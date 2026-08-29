# TerraDash standalone islands database

A self-contained command-line tool that materializes a queryable global-islands database from permissively licensed/public-domain geographic sources. Nothing outside this directory is required.

## Data sources

- **USGS Global Islands** (public domain): canonical island enumeration, names, geodesic area, and geometry. The official USGS ArcGIS File Geodatabase item is downloaded once and cached locally.
- **Natural Earth 1:10m admin-0 map subunits** (public domain): sovereign state, country, map unit, map subunit, UN-style region/subregion, and Natural Earth association.
- **Marine Regions World EEZ v12** (CC BY 4.0): fallback jurisdiction for tiny islands omitted by Natural Earth generalized land polygons.
- **WorldPop Global2 R2025A 1 km population** (CC BY 4.0): population estimate, downloaded and aggregated only when a query requires population (or `build --population` is requested).
- **USGS GNIS** (public domain): official U.S. and dependent-area island names.
- **NGA GNS Hypsographic** (freely available U.S. Government geographic names data): approved foreign island/islet names.
- **GeoNames** (CC BY 4.0): secondary global island-name enrichment and aliases.

Raw downloads, derived geometry, SQLite rows, indexes, and materialization metadata live under `cache/` by default. Repeated queries reuse them. Set `ISLANDS_CACHE_DIR` or `--cache-dir` to put the cache elsewhere.

## Install

Recommended lightweight setup uses `uv`, which can install a current standalone Python plus prebuilt ARM64/x86_64 GIS wheels without Conda or a system GDAL build:

```bash
cd tools/islands_db
curl -LsSf https://astral.sh/uv/install.sh | sh
uv python install 3.12
uv venv --python 3.12 .venv
. .venv/bin/activate
uv pip install -r requirements.txt
```

A normal Python 3.12+ virtualenv with `pip install -r requirements.txt` also works where compatible wheels are available.

## Query

CSV is the default output format:

```bash
./islands query --length 20
./islands query --filter country=Japan --sort area_km2 --direction desc --length 100
./islands query --filter country=Indonesia --sort population --direction desc --skip 0 --length 100
```

JSON is explicit:

```bash
./islands query --filter region=Asia --sort population --direction desc --length 10 --format json
```

Filters use `FIELD[.OP]=VALUE`; multiple filters are ANDed. Supported operators are `eq` (default), `ne`, `gt`, `gte`, `lt`, `lte`, and `like`.

```bash
./islands query \
  --filter country=Indonesia \
  --filter population.gte=100000 \
  --filter area_km2.gt=50 \
  --sort population --direction desc
```

Country/region/map-unit/map-subunit filters match _all_ jurisdictions associated with an island, not just the largest-overlap jurisdiction flattened into the main row. This means a multi-country island such as Borneo remains discoverable under every associated country.

Defaults: sort `name` ascending, `skip=0`, `length=100`, format `csv`, population year `2025`.

## Materialization and caching

Every query first ensures only the materializations it needs:

1. USGS island base (names and published geodesic area, read in attribute-only chunks)
2. Analysis-resolution island geometry + Natural Earth jurisdiction/association overlay, processed in resumable subprocess chunks
3. WorldPop population only when population is filtered or sorted

Population is aggregated tile-by-tile: each WorldPop raster block queries overlapping cached island analysis geometries through SQLite R-tree bounds, rasterizes island IDs for that block, and accumulates population into a resumable on-disk NumPy array. It does not independently scan the global raster once per island and does not load all island geometry into memory.

Prebuild everything explicitly:

```bash
./islands build --population --population-year 2025
```

Inspect cached materializations:

```bash
./islands status
```

Delete the cache directory to force a complete rebuild. Long geometry and population materializations use progress checkpoints so interrupted runs resume without repeating completed chunks. Materializations record their source/version so future source-version-aware invalidation can be added without changing the query interface.

### Low-memory/resumable GIS processing

The source USGS coastline geometry is much higher resolution than the 1 km population raster needs. The tool keeps the original cached File Geodatabase authoritative, while derived geometry is simplified to analysis resolution. Natural Earth processing runs in bounded subprocess chunks with filesystem checkpoint markers, so native GDAL/GEOS memory is released between chunks and interrupted builds resume instead of restarting. Exact overlap calculations are only performed for islands that intersect multiple Natural Earth units.

## Output columns

`id`, `usgs_id`, `name`, `alternate_names`, `name_source`, `name_source_id`, `name_match_method`, `area_km2`, `population`, `population_year`, `population_source`, `population_method`, `latitude`, `longitude`, `ne_feature_id`, `ne_name`, `sovereign_state`, `country`, `map_unit`, `map_subunit`, `region`, `subregion`.

The flattened Natural Earth fields represent the jurisdiction with the greatest island-area overlap. All overlaps are retained in the internal `jurisdictions` table with `area_fraction` so filters remain correct for divided islands.

## Tests

```bash
python -m pytest
```

### Name enrichment

USGS Global Islands remains authoritative for island enumeration and geometry, but its name fields are incomplete. The tool treats blank/`UNNAMED` values as missing and enriches names deterministically in this priority order:

1. usable USGS primary name
2. usable USGS alternate/local name
3. GNIS official `Island` name for U.S. coverage
4. NGA GNS approved individual-island/islet name (`ISL`, `ISLT`, `ISLX`) for foreign coverage
5. GeoNames individual-island feature name

Gazetteer names are accepted only when their feature coordinate is covered by the USGS island polygon; nearest-neighbor guessing is not used. All matched names and provenance are retained in the internal `island_names` table. Primary query output exposes `name_source`, `name_source_id`, and `name_match_method`. Group/archipelago designations such as GNS/GeoNames `ISLS` are not promoted to the name of a single island polygon.
