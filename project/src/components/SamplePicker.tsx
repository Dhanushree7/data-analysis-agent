import React from "react";
import { SampleDataset } from "../types";
import { Database, TrendingUp, Users, Globe } from "lucide-react";

interface SamplePickerProps {
  samples: SampleDataset[];
  onSelect: (sampleId: string) => void;
  selectedId: string | null;
  loading: boolean;
}

export const SamplePicker: React.FC<SamplePickerProps> = ({
  samples,
  onSelect,
  selectedId,
  loading
}) => {
  const getIconForSample = (id: string) => {
    if (id.includes("sales")) {
      return <TrendingUp className="h-4 w-4 text-emerald-400" />;
    } else if (id.includes("survey")) {
      return <Users className="h-4 w-4 text-amber-400" />;
    } else {
      return <Globe className="h-4 w-4 text-sky-400" />;
    }
  };

  return (
    <div className="space-y-3" id="sample-picker">
      <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center space-x-1.5">
        <Database className="h-3 w-3 text-emerald-500" />
        <span>Sample Datasets</span>
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {samples.map((sample) => {
          const isSelected = selectedId === sample.id;
          return (
            <button
              key={sample.id}
              disabled={loading}
              onClick={() => onSelect(sample.id)}
              className={`text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "bg-emerald-500/10 border-emerald-500/30 text-slate-200 shadow-md shadow-emerald-950/20"
                  : "bg-slate-800/20 border-slate-800/70 text-slate-300 hover:bg-slate-800/40 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? "bg-emerald-500/20" : "bg-slate-800/60"}`}>
                  {getIconForSample(sample.id)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold leading-snug">
                    {sample.label}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                    {sample.file_name}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {sample.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
