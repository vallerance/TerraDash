# TerraDash

TerraDash is a geography quiz game. The foundation slice is a React/TypeScript/Vite shell with a reproducibly generated, flat equirectangular Natural Earth world map.

## Development

```sh
npm ci
npm run generate
npm run validate:data
npm run dev
npm run format
npm run lint
npm test
npm run build
```

Vite is configured for the GitHub Pages base path `/TerraDash/`. The demo selector highlights ordinary, multipart/remote, island, observer, and microstate fixtures. It is intentionally not quiz gameplay.

## Data and architecture

`data/source/ne_50m_admin_0_countries.geojson` is Natural Earth Admin 0 countries, v5.1.1, 1:50m. Its SHA-256 and immutable raw download URL are pinned in `scripts/generate-map.mjs`; generation fails if the checked-in source differs. Natural Earth data is public domain. The map uses a neutral disclaimer because boundary representations do not imply endorsement of any boundary claim.

`data/source/ne_10m_admin_0_countries.geojson` is the pinned Natural Earth v5.1.1, 1:10m companion used only by the magnified circular inset. `data/generated/inset.json` is deterministic, generated in the same 1440×720 projection, and retains every source feature because the quiz catalog covers all 195 locations; this provides universal selected-country and neighboring-border coverage without changing the canonical 50m map. Its inset viewBox is the exact map-space extent of the main source circle, so the two circles show the same geography at different rendered scales.

`data/catalog.json` is the reviewed canonical UN-English 195-location catalog. `scripts/generate-map.mjs` is the build-time boundary between source geography and render artifacts. It projects every Natural Earth source feature to a 1440×720 equirectangular SVG coordinate system, applies deterministic simplification, writes stable source-feature IDs and plural geometry references, and emits the catalog and predefined quiz definition. Generated files live in `data/generated`; do not hand-edit them.

The renderer preserves true 50m paths on the ordinary map and uses `MIN_FOOTPRINT_PX` only to decide whether a location needs a magnified callout; it never changes rendered geometry or circle size. Only the inset reads the 10m artifact. Nearby components are clustered using the CSS-pixel `COMPONENT_CLUSTER_PROXIMITY_PX` threshold: locations with any native-large component receive no callout, while an all-small location receives one callout anchored to the cluster containing its largest component. Every callout uses the same viewport-responsive source and cutout radii with a fixed magnification ratio, regardless of region bounds. The seam is configurable at `MAP_SEAM_LONGITUDE` (currently 170°W) with a 100-reference-unit responsive overlap band. Wrapping translates intact source paths, so the seam does not rewrite or split geometry; one source/semantic feature may appear at both viewport edges without duplicated accessible labels. v0 has no map-click gameplay.

## Provenance

Natural Earth: <https://www.naturalearthdata.com/>; source product: <https://github.com/nvkelso/natural-earth-vector/tree/9380cca83db5f9aef52d5e762765100745f84b27/geojson>.
