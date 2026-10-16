import ELK from 'elkjs/lib/elk-api';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';
import { createDiagramGraph, diagramLayoutFromGraph } from './diagram-layout';
import type { RendererProjection } from './projection';

/** One worker per explicit tidy request. Abort/timeout releases the full engine. */
export async function tidyDiagram(projection: RendererProjection, signal: AbortSignal) {
  const graph = createDiagramGraph(projection);
  if (signal.aborted) throw new Error('Tidy canceled.');
  const worker = new Worker(workerUrl);
  const elk = new ELK({ algorithms: ['layered'], workerFactory: () => worker });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let cancel: () => void = () => {};
  try {
    const result = await Promise.race([
      elk.layout(graph),
      new Promise<never>((_, reject) => {
        cancel = () => reject(new Error('Tidy canceled.'));
        signal.addEventListener('abort', cancel, { once: true });
        worker.onerror = () => reject(new Error('The layout engine could not load. Try again.'));
        timeout = setTimeout(
          () => reject(new Error('Tidy took too long. Choose a smaller system.')),
          20_000
        );
      })
    ]);
    return diagramLayoutFromGraph(result);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
    elk.terminateWorker();
    worker.terminate();
  }
}
