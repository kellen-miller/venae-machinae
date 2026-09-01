<script lang="ts">
  import type { AuthoringCapability } from '../../session/authoring-capability';

  let { capability }: { capability: AuthoringCapability } = $props();

  const message = $derived.by(() => {
    if (capability.mode === 'author') return null;
    if (capability.reason === 'mobile-review') {
      return 'Mobile review: inspect, filter, search, compare, and export. Project mutation remains blocked below 700 CSS pixels.';
    }
    if (capability.reason === 'lease-held') {
      return 'Read-only lease: another window owns this Project’s authoring lease. Review remains available.';
    }
    if (capability.reason === 'transient-review') {
      return 'Transient review: this Project is not durable and cannot mutate the browser Project Library.';
    }
    return 'Authoring APIs are unavailable. Review remains available without silent mutation.';
  });
</script>

{#if message}
  <aside class="capability-notice" role="status" data-capability-reason={capability.reason}>
    <span aria-hidden="true">Read only</span>
    <p>{message}</p>
  </aside>
{/if}

<style>
  .capability-notice {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    min-height: 2.45rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid #a76848;
    border-radius: var(--radius-small);
    background: rgb(106 55 35 / 52%);
    color: #ffebe0;
  }

  span {
    flex: 0 0 auto;
    padding: 0.22rem 0.38rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 0.56rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  p {
    margin: 0;
    font-size: 0.7rem;
  }
</style>
