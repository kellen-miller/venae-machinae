import { once } from 'node:events';
import { connect, createServer } from 'node:net';

const host = process.env.HOST ?? 'localhost';
const port = Number(process.env.PORT ?? '3000');

if (host !== 'localhost') {
  throw new Error('HOST must be localhost for the local-only application server');
}

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`PORT must be an integer between 1 and 65535; received ${process.env.PORT}`);
}

for (const loopback of ['127.0.0.1', '::1']) {
  const connection = connect({ host: loopback, port });

  try {
    await once(connection, 'connect');
    throw new Error(`Port ${port} is already in use on ${loopback}`);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ECONNREFUSED')) {
      throw error;
    }
  } finally {
    connection.destroy();
  }

  const probe = createServer();

  try {
    probe.listen({ host: loopback, port, exclusive: true });
    await once(probe, 'listening');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE') {
      throw new Error(`Port ${port} is already in use on ${loopback}`, { cause: error });
    }

    throw error;
  } finally {
    if (probe.listening) {
      probe.close();
      await once(probe, 'close');
    }
  }
}

await import('../build/index.js');
