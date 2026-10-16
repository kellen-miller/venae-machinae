<script lang="ts">
  import { goto } from '$app/navigation';
  import { asset, resolve } from '$app/paths';
  import { onMount } from 'svelte';

  import { createBrowserApplication } from '#lib/composition/create-browser-application.ts';

  import type { BrowserApplication } from '#lib/composition/create-browser-application.ts';

  let failure = $state<string | null>(null);

  onMount(() => {
    let canceled = false;

    void (async () => {
      let application: BrowserApplication | null = null;

      try {
        const response = await fetch(asset('examples/rx7-fd-stock.v1.venae.json'));
        if (!response.ok) throw new Error(`Example download failed: HTTP ${response.status}`);

        const source = await response.text();
        if (canceled) return;

        application = await createBrowserApplication();
        if (canceled) return;

        const staged = await application.stageLibraryImport(
          new File([source], 'rx7-fd-stock.venae.json', { type: 'application/json' })
        );
        if (!staged.staged) {
          throw new Error(`Example validation failed: ${staged.message}`);
        }

        if (canceled) return;

        const outcome = await application.commitLibraryImport(staged, 'import-copy');
        if (!outcome.committed) {
          throw new Error(`Example copy failed: ${outcome.reason}`);
        }

        if (!outcome.projectId) {
          throw new Error('The example copy did not return a Project identity.');
        }

        await application.close();
        application = null;
        if (canceled) return;

        await goto(
          resolve('/projects/[projectId]?system=Engine%20cooling', {
            projectId: outcome.projectId
          }),
          {
            replaceState: true
          }
        );
      } catch (error) {
        if (!canceled) {
          failure = error instanceof Error ? error.message : 'The stock FD example could not open.';
        }
      } finally {
        await application?.close();
      }
    })();

    return () => {
      canceled = true;
    };
  });
</script>

<svelte:head>
  <title>Stock RX-7 FD example · Venae Machinae</title>
</svelte:head>

<main class="route-error" aria-busy={!failure}>
  <p class="eyebrow">Stock RX-7 FD example</p>
  {#if failure}
    <h1>Example could not open</h1>
    <p role="alert">{failure}</p>
    <a href={resolve('/')}>Return to Project Library</a>
  {:else}
    <h1>Opening stock FD fluid systems…</h1>
    <p>Copying six fluid systems into this browser’s Project Library.</p>
    <p>Illustrative topology; dimensions and ratings remain unverified.</p>
  {/if}
</main>
