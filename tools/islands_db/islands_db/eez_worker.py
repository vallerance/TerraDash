from __future__ import annotations
import argparse
from pathlib import Path
import pyogrio

FIELDS=[
    'mrgid','territory1','iso_ter1','sovereign1','iso_sov1',
    'territory2','iso_ter2','sovereign2','iso_sov2',
    'territory3','iso_ter3','sovereign3','iso_sov3',
]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--source',required=True); ap.add_argument('--output',required=True)
    ap.add_argument('--skip',type=int,required=True); ap.add_argument('--count',type=int,required=True)
    ap.add_argument('--mode',choices=('w','a'),required=True)
    a=ap.parse_args()
    g=pyogrio.read_dataframe(a.source,columns=FIELDS,skip_features=a.skip,max_features=a.count)
    if g.empty: return
    if g.crs is None: g=g.set_crs(4326)
    else: g=g.to_crs(4326)
    # Jurisdiction fallback is point-in-polygon only; ~1 km boundary fidelity is ample
    # and makes the global EEZ layer cheap to keep in memory.
    g.geometry=g.geometry.simplify(0.01,preserve_topology=False)
    g=g[~g.geometry.is_empty & g.geometry.notna()].copy()
    if g.empty: return
    g.to_file(Path(a.output),layer='eez',driver='GPKG',mode=a.mode,engine='pyogrio')

if __name__=='__main__': main()
