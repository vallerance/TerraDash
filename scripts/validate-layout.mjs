import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const css = await readFile(
  resolve(import.meta.dirname, '../src/styles.css'),
  'utf8',
);

if (/\b100vw\b|50vw/.test(css))
  throw new Error('layout must not use viewport breakout arithmetic');
for (const required of [
  'width: min(100%, 1320px);',
  '.active-player > :not(.full-bleed-map)',
  'width: min(100%, 60ch);',
  '.full-bleed-map',
  'border-radius: 0.75rem;',
]) {
  if (!css.includes(required))
    throw new Error(`layout contract is missing: ${required}`);
}

console.log('Layout validation passed: map is bounded and framed.');
