import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Building,Point} from './types';

type Style = 'corner'|'bakery'|'gable'|'arcade'|'salon'|'brick'|'old'|'house';
interface Profile {style:Style; name:string; height:number; wall:string; roof:string; fronts?:number[]}
export const mahala:Record<string,Profile>={
  w510393874:{style:'corner',name:'Stambeno-poslovna zgrada na uglu',height:20.2,wall:'#e4e2ce',roof:'#969b95'},
};
