import * as T from 'three';
import {Building,Feature,Point,centerOf} from './types';
import {Model,finish,canvasMaterial,prism} from './civic-geometry';
import {frontageY,westPoint} from './west-approach';

type Style='centre'|'green'|'glass'|'pink'|'bank';
export const centreBuildings:Partial<Record<string,{style:Style;name:string;height:number}>>={
  w1080919891:{style:'centre',name:'Konzum i terasa Hami VF',height:14.8},
  w510397159:{style:'green',name:'Zelena stambeno-poslovna zgrada',height:18.5},
  w1080919898:{style:'glass',name:'Zgrada UniCredit banke',height:20.4},
  w1080919896:{style:'pink',name:'Roze zgrada kod džamije',height:8.3},
  w959151441:{style:'bank',name:'Zgrada banke na Trgu oslobodilaca',height:7.9},
};
export const centreShops:Record<string,string>={
  n1619084112:'w1080919891',n14220668092:'w1080919891',n5875402582:'w1080919891',n1619087343:'w1080919898',
  n3738081737:'w959151441',n14220668074:'w959151441'
};
type Skin=Style|'cladding'|'tower';
const skins=new Map<Skin,T.MeshLambertMaterial>();
export function centreLighting(night:boolean){
  for(const mat of skins.values())mat.emissiveIntensity=night?.55:0;
}
function facade(style:Skin){
  if(skins.has(style))return skins.get(style)!;
  const colors:Record<Skin,string>={green:'#acb981',glass:'#438a86',pink:'#dba99c',bank:'#dad8ce',centre:'#d9dcd6',cladding:'#b8c1c1',tower:'#abb7bb'};
  const mask=document.createElement('canvas');mask.width=256;mask.height=512;
  const glow=mask.getContext('2d')!;glow.fillStyle='black';glow.fillRect(0,0,256,512);
  const mat=canvasMaterial(256,512,g=>{
    g.fillStyle=colors[style];g.fillRect(0,0,256,512);
    function window(x:number,y:number,w:number,h:number,green=false){
      g.fillStyle='#656c69';g.fillRect(x-3,y-3,w+6,h+8);
      const sky=g.createLinearGradient(x,y,x+w*.65,y+h);
      sky.addColorStop(0,green?'#68a19b':'#abc3c7');sky.addColorStop(.47,green?'#469189':'#81969c');
      sky.addColorStop(.5,green?'#39837d':'#697880');sky.addColorStop(1,green?'#2a6865':'#4a595e');
      g.fillStyle=sky;g.fillRect(x,y,w,h);
      g.fillStyle=green?'#637d78':'#e2ded2';g.fillRect(x+w*.5-2,y,4,h);g.fillRect(x,y+h*.28,w,3);
      g.fillStyle='#e6e0d1';g.fillRect(x-4,y+h,w+8,4);
      if(y>250||green){
        glow.fillStyle=green?'#506465':'#c1a77d';glow.fillRect(x+2,y+2,w*.5-5,h-4);
        glow.fillStyle='black';glow.fillRect(x,y+h*.28,w,3);
      }
    }
    if(style==='cladding'){
      for(let y=0;y<512;y+=36){g.fillStyle='#668275';g.fillRect(0,y,256,3);g.fillStyle='#dae0df';g.fillRect(0,y+3,256,2)}
      g.fillStyle='#939e9e';g.fillRect(0,0,2,512);
    }else if(style==='tower'){
      for(let row=0;row<3;row++)window(15,42+row*152,226,78);
      g.fillStyle='#cdd4d2';g.fillRect(0,0,9,512);g.fillRect(247,0,9,512);
    }else if(style==='glass'){
      for(let j=0;j<5;j++)window(2,j*102+3,252,96,true);
    }else{
      const floors=style==='pink'||style==='bank'?2:style==='green'?5:3;
      for(let j=0;j<floors;j++){
        const h=512/floors,top=j*h;
        if(j===floors-1&&style==='pink'){
          g.fillStyle='#b6a38b';g.fillRect(0,top,256,h);
          for(let row=0;row<10;row++)for(let col=-1;col<5;col++){
            g.fillStyle=['#bbaf99','#d4c6ae','#a89f89'][(row+Math.abs(col))%3];g.fillRect(col*65+row%2*32,top+row*h/10,63,h/10-2);
          }
        }
        window(j===floors-1?12:27,top+h*.16,j===floors-1?232:202,h*(j===floors-1?.77:.56));
        if(style==='green'){g.fillStyle='#d9dac0';g.fillRect(0,top,256,5)}
      }
    }
  },true);
  if(style!=='cladding'){
    const map=new T.CanvasTexture(mask);map.wrapS=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;
    mat.emissiveMap=map;mat.emissive.set('#ffe5b4');mat.emissiveIntensity=0;
  }
  skins.set(style,mat);return mat;
}
function label(model:Model,text:string,width:number,height:number,x:number,y:number,z:number,yaw:number,ink:string,paper:string){
  const pixels=Math.round(96*width/height);
  const mat=canvasMaterial(pixels,96,g=>{
    g.fillStyle=paper;g.fillRect(0,0,pixels,96);g.textAlign='center';g.textBaseline='middle';
    g.font='bold 66px sans-serif';g.fillStyle=ink;g.fillText(text,pixels/2,51,pixels*.94);
  });
  model.add(new T.PlaneGeometry(width,height),mat,x,y,z,yaw);
}
function clip(ring:Point[],distance:(p:Point)=>number):Point[]{
  const out:Point[]=[];
  ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length],da=distance(a),db=distance(b);if(da>=0)out.push(a);
    if(da*db<0){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}
  });return out;
}
function shoppingCentre(model:Model,ring:Point[],base:number){
  const [ox,oz]=ring[0],end=ring.at(-1)!,len=Math.hypot(end[0]-ox,end[1]-oz);
  const ux=(end[0]-ox)/len,uz=(end[1]-oz)/len,yaw=Math.atan2(-uz,ux);
  const u=([x,z]:Point)=>(x-ox)*ux+(z-oz)*uz,v=([x,z]:Point)=>(x-ox)*uz-(z-oz)*ux;
  const point=(a:number,b:number):Point=>[ox+ux*a+uz*b,oz+uz*a-ux*b];
  function slab(a:number,b:number,y:number,w:number,h:number,d:number,color:string){
    const [x,z]=point(a,b);model.box(x,base+y,z,w,h,d,finish(color),yaw);
  }
  function panel(a:number,b:number,y:number,w:number,h:number,material:T.Material,turn=0,repeats=1){
    const [x,z]=point(a,b),geometry=new T.PlaneGeometry(w,h),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*repeats);
    model.add(geometry,material,x,base+y,z,yaw+turn);
  }
  const cap=finish('#b1ae9f');
  const podium=clip(ring,p=>u(p)-2);
  prism(model,podium,base-1.4,base+4.4,finish('#aeb8b9'),cap);
  for(const y of [.9,2.18,3.44])slab((2+len)/2,0,y,len-2,.07,.13,'#4b8a66');
  slab((2+len)/2,0,4.20,len-2,.72,.19,'#39845c');
  slab((2+len)/2,-.03,3.82,len-2,.09,.20,'#cbc694');
  slab(len,7.75,4.20,.20,.72,15.5,'#39845c');
  slab(len,7.75,3.82,.21,.09,15.5,'#cbc694');
  for(const y of [.9,2.18,3.44])slab(len,7.75,y,.13,.07,15.5,'#4b8a66');

  // The roundabout wing projects above the ground-floor shop and open side entrance.
  prism(model,clip(ring,p=>13-u(p)),base+4.4,base+14.1,facade('tower'),finish('#a9b2b4'),1.65);
  for(const b of [7.1,12.5])slab(-1.3,b,2.17,.62,4.34,.61,'#7e817b');
  slab(6.5,0,9.25,13,9.7,.16,'#aab5b9');
  for(let a=.45;a<13;a+=1.24)slab(a,-.099,9.25,.07,9.61,.06,'#a3636a');
  slab(13,6.3,9.25,.40,9.7,.35,'#758e96');
  const residence=clip(clip(clip(ring,p=>u(p)-13),p=>35-u(p)),p=>v(p)-7.2);
  prism(model,residence,base+4.4,base+12.4,facade('centre'),cap,3.2);
  for(const a of [18.2,27.8]){
    for(const y of [6.8,9.4]){
      slab(a,6.78,y,2.32,.16,.95,'#aeb2ae');
      slab(a,6.31,y+.37,2.32,.65,.10,'#959f9f');
    }
  }

  const shop=canvasMaterial(256,256,g=>{
    const glass=g.createLinearGradient(0,0,256,256);
    glass.addColorStop(0,'#8baca6');glass.addColorStop(.42,'#506b67');glass.addColorStop(1,'#2c4443');
    g.fillStyle=glass;g.fillRect(0,0,256,256);
    g.fillStyle='#a8b3a4';g.fillRect(0,0,7,256);g.fillRect(249,0,7,256);
    g.fillStyle='#438060';for(const y of [60,136,206])g.fillRect(0,y,256,6);
  },true);
  panel(7.4,-.081,1.82,10.8,3.64,shop,0,5);
  panel(1.973,5.8,1.82,11.6,3.64,shop,-Math.PI/2,5);
  panel(len-6.1,-.081,1.82,12.2,3.64,shop,0,5);
  panel(len+.075,6.7,1.82,13.4,3.64,shop,Math.PI/2,6);
  const azel=canvasMaterial(512,110,g=>{
    g.fillStyle='#142961';g.fillRect(0,0,512,110);
    g.strokeStyle='#a0bac2';g.lineWidth=7;g.strokeRect(4,4,504,102);
    g.textBaseline='middle';g.font='bold 85px sans-serif';
    g.fillStyle='#c0dc51';g.fillText('Azel',23,57);
    g.fillStyle='#f1f0e8';g.fillText('France',197,57,293);
  });
  panel(4.55,-.151,3.93,4.55,.97,azel);
  panel(1.876,2.5,3.93,4.55,.97,azel,-Math.PI/2);
  const [doorX,doorZ]=point(len-4.5,-.106);
  const entrance=canvasMaterial(240,160,g=>{
    g.fillStyle='#3e635d';g.fillRect(0,0,240,160);
    g.fillStyle='#233e3b';g.fillRect(10,9,220,151);
    g.fillStyle='#6b8882';g.fillRect(18,17,96,122);g.fillRect(126,17,96,122);
    g.fillStyle='#bec1ad';g.fillRect(106,84,4,20);g.fillRect(130,84,4,20);
  });
  model.add(new T.PlaneGeometry(3.55,2.62),entrance,doorX,base+1.31,doorZ,yaw);
  const riverBlock=clip(clip(clip(ring,p=>u(p)-34),p=>v(p)-7),p=>len-3-u(p));
  prism(model,riverBlock,base+4.4,base+14.8,facade('cladding'),finish('#9b9e9c'));
  const konzum=canvasMaterial(640,164,g=>{
    g.font='900 120px sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.shadowColor='#352421';g.shadowOffsetX=4;g.shadowOffsetY=6;g.shadowBlur=5;
    g.fillStyle='#d66d53';g.fillText('KONZUM',320,97,600);
    g.fillStyle='#558558';g.beginPath();g.moveTo(163,26);g.lineTo(171,10);g.lineTo(183,19);g.lineTo(171,33);g.fill();
  });
  konzum.alphaTest=.45;
  panel(33.946,13.25,13.5,11.6,2.97,konzum,-Math.PI/2);
  const vf=canvasMaterial(240,210,g=>{
    g.font='italic bold 148px Georgia';g.textAlign='center';g.textBaseline='middle';
    g.lineWidth=12;g.strokeStyle='#32645a';g.fillStyle='#e5b33f';
    for(const [letter,x,y] of [['V',83,85],['F',153,126]] as const){}
  });
  vf.alphaTest=.45;
  
  
  
  // The white pergola and planters occupy the terrace in front of the VF wing.
  const terraceStart=38,terraceEnd=len-1;
  
  
  for(let a=terraceStart+.7;a<terraceEnd-3.3;a+=4.9){
    for(const b of [1.12,6.2])slab(a,b,6.0,.12,3.18,.12,'#d9ddd2');
    
    
    for(const b of [3.1,4.7])slab(a+1.3,b,4.77,1.35,.26,.43,'#6a634e');
    
    for(const offset of [.8,1.7,2.55]){
      const [x,z]=point(a+offset,1.35),shrub=new T.IcosahedronGeometry(.48,1);
      
      
    }
  }
}
export function centreBuilding(b:Building,height:(x:number,z:number)=>number){
  const profile=centreBuildings[b.id]!,ring=b.points,base=profile.style==='centre'?frontageY:height(...centerOf(ring)),model=new Model();
  if(profile.style==='centre')shoppingCentre(model,ring,base);
  else{
    const top=base+profile.height-(profile.style==='pink'?1.45:profile.style==='glass'?.66:0);
    const cap=finish(profile.style==='pink'?'#8a7768':'#9b9f95');
    if(profile.style==='glass'){
      // Separate upper volumes along the mapped curve so glazing is the outer face.
      const joinX=-251.0;
      
      
      const bay=clip(ring,p=>p[0]-joinX);
      
      
    }else prism(model,ring,base-1.1,top,facade(profile.style),cap,3.6);
    if(profile.style==='pink'){
      // A low hipped roof follows the long mapped wing.
      const eave=ring.map(([x,z])=>new T.Vector3(x,top,z)),[a,b,c,d]=eave;
      const left=a.clone().lerp(d,.5),right=b.clone().lerp(c,.5),ridgeA=left.clone().lerp(right,.13),ridgeB=right.clone().lerp(left,.13);
      ridgeA.y+=1.45;ridgeB.y+=1.45;
      const roof=new T.BufferGeometry(),verts=[a,b,ridgeB,a,ridgeB,ridgeA,b,c,ridgeB,c,d,ridgeA,c,ridgeA,ridgeB,d,a,ridgeA];
      
      
      const tile=finish('#907363');tile.side=T.DoubleSide;
    }
    if(profile.style==='green'){
      const [a,b]=ring,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
      for(let t=4;t<len-2;t+=8.6){
        const x=a[0]+ux*t,z=a[1]+uz*t;
        for(let y=4.4;y<profile.height-1;y+=3.15){
          
          
          
        }
        
      }
    }
    if(profile.style==='bank'){
      const [a,b]=[ring[3],ring[0]],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
      const yaw=Math.atan2(b[1]-a[1],a[0]-b[0]);
      
    }
  }
  return model.build(b.id);
}
export function flowerIsland(area:Feature,height:(x:number,z:number)=>number){
  const [x,z]=centerOf(area.points),y=height(x,z),r=Math.min(...area.points.map(p=>Math.hypot(p[0]-x,p[1]-z)));
  const model=new Model();
  
  
  for(let j=0;j<11;j++){
    const a=j*Math.PI*2/11,petal=new T.SphereGeometry(1,12,8);
    
  }
  
  return model.build(area.id);
}

export function plazaParking(area:Feature){
  const model=new Model(),cars=new Model();
  const ring=area.points;
  const frontage:Point[]=[ring[0],ring[1],ring[2],westPoint(-15,-5.32),westPoint(66,-5.32),
    westPoint(66,-15.35),westPoint(64.8,-15.38),westPoint(-1.1,-17.22),westPoint(-5,-18),ring[6]];
  
  const [a,b]=[ring[2],ring[3]],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  const ux=dx/len,uz=dz/len;
  function point(along:number,across:number):Point{return [a[0]+along*ux+across*uz,a[1]+along*uz-across*ux]}
  function inside([x,z]:Point){
    let hit=false;
    
    return hit;
  }
  const paint=finish('#dedbd0');
  for(let i=0;i<len/2.75;i++){
    const s=1.4+i*2.75,start=point(s,.6),end=point(s,5.45);
    if(!inside(start)||!inside(end))continue;
    
    if(i%4===1||!inside(point(s+2.45,5.45)))continue;
    const [x,z]=point(s+1.36,3),y=frontageY,yaw=Math.atan2(uz,-ux);
    const color=finish(['#939b9c','#6b7278','#d9dad4','#a9594f','#637b8c'][i%5]);
    
    
    
  }
  return {lines:model.build(area.id),cars:cars.build(area.id)};
}
