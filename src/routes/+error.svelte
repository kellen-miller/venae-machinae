<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
</script>

<svelte:head>
  <title>{page.status} · Venae Machinae</title>
</svelte:head>

<main class="route-error">
  <p class="eyebrow">Route error</p>
  <h1>{page.status}</h1>
  <p>
    {page.status === 404
      ? 'The requested local view could not be found.'
      : 'The local application could not open this view.'}
  </p>
  <a href={resolve('/')}>Return to the Project Library</a>
</main>
