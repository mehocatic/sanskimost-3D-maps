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


def contains(point, ring):
    inside = False
    x, z = point
    for (ax, az), (bx, bz) in zip(ring, ring[1:] + ring[:1]):
        if (az > z) != (bz > z) and x < ax + (z - az) * (bx - ax) / (bz - az):
            inside = not inside
    return inside


def segment_midpoint(points):
    lengths = [math.dist(a, b) for a, b in zip(points, points[1:])]
    remaining = sum(lengths)/2
    for a, b, length in zip(points, points[1:], lengths):
        if remaining <= length and length:
            return tuple(round(s + (e-s)*remaining/length, 2) for s, e in zip(a,b))
        remaining -= length
    return points[-1]


def measure(raw):
    if not raw:
        return None
    match = re.fullmatch(r"([0-9]+(?:[.,][0-9]+)?)\s*(m|ft|')?", raw.strip())
    if match:
        value = float(match[1].replace(',', '.')) * (0.3048 if match[2] in ('ft', "'") else 1)
        return round(value, 2) if value > 0 else None


def building_height(tags, area, osm_id):
    measured = measure(tags.get('height'))
    if measured:
        return measured, 'osm:height'
    levels = measure(tags.get('building:levels'))
    if levels:
        return round(levels*3.1 + (measure(tags.get('roof:height')) or 0), 1), 'osm:levels'
    kind = tags.get('building', 'yes')
    if kind in {'garage', 'garages', 'shed', 'greenhouse', 'roof', 'carport'} or area < 38:
        return 3.3, 'estimate'
    if kind == 'apartments':
        return 12 + 3*(osm_id % 3), 'estimate'
    if kind in {'industrial', 'retail', 'commercial', 'public', 'school', 'supermarket'}:
        return 7 + osm_id % 4, 'estimate'
    return (5.8 if area < 170 else 7.8) + (osm_id % 5)*0.5, 'estimate'


def area_kind(t):
    if t.get('natural') == 'water' or t.get('waterway') == 'riverbank':
        return 'water'
    if t.get('amenity') == 'parking':
        return 'parking'
    if t.get('leisure') in {'pitch', 'park'}:
        return t['leisure']
    if t.get('natural') in {'wood', 'scrub'} or t.get('landuse') == 'forest':
        return 'forest'
    if t.get('natural') == 'beach':
        return 'sand'
    land = t.get('landuse')
    if land in {'residential','industrial','commercial','cemetery','orchard','farmland','grass'}:
        return land
    if land in {'meadow','recreation_ground'} or t.get('leisure') == 'stadium':
        return 'grass'
    if t.get('highway') and t.get('area') == 'yes' or t.get('amenity') == 'bus_station':
        return 'paved'


def read_sources(paths):
    objects = {kind: {} for kind in ('node', 'way', 'relation')}
    for path in paths:
        opener = gzip.open if path.suffix == '.gz' else open
        with opener(path, 'rb') as f:
            for item in ET.parse(f).getroot():
                if item.tag in objects:
                    index = objects[item.tag]
                    key = item.get('id')
                    if key not in index or int(item.get('version', '0')) > int(index[key].get('version', '0')):
                        index[key] = item
    return objects


def rings(parts):
    """Stitch relation members by endpoint node ID, including reversed ways."""
    remaining = list(parts)
    while remaining:
        chain = list(remaining.pop())
        while chain[0] != chain[-1]:
            for i, part in enumerate(remaining):
                if chain[-1] == part[0]:
                    chain.extend(part[1:])
                elif chain[-1] == part[-1]:
                    chain.extend(part[-2::-1])
                elif chain[0] == part[-1]:
                    chain = part[:-1] + chain
                elif chain[0] == part[0]:
                    chain = part[:0:-1] + chain
                else:
                    continue
                remaining.pop(i)
                break
            else:
                break
        if chain[0] == chain[-1] and len(chain) >= 4:
            yield chain


def tags(item):
    return {tag.get('k'): tag.get('v') for tag in item.findall('tag')}


def record(key, t, **attributes):
    feature = {'id': key, **attributes, 'tags': {a:b for a,b in t.items() if a in ATTRIBUTES}}
    if name := t.get('name:bs') or t.get('name'):
        feature['name'] = name
    return feature


def build(paths):
    obj = read_sources(paths)
    nodes = {key: project(float(e.get('lat')),float(e.get('lon'))) for key,e in obj['node'].items()}
    way_refs = {key: [n.get('ref') for n in e.findall('nd')] for key,e in obj['way'].items()}
    data = {kind: [] for kind in ('buildings','parts','roads','areas','waterways','pois','trees','lamps')}

    def add_poi(key, t, point, fallback):
        if (t.get('name') or t.get('name:bs')) and in_map(point):
            data['pois'].append(record(key, t, kind=fallback, x=point[0], z=point[1]))

    def add_polygon(key, t, outer, inner=()):
        original = [nodes[n] for n in outer[:-1]]
        polygon = clip_polygon(original)
        if not polygon:
            return
        clipped_holes = [clip_polygon(h) for h in inner if contains(h[0], original)]
        holes = {'holes': [h for h in clipped_holes if h]} if any(clipped_holes) else {}
        if t.get('building') and t['building'] != 'no':
            height, source = building_height(t, abs(signed_area(original)), int(key[1:].split('-')[0]))
            data['buildings'].append(record(key,t,kind=t['building'],points=polygon,
                height=height,heightSource=source,**holes))
            add_poi(key,t,center(polygon),t.get('amenity') or t['building'])
        elif t.get('building:part'):
            part = record(key,t,kind=t['building:part'],points=polygon,**holes)
            if marked_height := measure(t.get('height')):
                part.update(height=marked_height, heightSource='osm:height')
            data['parts'].append(part)
        elif kind := area_kind(t):
            data['areas'].append(record(key,t,kind=kind,points=polygon,**holes))
            add_poi(key,t,center(polygon),t.get('leisure') or kind)
        else:
            add_poi(key,t,center(polygon),t.get('amenity') or t.get('leisure') or 'place')

    used = set()
    for key, e in obj['relation'].items():
        t = tags(e)
        if t.get('type') != 'multipolygon' or not (area_kind(t) or t.get('building')):
            continue
        refs = [(m.get('role') or 'outer', m.get('ref')) for m in e.findall('member') if m.get('type') == 'way']
        available = [(role,ref) for role,ref in refs if ref in way_refs and set(way_refs[ref]) <= nodes.keys()]
        inners = [[nodes[n] for n in ring[:-1]] for ring in rings([way_refs[r] for role,r in available if role=='inner'])]
        for i, outer in enumerate(rings([way_refs[r] for role,r in available if role == 'outer'])):
            add_polygon('r'+key+(f'-{i}' if i else ''),t,outer,inners)
        used.update(r for role,r in available if role == 'outer')

    for key, e in obj['way'].items():
        t, refs = tags(e), way_refs[key]
        if len(refs) < 2 or key in used or any(n not in nodes for n in refs):
            continue
        line = [nodes[n] for n in refs]
        if (t.get('highway') and t.get('area') != 'yes') or t.get('waterway') in {'river','stream','ditch','canal','drain'}:
            pieces = clip_line(line)
            for i, points in enumerate(pieces):
                feature_id = 'w'+key+(f'-{i}' if i else '')
                if kind := t.get('highway'):
                    width = measure(t.get('width')) or ROAD_WIDTH.get(kind.removesuffix('_link'), 5)
                    bridge = t.get('bridge', 'no') != 'no'
                    data['roads'].append(record(feature_id,t,kind=kind,points=points,width=width,bridge=bridge))
                    if bridge:
                        add_poi(feature_id,t,segment_midpoint(points),'bridge')
                else:
                    kind = t['waterway']
                    data['waterways'].append(record(feature_id,t,kind=kind,points=points,
                        width=measure(t.get('width')) or (9 if kind=='river' else 2.5)))
                    add_poi(feature_id,t,segment_midpoint(points),kind)
        elif refs[0] == refs[-1] and (t.get('building') or t.get('building:part') or area_kind(t) or t.get('amenity') or t.get('leisure')):
            add_polygon('w'+key,t,refs)

    for key, e in obj['node'].items():
        point = nodes[key]
        if not in_map(point):
            continue
        t = tags(e)
        if t.get('highway') == 'street_lamp':
            data['lamps'].append(point)
        if t.get('natural') == 'tree':
            data['trees'].append(point)
        add_poi('n'+key,t,point,next((t[k] for k in ('amenity','leisure','tourism','historic','shop','place','office','natural') if k in t),'place'))
    data['meta'] = {
        'center': CENTER, 'bounds': [-EDGE,-EDGE,EDGE,EDGE],
        'projection':'Local equirectangular; X east, Z south, metres; Earth radius 6371008.8 m',
        'osmAttribution':'© OpenStreetMap contributors', 'license':'ODbL 1.0',
        'licenseUrl':'https://www.openstreetmap.org/copyright',
        'counts': {k:len(v) for k,v in data.items()},
        'heightSources': dict(Counter(b['heightSource'] for b in data['buildings'])),
    }
    return data
