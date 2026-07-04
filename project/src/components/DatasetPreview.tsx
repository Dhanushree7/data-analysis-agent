import React, { useState } from "react";
import { FilePreview } from "../types";
import { Table, Eye, EyeOff, Tag, ListFilter } from "lucide-react";

interface DatasetPreviewProps {
  preview: FilePreview;
  fileName: string;
}

export const DatasetPreview: React.FC<DatasetPreviewProps> = ({ preview, fileName }) => {
  const [showAllRows, setShowAllRows] = useState(false);
  const rowsToDisplay = showAllRows ? preview.sample_rows : preview.sample_rows.slice(0, 5);

  return (
    <div className="flex flex-col h-full overflow-hidden border border-slate-800 bg-[#1C1C1F] shadow-lg rounded-xl" id="dataset-preview">
      {/* File Header Details */}
      <div className="border-b border-slate-800 bg-[#121214] px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <Table className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-sm text-slate-200 truncate" title={fileName}>
            {fileName}
          </span>
        </div>
        <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
          <span>{preview.total_rows.toLocaleString()} rows</span>
          <span className="text-slate-700">|</span>
          <span>{preview.total_columns} cols</span>
        </div>
      </div>

      {/* Column Schema/Metadata Panel */}
      <div className="px-4 py-3 border-b border-slate-800 bg-[#1C1C1F]">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 flex items-center space-x-1.5">
          <Tag className="h-3 w-3 text-emerald-500/80" />
          <span>Schema (Column Types)</span>
        </h4>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
          {preview.columns.map((col) => {
            const type = preview.col_types[col] || "object";
            let colorClass = "bg-slate-800/50 text-slate-300 border-slate-700/50";
            if (type.includes("int") || type.includes("float")) {
              colorClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            } else if (type.includes("date") || type.includes("time")) {
              colorClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
            } else if (type.includes("bool")) {
              colorClass = "bg-violet-500/10 text-violet-400 border-violet-500/20";
            }
            return (
              <span
                key={col}
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border font-mono ${colorClass}`}
              >
                <span className="font-medium mr-1 truncate max-w-[120px]">{col}:</span>
                <span className="opacity-80 text-[10px]">{type}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Tabular Preview */}
      <div className="flex-1 overflow-auto bg-[#1C1C1F]">
        <table className="w-full border-collapse text-left text-xs text-slate-400">
          <thead className="sticky top-0 bg-[#121214]/95 backdrop-blur-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 z-10 text-[10px]">
            <tr>
              {preview.columns.map((col) => (
                <th key={col} className="px-4 py-2.5 text-left font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 bg-[#1C1C1F]">
            {rowsToDisplay.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                {preview.columns.map((col) => {
                  const val = row[col];
                  const formattedVal = val === null || val === undefined 
                    ? <span className="text-slate-600 italic">null</span> 
                    : String(val);
                  return (
                    <td key={col} className="px-4 py-2 font-mono text-slate-300 border-b border-slate-800/40 whitespace-nowrap overflow-hidden max-w-[200px] truncate">
                      {formattedVal}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer controls to toggle preview density */}
      {preview.sample_rows.length > 5 && (
        <div className="border-t border-slate-800 bg-[#121214]/60 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Showing {rowsToDisplay.length} of {preview.sample_rows.length} preview rows
          </span>
          <button
            onClick={() => setShowAllRows(!showAllRows)}
            className="inline-flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold hover:text-emerald-300 transition-colors cursor-pointer"
          >
            {showAllRows ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                <span>Show less</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                <span>Show all preview rows</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
