import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { ChartData } from "../types";

interface ChartRendererProps {
  chart: ChartData;
}

// A professional, distinctive modern color palette for Elegant Dark
const COLORS = [
  "#10b981", // emerald
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#3b82f6"  // blue
];

export const ChartRenderer: React.FC<ChartRendererProps> = ({ chart }) => {
  const { type, x, y, data } = chart;

  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-slate-850 bg-[#121214] text-sm text-slate-500">
        No chart data available to plot.
      </div>
    );
  }

  // Ensure values on Y-axis are parsed as numbers for correct scaling
  const formattedData = data.map((item) => {
    const rawVal = item[y];
    let numVal = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
    if (isNaN(numVal)) {
      numVal = 0;
    }
    return {
      ...item,
      [x]: String(item[x] || ""),
      [y]: numVal
    };
  });

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-[#121214] p-5 shadow-inner" id="chart-container">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Visual Resource: {type.toUpperCase()} Chart ({x} vs {y})
        </h4>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart
              data={formattedData}
              margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.4} />
              <XAxis
                dataKey={x}
                tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#334155" }}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#334155" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#161618",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#f1f5f9",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)"
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
              <Bar dataKey={y} name={y} fill="#10b981" radius={[4, 4, 0, 0]}>
                {formattedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : type === "line" ? (
            <LineChart
              data={formattedData}
              margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.4} />
              <XAxis
                dataKey={x}
                tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#334155" }}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#334155" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#161618",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#f1f5f9",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)"
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
              <Line
                type="monotone"
                dataKey={y}
                name={y}
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 1, fill: "#10b981", stroke: "#0f0f11" }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={formattedData}
                dataKey={y}
                nameKey={x}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
                style={{ fontSize: "10px", fill: "#94a3b8", fontFamily: "Inter" }}
              >
                {formattedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#161618",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#f1f5f9",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)"
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
