export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
      <p className="font-archive text-xs tracking-[0.2em] text-ink-faint uppercase">
        Team Sigmoid &middot; SIH 2026
      </p>

      <h1 className="font-display mt-4 text-6xl leading-none text-ink">THRESHOLD</h1>

      <p className="font-display mt-2 text-2xl text-madder italic">
        Cross it, and the place speaks.
      </p>

      <hr className="my-8 border-0 border-t border-ink-faint/40" />

      <p className="max-w-xl text-base leading-relaxed text-ink-muted">
        Between 1916 and 1922 the Archaeological Survey of India catalogued roughly 1,300
        monuments in Delhi. About 174 are centrally protected today. The rest did not all
        disappear. They stopped being findable.
      </p>

      <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted">
        THRESHOLD reads what the archives already recorded, projects it back onto today&apos;s
        map, and lets a place tell its own story to whoever is standing in front of it.
      </p>

      <p className="mt-10 font-archive text-xs text-ink-faint">
        Phase 0 &middot; foundations
      </p>
    </main>
  );
}
