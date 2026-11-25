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
  ['w1081338209','#e0d2ac','#8b5c48',7.5],['w1081338212','#e4dbc4','#ad7760',4.5],
  ['w1081338213','#e3d7b8','#ac7259',8.1],['w1081338215','#d0b9a4','#825a4e',6.6],
  ['w1081338216','#dfc8aa','#a26c54',7.4],['w1081338217','#e5dbc9','#9c6550',7.3],
  ['w959151443','#d9b7b1','#786e68',7.2],['w1081368757','#d3b2ad','#847370',7.7],
  ['w1081624282','#ded6be','#966b55',7.8],['w1081624284','#e7d3b8','#945f4d',6.7],
  ['w1081624283','#d9c19e','#ab7359',7.6],['w510393873','#dcd5c8','#916b58',7.3]
] as const)mahala[id]={style:'house',name:'Kuća u džematu',height:h,wall,roof};

// Round only the street corner, retaining the survey vertices of the other facades.
export function cornerRing(ring:Point[]):Point[]{
  const result:Point[]=[];
  for(let i=0;i<ring.length;i++){
    if(![7,0,1].includes(i)){result.push(ring[i]);continue}
    const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length];
    const toward=(p:Point):Point=>{const dx=p[0]-b[0],dz=p[1]-b[1],t=Math.min(.42,.9/Math.hypot(dx,dz));return [b[0]+dx*t,b[1]+dz*t]};
    const l=toward(a),r=toward(c);
    for(let k=0;k<=3;k++){const t=k/3,q=1-t;result.push([q*q*l[0]+2*t*q*b[0]+t*t*r[0],q*q*l[1]+2*t*q*b[1]+t*t*r[1]])}
  }
  return result;
}

const material=new T.MeshLambertMaterial({vertexColors:true});
export const streetGlass=new T.MeshLambertMaterial({vertexColors:true,emissive:'#ffcc83',emissiveIntensity:0});
const cube=new T.BoxGeometry(), produce=new T.IcosahedronGeometry(1,0);
const tileMaps=new Map<string,T.CanvasTexture>();
function facadePattern(kind:'brick'|'stone'){
  if(tileMaps.has(kind))return tileMaps.get(kind)!;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const g=canvas.getContext('2d')!;
  g.fillStyle=kind==='brick'?'#a49a88':'#979284';g.fillRect(0,0,256,128);
  const shades=kind==='brick'?['#c28365','#b97856','#c88b66','#bd7553']:['#ccc5b4','#d6cdbb','#bdb6a3','#c4bdad'];
}
