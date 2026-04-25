import { supabase } from "./supabase";
import { inviteHeaders } from "./invite";
import type { Brief, Classification, Report, VerifiedReport } from "./types";

export type ListedReport = Report & {
  classification: Classification | null;
  verified: VerifiedReport | null;
};

export type ListedProfile = {
  reporter_id: string;
  questions_earned: number;
  questions_used: number;
};

export type ListReportsResponse = {
  reports: ListedReport[];
  profile: ListedProfile | null;
};

export type GetReportResponse = {
  report: Report;
  classification: Classification | null;
  verified: VerifiedReport | null;
  brief: Brief | null;
  profile: ListedProfile | null;
};

// Wrap the invoke + error normalization once. Edge functions return a JSON
// body with `error` on failure; supabase-js's `error` is set on non-2xx.
async function invokeJson<T>(
  fn: string,
  body: Record<string, unknown> = {},
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(fn, {
    body,
    headers: inviteHeaders(),
  });
  if (error) {
    let serverMessage: string | null = null;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.clone === "function") {
      try {
        const parsed = await ctx.clone().json();
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          serverMessage = String((parsed as { error: unknown }).error);
        }
      } catch {
        // fall through to error.message
      }
    }
    return { data: null, error: serverMessage ?? error.message };
  }
  return { data: (data as T) ?? null, error: null };
}

export function listReports(args: {
  reporter_id?: string;
  since_ms?: number;
  limit?: number;
} = {}) {
  return invokeJson<ListReportsResponse>("list-reports", args);
}

export function getReport(id: string, reporter_id?: string) {
  return invokeJson<GetReportResponse>("get-report", { id, reporter_id });
}

export type SubmitReportInput = {
  reporter_id: string;
  photo_url: string;
  lon: number;
  lat: number;
  heading_degrees: number;
  location_accuracy_m?: number | null;
  captured_at: string;
  caption?: string | null;
  status?: string;
};

export function submitReport(input: SubmitReportInput) {
  return invokeJson<{ id: string }>("submit-report", input as unknown as Record<string, unknown>);
}
