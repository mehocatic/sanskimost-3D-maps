import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Building,Point} from './types';

type Style = 'corner'|'bakery'|'gable'|'arcade'|'salon'|'brick'|'old'|'house';
interface Profile {style:Style; name:string; height:number; wall:string; roof:string; fronts?:number[]}
export const mahala:Record<string,Profile>={
  w510393874:{style:'corner',name:'Stambeno-poslovna zgrada na uglu',height:20.2,wall:'#e4e2ce',roof:'#969b95'},
  w510393875:{style:'gable',name:'Kuća s lokalima u Mahali',height:10.8,wall:'#d2b28d',roof:'#ab7562',fronts:[0]},
  w510393876:{style:'bakery',name:'Pekara Klas i voćara',height:8.1,wall:'#b9afa1',roof:'#8f6552',fronts:[3]},
  w1562605845:{style:'arcade',name:'Kuća s arkadama · Hamzibegova 1',height:10.8,wall:'#bed09f',roof:'#726c61',fronts:[6,8]},
  w1081338210:{style:'salon',name:'Kuća s poslovnim prizemljem · Hamzibegova 3',height:8.0,wall:'#eadbc7',roof:'#a76c54',fronts:[1]},
  w1081338211:{style:'brick',name:'Kuća od opeke · Hamzibegova 5',height:10.4,wall:'#bd7658',roof:'#96604a',fronts:[0]},
  w1081338214:{style:'old',name:'Stara kuća · Hamzibegova 11',height:5.1,wall:'#bbac92',roof:'#955f49',fronts:[0]},
};
for(const [id,wall,roof,h] of [
  ['w1081338209','#e0d2ac','#8b5c48',7.5],['w1081338212','#e4dbc4','#ad7760',4.5]
] as const)mahala[id]={style:'house',name:'Kuća u džematu',height:h,wall,roof};
