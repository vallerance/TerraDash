import csv
import io
import json

import pytest
from shapely.geometry import MultiPolygon, Point, Polygon, box

from islands_db.db import emit
from islands_db.geometry_refs import GeometryResolutionError, resolve_records


def feature(source, feature_id, geometry=None, **extra):
    value={
        "geometry":geometry,
        "geometry_source":source,
        "geometry_feature_id":feature_id,
        "geometry_source_version":"test-v1",
        "geometry_source_checksum":"0"*64,
        "geometry_layer":"test",
        "geometry_component":extra.get("component"),
        "geometry_level":extra.get("level"),
        "geometry_parent_id":extra.get("parent_id"),
        "geometry_sibling_id":extra.get("sibling_id"),
        "geometry_ancestor_id":extra.get("ancestor_id"),
        "geometry_source_detail":"test",
    }
    return value


def row(i,x,y):
    return {"id":i,"longitude":x,"latitude":y}


def usgs(i):
    return feature("usgs_global_islands",f"BigIslands:fid={i}")


def test_natural_earth_is_preferred_when_unique():
    ne=[feature("natural_earth","ne:1",box(0,0,2,2))]
    g={1:[feature("gshhg","g:1")]}
    out,report=resolve_records([row(1,1,1)],ne,None,{1:usgs(1)},gshhg_matches=g)
    assert out[0]["geometry_source"]=="natural_earth"
    assert out[0]["geometry_feature_id"]=="ne:1"
    assert out[0]["geometry_resolution_fallback_reason"] is None
    assert report.natural_earth_unique==1


def test_gshhg_is_only_used_after_natural_earth_miss():
    g={1:[feature("gshhg","42",level=1,parent_id="4",ancestor_id="42")]}
    out,report=resolve_records([row(1,10,10)],[],None,{1:usgs(1)},gshhg_matches=g)
    assert out[0]["geometry_source"]=="gshhg"
    assert out[0]["geometry_feature_id"]=="42"
    assert out[0]["geometry_resolution_fallback_reason"]=="natural_earth_missing"
    assert report.gshhg_unique==1


def test_duplicate_polygon_ownership_falls_through_instead_of_collapsing():
    shared=feature("natural_earth","shared",box(0,0,3,3))
    g={1:[],2:[]}
    out,report=resolve_records([row(1,1,1),row(2,2,2)],[shared],None,{1:usgs(1),2:usgs(2)},gshhg_matches=g)
    assert [r["geometry_source"] for r in out]==["usgs_global_islands","usgs_global_islands"]
    assert len({r["geometry_feature_id"] for r in out})==2
    assert report.natural_earth_duplicate_ownership==2


def test_missing_everywhere_fails_closed():
    with pytest.raises(GeometryResolutionError,match="failed closed"):
        resolve_records([row(1,5,5)],[],None,{},gshhg_matches={1:[]})


def test_hole_is_not_treated_as_land():
    donut=Polygon([(0,0),(4,0),(4,4),(0,4)],holes=[[(1,1),(3,1),(3,3),(1,3)]])
    out,_=resolve_records([row(1,2,2)],[feature("natural_earth","donut",donut)],None,{1:usgs(1)},gshhg_matches={1:[]})
    assert out[0]["geometry_source"]=="usgs_global_islands"
    assert "natural_earth_missing" in out[0]["geometry_resolution_fallback_reason"]


def test_multipart_components_are_distinct_owned_refs():
    ne=[
        feature("natural_earth","multipart:component=0",box(0,0,1,1),component=0),
        feature("natural_earth","multipart:component=1",box(10,0,11,1),component=1),
    ]
    out,_=resolve_records([row(1,.5,.5),row(2,10.5,.5)],ne,None,{1:usgs(1),2:usgs(2)},gshhg_matches={})
    assert [r["geometry_feature_id"] for r in out]==["multipart:component=0","multipart:component=1"]


def test_dateline_sides_are_deterministic_separate_components():
    # Natural Earth/GSHHG split dateline-crossing GIS polygons into east/west components.
    ne=[
        feature("natural_earth","dateline:east",box(178,-2,180,2)),
        feature("natural_earth","dateline:west",box(-180,-2,-178,2)),
    ]
    out,_=resolve_records([row(1,179,0),row(2,-179,0)],ne,None,{1:usgs(1),2:usgs(2)},gshhg_matches={})
    assert [r["geometry_feature_id"] for r in out]==["dateline:east","dateline:west"]


def test_csv_json_output_parity_and_stable_order():
    ne=[feature("natural_earth","ne:1",box(0,0,2,2))]
    rows,_=resolve_records([row(1,1,1)],ne,None,{1:usgs(1)},gshhg_matches={})
    csv_out=io.StringIO(); json_out=io.StringIO()
    emit(rows,"csv",csv_out); emit(rows,"json",json_out)
    csv_row=next(csv.DictReader(io.StringIO(csv_out.getvalue())))
    json_row=json.loads(json_out.getvalue())[0]
    assert list(csv_row)==list(json_row)
    assert csv_row["geometry_source"]==json_row["geometry_source"]
    assert csv_row["geometry_feature_id"]==json_row["geometry_feature_id"]
