import sys
import os
import json
import traceback
import io
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

def run_pandas_query(code, df):
    """
    Executes pandas code against the dataframe 'df' in a sandboxed execution context.
    Expects 'result' to be set in the code execution.
    """
    local_vars = {
        "df": df,
        "pd": pd,
        "np": np,
        "result": None
    }
    
    stdout_capture = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = stdout_capture
    
    try:
        exec(code, {}, local_vars)
        sys.stdout = old_stdout
        
        output_str = stdout_capture.getvalue()
        result = local_vars.get("result")
        
        if result is not None:
            if isinstance(result, (pd.DataFrame, pd.Series)):
                result_str = result.to_string()
            else:
                result_str = str(result)
            result_json = sanitize_for_json(result)
        else:
            result_str = "Code executed successfully."
            result_json = None
            
        return {
            "success": True,
            "stdout": output_str.strip(),
            "result_str": result_str.strip(),
            "result_json": result_json
        }
    except Exception as e:
        sys.stdout = old_stdout
        return {
            "success": False,
            "error": f"{type(e).__name__}: {str(e)}"
        }


def generate_insights():
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No file path provided."}))
            return

        file_path = sys.argv[1]
        if not os.path.exists(file_path):
            print(json.dumps({"error": f"File does not exist: {file_path}"}))
            return

        # Load dataset
        try:
            if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
                df = pd.read_excel(file_path, engine='openpyxl')
            else:
                df = pd.read_csv(file_path)
        except Exception as e:
            print(json.dumps({"error": f"Failed to load dataset: {str(e)}"}))
            return

        # Prepare dataset schema details
        columns = df.columns.tolist()
        col_types = df.dtypes.astype(str).to_dict()
        
        schema_desc = "Dataset Details:\n"
        for col, dtype in col_types.items():
            schema_desc += f"- `{col}` (type: {dtype})\n"
        schema_desc += f"\nTotal Rows: {len(df)}\n"
        schema_desc += f"Total Columns: {len(columns)}\n"
        schema_desc += f"\nSample Rows (First 3 rows):\n"
        schema_desc += json.dumps(sanitize_for_json(df.head(3).to_dict(orient="records")), indent=2)

        groq_api_key = os.environ.get("GROQ_API_KEY")
        if not groq_api_key:
            print(json.dumps({"error": "GROQ_API_KEY environment variable is not set."}))
            return

        client = Groq(api_key=groq_api_key)

        # We will use Groq to identify 3-5 insights. To do this, we'll run a tool loop.
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "run_pandas_query",
                    "description": "Runs pandas python code against 'df' to verify/calculate a statistical claim. Set 'result' variable.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "code": {
                                "type": "string",
                                "description": "Python snippet to run. Must assign to 'result'."
                            }
                        },
                        "required": ["code"]
                    }
                }
            }
        ]

        system_prompt = f"""You are a Proactive Dataset Insight Agent.
Your job is to scan the following dataset and generate 3 to 5 highly notable, specific findings (insights).
DO NOT guess or make up any numbers. You must write and run pandas queries to compute real, accurate statistics.

Types of findings to search for:
1. `warning`: Missing data issues, columns with high null counts, data type mismatches, or quality concerns.
2. `trend`: Strong linear trends, growth patterns, correlations between columns, or chronological patterns.
3. `star`: Notable outliers, highest/lowest performing category, extreme data points, or unique records.

Dataset details:
{schema_desc}

INSTRUCTIONS:
- First, write and execute pandas queries to check things like missing counts, correlations, outlier thresholds, or category aggregations.
- Run queries using `run_pandas_query`. If a query fails or returns nothing, fix your code and run again.
- Once you have completed your calculations and gathered real facts, output your final result as a JSON object matching this schema:
{{
  "insights": [
    {{
      "type": "warning" | "trend" | "star",
      "title": "Short title of the finding",
      "description": "Explanatory text describing the finding, including the exact calculated numbers, sums, counts, or percents.",
      "code": "The pandas python code you executed to prove/verify this exact finding",
      "value": "The specific value or statistic computed (e.g. '14.5% missing', '$120,400 outlier', etc.)"
    }}
  ]
}}

You MUST respond ONLY with the JSON object. Do not include conversational text or markdown code blocks in your final output. Use response_format JSON.
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Analyze the dataset and generate 3-5 Key Insights."}
        ]

        # Tool calling loop (up to 4 turns)
        for turn in range(4):
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                tools=tools,
                tool_choice="auto",
                temperature=0.1
            )
            
            resp_msg = response.choices[0].message
            messages.append(resp_msg)
            
            if not resp_msg.tool_calls:
                break
                
            for tool_call in resp_msg.tool_calls:
                args = json.loads(tool_call.function.arguments)
                code = args.get("code")
                
                res = run_pandas_query(code, df)
                
                tool_resp = {
                    "status": "success" if res["success"] else "error",
                    "stdout": res.get("stdout", ""),
                    "result": res.get("result_str", ""),
                    "error": res.get("error", "")
                }
                
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": "run_pandas_query",
                    "content": json.dumps(tool_resp)
                })

        # Final pass to get structured JSON
        final_response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.2
        )
        
        print(final_response.choices[0].message.content, flush=True)

    except Exception as e:
        print(json.dumps({
            "error": f"Insights generation failed: {str(e)}",
            "traceback": traceback.format_exc()
        }))

if __name__ == "__main__":
    generate_insights()
