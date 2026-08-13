import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const index = await readFile(resolve(root, 'index.html'), 'utf8');
const favicon = await readFile(resolve(root, 'public/favicon.svg'), 'utf8');

if (!index.includes('<title>TerraDash</title>'))
  throw new Error('index.html must set the document title to TerraDash');
if (!index.includes('rel="icon" type="image/svg+xml" href="/favicon.svg"'))
  throw new Error('index.html must link the SVG favicon');
if (!favicon.includes('fill="#071a2b"') || !favicon.includes('fill="#f5b942"'))
  throw new Error('favicon must use the dark-ocean and amber palette');

console.log('Branding validation passed: title and SVG favicon are wired.');
