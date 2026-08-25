import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const generatorRoot = new URL('./generator/', import.meta.url);
const cliPath = new URL('./generate-map.mjs', import.meta.url);
const source = fs.readFileSync(cliPath, 'utf8');
const modules = [
  [
    'scripts/generator/constants.mjs',
    fs.readFileSync(new URL('constants.mjs', generatorRoot), 'utf8'),
  ],
  [
    'scripts/generator/geometry.mjs',
    fs.readFileSync(new URL('geometry.mjs', generatorRoot), 'utf8'),
  ],
  [
    'scripts/generator/artifacts.mjs',
    fs.readFileSync(new URL('artifacts.mjs', generatorRoot), 'utf8'),
  ],
];

describe('Phase 6 generator and entrypoint boundaries', () => {
  it('keeps generator filesystem, formatting, logging, and failure effects in the CLI', () => {
    expect(source).toMatch(/readFileSync|writeFileSync|execFileSync|console\.log/);
    expect(modules.map(([, text]) => text).join('\n')).not.toMatch(
      /readFileSync|writeFileSync|execFileSync|console\.log|process\.exit/,
    );
  });

  it('keeps projection and artifact assembly in one production module each', () => {
    expect(source).not.toMatch(/function project\s*\(/);
    expect(source).not.toMatch(/function buildGeometryFeature\s*\(/);
    expect(source).not.toMatch(/const map = \{/);
    expect(source).not.toMatch(/const inset = \{/);
    expect(modules.find(([path]) => path.endsWith('/geometry.mjs'))[1]).toMatch(
      /export function project\(/,
    );
    expect(modules.find(([path]) => path.endsWith('/artifacts.mjs'))[1]).toMatch(
      /export function buildMapArtifact\(/,
    );
  });

  it('removes browser compatibility exports and imports', () => {
    const main = fs.readFileSync(
      new URL('../src/main.tsx', import.meta.url),
      'utf8',
    );
    const diagnostics = fs.readFileSync(
      new URL('../src/diagnostics.tsx', import.meta.url),
      'utf8',
    );
    expect(main).not.toMatch(/export\s*\{/);
    expect(diagnostics).not.toMatch(/export\s*\{/);
    expect(main + diagnostics).not.toMatch(
      /from ['"].*\/(main|diagnostics)['"];/,
    );
  });
});
