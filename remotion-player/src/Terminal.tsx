import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

type Line = {
  prompt?: string;
  text: string;
  /** Frame at which this line starts typing. */
  startFrame: number;
  /** Frames it takes to fully type the line. */
  durationInFrames: number;
};

const LINES: Line[] = [
  { prompt: '$', text: 'echo "hello, remotion"', startFrame: 10, durationInFrames: 40 },
  { text: 'hello, remotion', startFrame: 55, durationInFrames: 1 },
  { prompt: '$', text: 'npm run dev', startFrame: 75, durationInFrames: 30 },
  { text: '  ➜  Local:   http://localhost:5173/', startFrame: 115, durationInFrames: 1 },
  { prompt: '$', text: '_', startFrame: 135, durationInFrames: 1 },
];

const typed = (text: string, frame: number, start: number, duration: number) => {
  if (frame < start) return '';
  if (duration <= 1) return text;
  const progress = interpolate(frame, [start, start + duration], [0, text.length], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return text.slice(0, Math.floor(progress));
};

export const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cursorVisible = Math.floor((frame / fps) * 2) % 2 === 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        padding: 48,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#111',
          border: '1px solid #2a2a2a',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            backgroundColor: '#1a1a1a',
            borderBottom: '1px solid #2a2a2a',
          }}
        >
          <span style={{ width: 12, height: 12, borderRadius: 6, background: '#ff5f56' }} />
          <span style={{ width: 12, height: 12, borderRadius: 6, background: '#ffbd2e' }} />
          <span style={{ width: 12, height: 12, borderRadius: 6, background: '#27c93f' }} />
          <span style={{ marginLeft: 12, color: '#888', fontSize: 13 }}>~/project — zsh</span>
        </div>

        <div
          style={{
            flex: 1,
            padding: 24,
            color: '#e5e5e5',
            fontSize: 22,
            lineHeight: 1.5,
            whiteSpace: 'pre',
          }}
        >
          {LINES.map((line, i) => {
            const visibleText = typed(line.text, frame, line.startFrame, line.durationInFrames);
            const isLast = i === LINES.length - 1;
            const isActive =
              frame >= line.startFrame && frame < line.startFrame + line.durationInFrames;
            const showCursor = (isActive || isLast) && cursorVisible;

            if (frame < line.startFrame) return null;

            return (
              <div key={i}>
                {line.prompt ? (
                  <span style={{ color: '#27c93f', marginRight: 8 }}>{line.prompt}</span>
                ) : null}
                <span>{visibleText}</span>
                {showCursor ? (
                  <span style={{ background: '#e5e5e5', color: '#111', marginLeft: 1 }}> </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
