export interface ReasoningStep {
  type: "code" | "chart";
  title: string;
  code?: string;
  stdout?: string;
  result_str?: string;
  error?: string;
  chart_type?: "bar" | "line" | "pie";
  x?: string;
  y?: string;
  data_preview?: any[];
}

export interface ChartData {
  type: "bar" | "line" | "pie";
  x: string;
  y: string;
  data: Record<string, any>[];
}

export interface VerificationData {
  status: "success" | "corrected";
  explanation: string;
  original_claims: string[];
  verified_claims: string[];
  corrected_answer?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  reasoning_steps?: ReasoningStep[];
  chart_data?: ChartData;
  error?: string;
  verification?: VerificationData;
}

export interface FilePreview {
  columns: string[];
  col_types: Record<string, string>;
  sample_rows: Record<string, any>[];
  total_rows: number;
  total_columns: number;
  all_files?: string[];
}

export interface SampleDataset {
  id: string;
  label: string;
  description: string;
  file_name: string;
}

export interface Insight {
  type: "warning" | "trend" | "star";
  title: string;
  description: string;
  code?: string;
  value: string;
}

export interface JoinProposal {
  joinable: boolean;
  join_key: string | null;
  approach: "join" | "compare" | "none";
  proposal_text: string;
  suggested_questions: string[];
}
