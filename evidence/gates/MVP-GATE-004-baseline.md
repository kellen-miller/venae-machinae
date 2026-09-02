# MVP-GATE-004 baseline — Exchange limits

- Record: `MVP-GATE-004-baseline`
- Machine record: `evidence/gates/MVP-GATE-004-baseline.json`
- Raw measurements: `evidence/gates/raw/MVP-GATE-004-browser-measurements.json`
- Fixture: `tests/fixtures/capacity-project.ts`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:exchange`
- Result: Pass

Strict version-1 1×/2×/5× project envelopes were encoded, parsed, JITless-Zod validated, SHA-256 checked, structured-cloned, atomically committed to the concrete IndexedDB library, reopened, and compared exactly in Chromium 151.0.7922.34, Firefox 153.0, and WebKit 26.5. The 5× envelope carried two 6 MiB original raster assets: 18,202,080 encoded bytes, 12,582,912 original asset bytes, depth 7, and 21,006 collection entries. Largest observed times were 478 ms encoding, 18 ms parsing, 44.8 ms validation, 48 ms hashing, 16.3 ms clone, and 62 ms commit.

Cross-engine memory evidence uses an instrumented high-water bound over simultaneously retained encoded envelope bytes, UTF-16 source bytes, canonical payload bytes, validated and cloned representations, decoded original asset bytes, and IndexedDB commit inputs. It is not presented as a browser heap-profiler reading. The largest bound was 72,808,320 bytes. Unit boundaries independently rejected encoded envelope, individual asset, combined asset, count, depth, collection, payload-integrity, export-metadata-integrity, and asset-integrity violations. The first browser run exposed stack-unsafe nested repetition in the base64 validator at multi-MiB sizes; the strict validator was replaced with an iterative alphabet/padding scan and all engines passed without weakening the schema.

Bounded decision: retain strict monolithic JSON and freeze limits at 20 MiB encoded envelope, 6 MiB per original asset, 12 MiB combined original assets, 64 assets, nesting depth 32, 50,000 collection entries, and a 128 MiB instrumented retained-representation high-water bound. Milestone 5 must supersede this guarded baseline after the complete schema, migration, and exchange pipeline are promoted.
