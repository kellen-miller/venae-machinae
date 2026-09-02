<script lang="ts">
  import { onMount } from 'svelte';

  import { browserDeliveryState } from '../../delivery/browser-delivery-state';

  let connection = $state(browserDeliveryState.current);

  onMount(() => {
    const unsubscribe = browserDeliveryState.subscribe((next) => (connection = next));
    const stop = browserDeliveryState.start();
    return () => {
      stop();
      unsubscribe();
    };
  });
</script>

<aside
  class:disconnected={connection === 'disconnected'}
  data-delivery-state={connection}
  role="status"
  aria-live="polite"
>
  {#if connection === 'connected'}
    <span aria-hidden="true"></span>
    Local server connected
  {:else}
    <strong>Local server unavailable.</strong>
    Loaded editing, undo, browser-local save, and export remain available. Navigation, new lazy work,
    and worker restart wait for reconnect; cold launch is unavailable.
  {/if}
</aside>

<style>
  aside {
    position: fixed;
    z-index: 80;
    right: 0.65rem;
    bottom: 0.55rem;
    display: flex;
    gap: 0.4rem;
    align-items: center;
    max-width: min(36rem, calc(100vw - 1.3rem));
    padding: 0.34rem 0.55rem;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    background: rgb(17 29 31 / 94%);
    color: var(--color-text-muted);
    font: 0.58rem/1.35 var(--font-mono);
    pointer-events: none;
  }

  aside > span {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: var(--color-accent);
  }

  aside.disconnected {
    border-color: #d9875e;
    border-radius: var(--radius-small);
    background: rgb(66 35 29 / 97%);
    color: #ffe6dc;
  }

  @media (max-width: 43.75rem) {
    aside:not(.disconnected) {
      overflow: hidden;
      width: 0.75rem;
      height: 0.75rem;
      padding: 0;
      border: 0;
      color: transparent;
    }

    aside:not(.disconnected) > span {
      width: 0.75rem;
      height: 0.75rem;
    }
  }
</style>
