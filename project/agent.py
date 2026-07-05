import sys
import os
import json
import traceback
import io
import re
import pandas as pd
import numpy as np
from groq import Groq

# Set stdout encoding to utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def sanitize_for_json(val):
    if val is None:
        return None
    if isinstance(val, dict):
        return {str(k): sanitize_for_json(v) for k, v in val.items()}
    if isinstance(val, (list, tuple, set, np.ndarray)):
        return [sanitize_for_json(item) for item in val]
    if isinstance(val, pd.Series):
        return sanitize_for_json(json.loads(val.to_json(date_format='iso')))
    if isinstance(val, pd.DataFrame):
        return sanitize_for_json(json.loads(val.to_json(date_format='iso', orient='records')))
    
    # Check for pandas/numpy/python scalars
    if pd.isnull(val):
        return None
    
    import datetime
    if isinstance(val, (datetime.datetime, datetime.date, pd.Timestamp)):
        return val.isoformat()
    if isinstance(val, np.datetime64):
        ts = pd.Timestamp(val)
        if pd.isnull(ts):
            return None
        return ts.isoformat()
    if isinstance(val, np.integer):
        return int(val)
    if isinstance(val, np.floating):
        if np.isnan(val) or np.isinf(val):
            return None
        return float(val)
    if isinstance(val, np.bool_):
        return bool(val)
    return val

def run_pandas_query(code, dataframes_dict):
    """
    Executes pandas code in a sandboxed context with all loaded dataframes injected.
    Expects 'result' to be set in the code execution.
    """
    local_vars = {
        "pd": pd,
        "np": np,
        "result": None
    }
    # Inject all dataframes (df, df1, df2, and sanitized custom names)
    local_vars.update(dataframes_dict)
    
    # Capture standard output during execution
    stdout_capture = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = stdout_capture
    
    try:
        # Run the code
        exec(code, {}, local_vars)
        sys.stdout = old_stdout
        
        output_str = stdout_capture.getvalue()
        result = local_vars.get("result")
        
        # Format the result elegantly
        if result is not None:
            if isinstance(result, (pd.DataFrame, pd.Series)):
                result_str = result.to_string()
            else:
                result_str = str(result)
            result_json = sanitize_for_json(result)
        else:
            result_str = "Code executed successfully. No 'result' variable was assigned."
            result_json = None
            
        return {
            "success": True,
            "stdout": output_str.strip(),
            "result_str": result_str.strip(),
            "result_json": result_json
        }
    except Exception as e:
        sys.stdout = old_stdout
        error_msg = f"{type(e).__name__}: {str(e)}"
        return {
            "success": False,
            "error": error_msg
        }

def sanitize_var_name(filename):
    """
    Sanitizes a filename to a valid python variable name.
    """
    name = os.path.splitext(filename)[0]
    name = re.sub(r'[^a-zA-Z0-9]', '_', name)
    if not re.match(r'^[a-zA-Z_]', name):
        name = '_' + name
    return name.lower()

def verify_answer(final_answer, question, dataframes_dict, client):
    """
    Runs an independent second verification pass on the numeric claims of the answer.
    """
    # Only verify if there is at least one digit in the final answer
    if not re.search(r'\d', final_answer):
        return {
            "status": "success",
            "explanation": "No numeric claims detected in final answer.",
            "original_claims": [],
            "verified_claims": []
        }

    # Format small summary schemas for the verifier
    schemas = ""
    for k, v in dataframes_dict.items():
        if k.startswith("df") and k != "df": # df1, df2, etc.
            schemas += f"Variable `{k}`: {len(v)} rows. Columns: {list(v.columns)}\n"

    system_prompt = f"""You are an independent statistical verifier agent.
Your sole job is to audit and double-check all numeric, percentage, counting, or statistical claims in the draft answer against the raw datasets.
You must NEVER guess or blindly accept any numbers in the draft answer.
Instead, write and execute pandas queries to calculate every statistic, average, sum, percentage, or count mentioned in the draft answer.

Available dataset variables:
{schemas}

INSTRUCTIONS:
1. Identify each quantitative/numeric claim in the draft answer (e.g. '$12,450', '23%', '12 items').
2. Call `run_pandas_query` to re-calculate each value yourself.
3. Compare your calculated values with the claims in the draft answer.
4. If your calculations match all claims in the draft answer, return a JSON response with status 'success'.
5. If any calculation does NOT match (i.e. there is a discrepancy), you MUST write a corrected_answer that replaces the wrong numbers with the correct ones. Return a JSON response with status 'corrected', explaining the exact discrepancy and what was corrected.

JSON response schema:
{{
  "status": "success" | "corrected",
  "explanation": "Brief explanation of what was verified, and any discrepancies found.",
  "original_claims": ["list of numeric claims identified in the draft"],
  "verified_claims": ["list of claims that were confirmed or corrected"],
  "corrected_answer": "Full corrected narrative text. Keep the style and tone identical to the draft, but with the correct figures. Only set this if status is 'corrected'."
}}

Respond ONLY with the JSON object. Do not include markdown code wrappers or other text in your final response. Use response_format JSON.
"""
    
    verifier_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"User question was: {question}\n\nDraft Answer to verify:\n{final_answer}"}
    ]

    tools = [
        {
            "type": "function",
            "function": {
                "name": "run_pandas_query",
                "description": "Runs a Python/pandas code block against the loaded DataFrames. Define a 'result' variable.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "The exact python pandas code snippet to execute. Must define a 'result' variable."
                        }
                    },
                    "required": ["code"]
                }
            }
        }
    ]

    # Verification tool loop (up to 3 turns)
    for turn in range(3):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=verifier_messages,
                tools=tools,
                tool_choice="auto",
                temperature=0.1
            )
        except Exception as e:
            return {
                "status": "success",
                "explanation": f"Verifier failed to run: {str(e)}",
                "original_claims": [],
                "verified_claims": []
            }

        resp_msg = response.choices[0].message
        verifier_messages.append(resp_msg)

        if not resp_msg.tool_calls:
            break

        for tool_call in resp_msg.tool_calls:
            code = json.loads(tool_call.function.arguments).get("code")
            res = run_pandas_query(code, dataframes_dict)
            
            verifier_messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": "run_pandas_query",
                "content": json.dumps({
                    "status": "success" if res["success"] else "error",
                    "stdout": res.get("stdout", ""),
                    "result": res.get("result_str", ""),
                    "error": res.get("error", "")
                })
            })

    try:
        final_response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=verifier_messages,
            response_format={"type": "json_object"},
            temperature=0.1
        )
        return json.loads(final_response.choices[0].message.content)
    except Exception as e:
        return {
            "status": "success",
            "explanation": f"Failed to parse verifier output: {str(e)}",
            "original_claims": [],
            "verified_claims": []
        }

def analyze():
    try:
        # Read parameters from stdin
        input_str = sys.stdin.read()
        if not input_str:
            print(json.dumps({"error": "No input provided through stdin"}), flush=True)
            return

        params = json.loads(input_str)
        file_path = params.get("file_path")
        file_paths_param = params.get("file_paths", [])
        question = params.get("question")
        history = params.get("history", [])

        # Build consistent list of files
        files_to_load = []
        if file_paths_param:
            files_to_load = file_paths_param
        elif file_path:
            files_to_load = [{"path": file_path, "name": os.path.basename(file_path)}]

        if not files_to_load:
            print(json.dumps({"error": "No datasets loaded or session file not found."}), flush=True)
            return

        # Load datasets
        dataframes = {}
        schema_desc = "Available Datasets in Python Sandbox:\n"
        
        for idx, f_info in enumerate(files_to_load):
            f_path = f_info["path"]
            f_name = f_info["name"]
            
            if not os.path.exists(f_path):
                continue
                
            try:
                if f_path.endswith('.xlsx') or f_path.endswith('.xls'):
                    ldf = pd.read_excel(f_path, engine='openpyxl')
                else:
                    ldf = pd.read_csv(f_path)
            except Exception as e:
                print(json.dumps({"error": f"Failed to load dataset '{f_name}': {str(e)}"}), flush=True)
                return
                
            var_name = sanitize_var_name(f_name)
            dataframes[var_name] = ldf
            
            df_index = idx + 1
            dataframes[f"df{df_index}"] = ldf
            if df_index == 1:
                dataframes["df"] = ldf # default reference
                
            # Document schema
            schema_desc += f"\nDataset {df_index}: `{f_name}` (Available as: `{var_name}` or `df{df_index}`)\n"
            schema_desc += f"- Total rows: {len(ldf)}\n"
            schema_desc += f"- Columns:\n"
            for col, dtype in ldf.dtypes.astype(str).to_dict().items():
                schema_desc += f"  * `{col}` (type: {dtype})\n"
            schema_desc += f"  - Sample Rows:\n"
            schema_desc += json.dumps(sanitize_for_json(ldf.head(2).to_dict(orient="records")), indent=2) + "\n"

        # Check API key
        groq_api_key = os.environ.get("GROQ_API_KEY")
        if not groq_api_key:
            print(json.dumps({"error": "GROQ_API_KEY environment variable is not set."}), flush=True)
            return

        client = Groq(api_key=groq_api_key)

        # Define tools
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "run_pandas_query",
                    "description": "Runs a Python/pandas code block against the loaded DataFrames in 'dataframes'. "
                                   "Your code MUST calculate the answer and store it in a variable named 'result'. "
                                   "The pandas library is pre-imported as 'pd', numpy as 'np'. "
                                   "If multiple datasets are loaded, write pandas code using df1, df2, or their semantic names. "
                                   "Do not guess. Always compute numbers. Assign output to 'result'.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "code": {
                                "type": "string",
                                "description": "The exact python pandas code snippet to execute. Must define a 'result' variable."
                            }
                        },
                        "required": ["code"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "generate_chart",
                    "description": "Generates a chart for the UI. Call this when the user's request explicitly "
                                   "or implicitly asks for visual output (e.g., 'show a chart', 'compare sales', 'plot a trend'). "
                                   "Specify the chart_type (bar, line, or pie), the X column name, Y column name, "
                                   "and the actual data as a list of dictionaries.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "chart_type": {
                                "type": "string",
                                "enum": ["bar", "line", "pie"],
                                "description": "The type of chart to display."
                            },
                            "x": {
                                "type": "string",
                                "description": "The column name of the X-axis key (categories or dates)."
                            },
                            "y": {
                                "type": "string",
                                "description": "The column name of the Y-axis values."
                            },
                            "data": {
                                "type": "array",
                                "items": {
                                    "type": "object"
                                },
                                "description": "A list of dictionaries with the aggregated keys and values to plot."
                            }
                        },
                        "required": ["chart_type", "x", "y", "data"]
                    }
                }
            }
        ]

        system_prompt = f"""You are a professional, highly precise full-stack Data Analysis Agent.
Your job is to answer user questions about their uploaded dataset(s).
You must NEVER guess or fabricate any statistic, count, trend, average, or number.
Instead, you must write and execute real pandas code to compute the exact numbers, then explain them.

{schema_desc}

GUIDELINES FOR MULTI-FILE ANALYSIS:
- If there are multiple datasets (e.g., df1 and df2), you can merge/join them on their overlapping keys if appropriate.
- If no logical or safe join/comparison is possible (e.g., completely unrelated columns), clearly explain that to the user rather than forcing an incorrect merge.

GUIDELINES FOR CODE EXECUTION:
1. First PLAN your computational approach.
2. Call `run_pandas_query` with a python snippet that performs the calculations.
3. Your code MUST assign the final computed answer to a variable named `result`.
4. If code execution fails, fix your code and run again.
5. If visual charts are requested, call `generate_chart`.
6. Speak in a clear, friendly, and professional tone.
"""

        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            role = msg.get("role")
            content = msg.get("content")
            if role in ["user", "assistant"]:
                messages.append({"role": role, "content": content})
        
        messages.append({"role": "user", "content": question})

        reasoning_steps = []
        chart_data = None
        final_answer = None

        # Execute agentic loop (up to 5 turns)
        for turn in range(5):
            response = None
            last_error = None
            # Retry once on the known Llama/Groq "tool_use_failed" glitch, where the
            # model emits a raw <function=...> text block instead of a structured tool_call.
            for attempt in range(2):
                try:
                    response = client.chat.completions.create(
                        model="llama-3.3-70b-versatile",
                        messages=messages,
                        tools=tools,
                        tool_choice="auto",
                        temperature=0.1
                    )
                    break
                except Exception as e:
                    last_error = e
                    err_str = str(e)
                    if "tool_use_failed" in err_str and attempt == 0:
                        # Nudge the model with a stricter reminder and retry once.
                        messages.append({
                            "role": "user",
                            "content": "Reminder: you must call the run_pandas_query or generate_chart "
                                       "function using the structured tool-calling format only. "
                                       "Do not write out a <function=...> block as plain text."
                        })
                        continue
                    break

            if response is None:
                print(json.dumps({"error": f"Groq API completion error: {str(last_error)}"}), flush=True)
                return

            response_message = response.choices[0].message
            content = response_message.content
            tool_calls = response_message.tool_calls

            messages.append(response_message)

            if not tool_calls:
                final_answer = content
                break

            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)

                if function_name == "run_pandas_query":
                    code = function_args.get("code")
                    query_result = run_pandas_query(code, dataframes)
                    
                    step_info = {
                        "type": "code",
                        "title": f"Executed Pandas Code (Turn {turn + 1})",
                        "code": code,
                        "success": query_result["success"]
                    }
                    if query_result["success"]:
                        step_info["stdout"] = query_result["stdout"]
                        step_info["result_str"] = query_result["result_str"]
                        tool_response_content = json.dumps({
                            "status": "success",
                            "stdout": query_result["stdout"],
                            "result": query_result["result_str"]
                        })
                    else:
                        step_info["error"] = query_result["error"]
                        tool_response_content = json.dumps({
                            "status": "error",
                            "error": query_result["error"],
                            "tip": "Review column names or syntax and retry."
                        })
                    reasoning_steps.append(step_info)
                    
                elif function_name == "generate_chart":
                    chart_type = function_args.get("chart_type")
                    x = function_args.get("x")
                    y = function_args.get("y")
                    chart_data_list = function_args.get("data")
                    
                    chart_data = {
                        "type": chart_type,
                        "x": x,
                        "y": y,
                        "data": chart_data_list
                    }
                    
                    step_info = {
                        "type": "chart",
                        "title": "Generated Visualization Chart",
                        "chart_type": chart_type,
                        "x": x,
                        "y": y,
                        "success": True,
                        "data_preview": chart_data_list[:3] if isinstance(chart_data_list, list) else []
                    }
                    reasoning_steps.append(step_info)
                    
                    tool_response_content = json.dumps({
                        "status": "success",
                        "message": f"Chart generated."
                    })
                else:
                    tool_response_content = json.dumps({"status": "error", "error": f"Unknown tool: {function_name}"})

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": function_name,
                    "content": tool_response_content
                })

        if not final_answer:
            try:
                final_response = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages,
                    temperature=0.3
                )
                final_answer = final_response.choices[0].message.content
            except Exception:
                final_answer = "Could not compose final text answer. Please inspect the logs."

        # --- SELF-VERIFICATION PASS ---
        verification_payload = verify_answer(final_answer, question, dataframes, client)

        # Output the final compound payload
        output = {
            "answer": final_answer,
            "reasoning_steps": reasoning_steps,
            "chart_data": chart_data,
            "verification": verification_payload
        }
        print(json.dumps(sanitize_for_json(output), ensure_ascii=False, indent=2), flush=True)

    except Exception as e:
        print(json.dumps({
            "error": f"Internal agent error: {str(e)}",
            "traceback": traceback.format_exc()
        }), flush=True)

if __name__ == "__main__":
    analyze()
