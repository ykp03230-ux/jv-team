// 사용법: node tests/run.mjs            (로컬 wrangler dev, 127.0.0.1:8787)
//         BASE_URL=https://주소 node tests/run.mjs   (배포된 사이트)
//         node tests/run.mjs 1 3          (특정 시나리오만)
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { makeRunner, BASE } from './lib.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2).map(Number).filter(Boolean);
const files = readdirSync(dir).filter((f) => /^s\d+\.mjs$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

const runner = makeRunner();
console.log(`대상: ${BASE}\n`);
for (const f of files) {
  const mod = await import(pathToFileURL(join(dir, f)).href);
  if (only.length && !only.includes(mod.num)) continue;
  await runner.scenario(mod.num, mod.title, mod.method, mod.run);
}
const failed = runner.report();
process.exit(failed ? 1 : 0);
