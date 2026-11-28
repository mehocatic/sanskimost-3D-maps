import * as T from 'three';
import {Building,Point,centerOf,rng} from './types';
import {cornerRing,mahala,streetDetails} from './mahala';
import {centreBuilding,centreBuildings} from './centre';

import {marketBuilding,marketNames} from './market';

function facadeTexture(){
  const c=document.createElement('canvas');c.width=128;c.height=128;
  const g=c.getContext('2d')!,rand=rng(337);
  g.fillStyle='#f0efea';g.fillRect(0,0,128,128);
  for(let i=0;i<1800;i++){g.fillStyle=i%2?'#e8e6e2':'#f5f4ef';g.fillRect(rand()*128,rand()*128,2,2)}
  g.fillStyle='#dad7ce';g.fillRect(0,121,128,5);
  g.fillStyle='#cfcbc0';g.fillRect(32,30,63,66);
  g.fillStyle='#fdf8eb';g.fillRect(29,27,63,64);
  g.fillStyle='#6e797a';g.fillRect(33,31,55,55);
  const gradient=g.createLinearGradient(30,28,95,94);gradient.addColorStop(0,'#788b93');gradient.addColorStop(.55,'#a7b6b5');gradient.addColorStop(1,'#708282');
  g.fillStyle=gradient;g.fillRect(35,33,51,51);g.fillStyle='#ddd9cf';g.fillRect(58,32,3,53);g.fillRect(34,51,53,2);
  g.fillStyle='#fffaf0';g.fillRect(26,88,69,5);g.fillStyle='#c3c0b7';g.fillRect(27,93,67,3);
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
function roofTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!,rand=rng(776);
  g.fillStyle='#ece9e4';g.fillRect(0,0,128,128);
  for(let r=0;r<12;r++)for(let k=-1;k<9;k++){
    const x=k*16+(r%2)*8,y=r*128/12;
    const v=Math.floor(221+rand()*26);g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(x,y,16,12);
    g.fillStyle='rgba(65,46,36,.13)';g.fillRect(x,y+8,16,2);g.fillRect(x,y,2,10);
  }
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
type Vertex=[number,number,number];
class Surfaces {
  pos:number[]=[]; uv:number[]=[]; color:number[]=[]; ids:number[]=[];
  tri(a:Vertex,b:Vertex,c:Vertex,uv:number[],tint:T.Color,id:number){
    this.pos.push(...a,...b,...c);this.uv.push(...uv);
    for(let i=0;i<3;i++)this.color.push(tint.r,tint.g,tint.b);
    this.ids.push(id);
  }
  mesh(mat:T.Material){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.pos,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2));g.setAttribute('color',new T.Float32BufferAttribute(this.color,3));g.computeVertexNormals();
    const m=new T.Mesh(g,mat);m.castShadow=m.receiveShadow=true;m.userData.ids=this.ids;return m;
  }
}
export function makeBuildings(buildings:Building[],height:(x:number,z:number)=>number){
  const walls=new Surfaces(),plainWalls=new Surfaces(),roofs=new Surfaces(),flatRoofs=new Surfaces(),rand=rng(9125);
  const street=new T.Group();
  const facadeColors=['#eddfc9','#eedfc0','#eed5af','#e5e2d4','#dacfbf','#f3e8cb','#dfc9a9','#edcbb7','#dbd7c8'];
  const roofColors=['#ab5840','#98543e','#bc7256','#c58260','#845a4d','#bd8769','#754f41','#b47757','#99634d','#73736e'];
  const flatColors=['#bbb8ad','#a9a296','#92938d','#dad5c7'];
  const noGeneric=new Set(['w225470278','w346178044','w346178046','w346178047','w346178048','w346178049']);
  const chimneys:T.Matrix4[]=[],roofDetails:T.Matrix4[]=[];const dummy=new T.Object3D();
  buildings.forEach((b,id)=>{
    if(noGeneric.has(b.id)||b.points.length<3)return;
    if(marketNames[b.id]){street.add(marketBuilding(b,height));return}
    if(centreBuildings[b.id]){
      street.add(centreBuilding(b,height));
      return;
    }
    const profile=mahala[b.id],buildingHeight=profile?.height??b.height;
    const ring=profile?.style==='corner'?cornerRing(b.points):b.points;
    const [cx,cz]=centerOf(ring),base=height(cx,cz),low=Math.min(base,...ring.map(p=>height(...p)))-1.4;
    let vx=1,vz=0,minArea=Infinity,minB=0,maxB=0;
    for(let i=0;i<ring.length;i++){
      const a=ring[i],n=ring[(i+1)%ring.length],dx=n[0]-a[0],dz=n[1]-a[1],l=Math.hypot(dx,dz);if(l<.2)continue;
      const u=dx/l,v=dz/l,along=ring.map(([x,z])=>x*u+z*v),across=ring.map(([x,z])=>-x*v+z*u);
      const w=Math.max(...along)-Math.min(...along),h=Math.max(...across)-Math.min(...across);
      if(w*h>=minArea)continue;
      minArea=w*h;
      if(w>=h){vx=u;vz=v;minB=Math.min(...across);maxB=Math.max(...across)}
      else{vx=v;vz=-u;minB=Math.min(...along);maxB=Math.max(...along)}
    }
    if(profile?.style==='gable'||profile?.style==='brick'){
      const i=profile.fronts![0],a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      vx=(b[1]-a[1])/len;vz=(a[0]-b[0])/len;
      const across=ring.map(([x,z])=>-x*vz+z*vx);minB=Math.min(...across);maxB=Math.max(...across);
    }
    const mid=(minB+maxB)/2,half=Math.max(1,(maxB-minB)/2);
    const flat=b.tags['roof:shape']==='flat'||!!b.holes?.length||buildingHeight>=15||minArea>800;
    const rise=flat?0:Math.min(half*.48,4.5,buildingHeight*.4);
    const eave=base+buildingHeight-rise, measure=(p:Point)=>-p[0]*vz+p[1]*vx-mid;
    const along=ring.map(([x,z])=>x*vx+z*vz),amin=Math.min(...along),amax=Math.max(...along);
    const hip=!flat&&ring.length<=6&&(profile?['old','salon','bakery'].includes(profile.style):b.tags['roof:shape']==='hipped'||(!b.tags['roof:shape']&&rand()<.54));
    const hipRun=Math.min(half*.85,(amax-amin)*.39);
    const planes=[(p:Point)=>1-measure(p)/half,(p:Point)=>1+measure(p)/half];
    if(hip)planes.push(([x,z])=>(x*vx+z*vz-amin)/hipRun,([x,z])=>(amax-x*vx-z*vz)/hipRun);
    const top=(p:Point)=>eave+rise*Math.max(0,Math.min(...planes.map(fn=>fn(p))));
    const wallCol=new T.Color(facadeColors[Math.floor(rand()*facadeColors.length)]);
    const colors=flat?flatColors:roofColors;const roofCol=new T.Color(colors[Math.floor(rand()*colors.length)]);
    const wallSurface=profile?plainWalls:walls;
    if(profile){wallCol.set(profile.wall);roofCol.set(profile.roof);street.add(streetDetails(b,ring,base,eave))}
    const vec=(p:Point):Vertex=>[p[0],top(p),p[1]];
    const cut=(a:Point,b:Point):Point=>{const t=measure(a)/(measure(a)-measure(b));return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]};
    const holes=b.holes||[],rings=[ring,...holes];
    // Orient each boundary so the normals point out, also around courtyards.
    rings.forEach((input,k)=>{
      const pts=[...input], signed=pts.reduce((s,a,i)=>{const n=pts[(i+1)%pts.length];return s+a[0]*n[1]-n[0]*a[1]},0);
      if((signed>0)!==(k===0))pts.reverse();
      for(let i=0;i<pts.length;i++){
        const a=pts[i],n=pts[(i+1)%pts.length],parts=rise&&measure(a)*measure(n)<0?[a,cut(a,n),n]:[a,n];
        const len=Math.hypot(a[0]-n[0],a[1]-n[1]), repeat=Math.max(1,Math.round(len/3.15));
        for(let j=0;j<parts.length-1;j++){
          const p=parts[j],q=parts[j+1],pp:Vertex=[p[0],low,p[1]],qq:Vertex=[q[0],low,q[1]];
          const u=(v:Point)=>Math.hypot(v[0]-a[0],v[1]-a[1])/Math.max(.01,len)*repeat;
          const bottom=(low-eave)/3.05,up=(v:Point)=>(top(v)-eave)/3.05;
          wallSurface.tri(pp,vec(p),qq,[u(p),bottom,u(p),up(p),u(q),bottom],wallCol,id);
          wallSurface.tri(qq,vec(p),vec(q),[u(q),bottom,u(p),up(p),u(q),up(q)],wallCol,id);
        }
      }
    });
    const all=rings.flat(),tri=T.ShapeUtils.triangulateShape(ring.map(p=>new T.Vector2(...p)),holes.map(h=>h.map(p=>new T.Vector2(...p))));
    function emit(pts:Point[]){
      for(let j=1;j<pts.length-1;j++){
        const t=[pts[0],pts[j],pts[j+1]];
        if((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0])>0)t.reverse();
        (flat?flatRoofs:roofs).tri(vec(t[0]),vec(t[1]),vec(t[2]),t.flatMap(([x,z])=>[(x*vx+z*vz)/3,(-x*vz+z*vx)/3]),roofCol,id);
      }
    }
    for(const ids of tri){
      const pts=ids.map(i=>all[i]);
      if(hip){
        for(const plane of planes){
          let poly=pts;
          for(const other of planes){
            if(other===plane||!poly.length)continue;
            const next:Point[]=[];
            poly.forEach((a,j)=>{const b=poly[(j+1)%poly.length],da=plane(a)-other(a),db=plane(b)-other(b);
              if(da<=0)next.push(a);
              if(da*db<0){const k=da/(da-db);next.push([a[0]+k*(b[0]-a[0]),a[1]+k*(b[1]-a[1])])}
            });poly=next;
          }
          emit(poly);
        }
        continue;
      }
      if(!rise||pts.every(p=>measure(p)<=0)||pts.every(p=>measure(p)>=0)){emit(pts);continue}
      for(const sign of [-1,1]){
        const side:Point[]=[];
        pts.forEach((a,j)=>{const b=pts[(j+1)%3];if(measure(a)*sign>=0)side.push(a);if(measure(a)*measure(b)<0)side.push(cut(a,b))});
        emit(side);
      }
    }
    if(!flat&&minArea<350&&ring.length<=6&&rand()>.32){const x=(cx+ring[0][0])/2,z=(cz+ring[0][1])/2;
      dummy.position.set(x,top([x,z])+.2,z);dummy.scale.set(.65,1.65,.85);dummy.rotation.y=-Math.atan2(vz,vx);dummy.updateMatrix();chimneys.push(dummy.matrix.clone())}
    if(flat && !holes.length){
      for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1];
        dummy.position.set((a[0]+b[0])/2,eave+.16,(a[1]+b[1])/2);dummy.scale.set(.28,.42,Math.hypot(dx,dz));dummy.rotation.y=Math.atan2(dx,dz);dummy.updateMatrix();roofDetails.push(dummy.matrix.clone());
      }
      for(const face of tri.filter((_,j)=>j%4===0).slice(0,5)){
        const [a,b,c]=face.map(i=>all[i]);
        if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))<40)continue;
        dummy.position.set((a[0]+b[0]+c[0])/3,eave+.49,(a[1]+b[1]+c[1])/3);
        dummy.scale.set(1.5,.85,2.1);dummy.rotation.y=-Math.atan2(vz,vx);dummy.updateMatrix();roofDetails.push(dummy.matrix.clone());
      }
    }
  });
  const fac=facadeTexture(),wallMat=new T.MeshLambertMaterial({map:fac,vertexColors:true,side:T.DoubleSide});
  const roofMat=new T.MeshLambertMaterial({map:roofTexture(),vertexColors:true,side:T.DoubleSide});
  const group=new T.Group();group.add(walls.mesh(wallMat),roofs.mesh(roofMat),flatRoofs.mesh(new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide})));
  group.add(plainWalls.mesh(new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide})),street);
  const chim=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshLambertMaterial({color:'#996b52'}),chimneys.length);
  chimneys.forEach((m,i)=>chim.setMatrixAt(i,m));chim.castShadow=true;group.add(chim);
  const trim=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshLambertMaterial({color:'#c2bdb1'}),roofDetails.length);
  roofDetails.forEach((m,i)=>trim.setMatrixAt(i,m));trim.castShadow=true;trim.receiveShadow=true;group.add(trim);
  const lit=document.createElement('canvas');lit.width=lit.height=64;const l=lit.getContext('2d')!;
  l.fillStyle='black';l.fillRect(0,0,64,64);l.fillStyle='#ffd481';l.fillRect(17,17,11,23);l.fillRect(31,17,11,23);
  const lights=new T.CanvasTexture(lit);lights.wrapS=lights.wrapT=T.RepeatWrapping;lights.colorSpace=T.SRGBColorSpace;
  wallMat.emissiveMap=lights;wallMat.emissive.set('#ffcf82');wallMat.emissiveIntensity=0;
  return {group,wallMat,street};
}

