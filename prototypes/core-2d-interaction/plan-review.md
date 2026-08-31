# Adversarial Plan Review

Reviewer: Anthropic `claude-fable-5`
Author provider: OpenAI
Independence: cross-provider

## Findings

### 1. High — Required domain exposures missing

The plan names Components, Junctions, Wires, and Fluid Lines but does not make
Ports or Segments visible and targetable. Warning count alone does not expose
the warning subject. Seed Ports and a shared Segment, make Connect port-targeted,
show Route Length as a Segment breakdown, and make warnings inspectable.

### 2. High — Variants lack testable hypotheses and a common task

The variants could be judged aesthetically instead of as workflows. State one
hypothesis per variant and run the same add, connect, route, resolve, and trace
task in all three.

### 3. Medium — Visibility check contradicts progressive disclosure

Requiring all state to remain visible would collapse B and C toward A. Require
all state to be inspectable within one interaction and keep only a shared compact
status strip permanently visible.

### 4. Medium — Seed data cannot exercise unknowns or conflicts

Seed at least two Operating States, an unknown value, a conflicting value, and
an unknown Compatibility Assessment; name them in acceptance checks.

### 5. Medium — Variant switching may lose in-memory edits

Use `history.replaceState` over one shared in-memory state object so switching
variants updates the URL without reloading. Verify edits survive switches.

### 6. Medium — Tablet and mobile behavior are underspecified

Name each variant's tablet compression, verify mobile removes editing controls,
and spot-check 44-pixel touch targets.

### 7. Medium — Canvas keyboard scope is ambiguous

Make canvas nodes focusable and selectable. Explicitly descope keyboard Connect
and Route mechanics for this throwaway prototype.

### 8. Medium — Rendered artifact lacks a prototype marker

Show a persistent “Prototype — illustrative data, not engineering guidance”
banner and label seeded warnings as illustrative on every variant and viewport.

### 9. Low — Direction and temperature source is unspecified

Declare per-state direction and temperature annotations to be seeded, not
computed, so the artifact cannot drift into simulation.

## Disposition

All nine findings were verified against `PROTOTYPE.md` and accepted. The plan
was amended before implementation. This review will not be repeated for the
planning boundary.

---ADVERSARIAL_REVIEW_STATUS---
AUTHOR_PROVIDER: OpenAI
REVIEWER_PROVIDER: Anthropic
REVIEWER_MODEL: claude-fable-5
INDEPENDENCE: cross_provider
ISSUES_FOUND: 9
CRITICAL_COUNT: 0
HIGH_COUNT: 2
MEDIUM_COUNT: 6
LOW_COUNT: 1
CONFIDENCE: HIGH
BLOCKING: false
SUMMARY: Plan skeleton is sound but omits Ports/Segments exposure, per-variant hypotheses/task script, exercisable seed data, and state-preserving variant switching; amend before implementation.
---END_ADVERSARIAL_REVIEW_STATUS---
