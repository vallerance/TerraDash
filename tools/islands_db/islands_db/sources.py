from __future__ import annotations
import hashlib, json, re, shutil, zipfile
from pathlib import Path
from urllib.parse import urljoin
import requests

UA={"User-Agent":"TerraDash-islands-db/0.1"}
USGS_ARCGIS_ITEM="885a860af66d4833887dcce735a521a7"
NE_SUBUNITS="https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_map_subunits.zip"
MARINE_EEZ="https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=MarineRegions%3Aeez&outputFormat=SHAPE-ZIP"
WORLDPOP_INDEX="https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/{year}/0_Mosaicked/v1/1km/constrained/"

NE_LAND_URL="https://naturalearth.s3.amazonaws.com/5.1.1/10m_physical/ne_10m_land.zip"
NE_LAND_VERSION="5.1.1"
NE_LAND_SHA256="e547d749445eaa0964aba76738090ec88f5e63c4585122170f98c67a7ea922dc"
NE_MINOR_ISLANDS_URL="https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_minor_islands.zip"
NE_MINOR_ISLANDS_VERSION="4.1.0"
NE_MINOR_ISLANDS_SHA256="47c0b3ce26df7b4dbabdbb251023918cb2f5c83462a426288f1f253da7284db2"
GSHHG_URL="https://ftp.soest.hawaii.edu/gshhg/gshhg-shp-2.3.7.zip"
GSHHG_VERSION="2.3.7"
GSHHG_SHA256="8dbbe7e071e77e9e75f2d639239099ebca8d5c16d6a07df8169729d49f15cf41"
USGS_GLOBAL_ISLANDS_SHA256="7e7f2b5be5bfaac049fb6319b687f1b8099830b62243521a3d1bd2cbd21474d1"
USGS_GLOBAL_ISLANDS_MODIFIED=1737496596000

def download(url: str, dest: Path):
    if dest.exists(): return dest
    dest.parent.mkdir(parents=True,exist_ok=True); tmp=dest.with_suffix(dest.suffix+".part")
    with requests.get(url,headers=UA,stream=True,timeout=120) as r:
        r.raise_for_status()
        with tmp.open("wb") as f: shutil.copyfileobj(r.raw,f)
    tmp.replace(dest); return dest

def sha256_file(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):
            h.update(chunk)
    return h.hexdigest()

def verify_sha256(path: Path, expected: str) -> Path:
    actual=sha256_file(path)
    if actual != expected:
        raise RuntimeError(f"checksum mismatch for {path.name}: expected {expected}, got {actual}")
    return path

def download_pinned(url: str, dest: Path, sha256: str) -> Path:
    if dest.exists():
        return verify_sha256(dest,sha256)
    path=download(url,dest)
    try:
        return verify_sha256(path,sha256)
    except Exception:
        path.unlink(missing_ok=True)
        raise

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
    if meta.get("modified") != USGS_GLOBAL_ISLANDS_MODIFIED:
        raise RuntimeError(f"USGS Global Islands item changed: expected modified={USGS_GLOBAL_ISLANDS_MODIFIED}, got {meta.get('modified')}")
    path=download_pinned(url,cache/"sources"/"usgs"/name,USGS_GLOBAL_ISLANDS_SHA256)
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
    z=download(MARINE_EEZ,cache/"sources"/"marine-regions"/"eez_v12.zip")
    root=unzip(z,z.with_suffix(""))
    return find_vector(root),"Marine Regions EEZ v12 (CC BY 4.0)"

GNIS_NATIONAL="https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_National_Text.zip"
GNS_HYPSOGRAPHIC="https://geonames.nga.mil/geonames/GNSData/fc_files/Hypsographic.zip"
GEONAMES_ALL="https://download.geonames.org/export/dump/allCountries.zip"

def get_gnis(cache: Path):
    p=download(GNIS_NATIONAL,cache/"sources"/"gnis"/"DomesticNames_National_Text.zip")
    return p,"GNIS National Text 2026"

def get_gns_islands(cache: Path):
    p=download(GNS_HYPSOGRAPHIC,cache/"sources"/"gns"/"Hypsographic.zip")
    return p,"NGA GNS Hypsographic 2026"

def get_geonames(cache: Path):
    p=download(GEONAMES_ALL,cache/"sources"/"geonames"/"allCountries.zip")
    return p,"GeoNames allCountries CC BY 4.0 2026"


def get_ne_geometry(cache: Path):
    root=cache/"sources"/"natural-earth-geometry"
    land_zip=download_pinned(NE_LAND_URL,root/f"ne_10m_land-{NE_LAND_VERSION}.zip",NE_LAND_SHA256)
    minor_zip=download_pinned(NE_MINOR_ISLANDS_URL,root/f"ne_10m_minor_islands-{NE_MINOR_ISLANDS_VERSION}.zip",NE_MINOR_ISLANDS_SHA256)
    land=find_vector(unzip(land_zip,land_zip.with_suffix("")))
    minor=find_vector(unzip(minor_zip,minor_zip.with_suffix("")))
    return [
        {"layer":"ne_10m_land","path":land,"version":NE_LAND_VERSION,"checksum":NE_LAND_SHA256},
        {"layer":"ne_10m_minor_islands","path":minor,"version":NE_MINOR_ISLANDS_VERSION,"checksum":NE_MINOR_ISLANDS_SHA256},
    ]

def get_gshhg(cache: Path):
    root=cache/"sources"/"gshhg"
    z=download_pinned(GSHHG_URL,root/f"gshhg-shp-{GSHHG_VERSION}.zip",GSHHG_SHA256)
    extracted=unzip(z,z.with_suffix(""))
    return extracted,GSHHG_VERSION,GSHHG_SHA256
