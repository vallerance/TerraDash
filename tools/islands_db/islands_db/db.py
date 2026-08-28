from __future__ import annotations
import csv, json, sqlite3, sys
from pathlib import Path

FIELDS = [
    "id","usgs_id","name","alternate_names","area_km2","population","population_year","population_source","population_method",
    "latitude","longitude","ne_feature_id","ne_name","sovereign_state","country","map_unit","map_subunit","region","subregion"
]
SORTABLE = set(FIELDS)
FILTERABLE = set(FIELDS) | {"jurisdiction"}
OPS = {"eq":"=","ne":"!=","gt":">","gte":">=","lt":"<","lte":"<=","like":"LIKE"}

def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    c=sqlite3.connect(path)
    c.row_factory=sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.executescript('''
    CREATE TABLE IF NOT EXISTS islands(
      id INTEGER PRIMARY KEY, usgs_id TEXT, name TEXT, alternate_names TEXT,
      area_km2 REAL, population REAL, population_year INTEGER, population_source TEXT, population_method TEXT,
      latitude REAL, longitude REAL, ne_feature_id TEXT, ne_name TEXT,
      sovereign_state TEXT, country TEXT, map_unit TEXT, map_subunit TEXT, region TEXT, subregion TEXT
    );
    CREATE TABLE IF NOT EXISTS jurisdictions(
      island_id INTEGER NOT NULL, sovereign_state TEXT, country TEXT, map_unit TEXT, map_subunit TEXT,
      region TEXT, subregion TEXT, area_fraction REAL, ne_feature_id TEXT, ne_name TEXT,
      FOREIGN KEY(island_id) REFERENCES islands(id)
    );
    CREATE TABLE IF NOT EXISTS island_geometry(
      island_id INTEGER PRIMARY KEY, wkb BLOB NOT NULL, minx REAL, miny REAL, maxx REAL, maxy REAL,
      FOREIGN KEY(island_id) REFERENCES islands(id)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS island_geometry_rtree USING rtree(island_id,minx,maxx,miny,maxy);
    CREATE TABLE IF NOT EXISTS materializations(name TEXT PRIMARY KEY, source_version TEXT, generated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_islands_name ON islands(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_islands_usgs ON islands(usgs_id);
    CREATE INDEX IF NOT EXISTS idx_islands_country ON islands(country);
    CREATE INDEX IF NOT EXISTS idx_islands_region ON islands(region);
    CREATE INDEX IF NOT EXISTS idx_j_country ON jurisdictions(country);
    CREATE INDEX IF NOT EXISTS idx_j_region ON jurisdictions(region);
    ''')
    return c

def parse_filter(expr: str):
    if "=" not in expr: raise ValueError(f"invalid filter {expr!r}; expected FIELD[.OP]=VALUE")
    lhs,value=expr.split("=",1); parts=lhs.rsplit(".",1)
    field=parts[0]; op=parts[1] if len(parts)==2 else "eq"
    if field not in FILTERABLE: raise ValueError(f"unsupported filter field: {field}")
    if op not in OPS: raise ValueError(f"unsupported filter operator: {op}")
    return field,op,value

def query(c, filters, sort, direction, skip, length):
    if sort not in SORTABLE: raise ValueError(f"unsupported sort field: {sort}")
    if direction.lower() not in ("asc","desc"): raise ValueError("direction must be asc or desc")
    where=[]; args=[]
    for raw in filters:
        field,op,value=parse_filter(raw)
        if field=="jurisdiction":
            where.append("EXISTS (SELECT 1 FROM jurisdictions j WHERE j.island_id=i.id AND (j.country=? OR j.map_unit=? OR j.map_subunit=? OR j.sovereign_state=?))")
            args += [value]*4; continue
        # country/region filters match every jurisdiction, not only flattened primary one.
        if field in {"country","region","map_unit","map_subunit","sovereign_state"} and op=="eq":
            where.append(f"EXISTS (SELECT 1 FROM jurisdictions j WHERE j.island_id=i.id AND j.{field}=?)")
            args.append(value); continue
        where.append(f'i."{field}" {OPS[op]} ?'); args.append(value)
    sql="SELECT "+",".join('i."'+f+'"' for f in FIELDS)+" FROM islands i"
    if where: sql += " WHERE "+" AND ".join(where)
    sql += f' ORDER BY i."{sort}" {direction.upper()} NULLS LAST, i.name COLLATE NOCASE ASC LIMIT ? OFFSET ?'
    args += [length,skip]
    return c.execute(sql,args).fetchall()

def emit(rows, fmt, out=sys.stdout):
    if fmt=="json":
        json.dump([dict(r) for r in rows],out,ensure_ascii=False,indent=2); out.write("\n"); return
    w=csv.DictWriter(out,fieldnames=FIELDS); w.writeheader(); w.writerows(dict(r) for r in rows)
