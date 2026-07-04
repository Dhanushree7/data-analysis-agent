# Data Analysis Agent

A full-stack agentic AI application that lets users upload a CSV or Excel file and ask questions about it in plain English. Instead of guessing answers from memory, the agent writes and executes real Python/Pandas code against the uploaded dataset, then explains the results conversationally.

**Tech stack:** React · TypeScript · Express · Python · Pandas · Groq (Llama 3.3)

---

## Table of Contents

- [Overview](#overview)
- [Why This Project](#why-this-project)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Sample Datasets](#sample-datasets)
- [API Endpoints](#api-endpoints)
- [Example Questions to Try](#example-questions-to-try)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [License](#license)

---

## Overview

Most chatbots asked "what's the average revenue in this file?" will hallucinate a plausible-sounding number. This project avoids that by giving the LLM tool-calling access to a real Python execution sandbox — the model plans an approach, calls a function to run Pandas code on the actual data, reads the real output, and only then responds. If a query errors out, the agent inspects the error and retries with corrected code (up to 5 attempts).

## Why This Project

Data analysis usually means one of two things: writing Pandas code by hand, or asking a general-purpose chatbot and hoping the numbers it gives back are actually correct. Neither is ideal for someone who just wants a quick, trustworthy answer about their own data.

This project explores a middle ground — an agent that reasons about *what* to compute, but never invents the *result*. Every number shown to the user comes from code that was actually executed against the real dataset, not from the language model's memory. A second, independent verification pass cross-checks the agent's own numeric claims before they reach the user, catching the rare case where the model's stated result doesn't match what its own code actually produced.

The goal was to build something closer to a real analyst's workflow: understand the question, write the query, run it, check the result, then explain it in plain language — rather than a black box that just outputs an answer.

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

## Project Structure

```
project/
├── agent.py                # Core agent loop: planning, tool-calling, self-correction
├── insights.py              # Generates dataset-level statistical insights
├── preview.py                # Reads an uploaded file and returns schema + row preview
├── propose_join.py           # Suggests join keys when two datasets are loaded together
├── generate_report.py        # Compiles a full analysis into a downloadable report
├── server.ts                 # Express API — upload handling, sessions, rate limiting
├── src/
│   ├── App.tsx                # Main chat UI and session state
│   ├── components/
│   │   ├── ChartRenderer.tsx    # Renders bar/line/pie charts from agent output
│   │   ├── DatasetPreview.tsx   # Shows schema, row count, sample rows
│   │   ├── ReasoningTrace.tsx   # Expandable view of executed Pandas code
│   │   └── SamplePicker.tsx     # Lets users load a preloaded sample dataset
│   ├── types.ts               # Shared TypeScript types
│   └── main.tsx                # React entry point
├── samples/                  # Preloaded CSV datasets for quick testing
├── .env.example               # Template for required environment variables
└── package.json
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

Get a free Groq API key at [console.groq.com](https://console.groq.com/).

## Sample Datasets

Three datasets are preloaded so you can try the agent immediately without uploading anything:

| Dataset | Description |
|---|---|
| Company Sales Performance | Product sales, regions, quantities, and profit margins |
| Employee Satisfaction Survey | Salaries, job satisfaction scores, department and work-life balance data |
| Website Traffic & Conversions | Daily traffic sources, bounce rates, conversions, and ad revenue |

You can also drop in a second file to compare or join two datasets in the same session.

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/sample-datasets` | Lists the preloaded sample datasets |
| `POST` | `/api/upload` | Uploads a CSV/Excel file and returns a schema + row preview |
| `GET` | `/api/preview/:sessionId` | Re-fetches the preview for an existing session |
| `POST` | `/api/insights` | Generates statistical insights for a loaded dataset |
| `POST` | `/api/propose-join` | Suggests join keys across two uploaded datasets |
| `POST` | `/api/generate-report` | Compiles a full report for the current session |
| `POST` | `/api/agent` | Sends a natural-language question to the agent and returns its answer |

## Example Questions to Try

- "Summarize the entire dataset."
- "Which region had the highest total profit?"
- "Show a bar chart of average units sold by product."
- "Is there a correlation between employee satisfaction and salary?"
- "What's the trend in website conversions over time?"

## Troubleshooting

**`spawn python3 ENOENT` or "Python was not found" (Windows)**
Windows often resolves Python through the `py` launcher rather than a `python3` command, and can sometimes intercept `python`/`python3` with a Microsoft Store stub instead of the real interpreter. If uploads or queries fail immediately after starting the server, update the `spawn(...)` calls in `server.ts` to use `"py"` instead of `"python3"`, and confirm `py --version` resolves correctly in your terminal.

**Upload fails with no clear error**
Check the terminal running `npm run dev` — errors from the Python subprocess (schema parsing, missing packages) are logged there even when the browser only shows a generic failure message.

**Rate limit / 429 errors**
The app limits requests to 1 every 2 seconds per session to avoid overloading the API. Wait a couple of seconds between questions.

## Future Improvements

- Persistent storage for sessions instead of in-memory/tmp files
- User authentication and saved session history
- Support for additional file formats (JSON, Parquet)
- Deployable one-click setup (Docker)

