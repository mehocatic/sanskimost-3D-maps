import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Point} from './types';

const materials=new Map<string,T.MeshLambertMaterial>();
export function finish(color:string){
  let material=materials.get(color);
  if(!material){material=new T.MeshLambertMaterial({color});materials.set(color,material)}
  return material;
}

// Author in real metres, then submit one mesh per material for each selectable model.
export class Model {
  readonly group=new T.Group();
  private parts=new Map<T.Material,T.BufferGeometry[]>();
  private transform=new T.Object3D();
  add(geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0,yaw=0){
    this.transform.position.set(x,y,z);this.transform.rotation.set(0,yaw,0);this.transform.updateMatrix();
    geometry.applyMatrix4(this.transform.matrix);
    const part=geometry.index?geometry.toNonIndexed():geometry;
    if(geometry!==part)geometry.dispose();
    const batch=this.parts.get(material)??[];batch.push(part);this.parts.set(material,batch);
  }
  box(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,yaw=0){
    this.add(new T.BoxGeometry(w,h,d),mat,x,y,z,yaw);
  }
  beam(a:T.Vector3,b:T.Vector3,width:number,height:number,mat:T.Material){
    const delta=b.clone().sub(a),mid=b.clone().add(a).multiplyScalar(.5);
    const g=new T.BoxGeometry(width,height,delta.length());
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),delta.normalize()));
    this.add(g,mat,mid.x,mid.y,mid.z);
  }
  build(id:string){
    for(const [material,parts] of this.parts){
      const mesh=new T.Mesh(mergeGeometries(parts),material);mesh.castShadow=mesh.receiveShadow=true;
      this.group.add(mesh);
    }
    this.group.userData.place=id;return this.group;
  }
}
export function canvasMaterial(width:number,height:number,draw:(ctx:CanvasRenderingContext2D)=>void,repeat=false){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  if(repeat)map.wrapS=T.RepeatWrapping;
  return new T.MeshLambertMaterial({map});
}
export function prism(model:Model,ring:Point[],bottom:number,top:number,wall:T.Material,roof:T.Material,bay=4){
  if(ring.length<3)return;
  const winding=Math.sign(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1]},0));
  
  const shape=new T.Shape(ring.map(([x,z])=>new T.Vector2(x,-z)));
  const roofGeo=new T.ShapeGeometry(shape);
}
