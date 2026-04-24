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

export type Classification = {
  id: string;
  report_id: string;
  agent: "classifier";
  phenomenon: string | null;
  features: string[] | null;
  hail_size_cm: number | null;
  confidence: Confidence | null;
  created_at: string;
};
