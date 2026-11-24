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


def in_map(point):
    return abs(point[0]) <= EDGE and abs(point[1]) <= EDGE


def dedupe(points):
    result = []
    for x, z in points:
        point = (round(x, 2), round(z, 2))
        if not result or result[-1] != point:
            result.append(point)
    return result


def clip_polygon(points):
    """Sutherland–Hodgman clipping to the 3 km scene rectangle."""
    result = points
    for axis, sign in ((0, 1), (0, -1), (1, 1), (1, -1)):
        if not result:
            break
        previous = result[-1]
        new_ring = []
        for current in result:
            inside = current[axis] * sign <= EDGE
            if inside != (previous[axis] * sign <= EDGE):
                fraction = (EDGE * sign - previous[axis]) / (current[axis] - previous[axis])
                new_ring.append(tuple(a + fraction * (b - a) for a, b in zip(previous, current)))
            if inside:
                new_ring.append(current)
            previous = current
        result = new_ring
    result = dedupe(result)
    if len(result) > 1 and result[0] == result[-1]:
        result.pop()
    return result if len(result) >= 3 and abs(signed_area(result)) > 0.05 else []


def clip_line(points):
    """Preserve separate portions of streets that leave and re-enter the scene."""
    pieces = []
    for a, b in zip(points, points[1:]):
        lower, upper = 0, 1
        for axis in (0, 1):
            delta = b[axis] - a[axis]
            if delta:
                limits = sorted(((-EDGE-a[axis])/delta, (EDGE-a[axis])/delta))
                lower, upper = max(lower, limits[0]), min(upper, limits[1])
            elif abs(a[axis]) > EDGE:
                upper = -1
        if upper <= lower:
            continue
        ends = dedupe([tuple(s + t*(e-s) for s, e in zip(a, b)) for t in (lower, upper)])
        if len(ends) == 2:
            if pieces and pieces[-1][-1] == ends[0]:
                pieces[-1].append(ends[1])
            else:
                pieces.append(ends)
    return pieces


def signed_area(ring):
    return sum(a[0]*b[1] - b[0]*a[1] for a, b in zip(ring, ring[1:]+ring[:1])) / 2


def center(ring):
    area = signed_area(ring)
    if not area:
        return ring[0]
    sums = [0., 0.]
    for a, b in zip(ring, ring[1:] + ring[:1]):
        cross = a[0]*b[1] - b[0]*a[1]
        for i in (0, 1):
            sums[i] += (a[i]+b[i])*cross
    return tuple(round(v / (6*area), 2) for v in sums)
