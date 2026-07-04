import React, { useState } from "react";
import { ReasoningStep } from "../types";
import { ChevronDown, ChevronRight, Terminal, CheckCircle2, AlertCircle, BarChart3 } from "lucide-react";

interface ReasoningTraceProps {
  steps: ReasoningStep[];
}

export const ReasoningTrace: React.FC<ReasoningTraceProps> = ({ steps }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent collapsing the whole container
    setExpandedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-3 border border-slate-800 bg-[#121214] rounded-xl overflow-hidden" id="reasoning-trace">
      {/* Accordion Trigger for trace header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-semibold text-slate-400 hover:bg-slate-800/40 transition-colors cursor-pointer"
      >
        <span className="flex items-center space-x-2">
          <Terminal className="h-3.5 w-3.5 text-emerald-400" />
          <span>Agent Execution Trace ({steps.length} Steps)</span>
        </span>
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] text-slate-500 font-normal">
            {isOpen ? "Hide reasoning" : "Show reasoning"}
          </span>
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-800 px-4 py-3 space-y-2.5 bg-[#161618]">
          {steps.map((step, idx) => {
            const isStepExpanded = expandedSteps[idx] || false;
            const isChart = step.type === "chart";

            return (
              <div
                key={idx}
                className="border border-slate-800 bg-[#1C1C1F] rounded-lg overflow-hidden transition-all"
              >
                {/* Individual step title trigger */}
                <button
                  onClick={(e) => toggleStep(idx, e)}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-left text-xs font-medium text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    {isChart ? (
                      <BarChart3 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : step.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    )}
                    <span className="truncate">{step.title}</span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    {step.success ? (
                      <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-mono font-medium">
                        Success
                      </span>
                    ) : (
                      <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full font-mono font-medium">
                        Failed
                      </span>
                    )}
                    {isStepExpanded ? <ChevronDown className="h-3 w-3 text-slate-500" /> : <ChevronRight className="h-3 w-3 text-slate-500" />}
                  </div>
                </button>

                {isStepExpanded && (
                  <div className="px-3.5 pb-4 pt-1 border-t border-slate-800 bg-[#121214] space-y-3 text-xs font-mono">
                    {/* Render executed code */}
                    {step.code && (
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          Executed Code:
                        </div>
                        <pre className="bg-black/60 text-emerald-400 p-3 rounded-lg text-[11px] leading-relaxed overflow-x-auto whitespace-pre border border-slate-800/40">
                          {step.code}
                        </pre>
                      </div>
                    )}

                    {/* Render tool output result */}
                    {step.result_str && (
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          Output Result:
                        </div>
                        <pre className="bg-[#1C1C1F]/85 border border-slate-800 p-3 rounded-lg text-[10px] leading-relaxed text-slate-300 overflow-x-auto whitespace-pre max-h-40 overflow-y-auto">
                          {step.result_str}
                        </pre>
                      </div>
                    )}

                    {/* Render standard output logs */}
                    {step.stdout && (
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          Console Stdout:
                        </div>
                        <pre className="bg-[#1C1C1F]/40 border border-slate-800/60 p-3 rounded-lg text-[10px] leading-relaxed text-slate-400 overflow-x-auto whitespace-pre">
                          {step.stdout}
                        </pre>
                      </div>
                    )}

                    {/* Render error logs */}
                    {step.error && (
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold text-red-400 uppercase tracking-widest flex items-center space-x-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>Code Execution Error:</span>
                        </div>
                        <pre className="bg-red-950/20 border border-red-900/30 text-red-400 p-3 rounded-lg text-[11px] leading-relaxed overflow-x-auto whitespace-pre">
                          {step.error}
                        </pre>
                      </div>
                    )}

                    {/* Render chart parameters */}
                    {isChart && step.chart_type && (
                      <div className="grid grid-cols-2 gap-2 font-sans bg-[#1C1C1F] p-3 rounded-lg border border-slate-800">
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase tracking-wider">Chart Type</span>
                          <span className="text-xs font-semibold text-slate-200">{step.chart_type}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase tracking-wider">Axes Plot</span>
                          <span className="text-xs font-semibold text-slate-200">
                            X: {step.x} | Y: {step.y}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
