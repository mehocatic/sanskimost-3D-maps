import {localFrame} from './landmarks';
import {streetSurface} from './street-surface';
import {gradeWestBank,terrainAxis} from './west-approach';
import * as T from 'three';
import { City, Feature, Point, Road, Terrain, rng, sampleTerrain, centerOf } from './types';

const bound = 1620;
const side = 4096;
const palette: Record<string,string> = {
  residential:'#b4bf92', industrial:'#c1bcb1', commercial:'#c6c0aa', farmland:'#b9be82',
  grass:'#a2b680', meadow:'#88b94c', forest:'#477a42', park:'#70a53e', orchard:'#82a24d',
  cemetery:'#84a46c', paved:'#c9c5b6', parking:'#aaa99f', pitch:'#70a94b', sand:'#d7c596',
  water:'#559d99', garden:'#79a546', allotments:'#86ae56', scrub:'#729744'
};

export function makeGround(city:City, dem:Terrain, photo:HTMLImageElement){
  function surface(size:number) {
    const c=document.createElement('canvas'); c.width=c.height=size;
    const ctx=c.getContext('2d',{willReadFrequently:true})!;
    const scale=size/(2*bound);ctx.setTransform(scale,0,0,scale,size/2,size/2);
    ctx.lineCap='round';ctx.lineJoin='round';
    return {c,ctx};
  }
  const {c,ctx}=surface(side),{ctx:mask}=surface(1024);
  const rand=rng(1704);
  ctx.fillStyle='#87ae55';ctx.fillRect(-bound,-bound,2*bound,2*bound);
  mask.fillStyle='rgb(20,0,0)';mask.fillRect(-bound,-bound,2*bound,2*bound);
  const path=(p:Point[], close:boolean)=>{
    const a=new Path2D(); if(!p.length)return a;
    a.moveTo(...p[0]);for(let i=1;i<p.length;i++)a.lineTo(...p[i]);if(close)a.closePath();return a;
  };
  const areaPath=(a:Feature)=>{const p=path(a.points,true);for(const h of a.holes||[])p.addPath(path(h,true));return p};
  const groupOrder=['residential','industrial','commercial','farmland','meadow','grass','orchard','forest','park','cemetery','sand','paved','pitch','parking','water'];
  const waterAreas=city.areas.filter(a=>a.kind==='water');
  const areas=[...city.areas].sort((a,b)=>groupOrder.indexOf(a.kind)-groupOrder.indexOf(b.kind));
  for(const a of areas){
    const p=areaPath(a);ctx.fillStyle=palette[a.kind]||'#93aa73';ctx.fill(p,'evenodd');
    let density=20;
    if(['residential','grass','meadow','garden'].includes(a.kind))density=40;
    if(['park','forest','scrub','orchard'].includes(a.kind))density=a.kind==='forest'?245:155;
    if(['parking','paved','water','pitch','industrial','commercial','cemetery','farmland'].includes(a.kind))density=0;
    if(a.id==='w292847704')density=0;
    mask.fillStyle='rgb('+density+',0,'+(a.kind==='water'?255:0)+')';mask.fill(p,'evenodd');
    if(a.kind==='farmland' || a.kind==='orchard'){
      ctx.save();ctx.clip(p,'evenodd');ctx.strokeStyle='rgba(97,105,56,.16)';ctx.lineWidth=1;
      const [cx,cz]=centerOf(a.points); const radius=Math.min(500,Math.max(...a.points.map(q=>Math.hypot(q[0]-cx,q[1]-cz))));
      ctx.translate(cx,cz);ctx.rotate(rand()*2);ctx.beginPath();
      for(let i=-radius;i<radius;i+=a.kind==='orchard'?8:4){ctx.moveTo(i,-radius);ctx.lineTo(i,radius)} ctx.stroke();ctx.restore();
    }
  }
  const plantableYards=city.buildings.filter(b=>['yes','house','detached','residential','apartments'].includes(b.kind));
  for(const b of plantableYards){
    const p=areaPath(b);ctx.strokeStyle=['#79ab4e','#91b961','#78a34a','#89b758'][Math.floor(rand()*4)];
    ctx.lineWidth=5+rand()*5;ctx.stroke(p);
  }
  ctx.save();ctx.globalAlpha=.18;ctx.drawImage(photo,dem.x0,dem.z0,dem.step*(dem.cols-1),dem.step*(dem.rows-1));ctx.restore();
  // Fine ground variation is baked once. It follows semantic areas and costs no draw calls.
  for(let i=0;i<175000;i++){
    ctx.fillStyle=i%2?'rgba(75,83,45,.07)':'rgba(248,238,173,.10)';
    ctx.fillRect((rand()*2-1)*bound,(rand()*2-1)*bound,1+rand()*6,1+rand()*3);
  }
  function ribbon(road:Road, water=false){
    const p=path(road.points,false),w=road.width||4;
    const foot=['pedestrian','footway','path','cycleway','steps','track'].includes(road.kind);
    if(!water && road.bridge)return;
    ctx.setLineDash([]);ctx.strokeStyle=water?'#8dbaaa':foot?'#b5ae97':'#96998a';
    ctx.lineWidth=w+(water?2:foot?.7:2.5);ctx.stroke(p);
    if(!water&&!foot){ctx.strokeStyle='#d5d1bd';ctx.lineWidth=w+1.8;ctx.stroke(p)}
    ctx.strokeStyle=water?'#609f9b':foot?'#cfcaaf':road.kind==='service'?'#b7b7aa':'#a5a6a0';
    ctx.lineWidth=w;ctx.stroke(p);
    if(!water && w>=6 && ['trunk','primary','secondary','tertiary'].includes(road.kind)){
      ctx.strokeStyle='#dedbc6';ctx.lineWidth=.30;ctx.setLineDash([3.5,4.5]);ctx.stroke(p);ctx.setLineDash([]);
    }
    mask.strokeStyle=water?'rgb(0,0,255)':'black';mask.lineWidth=w+2;mask.stroke(p);
  }
  city.waterways.filter(w=>!waterAreas.some(a=>a.name && a.name===w.name)&&w.name!=='Sana').forEach(w=>ribbon(w,true));
  // Redraw banks over private garden halos.
  for(const a of waterAreas){const p=areaPath(a);ctx.lineWidth=3;ctx.strokeStyle='#a5b899';ctx.stroke(p);ctx.fillStyle=palette.water;ctx.fill(p,'evenodd')}
  const order=['steps','path','footway','cycleway','track','service','living_street','residential','unclassified','tertiary','secondary','primary','trunk'];
  [...city.roads].sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind)).forEach(r=>ribbon(r));
  for(const b of city.buildings){
    const p=areaPath(b);mask.fillStyle='black';mask.strokeStyle='black';mask.lineWidth=3;mask.fill(p,'evenodd');mask.stroke(p);
    ctx.save();ctx.translate(1,1);ctx.lineWidth=1.7;ctx.strokeStyle='rgba(57,64,49,.32)';ctx.stroke(p);ctx.restore();
  }
  const raw=mask.getImageData(0,0,1024,1024).data;
  function value(x:number,z:number,channel:number){
    const ix=Math.floor((x+bound)*1024/(2*bound)),iz=Math.floor((z+bound)*1024/(2*bound));
    if(ix<0||iz<0||ix>=1024||iz>=1024)return 0;return raw[(iz*1024+ix)*4+channel];
  }
  const riverSample=city.roads.find(r=>r.id==='w56396323');
  const [bx,bz]=riverSample?centerOf(riverSample.points):[0,200];
  const waterY=sampleTerrain(dem,bx,bz)-1.1;
  const mosque=city.buildings.find(b=>b.id==='w346178044');
  const f=mosque && localFrame(mosque.points);
  const floor=f?sampleTerrain(dem,f.x,f.z):0;
  function courtyardDistance(x:number,z:number){
    if(!f)return Infinity;
    const dx=x-f.x,dz=z-f.z;
    return Math.max(Math.abs(dx*f.az-dz*f.ax)-14,Math.abs(dx*f.ax+dz*f.az+10)-25);
  }
  function height(x:number,z:number){
    let h=sampleTerrain(dem,x,z);
    if(value(x,z,2)>128)h=waterY-.5;
    else if([[-6,0],[6,0],[0,-6],[0,6]].some(([a,b])=>value(x+a,z+b,2)>128))h=waterY+.25;
    const blend=Math.max(0,Math.min(1,(courtyardDistance(x,z)-4)/9));
    return gradeWestBank(x,z,floor+(h-floor)*blend);
  }
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  const land=new T.Group();
  const xs=terrainAxis(-bound,bound,-279,-126),zs=terrainAxis(-bound,bound,135,252);
  const g=new T.PlaneGeometry(bound*2,bound*2,xs.length-1,zs.length-1);g.rotateX(-Math.PI/2);
  const attr=g.attributes.position;
  const uv=g.attributes.uv;
  for(let i=0;i<attr.count;i++){
    const x=xs[i%xs.length],z=zs[Math.floor(i/xs.length)];
    attr.setXYZ(i,x,height(x,z),z);
    uv.setXY(i,(x+bound)/(2*bound),1-(z+bound)/(2*bound));
  }
  g.computeVertexNormals();
  const ground=new T.Mesh(g,new T.MeshLambertMaterial({map:tex}));ground.receiveShadow=true;land.add(ground);
  land.add(streetSurface(city,height,xs,zs));
  const env=new T.PlaneGeometry(dem.step*(dem.cols-1),dem.step*(dem.rows-1),dem.cols-1,dem.rows-1);env.rotateX(-Math.PI/2);
  const ep=env.attributes.position,colors:number[]=[];
  const envIndices:number[]=[];
  for(let i=0;i<ep.count;i++){
    const x=dem.x0+(i%dem.cols)*dem.step,z=dem.z0+Math.floor(i/dem.cols)*dem.step,h=sampleTerrain(dem,x,z);
    ep.setXYZ(i,x,h-1.5,z);
    const green=new T.Color('#a5b48c').lerp(new T.Color('#708c70'),Math.min(1,Math.max(0,h/180)));
    green.multiplyScalar(.96+.07*rand());colors.push(green.r,green.g,green.b);
  }
  const ix=env.index!;
  for(let i=0;i<ix.count;i+=3){const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);
    if([a,b,c].every(j=>Math.abs(ep.getX(j))<bound-5&&Math.abs(ep.getZ(j))<bound-5))continue;envIndices.push(a,b,c)}
  env.setIndex(envIndices);env.setAttribute('color',new T.Float32BufferAttribute(colors,3));env.computeVertexNormals();
  const imagery=new T.Texture(photo);imagery.colorSpace=T.SRGBColorSpace;imagery.needsUpdate=true;land.add(new T.Mesh(env,new T.MeshLambertMaterial({map:imagery})));
  function surfaceHeight(x:number,z:number){
    const col=Math.max(0,xs.findIndex(k=>k>x)-1),row=Math.max(0,zs.findIndex(k=>k>z)-1);
    if(x<xs[0]||x>=xs.at(-1)!||z<zs[0]||z>=zs.at(-1)!)return height(x,z);
    const u=(x-xs[col])/(xs[col+1]-xs[col]),v=(z-zs[row])/(zs[row+1]-zs[row]),i=row*xs.length+col;
    const a=attr.getY(i),b=attr.getY(i+1),c=attr.getY(i+xs.length),d=attr.getY(i+xs.length+1);
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  }
  return {land,height,surfaceHeight,waterY,density:(x:number,z:number)=>courtyardDistance(x,z)<0?0:value(x,z,0),waterAreas};
}

