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

`data/catalog.json` is the reviewed canonical UN-English 195-location catalog. `scripts/generate-map.mjs` is the build-time boundary between source geography and render artifacts. It projects every Natural Earth source feature to a 1440×720 equirectangular SVG coordinate system, applies deterministic simplification, writes stable source-feature IDs and plural geometry references, and emits the catalog and predefined quiz definition. Generated files live in `data/generated`; do not hand-edit them.

The renderer preserves true paths and derives a screen-space minimum footprint only when the projected highlight is below `MIN_FOOTPRINT_PX`. Nearby components are clustered using the CSS-pixel `COMPONENT_CLUSTER_PROXIMITY_PX` threshold: clusters with a native-large component receive no assists, while an all-small cluster receives one assist anchored to its largest component. The seam is configurable at `MAP_SEAM_LONGITUDE` (currently 170°W) with a 100-reference-unit responsive overlap band. Wrapping translates intact source paths, so the seam does not rewrite or split geometry; one source/semantic feature may appear at both viewport edges without duplicated accessible labels. The same aligned footprint and wrapping helpers are available for future interaction, but v0 has no map-click gameplay.

## Provenance

Natural Earth: <https://www.naturalearthdata.com/>; source product: <https://github.com/nvkelso/natural-earth-vector/tree/9380cca83db5f9aef52d5e762765100745f84b27/geojson>.
