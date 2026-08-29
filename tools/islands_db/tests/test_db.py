import io
from pathlib import Path
from islands_db.db import connect, emit, query
from islands_db.materialize import insert_base_rows

def seed(tmp_path):
    c=connect(tmp_path/"x.sqlite")
    c.executemany("INSERT INTO islands(id,usgs_id,name,area_km2,population,country,region) VALUES(?,?,?,?,?,?,?)",[
      (1,"a","Alpha",10,100,"Aland","Europe"),(2,"b","Beta",20,300,"Bland","Asia"),(3,"c","Gamma",30,200,"Cland","Asia")])
    c.executemany("INSERT INTO jurisdictions(island_id,country,region) VALUES(?,?,?)",[(1,"Aland","Europe"),(2,"Bland","Asia"),(3,"Cland","Asia"),(3,"Bland","Asia")]); c.commit(); return c

def test_default_name_sort_and_pagination(tmp_path):
    c=seed(tmp_path); rows=query(c,[],"name","asc",1,1); assert [r["name"] for r in rows]==["Beta"]

def test_population_sort_desc(tmp_path):
    c=seed(tmp_path); rows=query(c,[],"population","desc",0,2); assert [r["name"] for r in rows]==["Beta","Gamma"]

def test_country_matches_secondary_jurisdiction(tmp_path):
    c=seed(tmp_path); rows=query(c,["country=Bland"],"name","asc",0,10); assert [r["name"] for r in rows]==["Beta","Gamma"]

def test_csv_default_shape(tmp_path):
    c=seed(tmp_path); rows=query(c,[],"name","asc",0,1); s=io.StringIO(); emit(rows,"csv",s); assert s.getvalue().startswith("id,usgs_id,name,")

def test_json_format(tmp_path):
    c=seed(tmp_path); rows=query(c,[],"name","asc",0,1); s=io.StringIO(); emit(rows,"json",s); assert '"name": "Alpha"' in s.getvalue()


def test_base_insert_survives_extended_schema(tmp_path):
    c=connect(tmp_path/"fresh.sqlite")
    insert_base_rows(c,[(1,"u","Island","[]",1.0,None,None,None,None,None,None,None,None,None,None,None,None,None,None)])
    row=c.execute("SELECT id,name,name_source,name_source_id,name_match_method FROM islands").fetchone()
    assert tuple(row)==(1,"Island",None,None,None)
