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
