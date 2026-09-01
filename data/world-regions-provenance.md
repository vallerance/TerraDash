# World regions derivation provenance

This record defines the reproducible source boundary for the twelve features
that will later be consumed by the world quiz. The derived collection contains
exactly these names: Africa, Antarctica, Asia, Europe, North America, South
America, Australia, Arctic Ocean, Atlantic Ocean, Indian Ocean, Pacific Ocean,
and Southern Ocean.

## Pinned inputs

Both inputs are Natural Earth v5.1.1-era repository data at commit
`9380cca83db5f9aef52d5e762765100745f84b27`. Natural Earth data is public domain
and is attributed to Natural Earth.

| Input             | URL                                                                                                                                                   | SHA-256                                                            | Local path                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| Admin-0 countries | https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_admin_0_countries.geojson      | `239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255` | `data/source/ne_10m_admin_0_countries.geojson`   |
| Marine polygons   | https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_geography_marine_polys.geojson | `53f865e8ffa966cdd402145c82c5cd14ee7ce974cd0eb9a3f59f03a4cfd2d66c` | `.scratch/ne_10m_geography_marine_polys.geojson` |

The marine layer is selected by exact `properties.name` values. The script
rejects a missing named feature and does not automatically include other named
marine polygons.

## Source-to-target mapping

| Output ID / display name                | Source selection                                                              | Treatment                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `world:africa` / Africa                 | Admin-0 `CONTINENT == "Africa"`                                               | Assemble all matching source Polygon/MultiPolygon parts.                                                  |
| `world:antarctica` / Antarctica         | Admin-0 `CONTINENT == "Antarctica"`                                           | Assemble all matching source parts; polar coordinates are preserved.                                      |
| `world:asia` / Asia                     | Admin-0 `CONTINENT == "Asia"`                                                 | Assemble all matching source parts.                                                                       |
| `world:europe` / Europe                 | Admin-0 `CONTINENT == "Europe"`                                               | Assemble all matching source parts.                                                                       |
| `world:north-america` / North America   | Admin-0 `CONTINENT == "North America"`                                        | Assemble all matching source parts.                                                                       |
| `world:south-america` / South America   | Admin-0 `CONTINENT == "South America"`                                        | Assemble all matching source parts.                                                                       |
| `world:australia` / Australia           | Admin-0 `CONTINENT == "Oceania"`                                              | The full Natural Earth Oceania group is labeled Australia, as required by the seven-continent quiz model. |
| `world:arctic-ocean` / Arctic Ocean     | Marine `name == "Arctic Ocean"`                                               | Preserve the exact marine polygon(s).                                                                     |
| `world:atlantic-ocean` / Atlantic Ocean | Marine `name == "North Atlantic Ocean"` plus `name == "South Atlantic Ocean"` | Assemble both named source polygons as one MultiPolygon.                                                  |
| `world:indian-ocean` / Indian Ocean     | Marine `name == "INDIAN OCEAN"`                                               | Preserve the exact marine polygon(s).                                                                     |
| `world:pacific-ocean` / Pacific Ocean   | Marine `name == "North Pacific Ocean"` plus `name == "South Pacific Ocean"`   | Assemble both named source polygons; source antimeridian rings are retained.                              |
| `world:southern-ocean` / Southern Ocean | Marine `name == "SOUTHERN OCEAN"`                                             | Preserve the exact marine polygon(s); polar rings are retained.                                           |

Transcontinental/admin treatment is inherited unchanged from the source
`CONTINENT` property. No country is reclassified by this derivation, and no
hand-authored boundary or coordinate is introduced. The script does not run a
topological dissolve: it preserves every source polygon part in a stable
MultiPolygon, avoiding a non-reproducible floating-point union and preserving
islands, polar rings, and antimeridian seams.

## Reproduction

From the repository root, after placing the two files at the pinned local paths:

```sh
node scripts/derive-world-regions.mjs --output .scratch/world-regions.geojson
```

The script verifies both SHA-256 values, validates FeatureCollection input,
requires Polygon/MultiPolygon geometry, selects exactly the mappings above, and
emits canonical two-space JSON with a trailing newline. It emits no committed
generated artifact; `.scratch/world-regions.geojson` is disposable derivation
evidence.
