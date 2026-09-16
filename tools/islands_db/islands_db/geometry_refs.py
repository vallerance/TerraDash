from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
import struct
from typing import Iterable

import geopandas as gpd
import numpy as np
import pyogrio
from shapely.geometry import Point
from shapely import make_valid
from shapely.strtree import STRtree

from .sources import (
    GSHHG_SHA256,
    GSHHG_VERSION,
    USGS_ARCGIS_ITEM,
    USGS_GLOBAL_ISLANDS_MODIFIED,
    USGS_GLOBAL_ISLANDS_SHA256,
    get_gshhg,
    get_ne_geometry,
    get_usgs,
)

GEOMETRY_FIELDS = [
    "geometry_source",
    "geometry_feature_id",
    "geometry_source_version",
    "geometry_source_checksum",
    "geometry_layer",
    "geometry_component",
    "geometry_level",
    "geometry_parent_id",
    "geometry_sibling_id",
    "geometry_ancestor_id",
    "geometry_source_detail",
    "geometry_resolution_method",
    "geometry_resolution_status",
    "geometry_resolution_fallback_reason",
]


class GeometryResolutionError(RuntimeError):
    pass


@dataclass(frozen=True)
class ResolutionReport:
    total: int
    natural_earth_unique: int
    natural_earth_missing: int
    natural_earth_ambiguous: int
    natural_earth_duplicate_ownership: int
    gshhg_unique: int
    gshhg_missing: int
    gshhg_ambiguous: int
    gshhg_duplicate_ownership: int
    usgs_fallback: int
    unresolved: int

    def as_dict(self):
        return asdict(self)


def _feature_ref(feature: dict) -> tuple[str, str]:
    return str(feature["geometry_source"]), str(feature["geometry_feature_id"])


def _point_matches(points: dict[int, Point], features: list[dict]) -> dict[int, list[dict]]:
    if not features:
        return {iid: [] for iid in points}
    geometries=[f["geometry"] for f in features]
    if any(g is None or g.is_empty or not g.is_valid for g in geometries):
        raise GeometryResolutionError("geometry source contains empty or invalid polygon geometry")
    tree=STRtree(geometries)
    result={}
    for iid,point in points.items():
        candidates=tree.query(point)
        # covers() is deterministic containment and includes an exact boundary point without a buffer.
        result[iid]=[features[int(i)] for i in candidates if geometries[int(i)].covers(point)]
    return result


def _duplicate_owner_ids(matches: dict[int, list[dict]]) -> set[int]:
    owners=defaultdict(list)
    for iid,features in matches.items():
        if len(features)==1:
            owners[_feature_ref(features[0])].append(iid)
    return {iid for ids in owners.values() if len(ids)>1 for iid in ids}


def _base_resolution(feature: dict, fallback_reason: str | None) -> dict:
    return {
        key: feature.get(key)
        for key in GEOMETRY_FIELDS
    } | {
        "geometry_resolution_method":"coordinate-covered-by",
        "geometry_resolution_status":"unique",
        "geometry_resolution_fallback_reason":fallback_reason,
    }


def resolve_records(
    rows: Iterable[dict],
    natural_earth_features: list[dict],
    gshhg_features: list[dict] | None,
    usgs_features: dict[int, dict],
    gshhg_matches: dict[int,list[dict]] | None = None,
) -> tuple[list[dict], ResolutionReport]:
    records=[dict(r) for r in rows]
    if len({int(r["id"]) for r in records}) != len(records):
        raise GeometryResolutionError("export batch contains duplicate island ids")
    points={}
    for r in records:
        iid=int(r["id"])
        if r.get("longitude") is None or r.get("latitude") is None:
            raise GeometryResolutionError(f"island {iid} has no supplied coordinate")
        points[iid]=Point(float(r["longitude"]),float(r["latitude"]))

    ne_matches=_point_matches(points,natural_earth_features)
    ne_duplicate=_duplicate_owner_ids(ne_matches)
    resolved={}
    reasons={}
    ne_missing=ne_ambiguous=0
    for iid,matches in ne_matches.items():
        if len(matches)==1 and iid not in ne_duplicate:
            resolved[iid]=_base_resolution(matches[0],None)
        else:
            if not matches:
                ne_missing += 1; reasons[iid]="natural_earth_missing"
            elif len(matches)>1:
                ne_ambiguous += 1; reasons[iid]="natural_earth_ambiguous"
            else:
                reasons[iid]="natural_earth_duplicate_ownership"

    fallback_points={iid:points[iid] for iid in points if iid not in resolved}
    g_matches=(gshhg_matches if gshhg_matches is not None else _point_matches(fallback_points,gshhg_features or []))
    g_matches={iid:list(g_matches.get(iid,[])) for iid in fallback_points}
    g_duplicate=_duplicate_owner_ids(g_matches)
    g_missing=g_ambiguous=0
    for iid,matches in g_matches.items():
        if len(matches)==1 and iid not in g_duplicate:
            resolved[iid]=_base_resolution(matches[0],reasons[iid])
        else:
            if not matches:
                g_missing += 1; reasons[iid] += ";gshhg_missing"
            elif len(matches)>1:
                g_ambiguous += 1; reasons[iid] += ";gshhg_ambiguous"
            else:
                reasons[iid] += ";gshhg_duplicate_ownership"

    # The issue explicitly prefers a permissive/public-domain supplemental source when it gives
    # equivalent complete coverage. GSHHG cannot uniquely represent a number of river/delta and
    # Antarctic USGS islands, so those rows fall back to the pinned canonical USGS polygon itself.
    usgs_fallback=0
    for iid in points:
        if iid in resolved:
            continue
        feature=usgs_features.get(iid)
        if feature is None:
            continue
        resolved[iid]=_base_resolution(feature,reasons[iid])
        resolved[iid]["geometry_resolution_method"]="source-representative-point"
        usgs_fallback += 1

    unresolved=sorted(set(points)-set(resolved))
    if unresolved:
        details=", ".join(f"{iid}:{reasons.get(iid,'unresolved')}" for iid in unresolved[:25])
        if len(unresolved)>25: details += f", ... (+{len(unresolved)-25})"
        raise GeometryResolutionError(f"geometry resolution failed closed for {len(unresolved)} islands: {details}")

    final_owners=defaultdict(list)
    for iid,res in resolved.items(): final_owners[(res["geometry_source"],res["geometry_feature_id"])].append(iid)
    dup={ref:ids for ref,ids in final_owners.items() if len(ids)>1}
    if dup:
        sample=next(iter(dup.items()))
        raise GeometryResolutionError(f"duplicate final geometry ownership for {sample[0]}: {sample[1]}")

    out=[]
    by_id={int(r["id"]):r for r in records}
    for r in records:
        rr=dict(r); rr.update(resolved[int(r["id"])]); out.append(rr)

    report=ResolutionReport(
        total=len(records),
        natural_earth_unique=sum(len(v)==1 for v in ne_matches.values())-len(ne_duplicate),
        natural_earth_missing=ne_missing,
        natural_earth_ambiguous=ne_ambiguous,
        natural_earth_duplicate_ownership=len(ne_duplicate),
        gshhg_unique=sum(len(v)==1 for v in g_matches.values())-len(g_duplicate),
        gshhg_missing=g_missing,
        gshhg_ambiguous=g_ambiguous,
        gshhg_duplicate_ownership=len(g_duplicate),
        usgs_fallback=usgs_fallback,
        unresolved=0,
    )
    return out,report


def load_natural_earth_features(cache: Path) -> list[dict]:
    features=[]
    for source in get_ne_geometry(cache):
        g=gpd.read_file(source["path"])
        if g.crs is None: g=g.set_crs(4326)
        else: g=g.to_crs(4326)
        for fid,geom in g.geometry.items():
            parts=list(geom.geoms) if geom.geom_type=="MultiPolygon" else [geom]
            for component,poly in enumerate(parts):
                features.append({
                    "geometry":poly,
                    "geometry_source":"natural_earth",
                    "geometry_feature_id":f"{source['layer']}:fid={fid}:component={component}",
                    "geometry_source_version":source["version"],
                    "geometry_source_checksum":source["checksum"],
                    "geometry_layer":source["layer"],
                    "geometry_component":component,
                    "geometry_level":None,
                    "geometry_parent_id":None,
                    "geometry_sibling_id":None,
                    "geometry_ancestor_id":None,
                    "geometry_source_detail":"Natural Earth physical polygon component",
                })
    return features


def _point_on_segment(px,py,x1,y1,x2,y2,eps=1e-12):
    cross=(px-x1)*(y2-y1)-(py-y1)*(x2-x1)
    if abs(cross) > eps:
        return False
    return min(x1,x2)-eps <= px <= max(x1,x2)+eps and min(y1,y2)-eps <= py <= max(y1,y2)+eps


def _ring_contains(raw: memoryview, point_offset: int, start: int, end: int, px: float, py: float):
    inside=False
    if end-start < 3:
        return False,False
    x1,y1=struct.unpack_from('<dd',raw,point_offset+16*(end-1))
    for i in range(start,end):
        x2,y2=struct.unpack_from('<dd',raw,point_offset+16*i)
        if _point_on_segment(px,py,x1,y1,x2,y2):
            return True,True
        if ((y1>py)!=(y2>py)) and (px < (x2-x1)*(py-y1)/(y2-y1)+x1):
            inside=not inside
        x1,y1=x2,y2
    return inside,False


def _scan_polygon_shapefile(path: Path, points: dict[int, Point]) -> dict[int,list[int]]:
    """Return source record indexes whose polygon covers each point, using bounded memory.

    Shapefile polygon membership uses the even/odd ring rule, which handles multipart polygons and
    holes without GDAL's expensive global polygon organization. Exact segment hits count as covered.
    """
    result={iid:[] for iid in points}
    with path.open('rb') as f:
        header=f.read(100)
        if len(header)!=100 or struct.unpack_from('<i',header,32)[0] not in (5,15,25):
            raise GeometryResolutionError(f"expected polygon shapefile: {path}")
        record_index=0
        while True:
            record_header=f.read(8)
            if not record_header:
                break
            if len(record_header)!=8:
                raise GeometryResolutionError(f"truncated shapefile record header: {path}")
            _,words=struct.unpack('>ii',record_header)
            raw=f.read(words*2)
            if len(raw)!=words*2:
                raise GeometryResolutionError(f"truncated shapefile record: {path}")
            if len(raw)<44:
                record_index+=1; continue
            shape_type=struct.unpack_from('<i',raw,0)[0]
            if shape_type==0:
                record_index+=1; continue
            if shape_type not in (5,15,25):
                raise GeometryResolutionError(f"unexpected shape type {shape_type} in {path}")
            minx,miny,maxx,maxy=struct.unpack_from('<dddd',raw,4)
            candidates=[(iid,p) for iid,p in points.items() if minx<=p.x<=maxx and miny<=p.y<=maxy]
            if candidates:
                num_parts,num_points=struct.unpack_from('<ii',raw,36)
                parts=list(struct.unpack_from('<'+'i'*num_parts,raw,44)) if num_parts else []
                point_offset=44+4*num_parts
                ends=parts[1:]+[num_points]
                coords=np.frombuffer(raw,dtype='<f8',count=num_points*2,offset=point_offset).reshape((-1,2))
                states={iid:[False,False] for iid,_ in candidates}  # parity,boundary
                for ring_start,ring_end in zip(parts,ends):
                    ring=coords[ring_start:ring_end]
                    if len(ring)<3:
                        continue
                    rminx=float(ring[:,0].min()); rmaxx=float(ring[:,0].max())
                    rminy=float(ring[:,1].min()); rmaxy=float(ring[:,1].max())
                    ring_candidates=[
                        (iid,p) for iid,p in candidates
                        if not states[iid][1] and rminx<=p.x<=rmaxx and rminy<=p.y<=rmaxy
                    ]
                    if not ring_candidates:
                        continue
                    x2=ring[:,0]; y2=ring[:,1]
                    x1=np.roll(x2,1); y1=np.roll(y2,1)
                    dx=x2-x1; dy=y2-y1
                    min_x=np.minimum(x1,x2); max_x=np.maximum(x1,x2)
                    min_y=np.minimum(y1,y2); max_y=np.maximum(y1,y2)
                    for iid,p in ring_candidates:
                        px,py=p.x,p.y
                        cross=(px-x1)*dy-(py-y1)*dx
                        on=(np.abs(cross)<=1e-12) & (px>=min_x-1e-12) & (px<=max_x+1e-12) & (py>=min_y-1e-12) & (py<=max_y+1e-12)
                        if bool(np.any(on)):
                            states[iid][1]=True
                            continue
                        crossing=(y1>py)!=(y2>py)
                        valid=crossing & (dy!=0)
                        if bool(np.any(valid)):
                            crossings=px < (dx[valid]*(py-y1[valid])/dy[valid]+x1[valid])
                            if int(np.count_nonzero(crossings))%2:
                                states[iid][0]=not states[iid][0]
                for iid,_ in candidates:
                    parity,boundary=states[iid]
                    if boundary or parity:
                        result[iid].append(record_index)
            record_index+=1
    return result


def load_gshhg_matches(cache: Path, points: dict[int, Point]) -> dict[int,list[dict]]:
    root,version,checksum=get_gshhg(cache)
    matches={iid:[] for iid in points}
    # High-resolution GSHHG preserves substantially more small-island coverage than crude resolution.
    # Read attributes without geometry, and stream the .shp polygon records ourselves so even very
    # large continental multipart features never require global in-memory polygon organization.
    for level in (1,3):
        layer=f"GSHHS_h_L{level}"
        path=root/"GSHHS_shp"/"h"/f"{layer}.shp"
        record_matches=_scan_polygon_shapefile(path,points)
        wanted=sorted({record for records in record_matches.values() for record in records})
        if not wanted:
            continue
        attrs=pyogrio.read_dataframe(path,fids=wanted,read_geometry=False,fid_as_index=True)
        attr_by_fid={int(fid):row for fid,row in attrs.iterrows()}
        for iid,records in record_matches.items():
            for record in records:
                row=attr_by_fid[record]
                source_id=str(row["id"])
                matches[iid].append({
                    "geometry":None,
                    "geometry_source":"gshhg",
                    "geometry_feature_id":source_id,
                    "geometry_source_version":version,
                    "geometry_source_checksum":checksum,
                    "geometry_layer":layer,
                    "geometry_component":None,
                    "geometry_level":int(row["level"]),
                    "geometry_parent_id":None if int(row["parent_id"]) < 0 else str(int(row["parent_id"])),
                    "geometry_sibling_id":None if int(row["sibling_id"]) < 0 else str(int(row["sibling_id"])),
                    "geometry_ancestor_id":source_id,
                    "geometry_source_detail":str(row["source"]),
                })
    for iid in matches:
        matches[iid].sort(key=lambda f:(f["geometry_layer"],f["geometry_feature_id"]))
    return matches

def load_usgs_features(cache: Path, island_ids: Iterable[int]) -> dict[int,dict]:
    """Build canonical USGS source references without reloading the huge source polygons.

    Island ids are created by ensure_base as layer_index * 1_000_000 + source FID, and
    latitude/longitude are created by geom_worker from that source row's representative_point().
    Re-reading selected BigIslands geometry here can cause GDAL to materialize enormous multipart
    polygons and is unnecessary to reproduce the owned source feature.
    """
    wanted=sorted(set(int(x) for x in island_ids))
    if not wanted: return {}
    src,_=get_usgs(cache)
    layer_names=[x[0] for x in pyogrio.list_layers(src)]
    island_layers=[x for x in layer_names if any(k in x for k in ("BigIslands","SmallIslands","VerySmallIslands")) and "Contin" not in x]
    out={}
    for iid in wanted:
        layer_index=iid//1_000_000; fid=iid%1_000_000
        if layer_index < 1 or layer_index > len(island_layers):
            raise GeometryResolutionError(f"island {iid} has invalid encoded USGS layer index {layer_index}")
        layer=island_layers[layer_index-1]
        out[iid]={
            "geometry":None,
            "geometry_source":"usgs_global_islands",
            "geometry_feature_id":f"{layer}:fid={fid}",
            "geometry_source_version":f"ArcGIS item {USGS_ARCGIS_ITEM} modified {USGS_GLOBAL_ISLANDS_MODIFIED}",
            "geometry_source_checksum":USGS_GLOBAL_ISLANDS_SHA256,
            "geometry_layer":layer,
            "geometry_component":fid,
            "geometry_level":None,
            "geometry_parent_id":None,
            "geometry_sibling_id":None,
            "geometry_ancestor_id":None,
            "geometry_source_detail":"USGS Global Islands canonical source row; exported coordinate is its source representative point",
        }
    return out

def resolve_geometry_references(rows: Iterable[dict],cache: Path):
    records=[dict(r) for r in rows]
    ne=load_natural_earth_features(cache)
    points={int(r["id"]):Point(float(r["longitude"]),float(r["latitude"])) for r in records}
    ne_matches=_point_matches(points,ne)
    ne_duplicate=_duplicate_owner_ids(ne_matches)
    fallback_points={
        iid:point for iid,point in points.items()
        if len(ne_matches[iid]) != 1 or iid in ne_duplicate
    }
    gshhg_matches=load_gshhg_matches(cache,fallback_points)
    usgs=load_usgs_features(cache,[int(r["id"]) for r in records])
    return resolve_records(records,ne,None,usgs,gshhg_matches=gshhg_matches)
