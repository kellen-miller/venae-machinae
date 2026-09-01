<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';

  import { createBrowserApplication } from '$lib/composition/create-browser-application';
  import ProjectLibraryView from '$lib/presentation/library/ProjectLibraryView.svelte';

  import type { BrowserApplication } from '$lib/composition/create-browser-application';
  import type {
    ProjectLibraryState,
    ProjectListing
  } from '$lib/presentation/library/ProjectLibraryView.svelte';

  let application = $state<BrowserApplication | null>(null);
  let projects = $state<readonly ProjectListing[]>([]);
  let libraryState = $state<ProjectLibraryState>('loading');
  let failure = $state<string | null>(null);

  onMount(() => {
    let canceled = false;
    void (async () => {
      try {
        const openedApplication = await createBrowserApplication();
        if (canceled) {
          await openedApplication.close();
          return;
        }

        application = openedApplication;
        projects = await openedApplication.listProjects();
        libraryState = 'ready';
      } catch (error) {
        failure = error instanceof Error ? error.message : 'The browser Project Library failed.';
        libraryState = 'failed';
      }
    })();

    return () => {
      canceled = true;
      if (application) void application.close();
    };
  });

  async function openCreatedProject(projectId: string): Promise<void> {
    await application?.close();
    await goto(resolve('/projects/[projectId]', { projectId }));
  }

  async function createBlankProject(): Promise<void> {
    if (!application || libraryState !== 'ready') return;

    libraryState = 'creating';
    failure = null;
    const outcome = await application.createBlankProject({
      id: crypto.randomUUID(),
      name: `Vehicle project ${projects.length + 1}`,
      createdAt: new Date().toISOString()
    });
    if (!outcome.created) {
      failure = `Project creation failed: ${outcome.reason}.`;
      libraryState = 'failed';
      return;
    }

    await openCreatedProject(outcome.snapshot.id);
  }

  async function duplicateProject(project: ProjectListing): Promise<void> {
    if (!application || libraryState !== 'ready') return;

    libraryState = 'duplicating';
    failure = null;
    const outcome = await application.duplicateProject({
      sourceProjectId: project.id,
      id: crypto.randomUUID(),
      name: `${project.name} copy`,
      createdAt: new Date().toISOString()
    });
    if (!outcome.duplicated) {
      failure = `Project duplication failed: ${outcome.reason}.`;
      libraryState = 'failed';
      return;
    }

    await openCreatedProject(outcome.snapshot.id);
  }
</script>

<svelte:head>
  <title>Project Library · Venae Machinae</title>
</svelte:head>

<ProjectLibraryView
  state={libraryState}
  {projects}
  {failure}
  onblank={createBlankProject}
  onduplicate={duplicateProject}
/>
