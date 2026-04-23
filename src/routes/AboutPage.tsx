import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">VYou</h1>
      <p className="text-white/70">
        A community-fed situational weather map. A sky photo becomes a directional, AI-verified weather report on a shared map.
      </p>
      <p className="text-sm text-white/50">
        Built for the Built with Opus 4.7 Claude Code hackathon, 2026-04-21 to 2026-04-26. Code under MIT; community-contributed report content under CC-BY-4.0.
      </p>
      <Link to="/" className="self-start rounded-full bg-white/10 px-4 py-2 text-sm">
        Back to map
      </Link>
    </div>
  );
}
