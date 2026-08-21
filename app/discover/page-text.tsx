"use client";

import { useEffect, useRef } from "react";

// the passage lights up in the page's own text, so a reader can check the claim against the scan
export default function PageText({
  text,
  highlight,
}: {
  text: string;
  highlight: [number, number] | null;
}) {
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight]);

  const usable = highlight !== null && highlight[1] > highlight[0] && highlight[1] <= text.length;

  return (
    <pre className="font-archive mt-4 max-h-96 overflow-y-auto border border-ink-faint/30 bg-paper-raised p-3 text-[12px] leading-relaxed whitespace-pre-wrap text-ink-muted">
      {usable ? (
        <>
          {text.slice(0, highlight[0])}
          <mark ref={markRef} className="bg-madder/20 text-ink">
            {text.slice(highlight[0], highlight[1])}
          </mark>
          {text.slice(highlight[1])}
        </>
      ) : (
        text
      )}
    </pre>
  );
}
