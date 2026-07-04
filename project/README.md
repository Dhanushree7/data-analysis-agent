# Data Analysis Agent — Agentic AI Web Application

A full-stack, production-ready **Agentic AI Web Application** that empowers users to upload CSV or Excel files and ask complex questions in plain English. 

Unlike standard chatbots that attempt to guess or hallucinate statistics from their training memory, this system acts as a true **AI Agent**: it plans its logical approach, writes real Python/Pandas code, executes it in a sandbox against the actual uploaded dataset, captures the results, optionally triggers visualization charts, and explains the answers conversationally.

---

## 🚀 Key Features

- **Robust File Ingress**: Upload CSV and Excel (`.xlsx`, `.xls`) files up to 10MB.
- **Instant Previews**: Automatically extracts dataset structures, column data types, row counts, and previews the first few records.
- **True Agentic Tool-calling**: Powered by Groq's `llama-3.3-70b-versatile` utilizing structural tool/function calling with:
  - `run_pandas_query(code: str)`: Executes a Python/pandas code block on the dataset.
  - `generate_chart(chart_type: str, x: str, y: str, data: list)`: Generates structured chart data for visual reporting.
- **Multi-step Reasoning & Self-Correction**: The agent can run multiple queries sequentially. If a query fails (e.g., due to a key error or syntax issues), the agent catches the error, inspects it, rewrites the code, and retries.
- **Expandable Execution Trace**: Each agent reply includes a "Show reasoning" trace, showing exactly which lines of Pandas code were executed and what they outputted—building trust through computational accuracy.
- **Dynamic Charts**: Renders bar, line, and pie charts inline in the chat using responsive React Recharts.
- **Pre-loaded Samples**: Explore immediately with 3 preloaded datasets:
  - **Company Sales Performance** (Product sales, regions, profits).
  - **Employee Satisfaction Survey** (Salaries, job satisfaction, department data).
  - **Website Traffic & Conversions** (Ad traffic sources, bounce rates, daily revenue).
- **Session Rate Limiting**: Limit of 1 request per 2 seconds per session to prevent runaway API usage.

---

## 🏗️ Architecture Flow

```
[ User Question ]
       │
       ▼
[ Planning Step ] ──► Read User Question + Schema details (columns, types, sample data)
       │
       ▼
[ Execution Loop (Max 5 turns) ] <─────────────────────────┐
       │                                                   │
       ├──► Call run_pandas_query()                        │ (If error occurs,
       │    └─► Run code in Sandbox ──► Capture result     │  agent rewrites
       │                                                   │  & retries)
       ├──► Call generate_chart() (if visual requested)   │
       │    └─► Compile JSON Spec for Recharts             │
       │                                                   │
       └───────────────────────────────────────────────────┘
       │
       ▼
[ Final Conversational Summary ] ──► Returned to frontend with code traces & charts
```

---

## 🛠️ Tech Stack

- **Frontend**: React (v19) + Tailwind CSS + Lucide Icons + Framer Motion + Recharts (for responsive visualizations).
- **Backend API**: Express (TypeScript + Node.js) + Multer (for secure file uploads).
- **Agent Core**: Python (v3) + Pandas + Openpyxl (for Excel decoding) + official Groq SDK.
- **In-Memory Storage**: Session files are kept under `/tmp/sessions/` on the server and are automatically cleared when the container restarts.

---

## 💻 Local Installation & Setup

Ensure you have **Node.js (v18+)**, **Python (v3.10+)**, and **pip** installed.

### 1. Clone & Install Frontend / Backend Dependencies

```bash
# Clone the repository and navigate to root
npm install
```

### 2. Install Python Dependencies

```bash
pip install pandas openpyxl groq
```

### 3. Configure Secrets

Create a `.env` file at the root of the project:

```env
GROQ_API_KEY="your-groq-api-key-here"
```

*Note: You can obtain an API key from the [Groq Console](https://console.groq.com/).*

### 4. Run the Development Server

Start the full-stack server on port `3000`:

```bash
npm run dev
```

Open your browser and visit `http://localhost:3000` to interact with the Data Analysis Agent!

---

## 📊 Deployment

The app is fully optimized for Cloud Run deployment and container environments.
- **Production Compilation**:
  ```bash
  npm run build
  npm run start
  ```
- **Port Ingress**: The dev/start scripts are hardcoded to host `0.0.0.0` and port `3000` for seamless container routing.
