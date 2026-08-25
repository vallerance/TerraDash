from __future__ import annotations
import json, math
from pathlib import Path
import geopandas as gpd
import numpy as np
from shapely.geometry import box
from rasterio.features import rasterize
import rasterio
from .sources import get_usgs,get_ne,get_worldpop,get_eez

NAME_FIELDS=("Name_USGSO","NAME_wcmcI","NAME_LOCAL","name","NAME","island_nam","IslandName","island_name","NAME_EN","name_en")
ID_FIELDS=("USGS_ISID","island_id","IslandID","ID","OBJECTID","FID","fid")

def done(c,name): return c.execute("SELECT 1 FROM materializations WHERE name=?",(name,)).fetchone() is not None
def mark(c,name,version): c.execute("INSERT OR REPLACE INTO materializations(name,source_version) VALUES(?,?)",(name,version)); c.commit()
def pick(row, fields, default=None):
    for f in fields:
        if f in row and row[f] is not None and str(row[f]).strip(): return row[f]
    return default

def ensure_base(c,cache:Path):
    if done(c,"usgs_base"): return
    src,ver=get_usgs(cache)
    if src.suffix.lower()==".gdb":
        import pyogrio, pandas as pd
        layers=[x[0] for x in pyogrio.list_layers(src) if any(k in x[0] for k in ("BigIslands","SmallIslands","VerySmallIslands")) and "Contin" not in x[0]]
        if not layers: raise RuntimeError(f"no USGS island layers found in {src}")
        g=gpd.GeoDataFrame(pd.concat([gpd.read_file(src,layer=l) for l in layers],ignore_index=True))
    else:
        g=gpd.read_file(src)
    if g.crs is None: g=g.set_crs(4326)
    wgs=g.to_crs(4326); equal=g.to_crs(6933)
    rows=[]
    for pos,((idx,r),geom_eq) in enumerate(zip(wgs.iterrows(),equal.geometry),1):
        geom=r.geometry
        p=geom.representative_point() if geom is not None and not geom.is_empty else None
        uid=str(pick(r,ID_FIELDS,idx)); name=pick(r,NAME_FIELDS,None)
        rows.append((pos,uid,name,json.dumps([]),float(geom_eq.area/1e6) if geom_eq is not None else None,None,None,None,None,p.y if p else None,p.x if p else None,None,None,None,None,None,None,None,None))
    c.executemany("INSERT OR REPLACE INTO islands VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",rows); c.commit()
    # Cache geometry separately; SQLite remains lightweight/query-oriented.
    geomdir=cache/"derived"; geomdir.mkdir(parents=True,exist_ok=True)
    wgs[[wgs.geometry.name]].assign(island_id=range(1,len(wgs)+1)).to_file(geomdir/"islands.gpkg",layer="islands",driver="GPKG")
    mark(c,"usgs_base",ver)

def ensure_admin(c,cache:Path):
    ensure_base(c,cache)
    if done(c,"natural_earth_admin"): return
    src,ver=get_ne(cache); ne=gpd.read_file(src).to_crs(4326)
    islands=gpd.read_file(cache/"derived"/"islands.gpkg",layer="islands").to_crs(4326)
    # Spatial candidates first, then calculate actual overlap in equal-area projection.
    cand=gpd.sjoin(islands,ne,how="left",predicate="intersects")
    i_eq=islands.to_crs(6933).set_index("island_id"); ne_eq=ne.to_crs(6933)
    def attr(r,*names):
        for n in names:
            if n in r and r[n] is not None: return r[n]
        return None
    out=[]
    for iid,grp in cand.groupby("island_id",sort=False):
        ia=i_eq.loc[iid].geometry; denom=max(ia.area,1e-9); vals=[]
        for _,r in grp.iterrows():
            j=r.get("index_right")
            if j is None or (isinstance(j,float) and math.isnan(j)): continue
            nr=ne.loc[j]; frac=float(ia.intersection(ne_eq.loc[j].geometry).area/denom)
            vals.append((frac,nr))
        vals.sort(key=lambda x:x[0],reverse=True)
        for frac,nr in vals:
            out.append((int(iid),attr(nr,"SOVEREIGNT","SOV_A3"),attr(nr,"ADMIN"),attr(nr,"GEOUNIT"),attr(nr,"SUBUNIT"),attr(nr,"REGION_UN"),attr(nr,"SUBREGION"),frac,str(attr(nr,"NE_ID","ADM0_A3","SU_A3") or ""),attr(nr,"NAME","NAME_LONG")))
        if vals:
            frac,nr=vals[0]
            c.execute("UPDATE islands SET ne_feature_id=?,ne_name=?,sovereign_state=?,country=?,map_unit=?,map_subunit=?,region=?,subregion=? WHERE id=?",(str(attr(nr,"NE_ID","ADM0_A3","SU_A3") or ""),attr(nr,"NAME","NAME_LONG"),attr(nr,"SOVEREIGNT"),attr(nr,"ADMIN"),attr(nr,"GEOUNIT"),attr(nr,"SUBUNIT"),attr(nr,"REGION_UN"),attr(nr,"SUBREGION"),int(iid)))
    c.execute("DELETE FROM jurisdictions"); c.executemany("INSERT INTO jurisdictions VALUES(?,?,?,?,?,?,?,?,?,?)",out); c.commit()
    # Tiny islands absent from Natural Earth's generalized land polygons fall back to the
    # permissively licensed Marine Regions EEZ layer, then inherit Natural Earth region
    # metadata from another row with the same country/territory where possible.
    missing=[r[0] for r in c.execute("SELECT id FROM islands WHERE country IS NULL")]
    if missing:
        eez_src,eez_ver=get_eez(cache); eez=gpd.read_file(eez_src).to_crs(4326)
        pts=islands[islands.island_id.isin(missing)].copy(); pts.geometry=pts.geometry.representative_point()
        hits=gpd.sjoin(pts,eez,how="left",predicate="within")
        for _,r in hits.iterrows():
            iid=int(r.island_id); country=r.get("territory1") or r.get("sovereign1")
            if not country: continue
            sov=r.get("sovereign1"); ne_row=c.execute("SELECT region,subregion,map_unit,map_subunit FROM islands WHERE country=? AND region IS NOT NULL LIMIT 1",(country,)).fetchone()
            region,subregion,map_unit,map_subunit=(tuple(ne_row) if ne_row else (None,None,country,country))
            c.execute("UPDATE islands SET sovereign_state=?,country=?,map_unit=?,map_subunit=?,region=?,subregion=? WHERE id=? AND country IS NULL",(sov,country,map_unit,map_subunit,region,subregion,iid))
            c.execute("INSERT INTO jurisdictions(island_id,sovereign_state,country,map_unit,map_subunit,region,subregion,area_fraction,ne_feature_id,ne_name) VALUES(?,?,?,?,?,?,?,?,?,?)",(iid,sov,country,map_unit,map_subunit,region,subregion,1.0,None,None))
        c.commit(); ver += "; "+eez_ver
    mark(c,"natural_earth_admin",ver)

def ensure_population(c,cache:Path,year:int):
    ensure_base(c,cache); key=f"population_{year}_1km"
    if done(c,key): return
    raster,ver=get_worldpop(cache,year)
    islands=gpd.read_file(cache/"derived"/"islands.gpkg",layer="islands")
    totals=np.zeros(len(islands)+1,dtype="float64")
    with rasterio.open(raster) as ds:
        work=islands.to_crs(ds.crs); sindex=work.sindex
        for _,window in ds.block_windows(1):
            arr=ds.read(1,window=window,masked=True)
            if arr.mask is np.True_ or arr.count()==0: continue
            bounds=rasterio.windows.bounds(window,ds.transform); ids=list(sindex.query(box(*bounds),predicate="intersects"))
            if not ids: continue
            shapes=[(work.geometry.iloc[i],int(work.island_id.iloc[i])) for i in ids]
            labels=rasterize(shapes,out_shape=arr.shape,transform=ds.window_transform(window),fill=0,dtype="int32")
            values=np.asarray(arr.filled(0),dtype="float64"); valid=labels>0
            if valid.any(): totals += np.bincount(labels[valid].ravel(),weights=values[valid].ravel(),minlength=len(totals))
    c.executemany("UPDATE islands SET population=?,population_year=?,population_source=?,population_method=? WHERE id=?",[(float(totals[i]),year,ver,"1km-raster",i) for i in range(1,len(totals))])
    c.execute("CREATE INDEX IF NOT EXISTS idx_islands_population ON islands(population)"); c.commit(); mark(c,key,ver)
