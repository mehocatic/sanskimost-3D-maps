import * as T from 'three';
import {City,Point,rng} from './types';

// Align with the terrain vertices and triangle diagonals.
export function streetSurface(city:City,height:(x:number,z:number)=>number,terrainX:number[],terrainZ:number[]){
  const x0=-297,z0=126,size=216,pixels=1536;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=pixels;
  const ctx=canvas.getContext('2d')!,scale=pixels/size;
  ctx.setTransform(scale,0,0,scale,-x0*scale,-z0*scale);
  function line(points:Point[],close=false){
    const p=new Path2D();p.moveTo(...points[0]);
    for(const q of points.slice(1))p.lineTo(...q);if(close)p.closePath();return p;
  }
  const intersects=(points:Point[])=>Math.max(...points.map(p=>p[0]))>=x0&&Math.min(...points.map(p=>p[0]))<=x0+size&&
    Math.max(...points.map(p=>p[1]))>=z0&&Math.min(...points.map(p=>p[1]))<=z0+size;
  const roads=city.roads.filter(r=>!r.bridge&&intersects(r.points)).map(r=>({
    r,path:line(r.points),foot:['footway','cycleway','path','track','steps'].includes(r.kind)
  }));
  ctx.lineJoin='round';ctx.lineCap='round';
  for(const area of city.areas.filter(a=>a.kind==='parking'&&intersects(a.points))){
    ctx.fillStyle='#a4a39c';ctx.fill(line(area.points,true));
  }
  for(const {r,path,foot} of roads){
    ctx.lineWidth=r.width+(foot?.25:2.15);ctx.strokeStyle=foot?'#c1b9a7':'#d0c9b8';ctx.stroke(path);
  }
  for(const {r,path} of roads.filter(s=>!s.foot)){
    ctx.lineWidth=r.width+.30;ctx.strokeStyle='#8e8c81';ctx.stroke(path);
  }
  for(const {r,path,foot} of roads){
    if(foot)continue;
    ctx.lineWidth=r.width;ctx.strokeStyle=r.kind==='service'?'#aaa79e':'#999a96';ctx.stroke(path);
  }
  const island=city.areas.find(a=>a.id==='w292847704');
  if(island){ctx.fillStyle='#aaa99c';ctx.fill(line(island.points,true))}
  ctx.lineCap='butt';ctx.setLineDash([3,4]);ctx.lineWidth=.13;ctx.strokeStyle='#deded1';
  for(const {r,path} of roads){
    if(r.id==='w41068824')ctx.stroke(path);
  }
  ctx.setLineDash([]);
  // The marked crossing on the approach between the corner shops and the bank.
  const approach=city.roads.find(r=>r.id==='w41068817');
  if(approach){
    const p=approach.points;let nearest=0;
    for(let i=1;i<p.length;i++)if(Math.hypot(p[i][0]+218,p[i][1]-277)<Math.hypot(p[nearest][0]+218,p[nearest][1]-277))nearest=i;
    const a=p[nearest],b=p[nearest===0?1:nearest-1],angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
    ctx.save();ctx.fillStyle='#e7e4d7';
    for(let y=-approach.width/2+.4;y<approach.width/2-.3;y+=.83)ctx.fillRect(1.3,y,2.5,.40);
    
  }
  const random=rng(6534);ctx.globalCompositeOperation='source-atop';
  for(let i=0;i<37000;i++){
    ctx.fillStyle=i%2?'rgba(84,79,66,.12)':'rgba(242,237,212,.12)';
    
  }
  ctx.globalCompositeOperation='destination-out';
  for(const [a,b,c,d] of [[0,0,110,0],[pixels,0,pixels-110,0],[0,0,0,110],[0,pixels,0,pixels-110]]){
    const fade=ctx.createLinearGradient(a,b,c,d);
    ctx.fillStyle=fade;
  }
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  const xs=terrainX.filter(x=>x>=x0&&x<=x0+size),zs=terrainZ.filter(z=>z>=z0&&z<=z0+size);
  const geo=new T.PlaneGeometry(size,size,xs.length-1,zs.length-1);
  const {position,uv}=geo.attributes;
  for(let i=0;i<position.count;i++){
    const x=xs[i%xs.length],z=zs[Math.floor(i/xs.length)];
    
    
  }
  
  const mesh=new T.Mesh(geo,new T.MeshLambertMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  mesh.receiveShadow=true;return mesh;
}
