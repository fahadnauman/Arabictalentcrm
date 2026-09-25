"use client";

import { useState, useRef, useCallback } from "react";

interface VoiceNotePlayerProps {
  src: string;
  isOutbound: boolean;
}

// Pre-calculated heights for 28 waveform bars mimicking WhatsApp
const WAVE_BARS = [
  6, 12, 18, 10, 22, 16, 26, 14, 8, 12, 24, 18, 10, 14, 28, 20, 15, 8, 12, 22, 18, 14, 8, 12, 16, 10, 6, 14
];

export default function VoiceNotePlayer({ src, isOutbound }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn("Audio playback error:", err);
      });
    }
  }, [isPlaying]);

  const toggleRate = useCallback(() => {
    if (!audioRef.current) return;
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  }, [playbackRate]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || !waveformRef.current || !duration) return;
      const rect = waveformRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const newTime = (clickX / rect.width) * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration]
  );

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const activeBarIndex = Math.floor(progress * WAVE_BARS.length);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.65rem",
        padding: "0.55rem 0.75rem",
        borderRadius: "16px",
        background: isOutbound ? "rgba(32, 201, 151, 0.12)" : "rgba(255, 255, 255, 0.08)",
        border: isOutbound ? "1px solid rgba(32, 201, 151, 0.25)" : "1px solid rgba(255, 255, 255, 0.12)",
        minWidth: "240px",
        maxWidth: "310px",
        userSelect: "none",
      }}
    >
      {/* Invisible HTML5 Audio element */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (d && !isNaN(d) && isFinite(d)) {
            setDuration(d);
          }
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      {/* Play / Pause circular button */}
      <button
        type="button"
        onClick={togglePlay}
        title={isPlaying ? "Pause" : "Play voice note"}
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          border: "none",
          outline: "none",
          transition: "transform 0.15s ease, background 0.15s ease",
          background: isOutbound ? "#20C997" : "rgba(255, 255, 255, 0.22)",
          color: isOutbound ? "#0e0d17" : "#ffffff",
          boxShadow: isOutbound ? "0 2px 8px rgba(32,201,151,0.3)" : "0 2px 6px rgba(0,0,0,0.2)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {isPlaying ? (
          /* Pause Icon */
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="2" />
            <rect x="14" y="4" width="4" height="16" rx="2" />
          </svg>
        ) : (
          /* Play Icon */
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "2px" }}>
            <path d="M7 4.5v15a1 1 0 0 0 1.55.83l12-7.5a1 1 0 0 0 0-1.66l-12-7.5A1 1 0 0 0 7 4.5z" />
          </svg>
        )}
      </button>

      {/* Waveform and scrubber */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 0 }}>
        <div
          ref={waveformRef}
          onClick={handleSeek}
          title="Click to seek"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            height: "28px",
            cursor: "pointer",
            padding: "2px 0",
          }}
        >
          {WAVE_BARS.map((height, idx) => {
            const isPlayed = idx <= activeBarIndex;
            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: `${height}px`,
                  borderRadius: "2px",
                  transition: "background 0.1s ease",
                  background: isPlayed
                    ? isOutbound
                      ? "#20C997"
                      : "#53bdeb"
                    : "rgba(255, 255, 255, 0.25)",
                }}
              />
            );
          })}
        </div>

        {/* Time display & rate badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.72rem",
            color: "rgba(255, 255, 255, 0.65)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>{isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}</span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {isPlaying && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRate();
                }}
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "1px 5px",
                  fontSize: "0.65rem",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
                title="Playback speed"
              >
                {playbackRate}x
              </button>
            )}

            {/* Mic Badge */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
