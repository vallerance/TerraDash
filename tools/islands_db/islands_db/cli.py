from __future__ import annotations
import argparse, os, sys
from pathlib import Path
from .db import connect,emit,query,parse_filter
from .materialize import ensure_base,ensure_admin,ensure_population

def required(filters,sort):
    fields={sort}
    for f in filters:
        fields.add(parse_filter(f)[0])
    return fields

def parser():
    p=argparse.ArgumentParser(description="Standalone cached virtual global-islands database")
    p.add_argument("--cache-dir",default=os.getenv("ISLANDS_CACHE_DIR"),help="cache directory (default: ./cache beside script)")
    sp=p.add_subparsers(dest="cmd",required=True)
    q=sp.add_parser("query"); q.add_argument("--filter",action="append",default=[]); q.add_argument("--sort",default="name"); q.add_argument("--direction",choices=("asc","desc"),default="asc"); q.add_argument("--skip",type=int,default=0); q.add_argument("--length",type=int,default=100); q.add_argument("--format",choices=("csv","json"),default="csv"); q.add_argument("--population-year",type=int,default=2025)
    b=sp.add_parser("build"); b.add_argument("--population",action="store_true"); b.add_argument("--population-year",type=int,default=2025)
    sp.add_parser("status")
    return p

def main(argv=None):
    a=parser().parse_args(argv); root=Path(__file__).resolve().parents[1]; cache=Path(a.cache_dir) if a.cache_dir else root/"cache"; c=connect(cache/"islands.sqlite")
    try:
        if a.cmd=="status":
            rows=c.execute("SELECT name,source_version,generated_at FROM materializations ORDER BY name").fetchall()
            for r in rows: print("\t".join(str(x or "") for x in r)); return 0
        ensure_base(c,cache); ensure_admin(c,cache)
        if a.cmd=="build":
            if a.population: ensure_population(c,cache,a.population_year)
            return 0
        need=required(a.filter,a.sort)
        if "population" in need: ensure_population(c,cache,a.population_year)
        rows=query(c,a.filter,a.sort,a.direction,a.skip,a.length); emit(rows,a.format); return 0
    except (ValueError,RuntimeError,FileNotFoundError) as e:
        print(f"error: {e}",file=sys.stderr); return 2
    finally: c.close()
