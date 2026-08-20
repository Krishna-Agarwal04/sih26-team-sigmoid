# contrib/

Teammate builds live here, one folder each.

```
contrib/
  brief-1-discovery-<yourname>/
  brief-2-authority-<yourname>/
  brief-3-planner-<yourname>/
  brief-4-narration-<yourname>/
  brief-5-explore-<yourname>/
```

**This directory is excluded from the build, the typecheck, the tests and the Vercel deploy.** Nothing in here can break the main app, which is exactly the point: a PR into `contrib/` is always safe to merge, so it gets judged on being a contribution rather than on whether its code ends up shipping.

Excluded via `tsconfig.json` (`"exclude": ["node_modules", "contrib"]`), `vitest.config.ts` (`test.exclude`), and `.vercelignore`.

## Rules for a folder in here

- It is self-contained. Its own `package.json`, its own dependencies, its own README saying how to run it.
- It imports nothing from the main app, and the main app imports nothing from it.
- No `.env` file, no API key, no credential. Ever.
- No `node_modules/`, no `.next/`, no media over 5MB.

## If your work gets used

It is not moved out of here by copying files. It gets read, understood, rewritten to match the main app's conventions, and credited in the commit message. Your folder stays where it is.
