import { mount, tick } from 'svelte';

import type { RendererIntent } from '../../../src/lib/renderer/intent';
import RendererGateHarness from './RendererGateHarness.svelte';

const intentLog: RendererIntent[] = [];

export async function mountRendererGate(): Promise<void> {
  intentLog.length = 0;
  document.body.replaceChildren();
  const target = document.createElement('div');
  document.body.append(target);
  mount(RendererGateHarness, {
    target,
    props: {
      recordIntent(intent) {
        intentLog.push(structuredClone(intent));
      }
    }
  });
  await tick();
}

export function readRendererIntentLog(): RendererIntent[] {
  return structuredClone(intentLog);
}
