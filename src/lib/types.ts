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
