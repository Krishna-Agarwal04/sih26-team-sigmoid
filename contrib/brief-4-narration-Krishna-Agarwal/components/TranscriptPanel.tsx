'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { NarrationPlayer } from '../lib/player';
import type { Narration } from '../lib/types';

export interface TranscriptPanelProps {
  narration: Narration;
  player?: NarrationPlayer;
  activeIndex?: number;
  className?: string;
}

export function TranscriptPanel({
  narration,
  player,
  activeIndex: externalActiveIndex,
  className = ''
}: TranscriptPanelProps) {
  const [internalActiveIndex, setInternalActiveIndex] = useState<number>(0);
  const sentenceRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const activeIndex = externalActiveIndex !== undefined ? externalActiveIndex : internalActiveIndex;

  useEffect(() => {
    if (!player) return;

    const unsubscribe = player.onSentence((index: number) => {
      setInternalActiveIndex(index);
    });

    return () => {
      unsubscribe();
    };
  }, [player]);

  useEffect(() => {
    const currentRef = sentenceRefs.current[activeIndex];
    if (currentRef) {
      currentRef.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [activeIndex]);

  return (
    <div
      className={`flex flex-col gap-3 p-4 overflow-y-auto max-h-96 rounded-lg bg-zinc-900 text-zinc-100 ${className}`}
    >
      {narration.sentences.map((sentence, index) => {
        const isActive = index === activeIndex;
        return (
          <p
            key={index}
            ref={(el) => {
              sentenceRefs.current[index] = el;
            }}
            className={`transition-colors duration-200 p-2 rounded text-base leading-relaxed ${
              isActive
                ? 'bg-amber-500/20 text-amber-300 font-medium border-l-4 border-amber-500 pl-3'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {sentence}
          </p>
        );
      })}
    </div>
  );
}

export default TranscriptPanel;
