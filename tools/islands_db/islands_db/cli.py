from __future__ import annotations
import argparse, json, os, sys
from pathlib import Path
from .db import connect,emit,query,parse_filter
from .materialize import ensure_base,ensure_admin,ensure_population
from .names import ensure_names
from .geometry_refs import resolve_geometry_references


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
    e=sp.add_parser("export-adhoc",help="regenerate the four committed top-100/top-500 island export pairs")
    e.add_argument("--population-year",type=int,default=2025)
    e.add_argument("--output-dir",help="output directory (default: repository data/adhoc)")
    sp.add_parser("status")
    return p


def main(argv=None):
    a=parser().parse_args(argv); root=Path(__file__).resolve().parents[1]; cache=Path(a.cache_dir) if a.cache_dir else root/"cache"; c=connect(cache/"islands.sqlite")
    try:
        if a.cmd=="status":
            rows=c.execute("SELECT name,source_version,generated_at FROM materializations ORDER BY name").fetchall()
            for r in rows:
                print("\t".join(str(x or "") for x in r))
            return 0
        ensure_base(c,cache); ensure_admin(c,cache); ensure_names(c,cache)
        if a.cmd=="build":
            if a.population: ensure_population(c,cache,a.population_year)
            return 0
        if a.cmd=="export-adhoc":
            ensure_population(c,cache,a.population_year)
            area_rows=query(c,[],"area_km2","desc",0,500)
            population_rows=query(c,[],"population","desc",0,500)
            union=[]; seen=set()
            for row in list(area_rows)+list(population_rows):
                iid=int(row["id"])
                if iid not in seen:
                    seen.add(iid); union.append(dict(row))
            resolved,report=resolve_geometry_references(union,cache)
            by_id={int(r["id"]):r for r in resolved}
            outdir=Path(a.output_dir) if a.output_dir else root.parents[1]/"data"/"adhoc"
            outdir.mkdir(parents=True,exist_ok=True)
            for metric,rows in (("landmass",area_rows),("population",population_rows)):
                resolved_rows=[by_id[int(r["id"])] for r in rows]
                for count in (100,500):
                    selected=resolved_rows[:count]
                    stem=outdir/f"top-{count}-islands-by-{metric}"
                    with stem.with_suffix(".csv").open("w",encoding="utf-8",newline="") as f: emit(selected,"csv",f)
                    with stem.with_suffix(".json").open("w",encoding="utf-8",newline="") as f: emit(selected,"json",f)
            print(json.dumps(report.as_dict(),sort_keys=True))
            return 0
        need=required(a.filter,a.sort)
        if "population" in need: ensure_population(c,cache,a.population_year)
        rows=query(c,a.filter,a.sort,a.direction,a.skip,a.length)
        resolved,_=resolve_geometry_references(rows,cache)
        emit(resolved,a.format); return 0
    except (ValueError,RuntimeError,FileNotFoundError) as e:
        print(f"error: {e}",file=sys.stderr); return 2
    finally: c.close()


if __name__ == "__main__":
    raise SystemExit(main())
