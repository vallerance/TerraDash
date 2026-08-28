from __future__ import annotations
import hashlib, json, re, shutil, zipfile
from pathlib import Path
from urllib.parse import urljoin
import requests

UA={"User-Agent":"TerraDash-islands-db/0.1"}
USGS_ARCGIS_ITEM="885a860af66d4833887dcce735a521a7"
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
    meta_url=f"https://www.arcgis.com/sharing/rest/content/items/{USGS_ARCGIS_ITEM}"
    meta=requests.get(meta_url,params={"f":"json"},headers=UA,timeout=60).json()
    if meta.get("type") != "File Geodatabase":
        raise RuntimeError(f"unexpected USGS ArcGIS item type: {meta.get('type')}")
    name="GlbIslands.gdb.zip"
    url=f"https://www.arcgis.com/sharing/rest/content/items/{USGS_ARCGIS_ITEM}/data"
    path=download(url,cache/"sources"/"usgs"/name)
    root=unzip(path,path.with_suffix(""))
    src=find_vector(root)
    return src,f"USGS Global Islands ArcGIS item {USGS_ARCGIS_ITEM} modified {meta.get('modified')}"

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
