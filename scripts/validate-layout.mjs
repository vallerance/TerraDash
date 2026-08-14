import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const css = await readFile(
  resolve(import.meta.dirname, '../src/styles.css'),
  'utf8',
);

if (/\b100vw\b|50vw/.test(css))
  throw new Error('layout must not use viewport breakout arithmetic');
for (const required of [
  '--page-gutter: clamp(1rem, 2vw, 2rem);',
  'height: 100dvh;',
  'overflow: hidden;',
  'width: calc(100% - 2 * var(--page-gutter));',
  'max-width: none;',
  '.active-player > :not(.full-bleed-map):not(.map-stage)',
  'width: min(100%, 720px);',
  '.full-bleed-map',
  'border-radius: 0.75rem;',
]) {
  if (!css.includes(required))
    throw new Error(`layout contract is missing: ${required}`);
}

console.log(
  'Layout validation passed: quiz is wide, viewport-bound, and overflow-safe.',
);
