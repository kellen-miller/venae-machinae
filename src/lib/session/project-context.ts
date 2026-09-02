import { createContext } from 'svelte';

import type { ProjectSession } from './project-session.svelte';

type ProjectSessionContext = Readonly<{
  session: ProjectSession;
}>;

const [readProjectSessionContext, writeProjectSessionContext] =
  createContext<ProjectSessionContext>();

export function getProjectSessionContext(): ProjectSession {
  return readProjectSessionContext().session;
}

export function setProjectSessionContext(readSession: () => ProjectSession): void {
  writeProjectSessionContext({
    get session() {
      return readSession();
    }
  });
}
