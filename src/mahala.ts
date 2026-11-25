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
  for(let row=0;row<8;row++)for(let col=-1;col<8;col++){
    g.fillStyle=shades[(row*7+col*col+11)%4];g.fillRect(col*32+(row%2)*16,row*16,30,14);
  }
  const map=new T.CanvasTexture(canvas);map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;tileMaps.set(kind,map);return map;
}
const signMaterials=new Map<string,T.MeshBasicMaterial>();
function signMaterial(text:string){
  if(signMaterials.has(text))return signMaterials.get(text)!;
  const c=document.createElement('canvas');c.width=512;c.height=72;const g=c.getContext('2d')!;
  g.fillStyle=text==='VOĆE I POVRĆE'?'#375943':'#363b38';g.fillRect(0,0,512,72);
  g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff6dc';g.font='600 44px sans-serif';g.fillText(text,256,37,480);
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const mat=new T.MeshBasicMaterial({map});signMaterials.set(text,mat);return mat;
}

// A facade is authored in metres with local +Z facing the pavement. Geometry is
// baked together per building so window frames and stalls stay cheap to render.
export function streetDetails(b:Building,ring:Point[],base:number,eave:number){
  const profile=mahala[b.id],style=profile.style,result=new T.Group();
  result.userData.place=b.id;
  const batches=new Map<T.Material,T.BufferGeometry[]>(),frame=new T.Object3D(),item=new T.Object3D();
  function bake(geo:T.BufferGeometry,mat:T.Material,color:string){
    item.updateMatrix();const part=geo.clone();part.applyMatrix4(item.matrix);part.applyMatrix4(frame.matrix);
    const tint=new T.Color(color),colors=new Float32Array(part.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3)tint.toArray(colors,i);
    part.setAttribute('color',new T.BufferAttribute(colors,3));
    const flat=part.index?part.toNonIndexed():part;if(flat!==part)part.dispose();
    if(!batches.has(mat))batches.set(mat,[]);batches.get(mat)!.push(flat);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,color:string,mat=material,tilt=0){
    item.position.set(x,y+h/2,z);item.scale.set(w,h,d);item.rotation.set(tilt,0,0);bake(cube,mat,color);
  }
  function pane(x:number,y:number,w:number,h:number,z=.09){
    box(x,y,z,w,h,.10,'#e3dfcd');box(x,y+.1,z+.07,w-.17,h-.20,.08,'#71868c',streetGlass);
    box(x,y+.10,z+.13,.06,h-.20,.05,'#c9c8bc');box(x,y-.08,z+.05,w+.15,.11,.26,'#d7d0be');
  }
  function shopDoor(x:number,w:number){
    pane(x,.08,w,2.48,.14);
    box(x,.08,.30,w-.14,.21,.06,'#858a83');
    box(x,1.93,.30,w-.14,.065,.05,'#d7d6c9');
    box(x+w*.26,.96,.35,.045,.34,.06,'#e0d8ba');
    box(x,-.06,.23,w+.22,.12,.42,'#aaa598');
  }
  function sign(text:string,x:number,y:number,w:number,z=.23){
    const plane=new T.Mesh(new T.PlaneGeometry(w,.52),signMaterial(text));plane.position.set(x,y,z);
    plane.applyMatrix4(frame.matrix);result.add(plane);
  }
  function balcony(x:number,y:number,w:number){
    box(x,y, .66,w,.20,1.5,'#bca68c');box(x,y+.2,1.34,w,.86,.15,'#d5ac7d');
    for(const side of [-1,1]){
      box(x+side*(w/2-.06),y+.23,.69,.08,.07,1.3,'#ece9dc');
      box(x+side*(w/2-.06),y+1.04,.69,.07,.07,1.3,'#e9e4da');
      for(let j=0;j<4;j++)box(x+side*(w/2-.06),y+.24,.20+j*.28,.045,.82,.045,'#d6d2c9');
    }
  }
  const winding=Math.sign(ring.reduce((v,a,i)=>{const c=ring[(i+1)%ring.length];return v+a[0]*c[1]-a[1]*c[0]},0));
  const entry=b.points[0];const wallH=eave-base;
  ring.forEach((a,i)=>{
    const c=ring[(i+1)%ring.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);
    const mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2;
    frame.position.set(mx,base,mz);frame.rotation.set(0,Math.atan2(winding*dz/len,-winding*dx/len),0);frame.updateMatrix();
    const isCorner=style==='corner',rounded=isCorner&&Math.hypot(mx-entry[0],mz-entry[1])<3.3;
    if(rounded){
      box(0,0,.014,len+.03,wallH,.065,'#777d79');
      if(len>.42)for(let floor=0;floor<5;floor++)pane(0,4.18+floor*3.15,Math.min(.95,len*.78),1.52);
    }
    if(len<1.1)return;
    const front=profile.fronts?.includes(i)??false;
    if(isCorner){
      if(len<1.7)return;
      const bays=Math.max(1,Math.round(len/3.25)),spacing=len/bays;
      box(0,.1,.06,len,3.35,.12,'#404a4b');
      for(let col=0;col<bays;col++){
        const x=(col+.5)*spacing-len/2;
        pane(x,.25,spacing*.89,2.72,.16);
        for(let floor=0;floor<5;floor++){
          const y=3.7+floor*3.15;
          pane(x,y+.48,Math.min(1.9,spacing*.72),1.52);
          if(len>10&&(col===0||col===bays-1)&&!rounded)balcony(x,y,spacing*.90);
        }
      }
      box(0,wallH-.64,.04,len,.64,.15,'#848884');return;
    }
    const bays=Math.max(1,Math.round(len/3.35)),spacing=len/bays;
    if(style==='brick'||((style==='salon'||style==='old')&&front)){
      const geo=new T.PlaneGeometry(len,style==='brick'?wallH:style==='old'?1:3);
      const uv=geo.attributes.uv;
      for(let j=0;j<uv.count;j++)uv.setXY(j,uv.getX(j)*len/4,uv.getY(j)*geo.parameters.height/2);
      const panel=new T.Mesh(geo,new T.MeshLambertMaterial({map:facadePattern(style==='brick'?'brick':'stone')}));
      panel.position.set(0,geo.parameters.height/2,.012);panel.applyMatrix4(frame.matrix);result.add(panel);
    }
    if(front&&style==='bakery'){
      box(0,.1,.04,len,3.18,.1,'#d7aa6e');
      pane(-len*.23,.38,len*.37,2.18);
      shopDoor(len*.06,1.44);
      pane(len*.31,.35,len*.23,2.20);
      sign('PEKARA KLAS',0,3.07,Math.min(6.3,len*.74));
      // Stall at the end towards the adjacent shop house, with a clear pedestrian passage.
      const s=b.points[3],endX=(s[0]-mx)*Math.cos(frame.rotation.y)-(s[1]-mz)*Math.sin(frame.rotation.y);
      const sx=Math.sign(endX)*(len/2-2.1);
      box(sx,2.55,1.25,4,.17,2.5,'#a9473c',material,.10);
      box(sx,2.39,2.48,4,.20,.10,'#933d35');
    }else if(front&&style==='arcade'){
    }else{
    }
  });
}
