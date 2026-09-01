import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('evidence/gates/manual-evidence.json', 'utf8'));
if (manifest.status !== 'Pass') {
  throw new Error(`Manual evidence is not Pass: ${manifest.blocker ?? manifest.status}`);
}

for (const record of manifest.records ?? []) {
  if (!existsSync(record.path)) throw new Error(`Missing manual evidence ${record.path}`);
  const digest = createHash('sha256').update(readFileSync(record.path)).digest('hex');
  if (digest !== record.sha256) throw new Error(`Stale manual evidence hash for ${record.path}`);
  if (record.proxyOnly || !record.realDevice || !record.realSafari || !record.trustedHttpsOrigin) {
    throw new Error(`Manual evidence is proxy-only or incomplete: ${record.path}`);
  }
}

console.log(`Manual evidence: ${manifest.records.length} verified records; Pass`);
