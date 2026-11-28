import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {City, Feature, Point, Road, rng} from './types';
import {townBridge} from './bridge';
import {plazaParking} from './centre';
import {westCoordinates} from './west-approach';

export function makeWater(areas:Feature[],y:number){
  const positions:number[]=[];
  for(const a of areas){
    const rings=[a.points,...(a.holes||[])];
    const pts=rings.flat();
    const triangles=T.ShapeUtils.triangulateShape(rings[0].map(p=>new T.Vector2(...p)),rings.slice(1).map(r=>r.map(p=>new T.Vector2(...p))));
    for(const tri of triangles)for(const i of tri.reverse()){positions.push(pts[i][0],-pts[i][1],0)}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();
  const shader={
    name:'Sana', uniforms:{color:{value:new T.Color()},tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()},time:{value:0},night:{value:0}},
    vertexShader:`uniform mat4 textureMatrix; varying vec4 reflection; varying vec2 local;
      void main(){local=position.xy;reflection=textureMatrix*vec4(position,1.0);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D tDiffuse;uniform float time;uniform float night;varying vec4 reflection;varying vec2 local;
      void main(){
        vec2 p=local;float a=sin(p.y*.72+p.x*.19+time*1.5+sin(p.x*.23));
        float b=sin(p.y*1.1+p.x*.27-time*.9+sin(p.x*.08+p.y*.14));
        float broad=sin(p.y*.06+p.x*.025+sin(p.x*.025)+time*.25);
        vec2 uv=reflection.xy/reflection.w+vec2(a*.0018,b*.0032);
        vec3 mirror=texture2D(tDiffuse,clamp(uv,0.,1.)).rgb;
        vec3 water=mix(vec3(.075,.30,.285),vec3(.025,.086,.101),night);
        float glint=pow(max(0.,a*b),5.)*(.5+.5*broad)*.095;
        vec3 result=water*(1.+broad*.045)+mirror*.14+vec3(glint)*(1.-night*.85);
        gl_FragColor=vec4(result,1.);
        #include <colorspace_fragment>
      }`
  };
  const obj=new Reflector(g,{color:0x77b8af,textureWidth:384,textureHeight:384,clipBias:.003,shader,multisample:0});
  obj.rotation.x=-Math.PI/2;obj.position.y=y;(obj.material as T.ShaderMaterial).side=T.DoubleSide;
  return obj;
}
type Item={p:[number,number,number];s:[number,number,number];r:number;color?:string};
function instances(geo:T.BufferGeometry,mat:T.Material,rows:Item[]){
  const mesh=new T.InstancedMesh(geo,mat,rows.length),o=new T.Object3D();
  rows.forEach((row,i)=>{o.position.set(...row.p);o.scale.set(...row.s);o.rotation.y=row.r;o.updateMatrix();mesh.setMatrixAt(i,o.matrix);if(row.color)mesh.setColorAt(i,new T.Color(row.color))});
  mesh.castShadow=mesh.receiveShadow=true;return mesh;
}
export function cityLife(city:City,height:(x:number,z:number)=>number,density:(x:number,z:number)=>number,waterY:number,
  surfaceHeight:(x:number,z:number)=>number) {
  const rand=rng(18213),trees=new T.Group(),spans=new T.Group(),lamps=new T.Group(),traffic=new T.Group();
  const crowns:Item[]=[],trunks:Item[]=[],conifers:Item[]=[];
  const greens=['#698548','#799147','#828e4d','#93a35d','#607e46','#8b9d53','#5f9848','#91bb4b','#589342','#76a853'];
  function plant(x:number,z:number){
    const y=height(x,z),h=5.5+rand()*8.4,w=h*(.32+rand()*.15),r=rand()*6.28,color=greens[Math.floor(rand()*greens.length)];
    const [s,offset]=westCoordinates(x,z),paved=s> -30&&s<68&&offset> -17&&offset<6;
    if(!paved)trunks.push({p:[x,y+h*.24,z],s:[h*.036,h*.53,h*.036],r,color:'#726549'});
    if(rand()<.08){if(!paved)conifers.push({p:[x,y+h*.55,z],s:[w*.82,h*.95,w*.82],r,color:'#407546'});return}
    for(let i=0;i<4;i++){const a=r+2.1*i,d=i===3?0:w*.38,scale=i===3?.83:.72;
      const crownY=y+h*(i===3?.81:.61+rand()*.07),crownHeight=h*(.23+rand()*.065);
      if(!paved)crowns.push({p:[x+Math.cos(a)*d,crownY,z+Math.sin(a)*d],s:[w*scale,crownHeight,w*scale],r:a,color})}
  }
  city.trees.forEach(p=>plant(...p));
  for(let i=0;i<90000;i++){const x=rand()*3000-1500,z=rand()*3000-1500;if(rand()*360<density(x,z))plant(x,z)}
  const park=city.areas.find(a=>a.id==='w77938276');
  if(park){
    const [px,pz]=park.points.reduce(([x,z],p)=>[x+p[0]/park.points.length,z+p[1]/park.points.length],[0,0]);
    park.points.forEach((a,i)=>{
      const b=park.points[(i+1)%park.points.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let d=5;d<len;d+=10){
        const x=(a[0]+(b[0]-a[0])*d/len)*.86+px*.14,z=(a[1]+(b[1]-a[1])*d/len)*.86+pz*.14;
        if(density(x,z)>0)plant(x,z);
      }
    });
  }
  const leaves=new T.IcosahedronGeometry(1,0),leafColors:number[]=[];
  const vc=new T.Color();for(let i=0;i<leaves.attributes.position.count;i+=3){vc.setScalar(.89+rand()*.14);for(let j=0;j<3;j++)leafColors.push(vc.r,vc.g,vc.b)}
  leaves.setAttribute('color',new T.Float32BufferAttribute(leafColors,3));
  // Bound instances by neighbourhood so a street view can cull distant groves.
  function addTrees(geometry:T.BufferGeometry,material:T.Material,items:Item[]){
    const cells=new Map<string,Item[]>();
    for(const item of items){
      const key=Math.floor(item.p[0]/500)+','+Math.floor(item.p[2]/500);
      if(!cells.has(key))cells.set(key,[]);
      cells.get(key)!.push(item);
    }
    for(const cell of cells.values())trees.add(instances(geometry,material,cell));
  }
  addTrees(leaves,new T.MeshLambertMaterial({vertexColors:true,flatShading:true}),crowns);
  addTrees(new T.CylinderGeometry(.55,1,1,5),new T.MeshLambertMaterial(),trunks);
  addTrees(new T.ConeGeometry(1,1,7),new T.MeshLambertMaterial({flatShading:true}),conifers);
  const deck:Item[]=[],rails:Item[]=[],piers:Item[]=[],paint:Item[]=[],poles:Item[]=[],bulbs:Item[]=[];
  const bridgeGlows:T.Vector3[]=[];
  const bridgeHeights=new Map<string,(s:number)=>number>();
  const approachHeights=new Map<string,(x:number,z:number)=>number>();
  const west=city.roads.find(r=>r.id==='w41068824'),east=city.roads.find(r=>r.id==='w207515319');
  function streetlight(x:number,z:number,y:number,head?:T.Vector3){
    poles.push({p:[x,y+2.7,z],s:[.18,5.4,.18],r:0});
    if(head)bridgeGlows.push(head);
    else bulbs.push({p:[x,y+5.5,z],s:[.55,.38,.55],r:0});
  }
  for(const r of city.roads.filter(r=>r.bridge)){
    const last=r.points.at(-1)!, y1=Math.max(waterY+2.7,height(...r.points[0])+.15),y2=Math.max(waterY+2.7,height(...last)+.15);
    const length=r.points.slice(1).reduce((d,p,i)=>d+Math.hypot(p[0]-r.points[i][0],p[1]-r.points[i][1]),0);
    if(r.id==='w56396323'&&west&&east){
      const bridge=townBridge(r,west,east,waterY,surfaceHeight,streetlight);
      spans.add(bridge.group);
      bridgeHeights.set(r.id,bridge.heightAt);
      for(const approach of bridge.approaches)approachHeights.set(approach.id,approach.height);
      continue;
    }
    bridgeHeights.set(r.id,s=>y1+(y2-y1)*s/length);
    let offset=0;
    r.points.slice(1).forEach((b,i)=>{
      const a=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),rot=Math.atan2(dx,dz);
      const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,y=y1+(y2-y1)*(offset+len/2)/length;
      deck.push({p:[x,y-.35,z],s:[r.width+2.2,.8,len+.13],r:rot});
      for(const sign of [-1,1]){
        const tx=x+sign*Math.cos(rot)*(r.width/2+.64),tz=z-sign*Math.sin(rot)*(r.width/2+.64);
        rails.push({p:[tx,y+.85,tz],s:[.16,.21,len],r:rot});
        rails.push({p:[tx,y+.22,tz],s:[.9,.3,len],r:rot});
        for(let d=0;d<len;d+=3.6){const f=d/len-.5;rails.push({p:[tx+dx*f,y+.5,tz+dz*f],s:[.12,.86,.12],r:rot})}
        if(len>12)streetlight(tx,tz,y);
      }
      piers.push({p:[x,y-3,z],s:[r.width*.73,5,.95],r:rot});
      for(let d=1.8;d<len-1;d+=7){const f=d/len-.5;paint.push({p:[x+dx*f,y+.065,z+dz*f],s:[.22,.04,3],r:rot})}
      offset+=len;
    });
  }
  const box=new T.BoxGeometry();
  const lot=city.areas.find(a=>a.id==='w77938277');
  if(lot){
    const parking=plazaParking(lot);
    spans.add(parking.lines);traffic.add(parking.cars);
  }
  spans.add(instances(box,new T.MeshLambertMaterial({color:'#a4a59e'}),deck),instances(box,new T.MeshLambertMaterial({color:'#d1c9ae'}),rails),
    instances(box,new T.MeshLambertMaterial({color:'#b9b5a5'}),piers),instances(box,new T.MeshLambertMaterial({color:'#efead7'}),paint));
  city.lamps.forEach(([x,z])=>streetlight(x,z,height(x,z)));
  for(const r of city.roads.filter(r=>!r.bridge && ['secondary','tertiary','primary'].includes(r.kind))){
    let carry=19;
    r.points.slice(1).forEach((b,i)=>{const a=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      for(;carry<len;carry+=41){const x=a[0]+(dx*carry-dz*(r.width*.5+.7))/len,z=a[1]+(dz*carry+dx*(r.width*.5+.7))/len;streetlight(x,z,height(x,z))}
      carry-=len;
    });
  }
  const bulbMat=new T.MeshBasicMaterial({color:'#d8d7bc'});
  lamps.add(instances(box,new T.MeshLambertMaterial({color:'#68685c'}),poles),instances(new T.SphereGeometry(1,5,4),bulbMat,bulbs));
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=32;const gc=glowCanvas.getContext('2d')!;
  const grd=gc.createRadialGradient(16,16,0,16,16,16);grd.addColorStop(0,'#fff5bd');grd.addColorStop(.14,'#ffca69');grd.addColorStop(.4,'rgba(255,173,65,.34)');grd.addColorStop(1,'rgba(255,170,65,0)');
  gc.fillStyle=grd;gc.fillRect(0,0,32,32);
  const glowPositions=[...bulbs.flatMap(b=>b.p),...bridgeGlows.flatMap(head=>head.toArray())];
  const glowGeo=new T.BufferGeometry();glowGeo.setAttribute('position',new T.Float32BufferAttribute(glowPositions,3));
  const glow=new T.Points(glowGeo,new T.PointsMaterial({map:new T.CanvasTexture(glowCanvas),size:8,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  glow.visible=false;lamps.add(glow);
  const routes=city.roads.filter(r=>!['footway','path','steps','track','cycleway'].includes(r.kind)&&r.points.length>1);
  const routesData=routes.map(r=>{const distances=[0];r.points.slice(1).forEach((b,i)=>distances.push(distances[i]+Math.hypot(b[0]-r.points[i][0],b[1]-r.points[i][1])));return {r,distances,len:distances.at(-1)!}}).filter(s=>s.len>55);
  const carColors=['#d7cebc','#b34d37','#e8e2d3','#5f8392','#556778','#978f71','#d0a357'];
  const cars=routesData.filter(c=>c.r.bridge||rand()<.42).map(path=>({path,t:rand()*path.len,speed:(4+rand()*4)*(path.r.tags.oneway==='yes'||rand()>.48?1:-1),color:carColors[Math.floor(rand()*carColors.length)]}));
  const bodies=new T.InstancedMesh(box,new T.MeshLambertMaterial(),cars.length),cabs=new T.InstancedMesh(box,new T.MeshLambertMaterial({color:'#6a777b'}),cars.length);
  cars.forEach((c,i)=>bodies.setColorAt(i,new T.Color(c.color)));bodies.castShadow=true;traffic.add(bodies,cabs);bodies.frustumCulled=cabs.frustumCulled=false;
  const dummy=new T.Object3D();
  function updateCars(dt:number){
    cars.forEach((c,i)=>{
      const {r,distances,len}=c.path;c.t=(c.t+c.speed*dt+len)%len;
      let j=1;while(j<distances.length-1&&distances[j]<c.t)j++;
      const a=r.points[j-1],b=r.points[j],dist=Math.max(.001,distances[j]-distances[j-1]),f=(c.t-distances[j-1])/dist;
      const dx=(b[0]-a[0])/dist,dz=(b[1]-a[1])/dist,offset=Math.sign(c.speed)*Math.min(1.25,r.width*.19);
      const x=a[0]+dx*dist*f-dz*offset,z=a[1]+dz*dist*f+dx*offset;
      const bridge=bridgeHeights.get(r.id),roadHeight=approachHeights.get(r.id)??height;
      const y=bridge?bridge(c.t):roadHeight(x,z);
      dummy.rotation.y=Math.atan2(dx,dz);dummy.position.set(x,y+.52,z);dummy.scale.set(1.75,.78,3.92);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);
      dummy.position.y+=.55;dummy.scale.set(1.46,.54,2.05);dummy.updateMatrix();cabs.setMatrixAt(i,dummy.matrix);
    });bodies.instanceMatrix.needsUpdate=cabs.instanceMatrix.needsUpdate=true;
  }
  updateCars(0);return {trees,spans,lamps,glow,traffic,updateCars,bulbMat};
}

