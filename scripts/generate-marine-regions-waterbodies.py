#!/usr/bin/env python3
"""Generate a Marine Regions Gazetteer CSV for Seas, Gulfs, and Straits.

The script queries the public Marine Regions Gazetteer API for all records whose
hard place type is Sea, Gulf, or Strait. It then queries each record's JSON-LD
representation to discover any associated detailed geometries without downloading
the potentially very large WKT payloads themselves.

Output is deterministic apart from upstream Marine Regions data changes.
"""

from __future__ import annotations

import argparse
import csv
import concurrent.futures
import random
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BASE = "https://www.marineregions.org"
RECORDS_BY_TYPE = BASE + "/rest/getGazetteerRecordsByType.json/{place_type}/"
RECORD_LINKED_DATA = BASE + "/mrgid/{mrgid}"
PLACE_TYPES = ("Sea", "Gulf", "Strait")
PAGE_SIZE = 100
DEFAULT_OUTPUT = Path("data/adhoc/marine-regions-seas-gulfs-straits.csv")
DEFAULT_CACHE_DIR = Path(".cache/marine-regions")
USER_AGENT = "TerraDash Marine Regions dataset generator/1.0"

FIELDNAMES = (
    "MRGID",
    "preferredGazetteerName",
    "placeType",
    "gazetteerSource",
    "status",
    "accepted",
    "latitude",
    "longitude",
    "minLatitude",
    "minLongitude",
    "maxLatitude",
    "maxLongitude",
    "boundingBoxWKT",
    "geometryAvailable",
    "geometryCount",
    "geometryURLs",
    "recordURL",
)


def request_json(url: str, *, accept: str = "application/json", retries: int = 6) -> Any:
    """Fetch JSON with modest retry/backoff for transient upstream failures."""
    request = urllib.request.Request(
        url,
        headers={"Accept": accept, "User-Agent": USER_AGENT},
    )
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            last_error = exc
            if attempt + 1 == retries or exc.code not in (429, 500, 502, 503, 504):
                break
            retry_after = exc.headers.get("Retry-After")
            wait = float(retry_after) if retry_after and retry_after.isdigit() else min(20.0, 1.0 * (2**attempt))
            time.sleep(wait + random.uniform(0.0, 0.5))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt + 1 == retries:
                break
            time.sleep(min(20.0, 1.0 * (2**attempt)) + random.uniform(0.0, 0.5))
    raise RuntimeError(f"Failed to fetch {url}: {last_error}") from last_error


def fetch_records(place_type: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    offset = 0
    while True:
        url = RECORDS_BY_TYPE.format(place_type=urllib.parse.quote(place_type, safe=""))
        if offset:
            url += "?" + urllib.parse.urlencode({"offset": offset})
        page = request_json(url)
        if not isinstance(page, list):
            raise RuntimeError(f"Unexpected response for {place_type}: {type(page).__name__}")
        records.extend(page)
        if len(page) < PAGE_SIZE:
            return records
        offset += len(page)


def normalize_geometry_urls(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        values = [value]
    elif isinstance(value, list):
        values = value
    else:
        raise RuntimeError(f"Unexpected mr:hasGeometry value: {value!r}")
    return [str(url).replace("http://marineregions.org/", BASE + "/", 1) for url in values]


def fetch_geometry_urls(mrgid: int, cache_dir: Path = DEFAULT_CACHE_DIR) -> list[str]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{mrgid}.json"
    if cache_path.exists():
        doc = json.loads(cache_path.read_text(encoding="utf-8"))
    else:
        doc = request_json(
        RECORD_LINKED_DATA.format(mrgid=mrgid),
        accept="application/ld+json",
        )
        cache_path.write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
    if not isinstance(doc, dict):
        raise RuntimeError(f"Unexpected linked-data response for MRGID {mrgid}")
    return normalize_geometry_urls(doc.get("mr:hasGeometry"))


def bounding_box_wkt(record: dict[str, Any]) -> str:
    values = [
        record.get("minLongitude"),
        record.get("minLatitude"),
        record.get("maxLongitude"),
        record.get("maxLatitude"),
    ]
    if any(value is None for value in values):
        return ""
    min_lon, min_lat, max_lon, max_lat = values
    return (
        "POLYGON (("
        f"{min_lon} {min_lat}, {max_lon} {min_lat}, {max_lon} {max_lat}, "
        f"{min_lon} {max_lat}, {min_lon} {min_lat}"
        "))"
    )


def generate(output: Path, *, delay: float = 0.15, workers: int = 4, cache_dir: Path = DEFAULT_CACHE_DIR) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for place_type in PLACE_TYPES:
        records.extend(fetch_records(place_type))

    by_mrgid: dict[int, dict[str, Any]] = {}
    for record in records:
        mrgid = int(record["MRGID"])
        if mrgid in by_mrgid:
            raise RuntimeError(f"Duplicate MRGID {mrgid}")
        by_mrgid[mrgid] = record

    geometry_by_mrgid: dict[int, list[str]] = {}

    def load_geometry(mrgid: int) -> tuple[int, list[str]]:
        if delay:
            time.sleep(delay)
        return mrgid, fetch_geometry_urls(mrgid, cache_dir)

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(load_geometry, mrgid) for mrgid in by_mrgid]
        for future in concurrent.futures.as_completed(futures):
            mrgid, geometry_urls = future.result()
            geometry_by_mrgid[mrgid] = geometry_urls

    rows: list[dict[str, Any]] = []
    for mrgid, record in by_mrgid.items():
        geometry_urls = geometry_by_mrgid[mrgid]
        row = {field: record.get(field, "") for field in FIELDNAMES}
        row.update(
            {
                "boundingBoxWKT": bounding_box_wkt(record),
                "geometryAvailable": "true" if geometry_urls else "false",
                "geometryCount": len(geometry_urls),
                "geometryURLs": " | ".join(geometry_urls),
                "recordURL": f"{BASE}/mrgid/{mrgid}",
            }
        )
        rows.append(row)

    rows.sort(key=lambda row: (str(row["placeType"]), str(row["preferredGazetteerName"]), int(row["MRGID"])))
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--delay",
        type=float,
        default=0.15,
        help="Per-request delay before linked-data requests (default: 0.15)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Maximum concurrent linked-data requests (default: 4)",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=DEFAULT_CACHE_DIR,
        help="Cache directory for per-record linked-data responses",
    )
    args = parser.parse_args()
    rows = generate(args.output, delay=args.delay, workers=args.workers, cache_dir=args.cache_dir)
    counts = {place_type: sum(row["placeType"] == place_type for row in rows) for place_type in PLACE_TYPES}
    geometry_count = sum(row["geometryAvailable"] == "true" for row in rows)
    print(f"Wrote {len(rows)} records to {args.output}")
    print("Place types: " + ", ".join(f"{key}={value}" for key, value in counts.items()))
    print(f"Records with detailed geometry: {geometry_count}")


if __name__ == "__main__":
    main()
