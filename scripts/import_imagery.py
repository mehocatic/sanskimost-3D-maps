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
