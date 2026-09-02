import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
  it('defaults to the canonical localhost:4173 origin', () => {
    const source = readFileSync('scripts/start-production-server.mjs', 'utf8');
    expect(source).toContain("process.env.PORT ?? '4173'");
    expect(source).toContain('process.env.ORIGIN ?? canonicalOrigin');
  });

  it.each(['127.0.0.1', '::1', '0.0.0.0'])('rejects noncanonical HOST %s', async (host) => {
    const child = spawn(process.execPath, ['scripts/start-production-server.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOST: host,
        ORIGIN: 'http://localhost:4173',
        PORT: '4173'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const output: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => output.push(chunk));

    const [code] = await once(child, 'close');
    expect(code).not.toBe(0);
    expect(Buffer.concat(output).toString('utf8')).toContain(
      'HOST must be localhost for the local-only application server'
    );
  });

  it('rejects a noncanonical ORIGIN host', async () => {
    const child = spawn(process.execPath, ['scripts/start-production-server.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOST: 'localhost',
        ORIGIN: 'http://127.0.0.1:4173',
        PORT: '4173'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const output: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => output.push(chunk));

    const [code] = await once(child, 'close');
    expect(code).not.toBe(0);
    expect(Buffer.concat(output).toString('utf8')).toContain(
      'ORIGIN must match the canonical localhost origin http://localhost:4173'
    );
  });

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
