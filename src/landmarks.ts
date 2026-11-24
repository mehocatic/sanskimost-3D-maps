import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Ring = readonly (readonly number[])[];
type HeightAt = (x: number, z: number) => number;

// The long axis points towards the south (the qibla end for the mosque).
// Projecting all nodes onto the two axes also handles redundant OSM vertices.
export function localFrame(ring: Ring) {
  let ax = 0, az = 1, longest = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const x = b[0] - a[0], z = b[1] - a[1], length = Math.hypot(x, z);
    if (length > longest) {
      longest = length;
      const sign = z < 0 ? -1 : 1;
      ax = sign * x / length;
      az = sign * z / length;
    }
  }
  const u = ring.map(p => az * p[0] - ax * p[1]);
  const v = ring.map(p => ax * p[0] + az * p[1]);
  const u0 = Math.min(...u), u1 = Math.max(...u), v0 = Math.min(...v), v1 = Math.max(...v);
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
  return { x: az * um + ax * vm, z: -ax * um + az * vm, ax, az, width: u1-u0, length: v1-v0 };
}

// Bake components of each material into a single draw call.
function batch(group: T.Group) {
  const parts = new Map<T.Material, T.BufferGeometry[]>();
  for (const part of [...group.children]) {
    if (!(part instanceof T.Mesh)) continue;
    part.updateMatrix();
    const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    geo.applyMatrix4(part.matrix);
    geo.deleteAttribute('uv');
    const bucket = parts.get(part.material) ?? [];
    bucket.push(geo);
    parts.set(part.material, bucket);
    group.remove(part);
    part.geometry.dispose();
  }
  for (const [material, geometries] of parts) {
    const merged = mergeGeometries(geometries);
    const mesh = new T.Mesh(merged, material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    geometries.forEach(g => g.dispose());
  }
  return group;
}

/** Centred on the OSM way in world x/z metres. Set only position.y to the terrain height. */
export function createHamzaMosque(ring: Ring, minaretRings: readonly Ring[] = [], domeRing?: Ring, wing?: Ring, smallDomes: readonly Ring[] = []): T.Group {
  const frame = localFrame(ring);
  const model = new T.Group();
  model.name = 'Hamzibegova džamija';
  model.position.set(frame.x, 0, frame.z);
  model.rotation.y = Math.atan2(frame.ax, frame.az);

  const stone = new T.MeshStandardMaterial({ color: 0xe4ded0, roughness: .94 });
  const plaster = new T.MeshStandardMaterial({ color: 0xfff9ee, roughness: .9 });
  const ledge = new T.MeshStandardMaterial({ color: 0xb7b4ac, roughness: .85 });
  const roof = new T.MeshStandardMaterial({ color: 0x4a4d50, roughness: .62, metalness: .22 });
  const rib = new T.MeshStandardMaterial({ color: 0x626462, roughness: .65, metalness: .25 });
  const glass = new T.MeshStandardMaterial({ color: 0x3b4d53, roughness: .35, side: T.DoubleSide });
  const brass = new T.MeshStandardMaterial({ color: 0xc7a366, roughness: .45, metalness: .55 });
  const place = (geo: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => {
    const mesh = new T.Mesh(geo, material);
    mesh.position.set(x, y, z);
    model.add(mesh);
    return mesh;
  };
  const slab = (x: number, z: number, width: number, depth: number, y: number, height: number, material: T.Material) =>
    place(new T.BoxGeometry(width, height, depth), material, x, y + height/2, z);
  const cylinder = (x: number, z: number, bottom: number, top: number, y: number, height: number, material: T.Material, segments = 16) =>
    place(new T.CylinderGeometry(top, bottom, height, segments), material, x, y + height/2, z);

  function boundsInModel(points: Ring) {
    const xs = points.map(([x,z]) => (x-frame.x)*frame.az - (z-frame.z)*frame.ax);
    const zs = points.map(([x,z]) => (x-frame.x)*frame.ax + (z-frame.z)*frame.az);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    return {x: (x0+x1)/2, z: (z0+z1)/2, radius: (x1-x0+z1-z0)/4};
  }
  const w = frame.width, l = frame.length;
  const dome = domeRing?.length ? boundsInModel(domeRing) : {x:0,z:(l-w)/2,radius:w*.48};
  const {radius,x: mainX,z: mainZ} = dome;
  slab(0, 0, w, l, 0, 1, ledge);
  slab(0, 1.6, w-.3, l-3.5, 1, 5, stone);
  slab(0, 0, w+.12, l+.12, 5.85, .42, stone);
  slab(0, 0, w-.4, l-.35, 6.27, 4.6, plaster);
  slab(0, 0, w+.15, l+.1, 10.82, .34, roof);
  const drumRadius = radius / Math.cos(Math.PI / 8);
  const drum = cylinder(mainX,mainZ,drumRadius,drumRadius,11.12,5,plaster,8);
  drum.rotation.y = Math.PI / 8;
  const cornice = cylinder(mainX,mainZ,drumRadius+.1,drumRadius+.15,15.85,.44,ledge,8);
  cornice.rotation.y = Math.PI / 8;

  function archedPane(x: number,z: number,y: number,angle: number,width: number,height: number) {
    const shape = new T.Shape(), rad = width/2, spring = height-rad;
    shape.moveTo(-rad,0); shape.lineTo(rad,0); shape.lineTo(rad,spring);
    shape.absarc(0,spring,rad,0,Math.PI,false); shape.closePath();
    const pane = place(new T.ShapeGeometry(shape,8),glass,x,y,z);
    pane.rotation.y = angle;
    const inset = .056;
    const mullion = slab(x+inset*Math.sin(angle),z+inset*Math.cos(angle),.085,.08,y,height,ledge);
    mullion.rotation.y = angle;
    const bar = slab(x+inset*Math.sin(angle),z+inset*Math.cos(angle),width,.08,y+spring,.085,ledge);
    bar.rotation.y = angle;
  }
  for (let side = 0; side < 8; side++) {
    const angle = side * Math.PI / 4, apothem = radius + .025;
    archedPane(mainX+apothem*Math.sin(angle),mainZ+apothem*Math.cos(angle),11.45,angle,radius*.67,4.05);
  }
  for (const hand of [-1,1]) {
    for (let i = 0; i < 6; i++) {
      const z = (i-2.5)*l/6.6;
      archedPane(hand*(w/2-.12),z,2,hand*Math.PI/2,1.75,2.85);
      archedPane(hand*(w/2-.14),z,6.85,hand*Math.PI/2,2,3.1);
    }
  }
  const domeY = 16.27, domeRise = radius*.89;
  const cap = place(new T.SphereGeometry(radius,48,16,0,Math.PI*2,0,Math.PI/2),roof,mainX,domeY,mainZ);
  cap.scale.y = domeRise/radius;
  // Narrow raised seams make the lead-clad dome legible at oblique angles.
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, points = [];
    for (let j = 0; j <= 12; j++) {
      const b = j*Math.PI/24;
      points.push(new T.Vector3(radius*Math.cos(b)*Math.sin(a),domeRise*Math.sin(b),radius*Math.cos(b)*Math.cos(a)));
    }
    place(new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.04,4,false),rib,mainX,domeY,mainZ);
  }
  cylinder(mainX,mainZ,.16,.025,domeY+domeRise,1.1,brass,8);
  // Entrance faces the paved courtyard at the north end of the OSM footprint.
  const front=-l/2, frameMat=new T.MeshStandardMaterial({color:0x443236});
  const glazing=new T.MeshStandardMaterial({color:0x718b9b,roughness:.27});
  slab(0,front-.01,w*.88,.19,6.5,3.65,glazing);
  for(let i=0;i<=8;i++)slab((i/8-.5)*w*.88,front-.14,.11,.11,6.5,3.65,frameMat);
  slab(0,front-.14,w*.88,.12,8.55,.12,frameMat);
  const bayX=w*.38;
  cylinder(bayX,front,2.1,2.1,1,5.4,plaster,32);
  cylinder(bayX,front,2.13,2.13,6.4,3.75,glazing,32);
  cylinder(bayX,front,2.16,2.16,10.15,.72,plaster,32);
  for(let j=0;j<=8;j++){
    const a=Math.PI*j/8;
    cylinder(bayX+2.13*Math.cos(a),front-2.13*Math.sin(a),.075,.075,6.4,3.75,frameMat,6);
  }
  for(const x of [-w*.37,0,w*.37])cylinder(x,front+.38,.32,.32,1,4.92,plaster);
  slab(0,front+3.12,4.2,.16,1,3.45,glass);
  for(let i=0;i<4;i++)slab(0,front-1.36+i*.36,6.3,.38,0,.25*(i+1),ledge);

  const pavers=new T.MeshStandardMaterial({color:0xb9ad99,roughness:.96});
  slab(0,front-9.2,23,19,.03,.17,pavers);
  const fx=1.6,fz=front-8.5;
  cylinder(fx,fz,2.35,2.4,.20,.54,stone,8);
  cylinder(fx,fz,2.12,2.12,.74,.04,new T.MeshStandardMaterial({color:0x65a49c}),8);
  cylinder(fx,fz,.43,.24,.77,1.48,plaster);
  for(const [y,r] of [[1.01,1.0],[1.62,.72],[2.12,.40]]){
    cylinder(fx,fz,.19,r,y,.27,plaster,24);
    cylinder(fx,fz,r,r*.94,y+.27,.07,plaster,24);
  }
  cylinder(fx,fz,.13,.045,2.43,.28,plaster);
  // Low masonry plinth and white slats along the street-facing boundary.
  function fence(x1:number,z1:number,x2:number,z2:number){
    const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz);
    const angle=Math.atan2(dx,dz),bays=Math.ceil(length/3);
    const beam=(y:number,h:number,wide:number,mat:T.Material)=>{
      slab((x1+x2)/2,(z1+z2)/2,wide,length,y,h,mat).rotation.y=angle;
    };
    beam(.06,.51,.38,pavers);beam(.57,.10,.43,ledge);
    beam(.71,.09,.12,plaster);beam(1.39,.09,.12,plaster);
    for(let i=0;i<=bays*9;i++){
      const t=i/(bays*9),x=x1+t*dx,z=z1+t*dz;
      if(i%9===0){
        slab(x,z,.37,.37,.55,1.02,plaster).rotation.y=angle;
        place(new T.SphereGeometry(.19,10,6),plaster,x,1.67,z);
      }else slab(x,z,.10,.12,.66,.85,plaster).rotation.y=angle;
    }
  }
  const edge=-w/2-4.1,gateZ=front-7.0;
  fence(edge,-32,edge,gateZ-1.4);fence(edge,gateZ+1.4,edge,l/2+2);
  fence(edge,l/2+2,w/2+3,l/2+2);
  for(const z of [gateZ-1.4,gateZ+1.4])slab(edge,z,.55,.55,.08,2.45,plaster);
  const arch=new T.Shape();
  arch.moveTo(-1.67,2.38);arch.lineTo(-1.67,2.96);arch.lineTo(1.67,2.96);
  arch.lineTo(1.67,2.38);arch.quadraticCurveTo(0,3.16,-1.67,2.38);
  const portal=place(new T.ExtrudeGeometry(arch,{depth:.45,bevelEnabled:false}),plaster,edge-.22,0,gateZ);
  portal.rotation.y=Math.PI/2;
  if(wing){
    const outline=wing.map(([x,z])=>new T.Vector2((x-frame.x)*frame.az-(z-frame.z)*frame.ax,-((x-frame.x)*frame.ax+(z-frame.z)*frame.az)));
    const shape=new T.Shape(outline);
    for(const [y,depth,material] of [[0,3.75,plaster],[3.75,.34,roof]] as const){
      const geometry=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false});
      geometry.rotateX(-Math.PI/2);place(geometry,material,0,y,0);
    }
    for(let i=0;i<outline.length;i++){
      const a=outline[i],b=outline[(i+1)%outline.length],dx=b.x-a.x,dz=a.y-b.y,len=Math.hypot(dx,dz);
      if(len<3.4)continue;
      const count=Math.max(1,Math.round(len/3.8));
      for(let j=0;j<count;j++){
        const t=(j+.5)/count,x=a.x+dx*t,z=-a.y+dz*t;
        // Place the arches on the exterior side for either polygon winding.
        const sign=T.ShapeUtils.isClockWise(outline)?-1:1;
        const nx=-dz/len*sign,nz=dx/len*sign;
        archedPane(x+nx*.025,z+nz*.025,.29,Math.atan2(nx,nz),Math.min(3,len/count*.80),2.98);
      }
    }
    for(const footprint of smallDomes){
      const {x,z,radius:r}=boundsInModel(footprint);
      cylinder(x,z,r,r,4.09,.27,stone);
      const small=place(new T.SphereGeometry(r,24,10,0,2*Math.PI,0,Math.PI/2),roof,x,4.36,z);
      small.scale.y=.72;
    }
  }
  const porchZ = -l/2+(l-w)*.53;
  for (const column of [-1,0,1]) {
    const x = column*w*.31, r = Math.min(w*.142,(l-w)*.44);
    cylinder(x,porchZ,r,r,11.12,.38,ledge);
    const small = place(new T.SphereGeometry(r,18,8,0,Math.PI*2,0,Math.PI/2),roof,x,11.5,porchZ);
    small.scale.y = .8;
  }

  // The minarets' 51.5 m height is documented. Balcony and dome details are approximations.
  const towerSites = minaretRings.length ? minaretRings.map(boundsInModel) :
    [-w/2,w/2].flatMap(x => [-l/2,l/2].map(z => ({x,z,radius:1.34})));
  for (const {x,z,radius: footing} of towerSites) {
      cylinder(x,z,footing,footing,0,7.4,stone);
      cylinder(x,z,footing,1.28,7.4,2.4,plaster);
      cylinder(x,z,1.28,.91,9.8,30,plaster);
      for (const balcony of [26,34.4]) {
        cylinder(x,z,1.12,1.45,balcony-1.4,.72,ledge);
        cylinder(x,z,1.45,1.86,balcony-.68,.68,plaster);
        cylinder(x,z,1.87,1.87,balcony,.25,ledge);
        for (let post = 0; post < 16; post++) {
          const a = post * Math.PI / 8;
          cylinder(x+1.75*Math.sin(a),z+1.75*Math.cos(a),.09,.09,balcony+.22,.87,plaster,4);
        }
        const rail = place(new T.TorusGeometry(1.75,.105,5,16),plaster,x,balcony+1.09,z);
        rail.rotation.x = Math.PI/2;
      }
      cylinder(x,z,1.03,1.02,39.8,.32,ledge);
      cylinder(x,z,1.04,.045,40.12,10.36,roof);
      cylinder(x,z,.073,.024,50.48,1.02,brass,8);
  }
  return batch(model);
}

/** OSM way 226624055. Pitch and goals use the OSM bearing and the local DEM. */
export function createPodgrmecPitch(ring: Ring, heightAt: HeightAt): T.Group {
  const f = localFrame(ring), group = new T.Group();
  group.name = 'Stadion Podgrmeč';
  group.position.set(f.x,heightAt(f.x,f.z),f.z);
  group.rotation.y = Math.atan2(f.ax,f.az);
  const ground = (x: number,z: number) => heightAt(f.x+x*f.az+z*f.ax,f.z-x*f.ax+z*f.az)-group.position.y;
  const stripes = [0x66925a,0x719b60].map(color => new T.MeshStandardMaterial({color,roughness:1,side:T.DoubleSide}));
  const paint = new T.MeshStandardMaterial({color:0xf2f2df,roughness:.94,side:T.DoubleSide});
  const metal = new T.MeshStandardMaterial({color:0xe4e6dd,roughness:.55});
  const w = f.width/2, l = f.length/2;
  // Lift the draped surface slightly above mapped land cover.
  const base = .68;
  function quad(points: number[][],material: T.Material,offset: number) {
    const positions = points.flatMap(([x,z])=>[x,ground(x,z)+offset,z]);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setIndex([0,2,1,0,3,2]);
    geometry.computeVertexNormals();
    group.add(new T.Mesh(geometry,material));
  }
  for (let j=0;j<16;j++) {
    const a=-l+2*l*j/16,b=-l+2*l*(j+1)/16;
    for(let i=0;i<8;i++) {
      const left=-w+2*w*i/8,right=-w+2*w*(i+1)/8;
      quad([[left,a],[right,a],[right,b],[left,b]],stripes[j%2],base);
    }
  }
  function line(x1:number,z1:number,x2:number,z2:number) {
    const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz);
    const sideX=-dz*.095/length,sideZ=dx*.095/length;
    const steps=Math.ceil(length/5);
    for(let i=0;i<steps;i++) {
      const ax=x1+i*dx/steps,az=z1+i*dz/steps;
      const bx=ax+dx/steps,bz=az+dz/steps;
      quad([[ax+sideX,az+sideZ],[ax-sideX,az-sideZ],[bx-sideX,bz-sideZ],[bx+sideX,bz+sideZ]],paint,base+.07);
    }
  }
  const innerW=w-1.7,innerL=l-1.7;
  for (const side of [-1,1]) line(side*innerW,-innerL,side*innerW,innerL);
  line(-innerW,0,innerW,0);
  arc(0,0,9.15,0,2*Math.PI);
  function dot(z:number) {
    const disc = new T.Mesh(new T.CylinderGeometry(.17,.17,.04,10),paint);
    disc.position.set(0,ground(0,z)+base+.07,z);
    group.add(disc);
  }
  dot(0);
  for (const s of [-1,1]) {
    const end=s*innerL;
    line(-innerW,end,innerW,end);
    for(const [half,depth] of [[20.16,16.5],[9.16,5.5]]) {
      const top=end-s*depth;
      line(-half,end,-half,top); line(-half,top,half,top); line(half,top,half,end);
    }
    const spot=end-s*11;
    const a=Math.asin(5.5/9.15);
    arc(0,spot,9.15,s>0?Math.PI+a:a,s>0?2*Math.PI-a:Math.PI-a);
    dot(spot);
    const y=ground(0,end)+base;
    for(const x of [-3.66,3.66]) {
      const post=new T.Mesh(new T.CylinderGeometry(.065,.065,2.44,8),metal);
      post.position.set(x,y+1.22,end);
      group.add(post);
    }
    const crossbar=new T.Mesh(new T.CylinderGeometry(.065,.065,7.32,8),metal);
    crossbar.rotation.z=Math.PI/2; crossbar.position.set(0,y+2.44,end); group.add(crossbar);
  }
  return batch(group);
}
