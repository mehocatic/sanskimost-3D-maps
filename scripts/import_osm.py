"""Build Sanski Most's offline, metre-based scene data. Python 3.10+, standard library."""

import argparse
from collections import Counter
import gzip
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
CENTER = (44.7667, 16.667)
METRES_PER_DEGREE = math.pi * 6371008.8 / 180
LON_SCALE = METRES_PER_DEGREE * math.cos(math.radians(CENTER[0]))
EDGE = 1500
ATTRIBUTES = set("""
building building:part building:levels building:material building:colour height
roof:shape roof:colour roof:material roof:height roof:levels addr:street
addr:housenumber surface lanes oneway bridge layer maxspeed sidewalk sidewalk:left
sidewalk:right highway width ref leisure sport natural water waterway landuse
amenity religion denomination historic tourism place shop office wikidata
building:min_level min_height name:bs alt_name loc_name service lit railway man_made tower:type
""".split())
ROAD_WIDTH = {
    'primary': 8, 'secondary': 7.5, 'tertiary': 6.5, 'residential': 5.6,
    'living_street': 4, 'service': 3.6, 'track': 3.3, 'footway': 1.8,
    'cycleway': 2, 'path': 1.5, 'steps': 1.6, 'pedestrian': 4,
}


def project(lat, lon):
    return (round((lon - CENTER[1]) * LON_SCALE, 2),
            round((CENTER[0] - lat) * METRES_PER_DEGREE, 2))
