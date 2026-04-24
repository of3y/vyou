export type ReportStatus = "pending" | "accepted" | "rejected" | "review";

export type Report = {
  id: string;
  reporter_id: string;
  photo_url: string | null;
  lon: number;
  lat: number;
  heading_degrees: number;
  heading_accuracy_m: number | null;
  captured_at: string;
  submitted_at: string;
  caption: string | null;
  status: ReportStatus;
};

export type Confidence = "low" | "medium" | "high";

export type SessionStats = {
  session_id: string;
  agent_id: string;
  skill_id: string | null;
  skill_version: string | number | null;
  model: string;
  duration_ms: number | null;
  usage: Record<string, number> | null;
  cost_usd: number | null;
};

export type Classification = {
  id: string;
  report_id: string;
  agent: "classifier";
  phenomenon: string | null;
  features: string[] | null;
  hail_size_cm: number | null;
  confidence: Confidence | null;
  session_stats: SessionStats | null;
  created_at: string;
};

export type VerifiedReport = {
  id: string;
  report_id: string;
  classification_id: string;
  radar_frame_url: string | null;
  verdict: "match" | "mismatch" | "inconclusive";
  rationale: string | null;
  confidence: Confidence | null;
  session_stats: SessionStats | null;
  created_at: string;
};
