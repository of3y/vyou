import { useEffect, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { Terminal } from './Terminal';

const DURATION_IN_FRAMES = 180;
const FPS = 30;

export const App: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('frameupdate', onFrame);
    return () => {
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('frameupdate', onFrame);
    };
  }, []);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) player.pause();
    else player.play();
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    playerRef.current?.seekTo(value);
  };

  const seconds = (frame / FPS).toFixed(2);
  const totalSeconds = (DURATION_IN_FRAMES / FPS).toFixed(2);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32, gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>Remotion Player — Terminal</h1>

      <div style={{ width: 960, maxWidth: '100%', borderRadius: 12, overflow: 'hidden' }}>
        <Player
          ref={playerRef}
          component={Terminal}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          compositionWidth={1920}
          compositionHeight={1080}
          style={{ width: '100%' }}
          controls={false}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: 960, maxWidth: '100%' }}>
        <button
          onClick={togglePlay}
          style={{
            padding: '8px 16px',
            background: '#27c93f',
            color: '#0a0a0a',
            border: 0,
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
            minWidth: 80,
          }}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={DURATION_IN_FRAMES - 1}
          value={frame}
          onChange={onSeek}
          style={{ flex: 1 }}
        />
        <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 96, textAlign: 'right', fontSize: 13, color: '#888' }}>
          {seconds}s / {totalSeconds}s
        </span>
      </div>
    </div>
  );
};
