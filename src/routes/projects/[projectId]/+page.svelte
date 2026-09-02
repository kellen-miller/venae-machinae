<script lang="ts">
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';

  import ProjectWorkspace from '$lib/presentation/workspace/ProjectWorkspace.svelte';
  import { createBrowserApplication } from '$lib/composition/create-browser-application';

  import type { BrowserApplication } from '$lib/composition/create-browser-application';
  import type { PartDefinition } from '$lib/project/project';
  import type { ProjectSession } from '$lib/session/project-session.svelte';
  import type { PageProps } from './$types';

  let { params }: PageProps = $props();
  let session = $state<ProjectSession | null>(null);
  let failure = $state<string | null>(null);
  let application: BrowserApplication | null = null;

  onMount(() => {
    let canceled = false;
    void (async () => {
      try {
        application = await createBrowserApplication();
        const presentation =
          window.innerWidth < 700 ? 'mobile' : window.innerWidth <= 1120 ? 'tablet' : 'desktop';
        const outcome = await application.openProject(params.projectId, presentation);
        if (canceled) {
          await application.close();
          return;
        }
        if (!outcome.opened) {
          failure = 'This browser profile does not contain that Project.';
          return;
        }

        session = outcome.session;
      } catch (error) {
        failure = error instanceof Error ? error.message : 'The browser Project Library failed.';
      }
    })();

    return () => {
      canceled = true;
      if (application) void application.close();
    };
  });

  async function promotePartDefinition(definition: PartDefinition) {
    if (!application) return { promoted: false as const, reason: 'library-unavailable' };
    return application.promotePartDefinition(definition, new Date().toISOString());
  }
</script>

{#if session}
  <ProjectWorkspace {session} onpromotetemplate={promotePartDefinition} />
{:else if failure}
  <main class="route-error">
    <p class="eyebrow">Project unavailable</p>
    <h1>Project could not open</h1>
    <p>{failure}</p>
    <a href={resolve('/')}>Return to Project Library</a>
  </main>
{:else}
  <main class="route-error" aria-busy="true">
    <p class="eyebrow">Browser Project Library</p>
    <h1>Opening Project…</h1>
    <p>Loading the immutable snapshot and acquiring its authoring capability.</p>
  </main>
{/if}
