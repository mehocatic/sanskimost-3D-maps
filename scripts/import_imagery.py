"""Crop the true-colour Sentinel-2 scene to the terrain's exact geographic grid.

Rebuild only: Python with numpy and Pillow, plus HTTPS access.
The web application reads only the resulting local JPEG.
"""

import json
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import math
from pathlib import Path
from urllib.request import Request, urlopen
import zlib

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public' / 'data'
ITEM = 'S2B_33TXK_20260814_0_L2A'
COG = 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/33/T/XK/2026/8/' + ITEM
STAC = 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/' + ITEM


def utm33(lon, lat):
    """WGS84 transverse Mercator series for UTM 33N (central meridian 15°)."""
    a, e2, k0 = 6378137.0, 0.0066943799901413165, 0.9996
    phi = np.radians(lat)
    t = np.tan(phi) ** 2
    ep2 = e2 / (1-e2)
    c = ep2 * np.cos(phi) ** 2
    scale = np.cos(phi) * np.radians(lon - 15)
    n = a / np.sqrt(1 - e2 * np.sin(phi)**2)
    m = a*((1-e2/4-3*e2**2/64-5*e2**3/256)*phi
           -(3*e2/8+3*e2**2/32+45*e2**3/1024)*np.sin(2*phi)
           +(15*e2**2/256+45*e2**3/1024)*np.sin(4*phi)
           -35*e2**3/3072*np.sin(6*phi))
    east = 500000 + k0*n*(scale + (1-t+c)*scale**3/6
                           + (5-18*t+t*t+72*c-58*ep2)*scale**5/120)
    north = k0*(m+n*np.tan(phi)*(scale**2/2 + (5-t+9*c+4*c*c)*scale**4/24
                                  +(61-58*t+t*t+600*c-330*ep2)*scale**6/720))
    return east, north


def http_range(url, start, count):
    req = Request(url, headers={'Range': f'bytes={start}-{start+count-1}'})
    with urlopen(req, timeout=75) as response:
        if response.status != 206:
            raise RuntimeError('COG server did not honour the requested byte range')
        data = response.read()
    if len(data) != count:
        raise IOError('Incomplete COG response')
    return data


def sample_cog(asset, east, north, bilinear):
    """Read only intersecting native-resolution Deflate tiles from this COG."""
    url = COG + '/' + asset + '.tif'
    with Image.open(BytesIO(http_range(url, 0, 65536))) as image:
        tif = dict(image.tag_v2)
    if (tif[259], tif.get(284, 1), tif.get(317, 1)) not in ((8,1,1),(8,1,2)):
        raise ValueError('Unexpected compression/layout for selected GeoTIFF')
    channels = tif.get(277,1)
    if tuple(tif[258]) != (8,)*channels or 'UTM zone 33N' not in tif[34737]:
        raise ValueError('Unexpected source CRS or sample type')
    _, _, _, west, top, _ = tif[33922]
    dx, dy, _ = tif[33550]
    px, py = (east-west)/dx-0.5, (top-north)/dy-0.5
    width, height = tif[322], tif[323]
    tx0, tx1 = math.floor(px.min()/width), math.floor((px.max()+1)/width)
    ty0, ty1 = math.floor(py.min()/height), math.floor((py.max()+1)/height)
    mosaic = np.zeros(((ty1-ty0+1)*height,(tx1-tx0+1)*width,channels), dtype=np.uint8)
    tiles_per_row = math.ceil(tif[256]/width)
    def tile(position):
        x,y = position
        i = y*tiles_per_row+x
        packed = http_range(url, tif[324][i], tif[325][i])
        array = np.frombuffer(zlib.decompress(packed),dtype=np.uint8).reshape(height,width,channels)
        if tif.get(317,1)==2:
            array = np.cumsum(array,axis=1,dtype=np.uint8)
        return (x-tx0)*width, (y-ty0)*height, array
    with ThreadPoolExecutor(max_workers=4) as pool:
        positions = [(x,y) for y in range(ty0,ty1+1) for x in range(tx0,tx1+1)]
        for x,y,array in pool.map(tile,positions):
            mosaic[y:y+height,x:x+width] = array
    px, py = px-tx0*width, py-ty0*height
    if not bilinear:
        return mosaic[np.rint(py).astype(int),np.rint(px).astype(int),0]
    i,j = np.floor(px).astype(int), np.floor(py).astype(int)
    fx,fy = (px-i)[:,:,None], (py-j)[:,:,None]
    upper = mosaic[j,i]*(1-fx)+mosaic[j,i+1]*fx
    lower = mosaic[j+1,i]*(1-fx)+mosaic[j+1,i+1]*fx
    return np.rint(upper*(1-fy)+lower*fy).astype(np.uint8)


def main():
    terrain = json.loads((DATA / 'terrain.json').read_text(encoding='utf-8'))
    lat, lon = terrain['center']
    x0, z0 = terrain['x0'], terrain['z0']
    x1 = x0 + terrain['step'] * (terrain['cols'] - 1)
    z1 = z0 + terrain['step'] * (terrain['rows'] - 1)
    lat_scale = math.pi / 180 * 6371008.8
    lon_scale = lat_scale * math.cos(math.radians(lat))
    # Constant degrees per pixel gives the same x/z -> lat/lon as import_osm.py.
    bounds = [lon+x0/lon_scale, lat-z1/lat_scale, lon+x1/lon_scale, lat-z0/lat_scale]
    size = (round((x1-x0)/10), round((z1-z0)/10))
    longitude = bounds[0] + (np.arange(size[0])[None,:]+0.5)*(bounds[2]-bounds[0])/size[0]
    latitude = bounds[3] - (np.arange(size[1])[:,None]+0.5)*(bounds[3]-bounds[1])/size[1]
    east,north = utm33(longitude,latitude)
    rgb = sample_cog('TCI',east,north,True)
    scl = sample_cog('SCL',east,north,False)
    counts = {int(code):int(count) for code,count in zip(*np.unique(scl, return_counts=True))}
    # SCL 0=no data, 1=defective, 3=cloud shadow, 8/9=cloud, 10=cirrus, 11=snow.
    obscured = sum(counts.get(code,0) for code in (0,1,3,8,9,10,11))
    if any(counts.get(code,0) for code in (0,1,3,8,9,11)) or obscured > rgb.shape[0]*rgb.shape[1]*0.001:
        raise ValueError(f'{obscured} invalid, cloud/shadow or snow samples in crop: {counts}')
    if not rgb.any(axis=2).all():
        raise ValueError('The true colour image has missing RGB samples')
    metadata = {
        'file': 'ground.jpg', 'item': ITEM, 'acquiredUtc': '2026-08-14T09:58:14.853Z',
        'instrument': 'Sentinel-2B MSI', 'product': 'Level-2A true colour (B04, B03, B02)',
        'source': STAC, 'sourceImage': COG+'/TCI.tif', 'classificationMask': COG+'/SCL.tif',
        'sourceEPSG': 32633, 'sourceGsdM': 10, 'sizePx': size, 'centerLatLon': [lat,lon],
        'boundsXZ': [x0,z0,x1,z1], 'westSouthEastNorth': bounds,
        'sampling': 'North-up; bounds are outer pixel edges; row 0 is north. x east and z south in metres.',
        'processing': 'Reprojection from WGS84 / UTM 33N, bilinear resampling, sRGB JPEG.',
        'tileCloudCoverPercent': 0.000756, 'sceneClassificationCounts': counts,
        'localCloudShadowSnowInvalidSamples': obscured,
        'classificationNote': 'SCL is a 20 m automated classification, resampled to this grid by nearest neighbour.',
        'credit': 'Contains modified Copernicus Sentinel data 2026',
        'terms': 'https://dataspace.copernicus.eu/terms-and-conditions',
    }
    Image.fromarray(rgb).save(DATA/'ground.jpg', quality=92, subsampling=0, optimize=True)
    (DATA/'ground.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
    print(f'{size}, SCL counts {counts}, {(DATA/"ground.jpg").stat().st_size} bytes')


if __name__ == '__main__':
    main()
