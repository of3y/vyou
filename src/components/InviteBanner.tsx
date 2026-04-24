import { useEffect, useState } from "react";
import { hasInvite } from "../lib/invite";

export default function InviteBanner() {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(!hasInvite());
    const id = window.setInterval(() => setMissing(!hasInvite()), 2000);
    return () => window.clearInterval(id);
  }, []);

  if (!missing) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-100 backdrop-blur">
      You are not signed in to the VYou tester cohort. Open the full invite link
      you were sent (…/?invite=…) to unlock classification and reconciliation.
    </div>
  );
}
