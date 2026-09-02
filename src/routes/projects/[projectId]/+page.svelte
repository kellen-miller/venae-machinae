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

  function presentationForWidth(width: number) {
    return width < 700
      ? ('mobile' as const)
      : width <= 1120
        ? ('tablet' as const)
        : ('desktop' as const);
  }

  onMount(() => {
    let canceled = false;
    const updatePresentation = () => {
      if (session) void session.setPresentation(presentationForWidth(window.innerWidth));
    };
    window.addEventListener('resize', updatePresentation);
    void (async () => {
      try {
        application = await createBrowserApplication();
        const presentation = presentationForWidth(window.innerWidth);
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
        updatePresentation();
      } catch (error) {
        failure = error instanceof Error ? error.message : 'The browser Project Library failed.';
      }
    })();

    return () => {
      canceled = true;
      window.removeEventListener('resize', updatePresentation);
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
