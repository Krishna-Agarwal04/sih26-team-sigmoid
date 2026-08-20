"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Narration } from "@/lib/types";

function currentSentence(cues: number[], t: number): number {
  let index = 0;
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i]) index = i;
  }
  return index;
}

export default function NarrationPlayer({
  narration,
  audio,
}: {
  narration: Narration;
  audio: RefObject<HTMLAudioElement | null>;
}) {
  const [playing, setPlaying] = useState(false);
  const [spoken, setSpoken] = useState(0);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    const onTime = () => setSpoken(currentSentence(narration.cues, element.currentTime));
    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    element.addEventListener("timeupdate", onTime);
    element.addEventListener("play", onPlay);
    element.addEventListener("pause", onStop);
    element.addEventListener("ended", onStop);
    return () => {
      element.removeEventListener("timeupdate", onTime);
      element.removeEventListener("play", onPlay);
      element.removeEventListener("pause", onStop);
      element.removeEventListener("ended", onStop);
    };
  }, [audio, narration.cues]);

  useEffect(() => setSpoken(0), [narration.audioUrl]);

  if (narration.audioUrl === "") {
    return (
      <div className="border border-ink-faint/40 bg-paper-raised p-4">
        <p className="font-archive text-xs tracking-widest text-ink-faint uppercase">
          transcript only
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          This Narration has been written but not yet rendered to audio.
        </p>
        <div className="mt-3 space-y-2">
          {narration.sentences.map((sentence, i) => (
            <p key={i} className="text-sm leading-relaxed text-ink">
              {sentence}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-ink-faint/40 bg-paper-raised p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (playing ? audio.current?.pause() : audio.current?.play())}
          className="border border-madder px-4 py-2 text-sm text-madder hover:bg-madder hover:text-paper"
        >
          {playing ? "Pause" : "Play narration"}
        </button>
        <span className="font-archive text-xs text-ink-faint">
          {Math.round(narration.durationSec)}s &middot; {narration.persona} &middot; {narration.lang}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {narration.sentences.map((sentence, i) => (
          <p
            key={i}
            onClick={() => {
              if (audio.current) audio.current.currentTime = narration.cues[i] ?? 0;
            }}
            className={`cursor-pointer text-sm leading-relaxed ${
              i === spoken && playing ? "text-ink" : "text-ink-faint"
            }`}
          >
            {sentence}
          </p>
        ))}
      </div>
    </div>
  );
}
