"""Rebuild the local terrain grid. Requires Python 3 and Pillow with libtiff."""

import argparse
import json
import math
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlretrieve

from PIL import Image


CENTER_LAT, CENTER_LON = 44.7667, 16.6670
EARTH_RADIUS = 6371008.8
TILE = "Copernicus_DSM_COG_10_N44_00_E016_00_DEM"
SOURCE_URL = f"https://copernicus-dem-30m.s3.amazonaws.com/{TILE}/{TILE}.tif"
PRODUCT_URL = "https://doi.org/10.5270/ESA-c5d3d65"
ATTRIBUTION = (
    "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus "
    "Defence and Space GmbH 2014-2018 provided under COPERNICUS by the "
    "European Union and ESA; all rights reserved"
)
NOTICE = (
    "Organizacije zakonski ili po ovlaštenju zadužene za program Copernicus "
    "ne snose odgovornost za bilo koju upotrebu podataka Copernicus WorldDEM-30."
)
COUNT = 181
STEP_METRES = 60
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "data" / "terrain.json"


def resample(path):
    with Image.open(path) as dem:
        # The GLO-30 product uses PixelIsPoint: the tie point locates the
        # sample itself. A half-pixel offset would move the data off the OSM.
        _, _, _, west, north, _ = dem.tag_v2[33922]
        lon_step, lat_step, _ = dem.tag_v2[33550]
        if (dem.size, west, north) != ((3600, 3600), 16, 45):
            raise ValueError("Expected the N44 E016 GLO-30 GeoTIFF.")
        pixels = dem.load()
        mid = COUNT // 2
        elevations = []
        for row in range(COUNT):
            z = (row - mid) * STEP_METRES
            lat = CENTER_LAT - math.degrees(z / EARTH_RADIUS)
            py = (north - lat) / lat_step
            j = math.floor(py)
            fy = py - j
            for col in range(COUNT):
                x = (col - mid) * STEP_METRES
                lon = CENTER_LON + math.degrees(x / (EARTH_RADIUS * math.cos(math.radians(CENTER_LAT))))
                px = (lon - west) / lon_step
                i = math.floor(px)
                fx = px - i
                top = (1 - fx) * pixels[i, j] + fx * pixels[i + 1, j]
                bottom = (1 - fx) * pixels[i, j + 1] + fx * pixels[i + 1, j + 1]
                value = (1 - fy) * top + fy * bottom
                if not math.isfinite(value) or not 0 < value < 2000:
                    raise ValueError(f"Unexpected elevation {value} at {lat}, {lon}.")
                elevations.append(round(value))
    return {
        "cols": COUNT, "rows": COUNT, "x0": -mid * STEP_METRES,
        "z0": -mid * STEP_METRES, "step": STEP_METRES,
        "center": [CENTER_LAT, CENTER_LON],
        "baseElevation": elevations[mid * COUNT + mid], "heights": elevations,
        "verticalDatum": "EGM2008", "unit": "m",
        "source": "Copernicus DEM GLO-30", "sourceUrl": SOURCE_URL,
        "productUrl": PRODUCT_URL, "attribution": ATTRIBUTION, "notice": NOTICE,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tif", type=Path, help="Use an already downloaded GLO-30 N44 E016 GeoTIFF.")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    if args.tif:
        terrain = resample(args.tif)
    else:
        with TemporaryDirectory() as temp:
            filename, _ = urlretrieve(SOURCE_URL, Path(temp) / f"{TILE}.tif")
            terrain = resample(filename)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(terrain, separators=(",", ":"), ensure_ascii=False)
    args.output.write_text(encoded + "\n", encoding="utf-8")
    print(f"{COUNT} x {COUNT}, {STEP_METRES} m grid, "
          f"{min(terrain['heights'])}–{max(terrain['heights'])} m EGM2008")


if __name__ == "__main__":
    main()
