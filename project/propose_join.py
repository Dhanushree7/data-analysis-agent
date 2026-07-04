import sys
import os
import json
import traceback
import io
import pandas as pd
from groq import Groq

# Set stdout encoding to utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def propose():
    try:
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Two file paths must be provided."}))
            return

        file_path1 = sys.argv[1]
        file_path2 = sys.argv[2]

        if not os.path.exists(file_path1) or not os.path.exists(file_path2):
            print(json.dumps({"error": "One or both files do not exist."}))
            return

        # Load metadata and schema for both files
        try:
            if file_path1.endswith('.xlsx') or file_path1.endswith('.xls'):
                df1 = pd.read_excel(file_path1, engine='openpyxl')
            else:
                df1 = pd.read_csv(file_path1)
                
            if file_path2.endswith('.xlsx') or file_path2.endswith('.xls'):
                df2 = pd.read_excel(file_path2, engine='openpyxl')
            else:
                df2 = pd.read_csv(file_path2)
        except Exception as e:
            print(json.dumps({"error": f"Failed to load datasets: {str(e)}"}))
            return

        cols1 = df1.columns.tolist()
        cols2 = df2.columns.tolist()
        
        types1 = df1.dtypes.astype(str).to_dict()
        types2 = df2.dtypes.astype(str).to_dict()

        # Simple schema summaries
        schema1 = {col: types1[col] for col in cols1}
        schema2 = {col: types2[col] for col in cols2}

        groq_api_key = os.environ.get("GROQ_API_KEY")
        if not groq_api_key:
            print(json.dumps({"error": "GROQ_API_KEY is not set."}))
            return

        client = Groq(api_key=groq_api_key)

        prompt = f"""You are an expert Data Integrator.
Analyze the columns, types, and sample columns of two datasets to see if they can be merged, joined, or compared.

Dataset 1 (df1):
- Total rows: {len(df1)}
- Columns and types: {json.dumps(schema1)}
- First row: {json.dumps(df1.head(1).to_dict(orient="records"), default=str)}

Dataset 2 (df2):
- Total rows: {len(df2)}
- Columns and types: {json.dumps(schema2)}
- First row: {json.dumps(df2.head(1).to_dict(orient="records"), default=str)}

Determine:
1. Is there a sensible join key? (e.g. overlapping ID column, identical named category columns with similar data types).
2. Or is a vertical comparison better? (e.g. same column structure representing different periods or segments).
3. If no logical join/compare is possible, explain why.

Output a JSON object matching this schema:
{{
  "joinable": true | false,
  "join_key": "overlapping_column_name_if_any" | null,
  "approach": "join" | "compare" | "none",
  "proposal_text": "A friendly, expert-level 2-3 sentence proposal explaining how these datasets can be analyzed together (e.g. 'Both files contain a \"region\" column. I can join them on \"region\" to enrich your sales data with regional manager profiles.')",
  "suggested_questions": [
    "A sample question referencing both files together",
    "Another sample question",
    "A third sample question"
  ]
}}

You MUST return ONLY the JSON object. Do not include markdown code wrappers or conversational text. Use response_format JSON.
"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2
        )

        print(response.choices[0].message.content, flush=True)

    except Exception as e:
        print(json.dumps({
            "error": f"Join proposal failed: {str(e)}",
            "traceback": traceback.format_exc()
        }))

if __name__ == "__main__":
    propose()
