from __future__ import annotations
import csv, io, json, zipfile
from pathlib import Path
from shapely import from_wkb
from shapely.geometry import Point
from .sources import get_gnis, get_gns_islands, get_geonames

UNUSABLE={"", "UNNAMED", "UNKNOWN", "NO NAME", "N/A", "NA"}
GEONAMES_ISLAND_CODES={"ISL","ISLET","ISLF","ISLM","ISLT","ISLX"}
GNS_INDIVIDUAL_ISLAND_CODES={"ISL","ISLT","ISLX"}

def usable(value):
    return value is not None and str(value).strip().upper() not in UNUSABLE

def ensure_name_schema(c):
    cols={r[1] for r in c.execute("PRAGMA table_info(islands)")}
    for name,typ in [("name_source","TEXT"),("name_source_id","TEXT"),("name_match_method","TEXT")]:
        if name not in cols: c.execute(f"ALTER TABLE islands ADD COLUMN {name} {typ}")
    c.executescript('''
    CREATE TABLE IF NOT EXISTS island_names(
      island_id INTEGER NOT NULL, name TEXT NOT NULL, source TEXT NOT NULL, source_id TEXT,
      name_type TEXT, match_method TEXT NOT NULL, priority INTEGER NOT NULL,
      UNIQUE(island_id,name,source,source_id)
    );
    CREATE INDEX IF NOT EXISTS idx_island_names_island ON island_names(island_id);
    CREATE INDEX IF NOT EXISTS idx_island_names_name ON island_names(name COLLATE NOCASE);
    ''')
    c.commit()

def polygon_for_point(c,lon,lat):
    rows=c.execute('''SELECT g.island_id,g.wkb FROM island_geometry_rtree r
                      JOIN island_geometry g ON g.island_id=r.island_id
                      WHERE r.minx<=? AND r.maxx>=? AND r.miny<=? AND r.maxy>=?''',(lon,lon,lat,lat)).fetchall()
    if not rows: return None
    p=Point(lon,lat); matches=[]
    for iid,wkb in rows:
        geom=from_wkb(wkb)
        if geom is not None and not geom.is_empty and geom.covers(p): matches.append((iid,geom.area))
    if not matches: return None
    # If nested/overlapping polygons exist, the smallest containing island is the most specific match.
    return min(matches,key=lambda x:x[1])[0]

def record(c,iid,name,source,source_id,name_type,priority,promote=True):
    if not usable(name): return False
    name=str(name).strip()
    c.execute("INSERT OR IGNORE INTO island_names VALUES(?,?,?,?,?,?,?)",(iid,name,source,str(source_id) if source_id is not None else None,name_type,"point-in-polygon",priority))
    row=c.execute("SELECT name,name_source FROM islands WHERE id=?",(iid,)).fetchone()
    if promote and row and not usable(row[0]):
        c.execute("UPDATE islands SET name=?,name_source=?,name_source_id=?,name_match_method='point-in-polygon' WHERE id=?",(name,source,str(source_id) if source_id is not None else None,iid))
        return True
    return False

def promote_usgs_alternates(c):
    changed=0
    for iid,usgs,name,alts in c.execute("SELECT id,usgs_id,name,alternate_names FROM islands WHERE name IS NULL OR trim(name)='' OR upper(trim(name))='UNNAMED'").fetchall():
        try: vals=json.loads(alts or '[]')
        except Exception: vals=[]
        for v in vals:
            if usable(v):
                c.execute("UPDATE islands SET name=?,name_source='USGS Global Islands',name_source_id=?,name_match_method='source-alternate' WHERE id=?",(str(v).strip(),usgs,iid))
                c.execute("INSERT OR IGNORE INTO island_names VALUES(?,?,?,?,?,?,?)",(iid,str(v).strip(),"USGS Global Islands",usgs,"alternate","source-alternate",0))
                changed+=1; break
    c.commit(); return changed

def _zip_text(path, preferred=None):
    z=zipfile.ZipFile(path)
    names=z.namelist()
    if preferred:
        names=[n for n in names if preferred.lower() in n.lower()] or names
    name=max((n for n in names if n.lower().endswith(('.txt','.csv'))),key=lambda n:z.getinfo(n).file_size)
    return z,io.TextIOWrapper(z.open(name),encoding='utf-8-sig',errors='replace',newline='')

def enrich_gnis(c,cache):
    path,ver=get_gnis(cache); z,f=_zip_text(path,'DomesticNames_National')
    reader=csv.DictReader(f,delimiter='|'); seen=matched=changed=0
    for r in reader:
        if r.get('feature_class')!='Island': continue
        try: lat=float(r['prim_lat_dec']); lon=float(r['prim_long_dec'])
        except Exception: continue
        seen+=1; iid=polygon_for_point(c,lon,lat)
        if iid is None: continue
        matched+=1; changed+=record(c,iid,r.get('feature_name'),'GNIS',r.get('feature_id'),'official',10)
        if matched%5000==0: c.commit()
    c.commit(); f.close(); z.close(); return ver,seen,matched,changed

def enrich_gns(c,cache):
    path,ver=get_gns_islands(cache); z,f=_zip_text(path,'Hypsographic')
    reader=csv.DictReader(f,delimiter='\t'); seen=matched=changed=0
    for r in reader:
        if r.get('desig_cd') not in GNS_INDIVIDUAL_ISLAND_CODES: continue
        # Approved romanized names first; preserve variants as names but don't promote them before approved names.
        nt=(r.get('nt') or '').strip()
        if nt not in {'N','V'}: continue
        try: lat=float(r['lat_dd']); lon=float(r['long_dd'])
        except Exception: continue
        seen+=1; iid=polygon_for_point(c,lon,lat)
        if iid is None: continue
        matched+=1
        priority=20 if nt=='N' else 25
        before=c.execute("SELECT name FROM islands WHERE id=?",(iid,)).fetchone()[0]
        record(c,iid,r.get('full_name'),'GNS',r.get('uni') or r.get('ufi'),'approved' if nt=='N' else 'variant',priority,promote=(nt=='N'))
        after=c.execute("SELECT name FROM islands WHERE id=?",(iid,)).fetchone()[0]
        if not usable(before) and usable(after): changed+=1
        if matched%5000==0: c.commit()
    c.commit(); f.close(); z.close(); return ver,seen,matched,changed

def enrich_geonames(c,cache):
    path,ver=get_geonames(cache); z,f=_zip_text(path,'allCountries')
    seen=matched=changed=0
    for line in f:
        p=line.rstrip('\n\r').split('\t')
        if len(p)<9 or p[7] not in GEONAMES_ISLAND_CODES: continue
        try: lat=float(p[4]); lon=float(p[5])
        except Exception: continue
        seen+=1; iid=polygon_for_point(c,lon,lat)
        if iid is None: continue
        matched+=1
        before=c.execute("SELECT name FROM islands WHERE id=?",(iid,)).fetchone()[0]
        record(c,iid,p[1],'GeoNames',p[0],'primary',30)
        for alt in (p[3] or '').split(','):
            if usable(alt):
                c.execute("INSERT OR IGNORE INTO island_names VALUES(?,?,?,?,?,?,?)",(iid,alt.strip(),'GeoNames',p[0],'alternate','point-in-polygon',35))
        after=c.execute("SELECT name FROM islands WHERE id=?",(iid,)).fetchone()[0]
        if not usable(before) and usable(after): changed+=1
        if matched%5000==0: c.commit()
    c.commit(); f.close(); z.close(); return ver,seen,matched,changed


def apply_local_name_overrides(c):
    path=Path(__file__).with_name("data")/"local_name_overrides.csv"
    if not path.exists(): return 0
    changed=0
    with path.open(encoding="utf-8",newline="") as f:
        for r in csv.DictReader(f):
            try: iid=int(r["island_id"])
            except Exception: continue
            name=(r.get("name") or "").strip()
            if not usable(name): continue
            source=(r.get("source") or "Local research").strip()
            source_id=(r.get("source_id") or "").strip() or None
            method=(r.get("match_method") or "local-source").strip()
            c.execute("INSERT OR IGNORE INTO island_names VALUES(?,?,?,?,?,?,?)",(iid,name,source,source_id,"local",method,5))
            row=c.execute("SELECT name FROM islands WHERE id=?",(iid,)).fetchone()
            if row and not usable(row[0]):
                c.execute("UPDATE islands SET name=?,name_source=?,name_source_id=?,name_match_method=? WHERE id=?",(name,source,source_id,method,iid))
                changed+=1
    c.commit(); return changed

def _done(c,key):
    return c.execute("SELECT 1 FROM materializations WHERE name=?",(key,)).fetchone() is not None

def _mark(c,key,version):
    c.execute("INSERT OR REPLACE INTO materializations(name,source_version) VALUES(?,?)",(key,version)); c.commit()

def ensure_names(c,cache):
    ensure_name_schema(c)
    # Curated local-name research is intentionally idempotent and is applied on every run.
    # This lets an existing materialized cache pick up newly researched names without
    # forcing a rebuild of the much larger gazetteer stages.
    apply_local_name_overrides(c)
    if _done(c,"names_enriched"): return
    summaries=[]
    if not _done(c,"names_usgs"):
        c.execute("UPDATE islands SET name_source='USGS Global Islands',name_source_id=usgs_id,name_match_method='source-primary' WHERE name_source IS NULL AND name IS NOT NULL AND trim(name)<>'' AND upper(trim(name))<>'UNNAMED'")
        c.commit()
        promoted=promote_usgs_alternates(c)
        _mark(c,"names_usgs",f"USGS Global Islands; promoted_alternates={promoted}")
    summaries.append("USGS")
    summaries.append("LocalOverrides")
    if not _done(c,"names_gnis"):
        gv,gs,gm,gc=enrich_gnis(c,cache)
        _mark(c,"names_gnis",f"{gv}; candidates={gs}; matched={gm}; promoted={gc}")
    summaries.append("GNIS")
    if not _done(c,"names_gns"):
        nv,ns,nm,nc=enrich_gns(c,cache)
        _mark(c,"names_gns",f"{nv}; candidates={ns}; matched={nm}; promoted={nc}")
    summaries.append("GNS")
    if not _done(c,"names_geonames"):
        zv,zs,zm,zc=enrich_geonames(c,cache)
        _mark(c,"names_geonames",f"{zv}; candidates={zs}; matched={zm}; promoted={zc}")
    summaries.append("GeoNames")
    unusable=c.execute("SELECT COUNT(*) FROM islands WHERE name IS NULL OR trim(name)='' OR upper(trim(name))='UNNAMED'").fetchone()[0]
    _mark(c,"names_enriched",f"priority: USGS > LocalOverrides > GNIS > GNS > GeoNames; remaining_unusable={unusable}")
