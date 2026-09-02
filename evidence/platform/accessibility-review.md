# MVP-NFR-005 accessibility review

Scope: non-spatial Project Library, workspace controls, Inspector, dense views,
reports, tables, dialogs, and mobile review. Recorded matrix: Playwright 1.62.1
Chromium 151.0.7922.34, Firefox 153.0, and WebKit 26.5.

## Automated evidence

`PLAYWRIGHT_PORT=4313 pnpm test:accessibility` passed 6/6 production-browser
cases. Each engine reported zero axe-core violations for the Project Library,
desktop RX-7 report workflow, and responsive mobile review under WCAG 2 A/AA,
2.1 A/AA, and 2.2 AA tags. The same cases verified visible keyboard focus,
semantic report tables, reduced-motion presentation, text/symbol physical-kind
meaning, 320-CSS-pixel reflow, and no horizontal document overflow.

`tests/e2e/rx7-platform.spec.ts` passed 6/6 cases across the matrix. At the
inclusive 1120-pixel tablet boundary, the sampled primary controls were at
least 44 by 44 CSS pixels. At 699 pixels the durable revision remained
reviewable, every tested mutation was absent or disabled, state switching and
download remained available, and 700 pixels restored authoring only with the
existing write lease.

## Manual inspection

- Keyboard: visible focus, toolbar modes, semantic canvas subjects, contextual
  help, dialogs, dense-view close, and report controls expose named paths.
- Screen-reader-oriented structure: browser role/name exposure identifies the
  main region, navigation, toolbar, topology application, Inspector, dialogs,
  headings, tables, alerts, and status text. Dense summaries and paginated
  semantic topology preserve project identities outside the drawing.
- Zoom and reflow: the effective 320-pixel layout, 699/700 breakpoint, and
  1120-pixel tablet boundary retain readable content without page-width
  clipping. Long identities wrap within table and Inspector cells.
- Contrast and non-color meaning: axe-core contrast checks are clear; inspected
  captures pair every status, domain, physical kind, direction, and evidence
  outcome with text, shape, symbol, stroke, or static cue.
- Motion: `prefers-reduced-motion: reduce` pauses Overlay motion while retaining
  direction words and static marks.

## Spatial limitation

Freeform topology position, route geometry, pan, and zoom remain inherently
spatial. The MVP does not claim that an assistive technology conveys equivalent
geometric relationships. It provides keyboard actions, named Components,
Ports, Connections, and route points, semantic pagination, dense summaries,
tables, and textual traces as the non-spatial review alternative. This record
is not a physical-device or named assistive-technology certification.

Review verdict: Pass for the bounded WCAG 2.2 AA target.
