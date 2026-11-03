# Venae Machinae

Design automotive wiring and fluid systems without CAD overhead.

CI runs repository checks once, then Chromium, Firefox, and WebKit in parallel
with one worker per job. Each browser job builds once and runs E2E, accessibility,
visual, and the six browser gate suites together. The Chromium job also runs the
workspace visual project. Capacity smoke remains a separate workflow.

For the same browser coverage locally, run `pnpm test:browser`. It builds the
production application automatically. After an explicit `pnpm build`, use
`PLAYWRIGHT_SKIP_BUILD=1 pnpm test:browser` to reuse that build. Committed gate
records are checked separately with `pnpm gate:evidence`.

TypeScript 7 provides `tsc` through `@typescript/native`. Framework checks and
ESLint use the TypeScript 6 API compatibility package, aliased as `typescript`,
following [Microsoft’s side-by-side guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60).
