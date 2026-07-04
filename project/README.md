# Data Analysis Agent

A full-stack agentic AI application that lets users upload a CSV or Excel file and ask questions about it in plain English. Instead of guessing answers from memory, the agent writes and executes real Python/Pandas code against the uploaded dataset, then explains the results conversationally.

**Tech stack:** React · TypeScript · Express · Python · Pandas · Groq (Llama 3.3)

---

## Overview

Most chatbots asked "what's the average revenue in this file?" will hallucinate a plausible-sounding number. This project avoids that by giving the LLM tool-calling access to a real Python execution sandbox — the model plans an approach, calls a function to run Pandas code on the actual data, reads the real output, and only then responds. If a query errors out, the agent inspects the error and retries with corrected code (up to 5 attempts).

## Features

- Upload CSV or Excel files (`.csv`, `.xlsx`, `.xls`) up to 10MB, with an instant schema and data preview
- Ask natural-language questions; the agent writes and runs Pandas code to answer them
- Multi-step reasoning with self-correction when a query fails
- Expandable "reasoning trace" showing the exact code executed for each answer
- Auto-generated bar, line, and pie charts (React Recharts) when a visual is requested
- A secondary fact-checking pass that independently verifies the main agent's numeric claims before they're shown
- Three preloaded sample datasets (sales, employee survey, web traffic) for quick testing
- Session-based rate limiting (1 request / 2 seconds) to avoid runaway API usage

## Architecture

```
User question
      │
      ▼
Planning step — reads the question + dataset schema
      │
      ▼
Execution loop (max 5 turns)
      │
      ├─ run_pandas_query(code) → runs in sandbox → captures result
      │       └─ on error: agent inspects, rewrites, retries
      │
      ├─ generate_chart(type, x, y, data) → builds chart spec (if requested)
      │
      ▼
Conversational summary — returned with code trace + charts
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS, Recharts, Framer Motion, Lucide Icons |
| Backend | Express (TypeScript/Node.js), Multer for file uploads |
| Agent core | Python 3, Pandas, Openpyxl, Groq SDK (`llama-3.3-70b-versatile`) |
| Session storage | In-memory, files kept under `/tmp/sessions` and cleared on restart |

## Getting Started

**Requirements:** Node.js 18+, Python 3.10+, pip

```bash
# 1. Install frontend/backend dependencies
npm install

# 2. Install Python dependencies
pip install pandas openpyxl groq

# 3. Configure secrets — create a .env file in the project root
GROQ_API_KEY="your-groq-api-key-here"

# 4. Start the dev server
npm run dev
```

Then open `http://localhost:3000`.

> **Note (Windows):** if you hit a `spawn python3 ENOENT` or "Python was not found" error, your system likely resolves Python through the `py` launcher instead of `python3`. Update the `spawn(...)` calls in `server.ts` to use `"py"` instead.

Get a free Groq API key at [console.groq.com](https://console.groq.com/).
