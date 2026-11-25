import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Building,Point} from './types';

type Style = 'corner'|'bakery'|'gable'|'arcade'|'salon'|'brick'|'old'|'house';
interface Profile {style:Style; name:string; height:number; wall:string; roof:string; fronts?:number[]}
