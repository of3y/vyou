// Cohort-bound auth token. The tester receives a URL like
// https://vyou.app/?invite=<token>; we persist the token to localStorage on
// first visit and attach it to every paid edge-function invoke.

const STORAGE_KEY = "vyou_invite";
const URL_PARAM = "invite";
export const INVITE_HEADER = "x-vyou-invite";

export function captureInviteFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get(URL_PARAM);
  if (fromUrl) {
    window.localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  return window.localStorage.getItem(STORAGE_KEY);
}

export function getInviteToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function inviteHeaders(): Record<string, string> {
  const token = getInviteToken();
  return token ? { [INVITE_HEADER]: token } : {};
}

export function hasInvite(): boolean {
  return getInviteToken() !== null;
}
