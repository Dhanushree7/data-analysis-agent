import sys
import os
import json
import pandas as pd
import numpy as np

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

def get_preview():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided."}))
        return

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File does not exist: {file_path}"}))
        return

    try:
        if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
            df = pd.read_excel(file_path, engine='openpyxl')
        else:
            df = pd.read_csv(file_path)

        columns = df.columns.tolist()
        col_types = df.dtypes.astype(str).to_dict()
        
        # Format preview rows using the robust serializer
        sample_rows = sanitize_for_json(df.head(10).to_dict(orient="records"))

        output = {
            "columns": columns,
            "col_types": col_types,
            "sample_rows": sample_rows,
            "total_rows": len(df),
            "total_columns": len(columns)
        }
        print(json.dumps(output, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": f"Failed to preview file: {str(e)}"}))

if __name__ == "__main__":
    get_preview()

