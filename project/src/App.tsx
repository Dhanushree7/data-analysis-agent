import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Send,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  ArrowRight,
  Database,
  Terminal,
  Loader2,
  Lock,
  Compass,
  CheckCircle2,
  AlertCircle,
  FileDown,
  TrendingUp,
  Star,
  FileCode,
  FolderOpen,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Message, SampleDataset, FilePreview, Insight, JoinProposal } from "./types";
import { SamplePicker } from "./components/SamplePicker";
import { DatasetPreview } from "./components/DatasetPreview";
import { ChartRenderer } from "./components/ChartRenderer";
import { ReasoningTrace } from "./components/ReasoningTrace";

export default function App() {
  const [samples, setSamples] = useState<SampleDataset[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Proactive Insights state
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Multi-file join proposals
  const [joinProposal, setJoinProposal] = useState<JoinProposal | null>(null);
  const [loadingProposal, setLoadingProposal] = useState(false);

  // Show active tooltips for verification info
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sample datasets on mount
  useEffect(() => {
    fetch("/api/sample-datasets")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load sample datasets.");
        return res.json();
      })
      .then((data) => setSamples(data))
      .catch((err) => {
        console.error(err);
        setError("Could not retrieve sample datasets from server.");
      });
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Handle Drag Over
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Handle File Input Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Trigger proactive insights pass after a dataset is successfully loaded
  const fetchProactiveInsights = async (sessionId: string) => {
    setLoadingInsights(true);
    setInsights([]);
    try {
      const response = await fetch(`/api/insights/${sessionId}`);
      if (!response.ok) throw new Error("Insights failed.");
      const data = await response.json();
      if (data.insights) {
        setInsights(data.insights);
      }
    } catch (err) {
      console.error("Proactive insights failed to fetch:", err);
    } finally {
      setLoadingInsights(false);
    }
  };

  // Process and upload file (handles both first and additional files)
  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
      setError("Unsupported file format. Please upload a valid CSV or Excel (.xlsx, .xls) file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds the 10MB size limit. Please upload a smaller dataset.");
      return;
    }

    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const headers: Record<string, string> = {};
    if (selectedSessionId) {
      // Append additional file to the current session ID
      headers["x-session-id"] = selectedSessionId;
    } else {
      setPreview(null);
      setMessages([]);
      setInsights([]);
      setJoinProposal(null);
    }

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: headers,
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "File upload failed.");
      }

      const isNewSession = !selectedSessionId;
      setSelectedSessionId(data.session_id);
      setFileName(data.file_name);
      setPreview(data.preview);
      setAllFiles(data.all_files || [data.file_name]);
      
      if (isNewSession) {
        // Seed initial greeting message
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: `Successfully loaded **${data.file_name}**! 📊\n\nI have parsed the file and extracted its schema. I am ready to perform computations, answer your questions, group/aggregate columns, and draw charts directly from the data. Ask me anything in plain English!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        // Trigger proactive background analysis
        fetchProactiveInsights(data.session_id);
      } else {
        // Additional file uploaded
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Uploaded additional dataset: **${data.file_name}**! 📁\nBoth files are now active within this analysis sandbox. We can combine, compare, or join them directly using Python!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        // Trigger Join key inspection
        fetchJoinProposal(data.session_id);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during file upload.");
    } finally {
      setUploading(false);
    }
  };

  // Inspect relationships between uploaded datasets
  const fetchJoinProposal = async (sessionId: string) => {
    setLoadingProposal(true);
    setJoinProposal(null);
    try {
      const response = await fetch("/api/propose-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      });
      if (!response.ok) throw new Error("Join proposal failed.");
      const data = await response.json();
      if (data && data.proposal_text) {
        setJoinProposal(data);
      }
    } catch (err) {
      console.error("Failed to propose relationships:", err);
    } finally {
      setLoadingProposal(false);
    }
  };

  // Select a sample dataset
  const handleSelectSample = async (sampleId: string) => {
    setError(null);
    setUploading(true);
    setPreview(null);
    setMessages([]);
    setInsights([]);
    setJoinProposal(null);

    try {
      const sample = samples.find((s) => s.id === sampleId);
      if (!sample) throw new Error("Sample not found.");

      const response = await fetch(`/api/preview/${sampleId}`);
      const previewData = await response.json();

      if (!response.ok) {
        throw new Error(previewData.error || "Failed to load sample preview.");
      }

      setSelectedSessionId(sampleId);
      setFileName(sample.file_name);
      setPreview(previewData);
      setAllFiles([sample.file_name]);

      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Loaded sample dataset **${sample.label}**! ⚡\n\nI can run real-time aggregations, filter operations, compute means/totals, or plot charts from this data. Try choosing one of the suggested prompts below or ask any custom question!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      // Trigger proactive analysis
      fetchProactiveInsights(sampleId);
    } catch (err: any) {
      setError(err.message || "Failed to load sample dataset.");
    } finally {
      setUploading(false);
    }
  };

  // Submit Question to Agent
  const handleAskQuestion = async (text: string) => {
    if (!text.trim() || !selectedSessionId || loading) return;

    const userMsgText = text.trim();
    setInputText("");
    setError(null);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const historyPayload = messages
      .filter((m) => m.id !== "welcome" && !m.error)
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: m.content
      }));

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session_id: selectedSessionId,
          question: userMsgText,
          history: historyPayload
        })
      });

      const data = await response.json();

      if (response.status === 429) {
        throw new Error(data.error || "Too many requests. Please wait.");
      }

      if (!response.ok) {
        throw new Error(data.error || "The Agent failed to process your question.");
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        reasoning_steps: data.reasoning_steps || [],
        chart_data: data.chart_data || undefined,
        verification: data.verification || undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis.");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I ran into an error while analyzing this data. You can try adjusting your question or reviewing the schema on the left.",
          error: err.message || "Analysis failed.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Compile PDF Report via Backend
  const handleExportPDF = async () => {
    if (!selectedSessionId || generatingReport) return;
    setGeneratingReport(true);
    setError(null);

    // Extract all chart details from assistant responses
    const compiledCharts = messages
      .filter((m) => m.role === "assistant" && m.chart_data)
      .map((m) => m.chart_data);

    // Compile written narrative summaries
    const chatSummary = messages
      .filter((m) => m.id !== "welcome" && !m.error)
      .map((m) => `${m.role === "user" ? "User Question: " : "Agent Answer: "}${m.content}`)
      .join("\n\n");

    try {
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: selectedSessionId,
          title: `Executive Data Analysis Summary: ${fileName}`,
          summary: `This formal report compiles proactive findings, structured calculations, and visual charts processed for the dataset "${fileName}". All calculations were audited via double-pass execution.`,
          insights: insights,
          charts: compiledCharts,
          narrative_summary: chatSummary
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "PDF generation failed.");
      }

      if (data.download_url) {
        // Trigger file download
        const link = document.createElement("a");
        link.href = data.download_url;
        link.setAttribute("download", `Analysis_Report_${fileName}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate PDF report.");
    } finally {
      setGeneratingReport(false);
    }
  };

  // Quick Prompt Suggestions
  const getQuickPrompts = () => {
    if (!selectedSessionId) return [];
    if (selectedSessionId.includes("sales_data")) {
      return [
        "What are the total sales and profits per region?",
        "What is our most profitable product?",
        "Show a bar chart comparing sales by Category"
      ];
    }
    if (selectedSessionId.includes("survey")) {
      return [
        "Compare average job satisfaction by department",
        "What is the average salary and age of employees?",
        "Show a pie chart of employee distribution across departments"
      ];
    }
    if (selectedSessionId.includes("web_traffic")) {
      return [
        "Which marketing source generated the most conversions?",
        "Show a line chart comparing daily Visits by device",
        "What are the average bounce and conversion rates?"
      ];
    }
    
    if (preview) {
      const numericCols = preview.columns.filter(col => {
        const type = preview.col_types[col] || "";
        return type.includes("int") || type.includes("float");
      });
      const catCols = preview.columns.filter(col => {
        const type = preview.col_types[col] || "";
        return !type.includes("int") && !type.includes("float") && !type.includes("date");
      });

      const prompts = [`Summarize the entire dataset details.`];
      if (catCols.length > 0 && numericCols.length > 0) {
        prompts.push(`Show a bar chart of average ${numericCols[0]} grouped by ${catCols[0]}.`);
        prompts.push(`Which ${catCols[0]} had the highest total ${numericCols[0]}?`);
      } else if (numericCols.length > 0) {
        prompts.push(`What is the sum, mean, and maximum of ${numericCols[0]}?`);
      }
      return prompts.slice(0, 3);
    }
    return [];
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0F0F11] font-sans text-slate-200" id="main-container">
      
      {/* LEFT SIDEBAR: File Upload and Preview */}
      <aside className="w-80 bg-[#161618] border-r border-slate-800 flex flex-col shrink-0 h-full overflow-hidden">
        
        {/* App Branding */}
        <div className="p-6 border-b border-slate-800 bg-[#161618]">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            <h1 className="text-lg font-bold text-white tracking-tight">DataAgent.ai</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">Llama-3.3 Powered Analysis</p>
        </div>

        {/* Action Panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* File Upload Zone */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 block">
              {selectedSessionId ? "Add Comparison Dataset" : "Source Data"}
            </label>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all duration-250 bg-[#1C1C1F] ${
                dragActive
                  ? "border-emerald-500 bg-emerald-500/5 shadow-inner"
                  : "border-slate-700 hover:border-emerald-500/50"
              }`}
              id="dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center space-y-3">
                <div className={`p-2 rounded-full ${dragActive ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800/80 text-slate-400"} transition-colors`}>
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div className="text-xs text-slate-400 font-medium">
                  {uploading ? "Analyzing dataset..." : selectedSessionId ? "Drop second file here" : "Drop CSV or Excel"}
                </div>
                <div className="text-[10px] text-slate-600">
                  {selectedSessionId ? "Merge & run joined queries" : "Supports CSV, XLSX up to 10MB"}
                </div>
              </div>
            </div>
          </div>

          {/* Active Session Files list */}
          {selectedSessionId && allFiles.length > 0 && (
            <div className="bg-[#1C1C1F] border border-slate-800 rounded-lg p-4 space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Active Session Files</span>
              <div className="space-y-1.5">
                {allFiles.map((fn, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-emerald-400 font-medium bg-emerald-500/5 px-2.5 py-1.5 rounded border border-emerald-500/10 truncate">
                    <Database className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">df{idx + 1}: {fn}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Datasets */}
          {samples.length > 0 && !preview && (
            <SamplePicker
              samples={samples}
              onSelect={handleSelectSample}
              selectedId={selectedSessionId}
              loading={uploading}
            />
          )}

          {/* Dataset Preview Grid */}
          {preview && (
            <div className="flex-grow min-h-[350px] flex flex-col overflow-hidden">
              <DatasetPreview preview={preview} fileName={fileName} />
              
              {/* Reset Dataset Link */}
              <button
                onClick={() => {
                  setSelectedSessionId(null);
                  setPreview(null);
                  setFileName("");
                  setAllFiles([]);
                  setMessages([]);
                  setInsights([]);
                  setJoinProposal(null);
                }}
                className="mt-3 inline-flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 bg-slate-800/40 hover:bg-slate-800 transition-colors w-full cursor-pointer"
                id="reset-dataset"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                <span>Upload Different File</span>
              </button>
            </div>
          )}
        </div>

        {/* Global Security Disclaimer */}
        <div className="p-6 border-t border-slate-800 bg-[#161618] text-[10px] text-slate-500 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <span>System Status:</span>
            <span className="text-emerald-500 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Groq Llama-3.3 Online
            </span>
          </div>
          <div className="flex items-start gap-1.5 mt-1 border-t border-slate-800/60 pt-2 text-[9px] text-slate-600 leading-normal">
            <Lock className="h-3.5 w-3.5 mt-0.5 text-slate-700 shrink-0" />
            <span>
              In-memory sessions only. Spreadsheets live strictly on this instance and purge when the container sleeps.
            </span>
          </div>
        </div>
      </aside>

      {/* RIGHT SIDE: Chat Conversation Frame */}
      <main className="flex-grow flex flex-col h-full overflow-hidden bg-[#0F0F11]">
        
        {/* Chat Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-[#121214] shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#121214] flex items-center justify-center text-xs text-slate-300 font-semibold">DF</div>
              <div className="w-8 h-8 rounded-full bg-emerald-600 border-2 border-[#121214] flex items-center justify-center text-xs font-bold text-white">AI</div>
            </div>
            <span className="text-sm font-medium text-slate-200">
              {fileName ? `Session: Analysis of ${fileName} (${allFiles.length} files loaded)` : "New Session"}
            </span>
          </div>
          {fileName && (
            <div className="flex items-center gap-3">
              {/* Generate Report Button */}
              <button
                onClick={handleExportPDF}
                disabled={generatingReport || messages.length <= 1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed transition-all"
                title="Generates a customized ReportLab PDF outlining key proactive insights, rendered charts, and summaries"
              >
                {generatingReport ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Compiling PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="h-3.5 w-3.5" />
                    <span>Generate Report</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => {
                  setSelectedSessionId(null);
                  setPreview(null);
                  setFileName("");
                  setAllFiles([]);
                  setMessages([]);
                  setInsights([]);
                  setJoinProposal(null);
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Reset Session
              </button>
            </div>
          )}
        </header>

        {/* Error Banners */}
        {error && (
          <div className="bg-red-950/40 border-b border-red-900/50 text-red-300 px-6 py-3 flex items-start space-x-2 text-sm shrink-0">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 font-bold text-xs cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Chat History Container */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 bg-[#0F0F11]">
          
          {/* PROACTIVE INSIGHTS PANEL (DISPLAYED ABOVE CHAT AS A DISTINCT CARD) */}
          {selectedSessionId && (insights.length > 0 || loadingInsights) && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-[#1C1C1F] border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Proactive Key Insights</h3>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono px-2 py-0.5 rounded border border-emerald-500/20">
                    Auto-scanned
                  </span>
                </div>
                
                {loadingInsights ? (
                  <div className="flex items-center gap-2.5 text-xs text-slate-400 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    <span>Agent is running double-pass analysis scans to surface standout findings...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {insights.map((insight, idx) => {
                      const isWarning = insight.type === "warning";
                      const isTrend = insight.type === "trend";
                      return (
                        <div
                          key={idx}
                          onClick={() => handleAskQuestion(`Tell me more about: ${insight.title} (${insight.description})`)}
                          className={`group relative p-4 rounded-lg border text-left cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg bg-slate-900/40 ${
                            isWarning 
                              ? "border-red-900/30 hover:border-red-500/50" 
                              : isTrend 
                              ? "border-blue-900/30 hover:border-blue-500/50" 
                              : "border-emerald-900/30 hover:border-emerald-500/50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full shrink-0 ${
                              isWarning 
                                ? "bg-red-500/10 text-red-400" 
                                : isTrend 
                                ? "bg-blue-500/10 text-blue-400" 
                                : "bg-emerald-500/10 text-emerald-400"
                            }`}>
                              {isWarning ? (
                                <AlertCircle className="h-4 w-4" />
                              ) : isTrend ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <Star className="h-4 w-4" />
                              )}
                            </div>
                            <div className="space-y-1 overflow-hidden">
                              <h4 className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition-colors truncate">
                                {insight.title}
                              </h4>
                              <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                                {insight.description}
                              </p>
                              <div className="flex items-center gap-1.5 pt-1">
                                <span className="text-[9px] font-mono text-slate-500 truncate">Value: {insight.value}</span>
                                {insight.code && <FileCode className="h-3 w-3 text-slate-600 shrink-0" title="Query-backed metric" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MULTI-FILE RELATIONSHIP PROPOSAL */}
          {selectedSessionId && (joinProposal || loadingProposal) && (
            <div className="max-w-4xl mx-auto">
              <AnimatePresence>
                {loadingProposal ? (
                  <div className="bg-[#1C1C1F]/40 border border-slate-800 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    <span>Mapping structures of uploaded files to identify relationships...</span>
                  </div>
                ) : joinProposal ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-900/80 border border-emerald-500/20 rounded-xl p-5 space-y-3.5 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                    <div className="flex items-start gap-3">
                      <FolderOpen className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Multi-Dataset Relational Suggestion</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {joinProposal.proposal_text}
                        </p>
                      </div>
                    </div>
                    {joinProposal.suggested_questions && joinProposal.suggested_questions.length > 0 && (
                      <div className="flex flex-col gap-1.5 pl-8 pt-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Recommended Multi-File Queries:</span>
                        <div className="flex flex-col gap-1">
                          {joinProposal.suggested_questions.map((q, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleAskQuestion(q)}
                              className="text-left text-xs text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-2"
                            >
                              <ArrowRight className="h-3 w-3 shrink-0" />
                              <span>{q}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.length === 0 ? (
              /* Greeting / Hero Area when no file loaded */
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
                <div className="p-4 rounded-full bg-slate-900 border border-slate-800 text-emerald-400 shadow-xl">
                  <Compass className="h-8 w-8 animate-spin-slow" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    DataAgent.ai Terminal
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                    Upload a CSV or spreadsheet on the left, or pick a sample dataset to initialize the agent execution pipeline.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center justify-center text-[10px] font-mono text-slate-500 bg-[#161618] border border-slate-800/80 px-4 py-3 rounded-lg">
                  <span className="font-bold uppercase tracking-wider text-slate-400 mr-1">Trace Order:</span>
                  <span>Plan</span>
                  <span className="text-emerald-500">→</span>
                  <span>Pandas</span>
                  <span className="text-emerald-500">→</span>
                  <span>Render Chart</span>
                  <span className="text-emerald-500">→</span>
                  <span>Synthesis</span>
                </div>
              </div>
            ) : (
              /* Active Chat Thread */
              messages.map((msg) => {
                const isUser = msg.role === "user";
                const isCorrected = msg.verification?.status === "corrected";
                const displayContent = isCorrected && msg.verification?.corrected_answer ? msg.verification.corrected_answer : msg.content;
                
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-6 shadow-xl relative ${
                        isUser
                          ? "bg-slate-800/60 border border-slate-700 text-slate-100 rounded-br-none"
                          : msg.error
                          ? "bg-red-950/20 border border-red-900/40 text-slate-200 rounded-bl-none"
                          : "bg-[#1C1C1F] border border-slate-800 text-slate-200 rounded-bl-none"
                      }`}
                    >
                      {/* Message Sender / Time */}
                      <div className="flex items-center justify-between mb-3 text-[10px] opacity-75 text-slate-500">
                        <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          {!isUser && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                          {isUser ? "You" : "Data Agent"}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {/* SELF-VERIFICATION BADGE DISPLAY */}
                          {!isUser && msg.verification && (
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTooltipId(activeTooltipId === msg.id ? null : msg.id);
                                }}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                                  msg.verification.status === "corrected"
                                    ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/25"
                                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25"
                                }`}
                              >
                                {msg.verification.status === "corrected" ? (
                                  <>
                                    <AlertCircle className="h-3 w-3" />
                                    <span>Corrected Pass</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Verified</span>
                                  </>
                                )}
                              </button>
                              
                              {/* VERIFIER DISCREPANCY TOOLTIP DETAILS */}
                              {activeTooltipId === msg.id && (
                                <div className="absolute right-0 top-6 z-20 w-72 bg-slate-950 border border-slate-800 p-3.5 rounded-lg shadow-2xl space-y-2 text-slate-200 leading-normal">
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                    <span className="font-bold text-[10px] uppercase text-emerald-400">Independent Auditor Pass</span>
                                    <button 
                                      onClick={() => setActiveTooltipId(null)}
                                      className="text-slate-500 hover:text-white text-xs font-bold"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-slate-400">
                                    {msg.verification.explanation || "All statistical claims in this answer were verified against the raw dataset using double-pass computations."}
                                  </p>
                                  {msg.verification.original_claims && msg.verification.original_claims.length > 0 && (
                                    <div className="text-[9px] space-y-1">
                                      <span className="font-semibold block text-slate-500">Audited claims:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {msg.verification.original_claims.map((cl, cidx) => (
                                          <span key={cidx} className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded font-mono">
                                            {cl}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {msg.verification.status === "corrected" && (
                                    <div className="bg-red-500/5 border border-red-500/15 p-2 rounded text-[9px] text-red-300">
                                      <strong>Fact-check note:</strong> High-precision audit corrected discrepancy in the initial model's statistics.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <span className="font-mono">{msg.timestamp}</span>
                        </div>
                      </div>

                      {/* Text Narrative */}
                      <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans break-words prose prose-invert max-w-none">
                        {displayContent}
                      </div>

                      {/* Discrepancy comparison badge */}
                      {!isUser && isCorrected && (
                        <div className="mt-3 bg-red-500/5 border border-red-500/10 rounded-lg p-3 text-[11px] text-red-300 leading-normal flex items-start gap-2">
                          <Info className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                          <div>
                            <span className="font-bold">Fact-Checking Layer correction:</span> The main analysis agent claimed numbers that differed from the independent pandas double-check calculations. The verifier overrode and loaded the mathematically correct figures to guarantee statistical accuracy.
                          </div>
                        </div>
                      )}

                      {/* Optional Interactive Charts */}
                      {msg.chart_data && (
                        <div className="mt-4">
                          <ChartRenderer chart={msg.chart_data} />
                        </div>
                      )}

                      {/* Optional Expandable Reasoning Step Traces */}
                      {msg.reasoning_steps && msg.reasoning_steps.length > 0 && (
                        <ReasoningTrace steps={msg.reasoning_steps} />
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}

            {/* Thinking Loader State */}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="max-w-[85%] rounded-2xl p-5 bg-[#1C1C1F] border border-slate-800/80 shadow-2xl flex flex-col space-y-3 rounded-bl-none">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    <span>Agent is working...</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400 animate-pulse">
                      Planning computation paths, generating Pandas statements, and designing visuals...
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input Area */}
        <footer className="p-8 bg-[#121214] border-t border-slate-800 shrink-0">
          <div className="max-w-4xl mx-auto space-y-4">
            
            {/* Dynamic Suggestion Cards */}
            {selectedSessionId && getQuickPrompts().length > 0 && !loading && (
              <div className="flex flex-wrap gap-2">
                {getQuickPrompts().map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAskQuestion(prompt)}
                    className="inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-full border border-slate-850 bg-slate-800/20 text-xs font-medium text-slate-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400 transition-all cursor-pointer truncate max-w-[280px]"
                  >
                    <Compass className="h-3 w-3 shrink-0" />
                    <span>{prompt}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}

            {/* Main Chat Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskQuestion(inputText);
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                disabled={!selectedSessionId || loading}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  selectedSessionId
                    ? "Ask about your data (e.g. 'Show sales by product category...')"
                    : "Upload a CSV or Excel file on the left to start your inquiry..."
                }
                className="w-full bg-[#1C1C1F] border border-slate-700 rounded-xl px-6 py-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors pr-16 shadow-2xl disabled:opacity-30 disabled:cursor-not-allowed"
                id="question-input"
              />
              <button
                type="submit"
                disabled={!selectedSessionId || !inputText.trim() || loading}
                className="absolute right-3 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                id="submit-question"
              >
                <Send className="h-5 w-5 text-white" />
              </button>
            </form>

            <div className="mt-3 flex justify-center gap-6">
              <span className="text-[10px] text-slate-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span> Double-Pass Fact Check Active
              </span>
              <span className="text-[10px] text-slate-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span> Reasoning Trace Active
              </span>
              <span className="text-[10px] text-slate-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span> Auto-charting Enabled
              </span>
            </div>
          </div>
        </footer>

      </main>

    </div>
  );
}
