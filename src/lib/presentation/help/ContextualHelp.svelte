<script lang="ts">
  import { tick } from 'svelte';

  import { HELP_CONTENT } from './help-content';

  import type { HelpTopic } from './help-content';

  let { topic }: { topic: HelpTopic } = $props();
  let open = $state(false);
  let trigger: HTMLButtonElement;
  const content = $derived(HELP_CONTENT[topic]);

  async function close(): Promise<void> {
    open = false;
    await tick();
    trigger.focus();
  }
</script>

<div class="contextual-help">
  <button
    bind:this={trigger}
    class="help-trigger"
    type="button"
    aria-expanded={open}
    aria-haspopup="dialog"
    aria-label={`Help for ${content.title}`}
    onclick={() => (open = true)}
  >
    <span aria-hidden="true">?</span>
    {content.title} terms and evidence
  </button>

  {#if open}
    <div class="help-panel" role="dialog" aria-modal="false" aria-label={`${content.title} help`}>
      <header>
        <div>
          <p>Canonical vocabulary</p>
          <h3>{content.title}</h3>
        </div>
        <button type="button" onclick={close}>Close help</button>
      </header>

      <dl>
        <div>
          <dt>{content.title}</dt>
          <dd>{content.definition}</dd>
        </div>
        <div>
          <dt>{content.portTerm}</dt>
          <dd>{content.portDefinition}</dd>
        </div>
        <div>
          <dt>{content.connectionTerm}</dt>
          <dd>One direct physical continuity relationship between exactly two typed Ports.</dd>
        </div>
      </dl>

      <h4>Formula applicability and Unknown evidence</h4>
      <p>{content.formulaBoundary}</p>
      <h4>Validation Rule boundary</h4>
      <p>{content.validationBoundary}</p>
      <h4>Provenance required</h4>
      <p>{content.provenanceRequirement}</p>
      <h4>Corrective review</h4>
      <ol>
        {#each content.correctiveReview as action (action)}
          <li>{action}</li>
        {/each}
      </ol>
    </div>
  {/if}
</div>

<style>
  .contextual-help {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .help-trigger,
  .help-panel button {
    min-height: 2.75rem;
    border: 1px solid #75948d;
    border-radius: var(--radius-small);
    background: #eef4f0;
    color: #244849;
    cursor: pointer;
    font: 0.64rem/1.35 var(--font-mono);
  }

  .help-trigger {
    display: flex;
    gap: 0.45rem;
    align-items: center;
    padding: 0.45rem 0.65rem;
    text-align: left;
  }

  .help-trigger span {
    display: grid;
    width: 1.4rem;
    height: 1.4rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid currentColor;
    border-radius: 50%;
  }

  .help-panel {
    display: grid;
    gap: 0.55rem;
    padding: 0.7rem;
    border: 1px solid #75948d;
    border-radius: 0.6rem;
    background: #f7faf7;
    box-shadow: 0 0.8rem 2rem rgb(20 48 48 / 18%);
  }

  .help-panel header {
    display: flex;
    justify-content: space-between;
    gap: 0.7rem;
    align-items: start;
    padding: 0;
    border: 0;
  }

  .help-panel header p,
  .help-panel h3,
  .help-panel h4,
  .help-panel p,
  .help-panel ol,
  .help-panel dl {
    margin: 0;
  }

  .help-panel header p,
  .help-panel h4,
  .help-panel dt {
    color: #8b4c30;
    font: 0.58rem/1.35 var(--font-mono);
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .help-panel h3 {
    font: 700 1rem/1.2 var(--font-display);
  }

  .help-panel button {
    padding: 0.4rem 0.65rem;
  }

  .help-panel dl {
    display: grid;
    gap: 0.4rem;
  }

  .help-panel dl div {
    padding-top: 0.4rem;
    border-top: 1px solid #ccd9d5;
  }

  .help-panel dd {
    margin: 0.16rem 0 0;
  }

  .help-panel dd,
  .help-panel p,
  .help-panel li {
    color: #425f5d;
    font-size: 0.68rem;
    line-height: 1.45;
  }

  .help-panel ol {
    display: grid;
    gap: 0.3rem;
    padding-left: 1.1rem;
  }

  button:focus-visible {
    outline: 0.2rem solid #315f5d;
    outline-offset: 0.15rem;
  }
</style>
