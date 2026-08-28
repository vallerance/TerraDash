from __future__ import annotations
import argparse, math, sqlite3
from pathlib import Path
import geopandas as gpd
import pyogrio


def attr(row,*names):
    for n in names:
        if n in row and row[n] is not None:
            return row[n]
    return None


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--db',required=True); ap.add_argument('--source',required=True); ap.add_argument('--layer',required=True)
    ap.add_argument('--layer-index',type=int,required=True); ap.add_argument('--skip',type=int,required=True); ap.add_argument('--count',type=int,required=True)
    ap.add_argument('--natural-earth',required=True)
    a=ap.parse_args()
    g=pyogrio.read_dataframe(a.source,layer=a.layer,columns=['USGS_ISID'],fid_as_index=True,skip_features=a.skip,max_features=a.count)
    if g.empty: return
    if g.crs is None: g=g.set_crs(4326)
    else: g=g.to_crs(4326)
    # Analysis geometry only: population is 1 km and admin matching does not need 30 m coastline detail.
    # Avoid topology-preserving simplification: it is dramatically more expensive on very complex islands.
    tol=0.002 if 'BigIslands' in a.layer else (0.001 if 'SmallIslands' in a.layer else 0.0005)
    g.geometry=g.geometry.simplify(tol,preserve_topology=False)
    g['island_id']=[a.layer_index*1_000_000+int(fid) for fid in g.index]
    ne=gpd.read_file(a.natural_earth).to_crs(4326)
    c=sqlite3.connect(a.db); c.execute('PRAGMA journal_mode=WAL')
    ids=[int(x) for x in g.island_id]
    q=','.join('?' for _ in ids)
    c.execute(f'DELETE FROM jurisdictions WHERE island_id IN ({q})',ids)
    c.execute(f'DELETE FROM island_geometry WHERE island_id IN ({q})',ids)
    c.execute(f'DELETE FROM island_geometry_rtree WHERE island_id IN ({q})',ids)
    geom_rows=[]
    for _,r in g.iterrows():
        geom=r.geometry
        if geom is None or geom.is_empty: continue
        p=geom.representative_point(); minx,miny,maxx,maxy=geom.bounds; iid=int(r.island_id)
        geom_rows.append((iid,sqlite3.Binary(geom.wkb),minx,miny,maxx,maxy))
        c.execute('UPDATE islands SET latitude=?,longitude=? WHERE id=?',(p.y,p.x,iid))
    c.executemany('INSERT OR REPLACE INTO island_geometry(island_id,wkb,minx,miny,maxx,maxy) VALUES(?,?,?,?,?,?)',geom_rows)
    c.executemany('INSERT OR REPLACE INTO island_geometry_rtree(island_id,minx,maxx,miny,maxy) VALUES(?,?,?,?,?)',[(r[0],r[2],r[4],r[3],r[5]) for r in geom_rows])

    if 'BigIslands' in a.layer:
        cand=gpd.sjoin(g[['island_id','geometry']],ne,how='left',predicate='intersects')
        # Most islands intersect exactly one admin polygon. Avoid reprojection/intersection work for those.
        # Only divided/border islands need actual equal-area overlap fractions.
        from pyproj import Transformer
        from shapely.ops import transform
        tx=Transformer.from_crs(4326,6933,always_xy=True).transform
        g_by_id=g.set_index('island_id')
        for iid,grp in cand.groupby('island_id',sort=False):
            js=[]
            for j in grp['index_right'].tolist():
                if j is None or (isinstance(j,float) and math.isnan(j)): continue
                j=int(j)
                if j not in js: js.append(j)
            vals=[]
            if len(js)==1:
                vals=[(1.0,ne.loc[js[0]])]
            elif len(js)>1:
                ia=transform(tx,g_by_id.loc[iid].geometry); denom=max(float(ia.area),1e-9)
                for j in js:
                    nr=ne.loc[j]; ng=transform(tx,nr.geometry)
                    frac=float(ia.intersection(ng).area/denom)
                    if frac>0: vals.append((frac,nr))
                vals.sort(key=lambda x:x[0],reverse=True)
            for frac,nr in vals:
                c.execute('INSERT INTO jurisdictions VALUES(?,?,?,?,?,?,?,?,?,?)',(int(iid),attr(nr,'SOVEREIGNT','SOV_A3'),attr(nr,'ADMIN'),attr(nr,'GEOUNIT'),attr(nr,'SUBUNIT'),attr(nr,'REGION_UN'),attr(nr,'SUBREGION'),frac,str(attr(nr,'NE_ID','ADM0_A3','SU_A3') or ''),attr(nr,'NAME','NAME_LONG')))
            if vals:
                _,nr=vals[0]
                c.execute('UPDATE islands SET ne_feature_id=?,ne_name=?,sovereign_state=?,country=?,map_unit=?,map_subunit=?,region=?,subregion=? WHERE id=?',(str(attr(nr,'NE_ID','ADM0_A3','SU_A3') or ''),attr(nr,'NAME','NAME_LONG'),attr(nr,'SOVEREIGNT'),attr(nr,'ADMIN'),attr(nr,'GEOUNIT'),attr(nr,'SUBUNIT'),attr(nr,'REGION_UN'),attr(nr,'SUBREGION'),int(iid)))
    else:
        pts=g[['island_id','geometry']].copy(); pts.geometry=pts.geometry.representative_point()
        hits=gpd.sjoin(pts,ne,how='left',predicate='within')
        for _,r in hits.iterrows():
            j=r.get('index_right')
            if j is None or (isinstance(j,float) and math.isnan(j)): continue
            nr=ne.loc[int(j)]; iid=int(r.island_id)
            vals=(attr(nr,'SOVEREIGNT','SOV_A3'),attr(nr,'ADMIN'),attr(nr,'GEOUNIT'),attr(nr,'SUBUNIT'),attr(nr,'REGION_UN'),attr(nr,'SUBREGION'),1.0,str(attr(nr,'NE_ID','ADM0_A3','SU_A3') or ''),attr(nr,'NAME','NAME_LONG'))
            c.execute('INSERT INTO jurisdictions VALUES(?,?,?,?,?,?,?,?,?,?)',(iid,*vals))
            c.execute('UPDATE islands SET ne_feature_id=?,ne_name=?,sovereign_state=?,country=?,map_unit=?,map_subunit=?,region=?,subregion=? WHERE id=?',(vals[7],vals[8],vals[0],vals[1],vals[2],vals[3],vals[4],vals[5],iid))
    c.commit(); c.close()

if __name__=='__main__': main()
