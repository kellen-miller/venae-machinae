# Milestone 4A calculations frontend review

## Official Svelte evidence

The official Svelte MCP documentation was consulted for `$state`, `$derived`,
`bind:`, `{#if}`, `{#each}`, TypeScript, testing, and SvelteKit accessibility.
The official Svelte autofixer then reported zero issues and zero suggestions for
`CalculationsLens.svelte` and `LensStack.svelte`. `pnpm check` independently
reported zero errors and zero warnings.

## Browser and visual evidence

`tests/e2e/evaluation-worker.spec.ts` exercises the production worker and
Calculations Lens through the same Project Session actions used by other
projections. The focused production-browser run passed in Chromium, Firefox,
and WebKit. It proves explicit Operating State selection, exact-decimal bounded
voltage-drop evaluation, stale-safe replacement, Unknown and Unsupported
outcomes, neutral selected-candidate screening, and durable save completion.

`M4A-calculations-desktop.png` and `M4A-calculations-tablet.png` were captured
from the production build at 1185 by 1169 and 800 by 1000 CSS pixels. Both were
visually inspected. The result leads with its scoped status and numeric value,
then formula revision, input-bound envelope, omissions, and input identities.
The 800-pixel layout stacks formula inputs without horizontal overflow; the
result remains legible beneath the floating Inspector and above the screening
form. Color is not the sole cue for status or completeness.

The browser inspection also reproduced pre-existing CSP console rejection of
the SvelteKit shell and announcer inline styles plus the missing favicon. Those
delivery/accessibility defects are recorded for Milestone 7; they did not alter
the Milestone 4A calculation data or worker result.
