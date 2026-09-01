import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const routesRoot = 'src/routes';
const allowedEndpoints = new Set(['src/routes/health/+server.ts', 'src/routes/version/+server.ts']);
const violations = [];

function inspect(path) {
  if (!existsSync(path)) return;
  if (statSync(path).isDirectory()) {
    for (const child of readdirSync(path)) inspect(join(path, child));
    return;
  }

  const normalized = relative('.', path);
  if (/\+(?:page|layout)\.server\.[jt]s$/.test(normalized)) {
    violations.push(`${normalized}: server load/action module is prohibited for project routes`);
  }

  if (/\+server\.[jt]s$/.test(normalized) && !allowedEndpoints.has(normalized)) {
    violations.push(`${normalized}: only /health and /version endpoints are allowed`);
  }
}

inspect(routesRoot);
if (violations.length) throw new Error(`Server boundary violations:\n${violations.join('\n')}`);
console.log('Server boundary: delivery-only endpoints; Pass');
