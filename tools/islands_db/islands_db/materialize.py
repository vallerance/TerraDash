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
    import pyogrio
    layer_names=[x[0] for x in pyogrio.list_layers(src)]
    layers=[x for x in layer_names if any(k in x for k in ("BigIslands","SmallIslands","VerySmallIslands")) and "Contin" not in x]
    if not layers: raise RuntimeError(f"no USGS island layers found in {src}: {layer_names}")
    c.execute("DELETE FROM islands"); c.execute("DELETE FROM jurisdictions"); c.commit()
    columns=["USGS_ISID","Name_USGSO","NAME_wcmcI","NAME_LOCAL","Area_Geode"]
    total=0
    for layer_index,layer in enumerate(layers,1):
        info=pyogrio.read_info(src,layer=layer); count=int(info.get("features") or 0)
        chunk=10000
        for offset in range(0,count,chunk):
            g=pyogrio.read_dataframe(src,layer=layer,columns=columns,read_geometry=False,fid_as_index=True,skip_features=offset,max_features=chunk)
            rows=[]
            for _,r in g.iterrows():
                usgs=r.get("USGS_ISID")
                if usgs is None or (isinstance(usgs,float) and math.isnan(usgs)): continue
                oid=int(r.name)
                iid=layer_index*1_000_000+oid
                raw=[]
                for f in ("Name_USGSO","NAME_wcmcI","NAME_LOCAL"):
                    v=r.get(f)
                    if v is not None and str(v).strip():
                        v=str(v).strip()
                        if v not in raw: raw.append(v)
                area=r.get("Area_Geode")
                rows.append((iid,str(int(usgs)),raw[0] if raw else None,json.dumps(raw[1:]),float(area) if area is not None else None,None,None,None,None,None,None,None,None,None,None,None,None,None,None))
            c.executemany("INSERT OR REPLACE INTO islands VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",rows); c.commit(); total+=len(rows)
            print(f"USGS {layer}: {min(offset+len(g),count)}/{count}",flush=True)
    c.execute("CREATE INDEX IF NOT EXISTS idx_islands_usgs ON islands(usgs_id)"); c.execute("CREATE INDEX IF NOT EXISTS idx_islands_name ON islands(name)"); c.commit()
    actual=c.execute("SELECT COUNT(*) FROM islands").fetchone()[0]
    if actual != total: raise RuntimeError(f"internal island ID collision: loaded {total} rows but only {actual} unique IDs")
    mark(c,"usgs_base",ver)

def ensure_admin(c,cache:Path):
    ensure_base(c,cache)
    if done(c,"natural_earth_admin"): return
    import pyogrio, subprocess, sys
    src,usgs_ver=get_usgs(cache); ne_src,ne_ver=get_ne(cache)
    layers=[x[0] for x in pyogrio.list_layers(src) if any(k in x[0] for k in ("BigIslands","SmallIslands","VerySmallIslands")) and "Contin" not in x[0]]
    progress=cache/"progress"/"natural-earth"; progress.mkdir(parents=True,exist_ok=True)
    if not done(c,"natural_earth_geometry_started"):
        c.execute("DELETE FROM jurisdictions"); c.execute("DELETE FROM island_geometry"); c.execute("DELETE FROM island_geometry_rtree")
        c.execute("UPDATE islands SET latitude=NULL,longitude=NULL,ne_feature_id=NULL,ne_name=NULL,sovereign_state=NULL,country=NULL,map_unit=NULL,map_subunit=NULL,region=NULL,subregion=NULL")
        c.commit(); mark(c,"natural_earth_geometry_started",usgs_ver+"; "+ne_ver)
    for layer_index,layer in enumerate(layers,1):
        count=int(pyogrio.read_info(src,layer=layer).get("features") or 0)
        batch=100 if "BigIslands" in layer else 10000
        for skip in range(0,count,batch):
            marker=progress/f"{layer_index}-{skip}-{min(batch,count-skip)}.done"
            if marker.exists(): continue
            cmd=[sys.executable,"-m","islands_db.geom_worker","--db",str(cache/"islands.sqlite"),"--source",str(src),"--layer",layer,"--layer-index",str(layer_index),"--skip",str(skip),"--count",str(min(batch,count-skip)),"--natural-earth",str(ne_src)]
            subprocess.run(cmd,check=True,cwd=Path(__file__).resolve().parents[1])
            marker.touch()
            print(f"Natural Earth {layer}: {min(skip+batch,count)}/{count}",flush=True)
    mark(c,"natural_earth_geometry",usgs_ver+"; "+ne_ver)
    # EEZ fallback is applied after the Natural Earth geometry pass.
    apply_eez_fallback(c,cache,ne_src)
    mark(c,"natural_earth_admin",usgs_ver+"; "+ne_ver+"; Marine Regions EEZ v12")

def ensure_eez_analysis(c,cache:Path):
    key="marine_regions_eez_analysis"
    derived=cache/"derived"/"eez_analysis.gpkg"
    if done(c,key) and derived.exists(): return derived
    import pyogrio, subprocess, sys
    src,ver=get_eez(cache)
    info=pyogrio.read_info(src); count=int(info.get("features") or 0)
    derived.parent.mkdir(parents=True,exist_ok=True)
    if derived.exists(): derived.unlink()
    batch=10; first=True
    for skip in range(0,count,batch):
        cmd=[sys.executable,"-m","islands_db.eez_worker","--source",str(src),"--output",str(derived),"--skip",str(skip),"--count",str(min(batch,count-skip)),"--mode","w" if first else "a"]
        subprocess.run(cmd,check=True,cwd=Path(__file__).resolve().parents[1])
        first=False
        print(f"EEZ analysis: {min(skip+batch,count)}/{count}",flush=True)
    mark(c,key,ver+"; simplified 0.01 degree analysis geometry")
    return derived


def apply_eez_fallback(c,cache:Path,ne_src:Path):
    missing=c.execute("SELECT COUNT(*) FROM islands WHERE country IS NULL AND latitude IS NOT NULL").fetchone()[0]
    if not missing: return
    import geopandas as gpd
    from shapely.geometry import Point
    eez_src=ensure_eez_analysis(c,cache); eez=gpd.read_file(eez_src,layer="eez").to_crs(4326)
    ne=gpd.read_file(ne_src).to_crs(4326)
    name_map={}
    for _,r in ne.iterrows():
        for key in (r.get("ADMIN"),r.get("GEOUNIT"),r.get("SUBUNIT"),r.get("SOVEREIGNT")):
            if key and key not in name_map: name_map[key]=r
    batch=20000; last=-1
    while True:
        rows=c.execute("SELECT id,longitude,latitude FROM islands WHERE country IS NULL AND latitude IS NOT NULL AND id>? ORDER BY id LIMIT ?",(last,batch)).fetchall()
        if not rows: break
        last=rows[-1][0]
        pts=gpd.GeoDataFrame({"island_id":[r[0] for r in rows]},geometry=[Point(r[1],r[2]) for r in rows],crs=4326)
        hits=gpd.sjoin(pts,eez,how="left",predicate="within")
        for _,r in hits.iterrows():
            iid=int(r.island_id)
            jurisdictions=[]
            for n in (1,2,3):
                country=r.get(f"territory{n}") or r.get(f"sovereign{n}")
                if not country: continue
                sov=r.get(f"sovereign{n}") or country
                if any(x[0]==country and x[1]==sov for x in jurisdictions): continue
                nr=name_map.get(country)
                if nr is None: nr=name_map.get(sov)
                if nr is not None:
                    region=nr.get("REGION_UN"); subregion=nr.get("SUBREGION"); map_unit=nr.get("GEOUNIT") or country; map_subunit=nr.get("SUBUNIT") or country
                else:
                    region=subregion=None; map_unit=map_subunit=country
                jurisdictions.append((country,sov,map_unit,map_subunit,region,subregion))
            if not jurisdictions: continue
            # Primary flattened jurisdiction is Marine Regions' territory1/sovereign1.
            country,sov,map_unit,map_subunit,region,subregion=jurisdictions[0]
            c.execute("UPDATE islands SET sovereign_state=?,country=?,map_unit=?,map_subunit=?,region=?,subregion=? WHERE id=? AND country IS NULL",(sov,country,map_unit,map_subunit,region,subregion,iid))
            for country,sov,map_unit,map_subunit,region,subregion in jurisdictions:
                c.execute("INSERT INTO jurisdictions(island_id,sovereign_state,country,map_unit,map_subunit,region,subregion,area_fraction,ne_feature_id,ne_name) VALUES(?,?,?,?,?,?,?,?,?,?)",(iid,sov,country,map_unit,map_subunit,region,subregion,1.0,None,None))
        c.commit(); print(f"EEZ fallback through island id {last}",flush=True)

def ensure_population(c,cache:Path,year:int):
    ensure_base(c,cache); key=f"population_{year}_1km"
    if done(c,key): return
    raster,ver=get_worldpop(cache,year)
    import os
    from shapely import from_wkb
    progress_dir=cache/"progress"/"population"; progress_dir.mkdir(parents=True,exist_ok=True)
    max_id=int(c.execute("SELECT COALESCE(MAX(id),0) FROM islands").fetchone()[0])
    totals_path=progress_dir/f"{year}-totals.npy"
    state_path=progress_dir/f"{year}-state.txt"
    if totals_path.exists():
        totals=np.load(totals_path,mmap_mode="r+")
        if len(totals) != max_id+1:
            raise RuntimeError("population checkpoint does not match current island database")
    else:
        totals=np.lib.format.open_memmap(totals_path,mode="w+",dtype="float64",shape=(max_id+1,))
        totals[:] = 0; totals.flush()
    completed=int(state_path.read_text().strip()) if state_path.exists() else 0
    with rasterio.open(raster) as ds:
        if ds.crs is None or ds.crs.to_epsg()!=4326:
            raise RuntimeError(f"expected EPSG:4326 WorldPop raster, got {ds.crs}")
        windows=list(ds.block_windows(1))
        for pos,(_,window) in enumerate(windows):
            if pos < completed: continue
            arr=ds.read(1,window=window,masked=True)
            if arr.count():
                left,bottom,right,top=rasterio.windows.bounds(window,ds.transform)
                rows=c.execute("""SELECT g.island_id,g.wkb FROM island_geometry_rtree r
                                  JOIN island_geometry g ON g.island_id=r.island_id
                                  WHERE r.maxx>=? AND r.minx<=? AND r.maxy>=? AND r.miny<=?""",
                               (left,right,bottom,top)).fetchall()
                if rows:
                    shapes=[]
                    for row in rows:
                        geom=from_wkb(bytes(row[1]))
                        if geom is not None and not geom.is_empty:
                            shapes.append((geom,int(row[0])))
                    if shapes:
                        labels=rasterize(shapes,out_shape=arr.shape,transform=ds.window_transform(window),fill=0,dtype="int32")
                        values=np.asarray(arr.filled(0),dtype="float64")
                        valid=(labels>0) & np.isfinite(values) & (values>0)
                        if valid.any():
                            ids=labels[valid].ravel(); vals=values[valid].ravel()
                            np.add.at(totals,ids,vals)
            totals.flush()
            tmp=state_path.with_suffix('.tmp'); tmp.write_text(str(pos+1)); os.replace(tmp,state_path)
            if (pos+1)%100==0 or pos+1==len(windows):
                print(f"WorldPop {year}: {pos+1}/{len(windows)} raster blocks",flush=True)
    existing_ids=[r[0] for r in c.execute("SELECT id FROM islands ORDER BY id")]
    for offset in range(0,len(existing_ids),10000):
        ids=existing_ids[offset:offset+10000]
        rows=[(float(totals[i]),year,ver,"1km-raster",i) for i in ids]
        c.executemany("UPDATE islands SET population=?,population_year=?,population_source=?,population_method=? WHERE id=?",rows); c.commit()
    c.execute("CREATE INDEX IF NOT EXISTS idx_islands_population ON islands(population)"); c.commit(); mark(c,key,ver)
