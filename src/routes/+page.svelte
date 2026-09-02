<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';

  import { createBrowserApplication } from '$lib/composition/create-browser-application';
  import ProjectLibraryView from '$lib/presentation/library/ProjectLibraryView.svelte';

  import type { BrowserApplication } from '$lib/composition/create-browser-application';
  import type {
    DownloadArtifact,
    LibraryOverview,
    StagedLibraryImport
  } from '$lib/composition/create-browser-application';
  import type {
    ProjectLibraryState,
    ProjectListing
  } from '$lib/presentation/library/ProjectLibraryView.svelte';

  let application = $state<BrowserApplication | null>(null);
  let projects = $state<readonly ProjectListing[]>([]);
  let libraryState = $state<ProjectLibraryState>('loading');
  let failure = $state<string | null>(null);
  let operationFailure = $state<string | null>(null);
  let operationStatus = $state<string | null>(null);
  let overview = $state<LibraryOverview | null>(null);
  let stagedImport = $state<StagedLibraryImport | null>(null);

  async function refreshLibrary(openedApplication: BrowserApplication): Promise<void> {
    const now = new Date().toISOString();
    [projects, overview] = await Promise.all([
      openedApplication.listProjects(),
      openedApplication.readLibraryOverview(now)
    ]);
  }

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
        await refreshLibrary(openedApplication);
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

  async function copyIllustrativeExample(): Promise<void> {
    if (!application || libraryState !== 'ready') return;

    libraryState = 'copying-example';
    operationFailure = null;
    const outcome = await application.copyIllustrativeExample();
    if (!outcome.copied) {
      operationFailure = `Illustrative example copy failed: ${outcome.reason}.`;
      libraryState = 'ready';
      return;
    }

    await openCreatedProject(outcome.projectId);
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

  function startDownload(artifact: DownloadArtifact): void {
    const url = URL.createObjectURL(new Blob([artifact.json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = artifact.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function createNamedSnapshot(project: ProjectListing): Promise<void> {
    if (!application) return;
    operationFailure = null;
    const outcome = await application.createNamedSnapshot(project.id, new Date().toISOString());
    if (!outcome.created) {
      operationFailure = `Named Snapshot failed: ${outcome.reason}.`;
      return;
    }
    operationStatus = `Created a user-retained Named Snapshot for ${project.name}.`;
    await refreshLibrary(application);
  }

  async function trashProject(project: ProjectListing): Promise<void> {
    if (!application) return;
    operationFailure = null;
    const outcome = await application.trashProject(project.id, new Date().toISOString());
    if (!outcome.trashed) {
      operationFailure = `Trash failed: ${outcome.reason}.`;
      return;
    }
    operationStatus = `${project.name} remains recoverable in Trash for 30 days.`;
    await refreshLibrary(application);
  }

  async function restoreNamedSnapshot(snapshotId: string): Promise<void> {
    if (!application) return;
    operationFailure = null;
    const outcome = await application.restoreNamedSnapshot(snapshotId, new Date().toISOString());
    if (!outcome.restored) {
      operationFailure = `Named Snapshot restore failed: ${outcome.reason}.`;
      return;
    }
    operationStatus = 'Restored immutable snapshot contents as a new current Project revision.';
    await refreshLibrary(application);
  }

  async function restoreTrash(trashId: string): Promise<void> {
    if (!application) return;
    operationFailure = null;
    const outcome = await application.restoreTrash(trashId);
    if (!outcome.restored) {
      operationFailure = `Trash restore failed: ${outcome.reason}.`;
      return;
    }
    operationStatus = 'Restored the browser-local record from Trash.';
    await refreshLibrary(application);
  }

  async function exportProject(project: ProjectListing): Promise<void> {
    if (!application) return;
    operationFailure = null;
    const outcome = await application.createProjectDownload(project.id, new Date().toISOString());
    if (!outcome.created) {
      operationFailure = `Project export failed: ${outcome.reason}.`;
      return;
    }
    startDownload(outcome.artifact);
    operationStatus = `Exported ${project.name}; SHA-256 hashes detect corruption, not authorship.`;
    await refreshLibrary(application);
  }

  async function exportTemplates(): Promise<void> {
    if (!application) return;
    operationFailure = null;
    const outcome = await application.createTemplateDownload(new Date().toISOString());
    if (!outcome.created) {
      operationFailure = `Template export failed: ${outcome.reason}.`;
      return;
    }
    startDownload(outcome.artifact);
    operationStatus = 'Exported immutable Part Definition Template revisions.';
  }

  async function downloadLibraryBackup(): Promise<void> {
    if (!application) return;
    operationFailure = null;
    const outcome = await application.createLibraryBackupDownload(new Date().toISOString());
    if (!outcome.created) {
      operationFailure = `Library Backup failed: ${outcome.reason}.`;
      return;
    }
    startDownload(outcome.artifact);
    operationStatus = 'Library Backup downloaded; this is the profile and device loss boundary.';
    await refreshLibrary(application);
  }

  async function downloadRedactedDiagnostics(): Promise<void> {
    if (!application) return;
    startDownload(await application.createDiagnosticsDownload(new Date().toISOString()));
    operationStatus = 'Downloaded bounded diagnostics with project values omitted.';
  }

  async function stageLibraryImport(file: File): Promise<void> {
    if (!application) return;
    operationFailure = null;
    operationStatus = null;
    stagedImport = null;
    const outcome = await application.stageLibraryImport(file);
    if (!outcome.staged) {
      operationFailure = `Import blocked by corruption detection (${outcome.reason}): ${outcome.message}`;
      await refreshLibrary(application);
      return;
    }
    stagedImport = outcome;
  }

  async function commitLibraryImport(
    decision: 'replace' | 'import-copy' | 'cancel'
  ): Promise<void> {
    if (!application || !stagedImport) return;
    if (decision === 'cancel') {
      stagedImport = null;
      operationStatus = 'Import canceled without changing the Project Library.';
      return;
    }
    operationFailure = null;
    const outcome = await application.commitLibraryImport(stagedImport, decision);
    if (!outcome.committed) {
      operationFailure = `Import commit failed: ${outcome.reason}.`;
      return;
    }
    stagedImport = null;
    operationStatus = `Committed ${outcome.format} after explicit ${decision}.`;
    await refreshLibrary(application);
  }
</script>

<svelte:head>
  <title>Project Library · Venae Machinae</title>
</svelte:head>

<ProjectLibraryView
  state={libraryState}
  {projects}
  {failure}
  {operationFailure}
  {operationStatus}
  {overview}
  {stagedImport}
  onblank={createBlankProject}
  onexample={copyIllustrativeExample}
  onduplicate={duplicateProject}
  onnamedsnapshot={createNamedSnapshot}
  onrestoresnapshot={restoreNamedSnapshot}
  ontrash={trashProject}
  onrestoretrash={restoreTrash}
  onexportproject={exportProject}
  onexporttemplates={exportTemplates}
  onbackup={downloadLibraryBackup}
  ondiagnostics={downloadRedactedDiagnostics}
  onstageimport={stageLibraryImport}
  oncommitimport={commitLibraryImport}
/>
