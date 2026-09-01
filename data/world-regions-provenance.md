# World regions derivation provenance

This record defines the reproducible source boundary for exactly twelve
selectable features: seven land regions (Africa, Antarctica, Asia, Europe,
North America, South America, and Oceania) and five oceans.

## Pinned inputs

Natural Earth v5.1.1-era repository data is pinned at commit
`9380cca83db5f9aef52d5e762765100745f84b27`; Natural Earth data is public domain.

| Input                                    | SHA-256                                                            | Local path                                        |
| ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| `ne_10m_land.geojson`                    | `1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416` | `.scratch/ne_10m_land.geojson`                    |
| `ne_10m_geography_regions_polys.geojson` | `b7b26e50ea917d3696aec87f932def2bf5f890f5770e441d59c162c6f4c92a77` | `.scratch/ne_10m_geography_regions_polys.geojson` |
| `ne_10m_geography_marine_polys.geojson`  | `53f865e8ffa966cdd402145c82c5cd14ee7ce974cd0eb9a3f59f03a4cfd2d66`  | `.scratch/ne_10m_geography_marine_polys.geojson`  |

The exact raw URLs and checks are in `scripts/derive-world-regions.mjs`.
The seven authored WGS84 mask polygons are in
`data/source/world-region-boundaries.geojson`.

## Land operation and convention

The generator normalizes the pinned land FeatureCollection, performs one
deterministic polygon-clipping unary union to remove all country seams, then
intersects the dissolved land with the seven masks. The masks use explicit
world coordinates: the Americas split at 9°N (the Panama land-bridge
convention), Africa occupies the 20°W–60°E band south of 37°N, Europe is west
of 60°E north of 37°N, Asia occupies 60°E–180°E except south of 30°N east of
141°E, and Antarctica is south of 60°S. Oceania occupies that east-of-141°E,
south-of-30°N mask. These authored masks are disjoint at their boundaries, so
the generator does not subtract the detailed physical-region polygons (that
operation is unnecessarily unstable on this source's very dense rings). The
pinned geography-region layer is still checked for Oceania features as
provenance corroboration. The coordinate rule assigns Australia, New Zealand,
Papua New Guinea and Pacific islands east of 141°E to Oceania; Indonesia,
Malaysia, the Philippines and Timor-Leste remain in Asia. This is a documented
conventional seven-region partition, not a claim that Natural Earth publishes
an exhaustive geological continent layer; Europe/Asia is necessarily
conventional.

Tests assert exactly seven land outputs, valid non-empty geometry, and
exhaustive/non-overlapping assignment of the dissolved land to the masks.

## Ocean operation and audit

Ocean geometry is unchanged: the generator selects exact `properties.name`
features and only flattens their Polygon/MultiPolygon members. It performs no
union, clipping, projection, or coordinate editing. The pinned inventory is
Arctic Polygon×1, Southern Polygon×1, North Atlantic Polygon×1, Indian
Polygon×1, North Pacific MultiPolygon×1, and South Pacific MultiPolygon×1;
the requested Atlantic and Pacific outputs retain their source component
seams and Pacific antimeridian rings. Joshua's supplied screenshot shows the
Europe selection and country seams, not an ocean overlay, so it is not evidence
for a particular ocean edge. No marine source replacement is justified.

## IDs and reproduction

The sole authored land target is `world:oceania`; `world:australia` is not an
authored ID and no alias is added. Scoped searches of authored data, generated
artifacts, source/scripts/tests, routes, high-score storage, and repository
history found no persisted location-ID or compatibility contract requiring one.
The unrelated `iso:AUS` country ID remains unchanged.

Run `node scripts/derive-world-regions.mjs --output
.scratch/world-regions.geojson` from the repository root. The script downloads
missing pinned inputs, verifies their SHA-256 values, validates GeoJSON, emits
exactly twelve stable IDs, and writes disposable derivation evidence. The map
generator alone owns committed `data/generated/*` artifacts.
