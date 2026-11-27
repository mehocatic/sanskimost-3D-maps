import {marketNames} from '../src/market';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {centreBuildings} from '../src/centre';
import {mahala} from '../src/mahala';

// Include Mahala and the parallel Hamzibegova corridor through their southern junction.
const bounds={west:-306,east:162,north:108,south:963};
const inside=(x,z)=>x>=bounds.west&&x<=bounds.east&&z>=bounds.north&&z<=bounds.south;
function group(name,parent){
  const result=new T.Group();result.name=name;parent.add(result);return result;
}
function copyFaces(mesh,faces){
  const geometry=new T.BufferGeometry();
  for(const [key,attribute] of Object.entries(mesh.geometry.attributes)){
    const data=new Float32Array(faces.length*3*attribute.itemSize);
    let offset=0;
    for(const face of faces)for(let j=0;j<3;j++){
      const vertex=mesh.geometry.index?.getX(face*3+j)??face*3+j;
      for(let k=0;k<attribute.itemSize;k++)data[offset++]=attribute.getComponent(vertex,k);
    }
    geometry.setAttribute(key,new T.BufferAttribute(data,attribute.itemSize));
  }
  return new T.Mesh(geometry,mesh.material);
}
function clippedWater(water){
  const pos=water.geometry.attributes.position,vertices=[];
  for(let i=0;i<pos.count;i+=3){
    let pts=[0,1,2].map(j=>[pos.getX(i+j),-pos.getY(i+j)]);
    for(const [axis,limit,sign] of [[0,bounds.west,1],[0,bounds.east,-1],[1,bounds.north,1],[1,bounds.south,-1]]){
      const clipped=[];
      pts.forEach((p,j)=>{
        const q=pts[(j+1)%pts.length],a=sign*(p[axis]-limit),b=sign*(q[axis]-limit);
        if(a>=0)clipped.push(p);
        if(a*b<0)clipped.push(p.map((v,k)=>v+(q[k]-v)*a/(a-b)));
      });
      pts=clipped;
    }
    for(let j=1;j+1<pts.length;j++)for(const [x,z] of [pts[0],pts[j],pts[j+1]])vertices.push(x,water.position.y,z);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
  return new T.Mesh(g,new T.MeshStandardMaterial({color:'#579c96',roughness:.32,side:T.DoubleSide}));
}
export async function exportDistrict({city,ground,water,blocks,life,special,island}){
  const scene=new T.Scene(),buildings=group('Zgrade',scene),byId=new Map();
  city.buildings.forEach((b,i)=>{
    if(!b.points.every(([x,z])=>inside(x,z)))return;
    byId.set(i,b);
  });
  const objects=new Map(),buildingData=new Map([...byId.values()].map(b=>[b.id,b]));
  function building(id){
    if(!objects.has(id)){
      const name=marketNames[id]??centreBuildings[id]?.name??mahala[id]?.name??'Zgrada';
      const obj=group(name+' '+id,buildings);
      obj.userData.osm_id=id;
      obj.userData.height_source=mahala[id]||centreBuildings[id]?'estimate':buildingData.get(id).heightSource;
      objects.set(id,obj);
    }
    return objects.get(id);
  }
  for(const mesh of blocks.group.children.filter(o=>o.userData.ids)){
    const faces=new Map();
    mesh.userData.ids.forEach((i,face)=>{
      const b=byId.get(i);if(!b)return;
      if(!faces.has(b.id))faces.set(b.id,[]);faces.get(b.id).push(face);
    });
    for(const [id,list] of faces)building(id).add(copyFaces(mesh,list));
  }
  const ids=new Set([...byId.values()].map(b=>b.id));
  function onIncludedRoof(x,z){
    return [...byId.values()].some(({points})=>{
      let hit=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const [ax,az]=points[j],[bx,bz]=points[i],dx=bx-ax,dz=bz-az;
        const t=Math.min(1,Math.max(0,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));
        if(Math.hypot(x-ax-t*dx,z-az-t*dz)<.03)return true;
        if((az>z)!==(bz>z)&&x<ax+dx*(z-az)/dz)hit=!hit;
      }
      return hit;
    });
  }
  for(const obj of blocks.street.children)if(ids.has(obj.userData.place))building(obj.userData.place).add(obj.clone());
  function labelled(obj,name){const clone=obj.clone();clone.name=name;scene.add(clone)}
  const marker=blocks.street.children.find(o=>o.userData.place==='n14219675362');
  if(marker)labelled(marker,marker.name);
  labelled(special.children.find(o=>o.userData.place==='w346178044'),'Hamzibegova džamija');
  labelled(life.spans.children.find(o=>o.userData.place==='w56396323'),'Gradski most');
  labelled(island,'Cvijet Srebrenice');
  for(const obj of [...life.spans.children,...life.traffic.children].filter(o=>o.userData.place==='w77938277'))labelled(obj,'Parking kod Konzuma');
  const terrain=ground.land.children[0],faces=[],idx=terrain.geometry.index,pos=terrain.geometry.attributes.position;
  for(let f=0;f<idx.count/3;f++)if([0,1,2].every(k=>{
    const i=idx.getX(f*3+k);return inside(pos.getX(i),pos.getZ(i));
  }))faces.push(f);
  const land=copyFaces(terrain,faces);land.name='Teren i ulice';scene.add(land);
  const streets=ground.land.children[1].clone();streets.position.y+=.05;streets.name='Ulične oznake';scene.add(streets);
  const river=clippedWater(water);river.name='Sana';scene.add(river);
  // Keep individual instances editable in Blender and preserve their per-instance colours.
  for(const [name,source] of [['Vegetacija',life.trees],['Rasvjeta',life.lamps],['Krovni detalji',blocks.group]]){
    const parent=group(name,scene),matrix=new T.Matrix4(),p=new T.Vector3(),color=new T.Color(),materials=new Map();
    for(const mesh of source.children.filter(o=>o.isInstancedMesh))for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);if(!inside(p.x,p.z))continue;
      if(source===blocks.group&&!onIncludedRoof(p.x,p.z))continue;
      let mat=mesh.material;
      if(mesh.instanceColor){
        mesh.getColorAt(i,color);const key=mat.uuid+color.getHexString();
        if(!materials.has(key)){const copy=mat.clone();copy.color.multiply(color);materials.set(key,copy)}
        mat=materials.get(key);
      }
      const obj=new T.Mesh(mesh.geometry,mat);matrix.decompose(obj.position,obj.quaternion,obj.scale);parent.add(obj);
    }
  }
  // Bake the current day/night state because glTF has no Three.js emissive intensity toggle.
  const daytimeMaterials=new Map();
  scene.traverse(obj=>{
    const mat=obj.material;
    if(!mat?.emissiveMap||mat.emissiveIntensity!==0)return;
    if(!daytimeMaterials.has(mat)){
      const copy=mat.clone();
      copy.emissive.set(0);
      copy.emissiveMap=null;
      daytimeMaterials.set(mat,copy);
    }
    obj.material=daytimeMaterials.get(mat);
  });
  const bytes=await new GLTFExporter().parseAsync(scene,{binary:true,maxTextureSize:4096});
  const reader=new FileReader();const done=new Promise((ok,fail)=>{reader.onload=()=>ok(reader.result);reader.onerror=fail});
  reader.readAsDataURL(new Blob([bytes]));return done;
}
