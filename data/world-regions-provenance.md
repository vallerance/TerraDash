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
The continent geometries are selected from the pinned physical-region source
by `REGION` and `FEATURECLA=Continent`; the existing land layer is intersected
with those natural coastline polygons before projection. This preserves the
source's conventional seven-continent definitions without introducing
rectangular authored seams.

## Land operation and convention

The generator normalizes the pinned land FeatureCollection, performs one
deterministic polygon-clipping unary union to remove all country seams, then
intersects the dissolved land with each matching `FEATURECLA=Continent`
geometry from the pinned geography-region layer. These are Natural Earth's
conventional seven-region definitions; Europe and Asia remain necessarily
conventional, but their coastlines no longer inherit authored longitude and
latitude cut lines.

The generator asserts exactly one matching `FEATURECLA=Continent` source
feature for each of the seven names and rejects empty intersections. The
resulting land is intentionally the source's conventional seven-continent
selection; it is not described as an exhaustive or non-overlapping partition
of every Natural Earth land vertex, because that convention can leave edge
islands outside a named continent or represent conventional boundaries that
are not mutually exclusive at their shared edges.

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
