# TerraDash standalone islands database

A self-contained command-line tool that materializes a queryable global-islands database from permissively licensed/public-domain geographic sources. Nothing outside this directory is required.

## Data sources

- **USGS Global Islands** (public domain): canonical island enumeration and geometry. The ScienceBase item is resolved dynamically and cached.
- **Natural Earth 1:10m admin-0 map subunits** (public domain): sovereign state, country, map unit, map subunit, UN-style region/subregion, and Natural Earth association.
- **Marine Regions World EEZ v12** (CC BY 4.0): fallback jurisdiction for tiny islands omitted by Natural Earth generalized land polygons.
- **WorldPop Global2 R2025A 1 km population** (CC BY 4.0): population estimate, downloaded and aggregated only when a query requires population (or `build --population` is requested).

Raw downloads, derived geometry, SQLite rows, indexes, and materialization metadata live under `cache/` by default. Repeated queries reuse them. Set `ISLANDS_CACHE_DIR` or `--cache-dir` to put the cache elsewhere.

## Install

Requires Python 3.9+. On platforms where PyPI provides GeoPandas/Rasterio wheels:

```bash
cd tools/islands_db
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

For platforms without compatible GDAL/Rasterio wheels (including some ARM64/Python combinations), use the included conda-forge environment instead; it remains entirely independent of the rest of TerraDash:

```bash
micromamba create -f environment.yml -p .env
micromamba run -p .env ./islands query --length 20
```

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

Country/region/map-unit/map-subunit filters match *all* jurisdictions associated with an island, not just the largest-overlap jurisdiction flattened into the main row. This means a multi-country island such as Borneo remains discoverable under every associated country.

Defaults: sort `name` ascending, `skip=0`, `length=100`, format `csv`, population year `2025`.

## Materialization and caching

Every query first ensures only the materializations it needs:

1. USGS island base (geometry, representative point, geodesically appropriate equal-area land area)
2. Natural Earth jurisdiction/association overlay
3. WorldPop population only when population is filtered or sorted

Population is aggregated tile-by-tile: each raster block spatially selects overlapping islands, rasterizes island IDs for that block, and sums population with a vectorized bincount. It does not independently scan the global raster once per island.

Prebuild everything explicitly:

```bash
./islands build --population --population-year 2025
```

Inspect cached materializations:

```bash
./islands status
```

Delete the cache directory to force a complete rebuild. Materializations record their source/version so future source-version-aware invalidation can be added without changing the query interface.

## Output columns

`id`, `usgs_id`, `name`, `alternate_names`, `area_km2`, `population`, `population_year`, `population_source`, `population_method`, `latitude`, `longitude`, `ne_feature_id`, `ne_name`, `sovereign_state`, `country`, `map_unit`, `map_subunit`, `region`, `subregion`.

The flattened Natural Earth fields represent the jurisdiction with the greatest island-area overlap. All overlaps are retained in the internal `jurisdictions` table with `area_fraction` so filters remain correct for divided islands.

## Tests

```bash
python -m pytest
```
