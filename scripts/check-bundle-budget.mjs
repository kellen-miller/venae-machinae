import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

if (!existsSync('build')) throw new Error('build/ is absent; run pnpm build first');

const bytes = { '.css': 0, '.js': 0, total: 0 };

function measure(path) {
  const entry = statSync(path);
  if (entry.isDirectory()) {
    for (const child of readdirSync(path)) measure(join(path, child));
    return;
  }

  bytes.total += entry.size;
  const extension = extname(path);
  if (extension in bytes) bytes[extension] += entry.size;
}

measure('build');
const budgets = { '.css': 512 * 1024, '.js': 2 * 1024 * 1024, total: 8 * 1024 * 1024 };
const exceeded = Object.entries(budgets).filter(([kind, budget]) => bytes[kind] > budget);
if (exceeded.length) {
  throw new Error(
    exceeded.map(([kind, budget]) => `${kind}: ${bytes[kind]} > ${budget}`).join('\n')
  );
}

console.log(`Bundle bytes: js=${bytes['.js']} css=${bytes['.css']} total=${bytes.total}; Pass`);
