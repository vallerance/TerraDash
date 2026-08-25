from __future__ import annotations
import hashlib, json, re, shutil, zipfile
from pathlib import Path
from urllib.parse import urljoin
import requests

UA={"User-Agent":"TerraDash-islands-db/0.1"}
SCIENCEBASE="https://www.sciencebase.gov/catalog/item/63bdf25dd34e92aad3cda273?format=json"
NE_SUBUNITS="https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_map_subunits.zip"
MARINE_EEZ="https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=MarineRegions%3Aeez&outputFormat=application%2Fjson"
WORLDPOP_INDEX="https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/{year}/0_Mosaicked/v1/1km/constrained/"

def download(url: str, dest: Path):
    if dest.exists(): return dest
    dest.parent.mkdir(parents=True,exist_ok=True); tmp=dest.with_suffix(dest.suffix+".part")
    with requests.get(url,headers=UA,stream=True,timeout=120) as r:
        r.raise_for_status()
        with tmp.open("wb") as f: shutil.copyfileobj(r.raw,f)
    tmp.replace(dest); return dest

def unzip(z: Path, dest: Path):
    marker=dest/".complete"
    if marker.exists(): return dest
    dest.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(z) as f: f.extractall(dest)
    marker.touch(); return dest

def find_vector(root: Path):
    for ext in ("*.gpkg","*.shp","*.geojson"):
        fs=[p for p in root.rglob(ext) if not p.name.startswith("._")]
        if fs: return max(fs,key=lambda p:p.stat().st_size)
    gdb=[p for p in root.rglob("*.gdb") if p.is_dir()]
    if gdb: return max(gdb,key=lambda p:sum(x.stat().st_size for x in p.rglob("*") if x.is_file()))
    mpks=list(root.rglob("*.mpk"))
    if mpks:
        inner=root/"mpk-expanded"
        if not (inner/".complete").exists():
            inner.mkdir(parents=True,exist_ok=True)
            with zipfile.ZipFile(mpks[0]) as f: f.extractall(inner)
            (inner/".complete").touch()
        return find_vector(inner)
    raise FileNotFoundError(f"no vector dataset found under {root}")

def get_usgs(cache: Path):
    meta=requests.get(SCIENCEBASE,headers=UA,timeout=60).json()
    files=meta.get("files",[])
    candidates=[f for f in files if f.get("url") and re.search(r"\.(zip|gpkg)$",f.get("name",""),re.I)]
    if not candidates: raise RuntimeError("USGS ScienceBase item has no downloadable vector archive")
    # Prefer files whose names describe islands/global data, then largest archive.
    candidates.sort(key=lambda f:(("island" in f.get("name","").lower())+("global" in f.get("name","").lower()),f.get("size",0)),reverse=True)
    f=candidates[0]; path=download(f["url"],cache/"sources"/"usgs"/f["name"])
    if path.suffix.lower()==".zip": return find_vector(unzip(path,path.with_suffix(""))), f.get("name","")
    return path,f.get("name","")

def get_ne(cache: Path):
    z=download(NE_SUBUNITS,cache/"sources"/"natural-earth"/"ne_10m_admin_0_map_subunits.zip")
    return find_vector(unzip(z,z.with_suffix(""))),"Natural Earth 5.1.1"

def resolve_worldpop_url(year:int):
    base=WORLDPOP_INDEX.format(year=year)
    r=requests.get(base,headers=UA,timeout=60); r.raise_for_status()
    hrefs=re.findall(r'href=["\']([^"\']+\.tif)["\']',r.text,re.I)
    # Population-total mosaic, not age/sex files. There should normally be one tif.
    if not hrefs: raise RuntimeError(f"no WorldPop GeoTIFF found at {base}")
    preferred=[h for h in hrefs if re.search(r'(pop|ppp)',h,re.I)] or hrefs
    return urljoin(base,preferred[0])

def get_worldpop(cache:Path,year:int):
    url=resolve_worldpop_url(year); name=url.rsplit('/',1)[-1]
    return download(url,cache/"sources"/"worldpop"/name),f"WorldPop R2025A {year} 1km"


def get_eez(cache: Path):
    p=download(MARINE_EEZ,cache/"sources"/"marine-regions"/"eez_v12.geojson")
    return p,"Marine Regions EEZ v12 (CC BY 4.0)"
