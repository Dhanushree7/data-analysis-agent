import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import crypto from "crypto";
import { spawn } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Ensure temp session directory exists
const SESSIONS_DIR = "/tmp/sessions";
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Set up file storage via multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, SESSIONS_DIR);
  },
  filename: (req, file, cb) => {
    // If we have an existing session header, we keep the session id same
    const headerSessionId = req.headers["x-session-id"] as string;
    const sessionId = headerSessionId || crypto.randomUUID();
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${sessionId}_${cleanName}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".csv" || ext === ".xlsx" || ext === ".xls") {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only CSV and Excel (.xlsx, .xls) files are supported."));
    }
  }
});

app.use(express.json());

// Simple Rate Limiting: 1 request per 2 seconds per session/IP
const lastRequestTime = new Map<string, number>();

function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const sessionId = req.body.session_id || req.headers["x-session-id"] || req.ip || "global";
  const now = Date.now();
  const lastTime = lastRequestTime.get(sessionId as string);

  if (lastTime && now - lastTime < 2000) {
    res.status(429).json({
      error: "Rate limit exceeded. Please wait at least 2 seconds between questions to avoid overloading the agent."
    });
    return;
  }

  lastRequestTime.set(sessionId as string, now);
  next();
}

// Resolves a session ID to its file path on disk (or matches special sample datasets)
function getFilePathForSession(sessionId: string): string | null {
  if (sessionId.startsWith("sample_")) {
    const sampleName = sessionId.replace("sample_", "");
    const samplePath = path.resolve(process.cwd(), "samples", `${sampleName}.csv`);
    return fs.existsSync(samplePath) ? samplePath : null;
  }

  if (!fs.existsSync(SESSIONS_DIR)) return null;
  const files = fs.readdirSync(SESSIONS_DIR);
  const match = files.find(f => f.startsWith(sessionId));
  return match ? path.join(SESSIONS_DIR, match) : null;
}

// Returns all files matching a session ID
function getFilesForSession(sessionId: string): { path: string; name: string }[] {
  if (sessionId.startsWith("sample_")) {
    const sampleName = sessionId.replace("sample_", "");
    const samplePath = path.resolve(process.cwd(), "samples", `${sampleName}.csv`);
    if (fs.existsSync(samplePath)) {
      return [{ path: samplePath, name: `${sampleName}.csv` }];
    }
    return [];
  }

  if (!fs.existsSync(SESSIONS_DIR)) return [];
  const files = fs.readdirSync(SESSIONS_DIR);
  const matches = files.filter(f => f.startsWith(sessionId));
  return matches.map(f => {
    // f is like "${sessionId}_${originalName}"
    const originalName = f.slice(sessionId.length + 1);
    return {
      path: path.join(SESSIONS_DIR, f),
      name: originalName
    };
  });
}

// --- API ROUTES ---

// GET /api/sample-datasets
app.get("/api/sample-datasets", (req, res) => {
  res.json([
    {
      id: "sample_sales_data",
      label: "Company Sales Performance",
      description: "Product sales, quantities, regions, and profit margins.",
      file_name: "sales_data.csv"
    },
    {
      id: "sample_employee_survey",
      label: "Employee Satisfaction Survey",
      description: "Anonymized employee feedback, salaries, job satisfaction, and work-life balance.",
      file_name: "employee_survey.csv"
    },
    {
      id: "sample_web_traffic",
      label: "Website Traffic & Conversions",
      description: "Daily traffic statistics, bounce rates, conversions, and advertising performance.",
      file_name: "web_traffic.csv"
    }
  ]);
});

// POST /api/upload
app.post("/api/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Failed to upload file." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded." });
    }

    const filename = req.file.filename;
    const sessionId = filename.split("_")[0];
    const filePath = req.file.path;

    // Run preview.py to analyze the dataset structure and get first 10 rows
    const python = spawn("py", ["preview.py", filePath]);
    let output = "";
    let errorOutput = "";

    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error(`preview.py failed with code ${code}. Error: ${errorOutput}`);
        return res.status(500).json({ error: "Failed to generate file preview. Ensure the file is a valid CSV or Excel document." });
      }

      try {
        const previewData = JSON.parse(output);
        if (previewData.error) {
          return res.status(400).json({ error: previewData.error });
        }

        const allFiles = getFilesForSession(sessionId);

        res.json({
          session_id: sessionId,
          file_name: req.file?.originalname || "Uploaded File",
          preview: previewData,
          all_files: allFiles.map(f => f.name)
        });
      } catch (parseErr) {
        console.error("Failed to parse preview output:", parseErr, "Output was:", output);
        res.status(500).json({ error: "Internal server error reading dataset preview." });
      }
    });
  });
});

// GET /api/preview/:sessionId
app.get("/api/preview/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const filePath = getFilePathForSession(sessionId);

  if (!filePath) {
    return res.status(404).json({ error: "Session or dataset not found. Please upload your file again." });
  }

  const python = spawn("py", ["preview.py", filePath]);
  let output = "";
  let errorOutput = "";

  python.stdout.on("data", (data) => {
    output += data.toString();
  });

  python.stderr.on("data", (data) => {
    errorOutput += data.toString();
  });

  python.on("close", (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: "Failed to load preview." });
    }
    try {
      res.json(JSON.parse(output));
    } catch (err) {
      res.status(500).json({ error: "Failed to parse preview output." });
    }
  });
});

// GET /api/insights/:sessionId
app.get("/api/insights/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const sessionFiles = getFilesForSession(sessionId);

  if (sessionFiles.length === 0) {
    return res.status(404).json({ error: "Session or dataset not found." });
  }

  // Generate insights on the primary file
  const primaryFile = sessionFiles[0].path;

  const python = spawn("py", ["insights.py", primaryFile]);
  let output = "";
  let errorOutput = "";

  python.stdout.on("data", (data) => {
    output += data.toString();
  });

  python.stderr.on("data", (data) => {
    errorOutput += data.toString();
  });

  python.on("close", (code) => {
    if (code !== 0) {
      console.error(`insights.py failed with code ${code}. Error: ${errorOutput}`);
      return res.status(500).json({ error: "Failed to generate proactive insights." });
    }

    try {
      res.json(JSON.parse(output));
    } catch (err) {
      console.error("Failed to parse insights JSON. Raw:", output);
      res.status(500).json({ error: "Failed to parse proactive insights output." });
    }
  });
});

// POST /api/propose-join
app.post("/api/propose-join", (req, res) => {
  const { session_id } = req.body;
  if (!session_id) {
    return res.status(400).json({ error: "Missing session_id" });
  }

  const sessionFiles = getFilesForSession(session_id);
  if (sessionFiles.length < 2) {
    return res.status(400).json({ error: "At least two uploaded files are required to compare or join." });
  }

  const python = spawn("py", ["propose_join.py", sessionFiles[0].path, sessionFiles[1].path]);
  let output = "";
  let errorOutput = "";

  python.stdout.on("data", (data) => {
    output += data.toString();
  });

  python.stderr.on("data", (data) => {
    errorOutput += data.toString();
  });

  python.on("close", (code) => {
    if (code !== 0) {
      console.error(`propose_join.py failed with code ${code}. Error: ${errorOutput}`);
      return res.status(500).json({ error: "Failed to analyze datasets for a join key." });
    }

    try {
      res.json(JSON.parse(output));
    } catch (err) {
      console.error("Failed to parse join proposal JSON. Raw:", output);
      res.status(500).json({ error: "Failed to parse join proposal output." });
    }
  });
});

// POST /api/generate-report
app.post("/api/generate-report", (req, res) => {
  const { session_id, title, summary, insights, charts, narrative_summary } = req.body;
  if (!session_id) {
    return res.status(400).json({ error: "Missing session_id" });
  }

  const python = spawn("py", ["generate_report.py"]);
  const payload = JSON.stringify({
    session_id,
    title: title || "Executive Data Analysis Summary",
    summary: summary || "Automated deep dive analysis processed by DataAgent.ai.",
    insights: insights || [],
    charts: charts || [],
    narrative_summary: narrative_summary || ""
  });

  let stdoutData = "";
  let stderrData = "";

  python.stdin.write(payload);
  python.stdin.end();

  python.stdout.on("data", (data) => {
    stdoutData += data.toString();
  });

  python.stderr.on("data", (data) => {
    stderrData += data.toString();
  });

  python.on("close", (code) => {
    if (code !== 0) {
      console.error(`generate_report.py failed with code ${code}. Stderr: ${stderrData}`);
      return res.status(500).json({ error: "Failed to compile PDF report.", details: stderrData });
    }

    try {
      const result = JSON.parse(stdoutData);
      if (result.error) {
        return res.status(500).json({ error: result.error });
      }
      res.json({
        success: true,
        download_url: `/api/download-report/${session_id}`
      });
    } catch (err) {
      console.error("Failed to parse report path JSON. Raw stdout:", stdoutData);
      res.status(500).json({ error: "Failed to parse report path output." });
    }
  });
});

// GET /api/download-report/:sessionId
app.get("/api/download-report/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const pdfPath = path.join(SESSIONS_DIR, `${sessionId}_report.pdf`);
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).send("Report PDF not found. Please click 'Generate Report' first.");
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=DataAgent_Report_${sessionId}.pdf`);
  fs.createReadStream(pdfPath).pipe(res);
});

// POST /api/ask
app.post("/api/ask", rateLimiter, (req, res) => {
  const { session_id, question, history } = req.body;

  if (!session_id || !question) {
    return res.status(400).json({ error: "Missing session_id or question." });
  }

  const sessionFiles = getFilesForSession(session_id);
  if (sessionFiles.length === 0) {
    return res.status(404).json({ error: "Session or dataset not found. Please upload your file again to start a new analysis." });
  }

  // Ensure GROQ_API_KEY is available
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server. Please add it to the platform Secrets." });
  }

  // Spawn agent.py
  const python = spawn("py", ["agent.py"]);
  
  // Write parameters to stdin
  const inputPayload = JSON.stringify({
    file_paths: sessionFiles,
    question,
    history: history || []
  });

  let stdoutData = "";
  let stderrData = "";

  python.stdin.write(inputPayload);
  python.stdin.end();

  python.stdout.on("data", (data) => {
    stdoutData += data.toString();
  });

  python.stderr.on("data", (data) => {
    stderrData += data.toString();
  });

  python.on("close", (code) => {
    if (code !== 0) {
      console.error(`agent.py failed with code ${code}. Stderr: ${stderrData}`);
      return res.status(500).json({
        error: "The Data Analysis Agent encountered a server error during computation.",
        details: stderrData.substring(0, 500)
      });
    }

    try {
      const result = JSON.parse(stdoutData);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result);
    } catch (parseErr) {
      console.error("Failed to parse agent.py stdout:", parseErr, "Stdout was:", stdoutData);
      res.status(500).json({
        error: "Failed to parse computed agent response.",
        raw: stdoutData.substring(0, 500)
      });
    }
  });
});

// --- CLIENT SERVING ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
