# Developing states and provinces quizzes

This guide is the operating procedure for adding a mapped quiz whose answers
are states, provinces, or another administrative geography. It applies to
both the ordinary map and its magnified inset. The source data and declarative
quiz configuration are the product boundary; the shared renderer must remain
geography-agnostic.

## 1. Preflight the source and the existing contract

Before editing, work from an upstream branch/worktree and inspect:

- `README.md` for the current projection, source products, and provenance;
- `data/source/` and `data/geometry-sources.json` for pinned files, URLs,
  checksums, licenses, and attribution;
- `data/locations.json`, `data/quizzes.json`, and
  `data/reviewed-invariants.json` for the authored contract;
- `src/quizMapBoundary.ts`, `src/map/renderModel.ts`, `src/map/MapCanvas.tsx`,
  and `src/mapProjection.ts` for the generic map path;
- `src/quizContractRegression.test.ts`, `src/mapProjection.test.ts`, and
  `browser/us-states.spec.ts` for existing contract and evidence patterns.

Confirm that the requested geography is actually represented by the available
source. Resolve every answer to a unique source feature or a documented
replacement. Do not silently substitute an adjacent country, capital, parent
region, or a convenient but wrong polygon. If the source is insufficient,
pause for a reviewed source addition and record its immutable URL, SHA-256,
license, and attribution.

Keep scope decisions explicit. For example, excluding territories from quiz
membership does not authorize deleting them from the rendered parent-country
context. Selectable membership and visible surrounding land are separate
concerns.

## 2. Author the data and reviewed invariants

`data/locations.json` is the sole authored location registry. Add one stable
ID, display name, and resolution for each answer:

- use `resolution.kind: "source-keys"` when the generator should resolve a
  pinned source property/key;
- use `resolution.kind: "exact-refs"` only when the reviewed generated feature
  IDs are intentionally fixed.

Add the quiz definition and its membership in `data/quizzes.json`. A mapped
quiz normally declares:

```json
{
  "category": "regional",
  "locationIds": ["..."],
  "map": {
    "contextFeatureExclusions": [],
    "baseLayerLocationIds": ["..."],
    "viewBox": "x y width height",
    "preserveAspectRatio": "xMidYMid meet",
    "standardParallel": 0,
    "wrapWidth": 1440,
    "seamLongitude": 0,
    "wrapActive": true,
    "selectable": true
  }
}
```

Use the actual appropriate parallel and seam for the source geography; the
values above are illustrative defaults, not a Canada- or US-specific recipe.
`baseLayerLocationIds` must be a subset of quiz membership. Keep the parent or
other unreplaced land out of `contextFeatureExclusions` unless there is a
reviewed reason to exclude it. `mapLayerForQuiz` derives the runtime
`contextFeatureIds` from generated source features after subtracting those
authored exclusions. The retained context renders beneath base layers and is
non-selectable.

Update the matching `data/reviewed-invariants.json` sets. The authored
location IDs and every quiz membership must have a reviewed baseline. Do not
hand-edit `data/generated/*`; the generator owns those files.

If a source lacks a needed shape, use the existing supplemental-source and
replacement contract (`data/geometry-sources.json` plus the generator’s
provenance output). Keep replacement provenance complete and one-to-one.

## 3. Choose the projection first, then derive the viewport

The generator emits the main map in a 1440×720 flat equirectangular coordinate
system. A regional layer may apply the shared `standardParallel` transform in
`src/mapProjection.ts`. That transform changes rendered Y coordinates around
the configured viewBox midpoint; therefore a raw source extent is not a
viewport extent.

Choose the parallel from the geography and source characteristics first. Do
not change it merely to make clipping disappear. Because production projects
around the viewBox midpoint, derive the box with a convergent loop:

1. resolve all base-layer paths and the complete retained context paths;
2. choose a candidate center and box at the intended regional aspect ratio
   (the existing regional layout is approximately 41:18);
3. project the composition with
   `createMapProjection(standardParallel, candidateBoxCenterY)`;
4. fit a padded box around those projected bounds, preserving the target
   aspect ratio;
5. use the fitted box’s midpoint as the next candidate center and repeat until
   the fitted box midpoint is the one used for projection and the bounds remain
   contained; and
6. validate the final authored values through that same
   `createMapProjection` path, then verify wide, tablet, and mobile sizes.

The viewport must contain every selectable layer and the complete intended
parent/context composition. A box that contains only the provinces can still
clip the Arctic, islands, or unreplaced territory context. A box that contains
raw coordinates but not projected coordinates is also invalid.

Use the declarative map fields rather than adding a branch to the renderer.
Never add a quiz-ID predicate, geography-specific React/TypeScript component,
CSS branch, alternate renderer, or geography helper to compensate for a data
or projection error.

## 4. Multipart, tiny, and coastal geography

Treat geometry as a set of valid parts, not necessarily one polygon. Before
accepting a location, check its generated `geometryRefs`, map feature paths,
and inset feature paths. Preserve islands, coastal fragments, and remote parts
when they are part of the source contract.

Pay special attention to:

- multipart provinces/states and separated coastal pieces;
- tiny islands such as Prince Edward Island, which should remain selectable
  and use the shared magnifier when its rendered footprint is small;
- British Columbia and other island-rich coasts, where source detail and
  context layering must remain visible;
- Newfoundland and Labrador, whose mainland and island parts must remain
  distinct and visible;
- dateline/seam-adjacent paths, which must wrap as intact paths rather than
  being rewritten or split.

The shared footprint/callout system is responsible for responsive assistance.
Do not hide, delete, inflate, or hand-position a valid part to make a screenshot
look cleaner.

## 5. Generate and verify provenance

From the repository root, run the low-level checks locally only when they are
appropriately scoped; the full suite belongs in GitHub Actions:

```sh
npm ci
npm run generate
npm run validate:data
git diff -- data/generated
```

Generation must be deterministic. Review the generated diff and manifest for:
source URL/checksum, feature IDs, geometry references, replacements, and inset
coverage. Generated artifacts are `data/generated/inset.json`,
`locations.json`, `manifest.json`, and `map.json`. Commit generated changes
only when they are the deterministic result of authored/source changes.

`npm run validate:data` checks authored/generated identity, reviewed baselines,
quiz membership, map indexes, exact geometry refs, source usage, replacement
provenance, and inset coverage. Treat any failure as a contract problem to
resolve—not as a reason to weaken validation.

## 6. Add generic regression coverage

Regression tests must describe the mapped-quiz contract, not a country. For
every `quizOptions` entry with `map`:

- resolve all configured base layers;
- project their paths using the same standard parallel and viewBox midpoint as
  production;
- normalize wrapped copies using the configured wrap width and seam;
- assert every rendered base-layer bound is inside the configured viewport;
- assert retained context is present and intersects the mapped composition;
- verify multipart paths remain non-empty and resolvable.

Use fixtures or invariants to represent data facts. Do not select only the
first mapped quiz, assume a fixed answer count, assert “first N” entries, or
write a Canada/US quiz-ID predicate. Runtime and contract tests should continue
to pass if another mapped quiz is added.

## 7. Evidence and CI

Open the canonical PR early from the upstream branch and include the originating
public channel when creating the project PR. Use a disposable, uncommitted
Playwright harness for task-shaped evidence when the existing browser suite
does not cover the new geography. The harness must leave no repository diff.

Capture and review at minimum:

- full regional composition at wide, tablet, and mobile sizes;
- the most island/coastal-rich area (including BC/coastal islands where
  applicable);
- the smallest selectable part with its magnifier (PEI-like case);
- a multipart/coastal case (Newfoundland-and-Labrador-like case);
- normal answer submission and advance flow;
- visible parent/context land, including unreplaced surrounding geography.

The required CI shape is the repository workflow’s complete validation,
format/lint, deterministic generation, data validation, full Vitest suite,
build, browser suite, and live smoke where the workflow supports it. Inspect
the exact head SHA in the completed run. Do not claim visual acceptance from a
generic browser artifact that lacks the task-shaped screenshots.

Before handoff, compare the complete diff against its canonical base, check the
worktree is clean, and record the generated-artifact accounting, evidence
artifact, CI URL, PR URL, exact SHA, failed-check disposition, and residual
risks. Do not merge merely because CI is green; merge only after required
review/visual acceptance and under the active repository authority and process.

## Troubleshooting lessons

### US States

The US regional work established the reusable pattern: declarative regional
viewport/wrap settings, a configured parallel, generic layer separation, and
tests/evidence derived from configuration. Fixed state counts, first-eight
assumptions, and hard-coded submenu labels became compatibility defects as
configuration evolved. Derive expected labels, counts, and layers from the
authored quiz configuration.

### Canadian Provinces

The Canadian work exposed two additional failure modes. First, inheriting the
world seam/projection defaults while using a regional viewBox can wrap or clip
the composition. Second, excluding the parent Canada feature while adding only
province overlays removes territories and unreplaced land. Restore the generic
context-underlay path, keep the parent non-selectable, and derive the viewport
from post-projection bounds. Retain the appropriate high-latitude parallel;
never flatten the projection solely to fit an old box.

Both lessons have the same architectural conclusion: put geography facts in
source/data/config and keep rendering, tests, and responsive behavior generic.
