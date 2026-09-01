# MVP-GATE-004 — Exchange limits

- Current record: `evidence/gates/MVP-GATE-004-baseline.md`
- Machine record: `evidence/gates/MVP-GATE-004-baseline.json`
- Verdict: Pass
- Supersedes: none

The current guarded baseline covers strict monolithic JSON at 1×/2×/5×, separate payload/export-metadata/asset corruption detection, encoded/original byte limits, structural limits, cross-engine stage timings, instrumented retained-representation high-water bounds, atomic IndexedDB commit, and exact reopen. It must be superseded after the complete production schema and exchange pipeline are promoted.
