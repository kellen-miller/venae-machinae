import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

import { afterEach, describe, expect, it } from 'vitest';

import type { Server } from 'node:net';

const listeners: Server[] = [];

afterEach(async () => {
  await Promise.all(
    listeners.splice(0).map(async (server) => {
      server.close();
      await once(server, 'close');
    })
  );
});

describe('production server startup', () => {
  it.each(['127.0.0.1', '::1'])('rejects an occupied %s loopback port', async (host) => {
    const listener = createServer();
    listeners.push(listener);
    listener.listen(0, host);
    await once(listener, 'listening');

    const address = listener.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP listener address');

    const child = spawn(process.execPath, ['scripts/start-production-server.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOST: 'localhost',
        ORIGIN: `http://localhost:${address.port}`,
        PORT: String(address.port)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const output: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => output.push(chunk));

    const [code] = await once(child, 'close');

    expect(code).not.toBe(0);
    expect(Buffer.concat(output).toString('utf8')).toContain(
      `Port ${address.port} is already in use on ${host}`
    );
  });
});
