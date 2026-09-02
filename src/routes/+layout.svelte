<script lang="ts">
  import '../styles/base.css';
  import '../styles/tokens.css';

  import { updated } from '$app/state';
  import type { Snippet } from 'svelte';
  import DeliveryStatus from '$lib/presentation/delivery/DeliveryStatus.svelte';

  let { children }: { children: Snippet } = $props();

  function reloadApplication(): void {
    const event = new Event('venae:prepare-application-reload', { cancelable: true });
    if (window.dispatchEvent(event)) window.location.reload();
  }
</script>

<svelte:head>
  <title>Venae Machinae</title>
  <meta
    name="description"
    content="A browser-local workspace for automotive electrical and fluid systems."
  />
</svelte:head>

{@render children()}

{#if updated.current}
  <aside class="application-update" role="alert">
    <strong>Application update available.</strong>
    <span>Finish the active action and save this browser-local revision before reload.</span>
    <button type="button" onclick={reloadApplication}>Save and reload application</button>
  </aside>
{/if}

<DeliveryStatus />

<style>
  .application-update {
    position: fixed;
    z-index: 90;
    top: 0.65rem;
    left: 50%;
    display: flex;
    gap: 0.65rem;
    align-items: center;
    width: min(48rem, calc(100vw - 1.3rem));
    padding: 0.65rem;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-small);
    background: #172628;
    box-shadow: var(--shadow-raised);
    color: var(--color-text);
    font-size: 0.72rem;
    transform: translateX(-50%);
  }

  .application-update span {
    flex: 1;
    color: var(--color-text-muted);
  }

  .application-update button {
    min-height: 2.75rem;
    border: 0;
    border-radius: var(--radius-small);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: 700;
  }

  @media (max-width: 43.75rem) {
    .application-update {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
