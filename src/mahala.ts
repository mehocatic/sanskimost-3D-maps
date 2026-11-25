import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Building,Point} from './types';

type Style = 'corner'|'bakery'|'gable'|'arcade'|'salon'|'brick'|'old'|'house';
