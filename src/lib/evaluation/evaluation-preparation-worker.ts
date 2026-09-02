/// <reference lib="webworker" />

import { prepareEvaluation } from './evaluation-preparation';

import type {
  EvaluationPreparationFailed,
  PrepareEvaluationRequest
} from './evaluation-preparation';
import type { EvaluationProject } from './protocol';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
let mirror: EvaluationProject | null = null;
let latestSequence = 0;

workerScope.addEventListener('message', (event: MessageEvent<unknown>) => {
  const input = event.data as Partial<PrepareEvaluationRequest>;
  if (
    input.type !== 'prepare-evaluation' ||
    !Number.isSafeInteger(input.sequence) ||
    typeof input.sequence !== 'number' ||
    input.sequence < 1 ||
    typeof input.requestId !== 'string' ||
    input.requestId.length === 0 ||
    typeof input.sourceRevision !== 'number' ||
    !input.snapshot ||
    !input.scope
  ) {
    return;
  }

  latestSequence = Math.max(latestSequence, input.sequence);
  const sequence = input.sequence;
  void prepareEvaluation(input as PrepareEvaluationRequest, mirror)
    .then((prepared) => {
      if (sequence !== latestSequence) return;
      mirror = prepared.project;
      workerScope.postMessage(prepared.result);
    })
    .catch((error: unknown) => {
      if (sequence !== latestSequence) return;
      const failed: EvaluationPreparationFailed = {
        type: 'evaluation-preparation-failed',
        sequence,
        requestId: input.requestId!,
        message: error instanceof Error ? error.message : 'Evaluation preparation failed'
      };
      workerScope.postMessage(failed);
    });
});
