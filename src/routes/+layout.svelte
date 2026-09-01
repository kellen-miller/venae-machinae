<script lang="ts">
  import '../styles/base.css';
  import '../styles/tokens.css';

  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>Venae Machinae</title>
  <meta
    name="description"
    content="A browser-local workspace for automotive electrical and fluid systems."
  />
</svelte:head>

{@render children()}
