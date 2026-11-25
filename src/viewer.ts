import {mahala,streetGlass} from './mahala';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeGround} from './ground';
import {makeBuildings} from './buildings';
import {makeWater,cityLife} from './environment';
import {createHamzaMosque,createPodgrmecPitch} from './landmarks';
import {City,Feature,Point,Place,Terrain,centerOf} from './types';

export function createViewer(host:HTMLElement,city:City & {parts?:Feature[]},dem:Terrain,photo:HTMLImageElement,select:(id:string)=>void) {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  host.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','Interaktivni trodimenzionalni prikaz Sanskog Mosta');
  renderer.domElement.tabIndex=0;
  const scene=new T.Scene(),sky=new T.Color('#d4dfd2');scene.background=sky;scene.fog=new T.FogExp2(sky,.00015);
  const light=new T.HemisphereLight('#f4f8ff','#acb49c',1.8),sun=new T.DirectionalLight('#fff2db',2.22);scene.add(light,sun,sun.target);
  sun.position.set(-720,1080,-525);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-750,right:750,top:750,bottom:-750,near:1,far:3500});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00022;sun.shadow.normalBias=.28;
  const ground=makeGround(city,dem,photo);scene.add(ground.land);
  const water=makeWater(ground.waterAreas,ground.waterY);scene.add(water);
  const reflect=water.onBeforeRender.bind(water);
  let lastReflection=-Infinity;
  water.onBeforeRender=(...args)=>{
    const now=performance.now();
    if(dirty||now-lastReflection>160){reflect(...args);lastReflection=now}
  };
  const blocks=makeBuildings(city.buildings,ground.height);scene.add(blocks.group);
  const life=cityLife(city,ground.height,ground.density,ground.waterY);scene.add(life.trees,life.spans,life.lamps,life.traffic);
  const special=new T.Group();scene.add(special);
  const mosque=city.buildings.find(b=>b.id==='w346178044'),pitch=city.areas.find(a=>a.id==='w226624055');
  if(mosque){
    const towers=city.buildings.filter(b=>['w346178046','w346178047','w346178048','w346178049'].includes(b.id));
    const model=createHamzaMosque(mosque.points,towers.map(b=>b.points),city.parts?.find(b=>b.id==='w346961963')?.points,city.buildings.find(b=>b.id==='w225470278')?.points,city.parts?.filter(b=>['w346178041','w346178042','w346178043','w346178060','w346178061','w346178062'].includes(b.id)).map(b=>b.points));
    model.position.y=ground.height(...centerOf(mosque.points));model.userData.place=mosque.id;special.add(model);
  }
  if(pitch){const m=createPodgrmecPitch(pitch.points,ground.height);m.userData.place=pitch.id;special.add(m)}
  const camera=new T.PerspectiveCamera(39,1,1.5,16000),controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=9;controls.maxDistance=3200;controls.maxPolarAngle=Math.PI*.414;
  controls.mouseButtons={LEFT:T.MOUSE.PAN,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.ROTATE};controls.screenSpacePanning=false;
  controls.touches={ONE:T.TOUCH.PAN,TWO:T.TOUCH.DOLLY_ROTATE};controls.zoomSpeed=1.15;
  const homeTarget=new T.Vector3(-56,ground.height(-56,224),224),homeOffset=new T.Vector3(-369,390,430);
  controls.target.copy(homeTarget);camera.position.copy(homeTarget).add(homeOffset);controls.update();
  let dirty=true,until=0,last=0,shadowX=Infinity,shadowZ=Infinity,flat=false;
  const motion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let flight:{start:number;duration:number;from:T.Vector3;eye:T.Vector3;to:T.Vector3;end:T.Vector3}|null=null;
  let onMove:()=>void=()=>{},onManual:()=>void=()=>{};
  controls.addEventListener('change',()=>{dirty=true});
  controls.addEventListener('start',()=>{flight=null;onManual();dirty=true});
  function go(to:T.Vector3,offset:T.Vector3,duration=800){
    flight={start:performance.now(),duration:motion?1:duration,from:controls.target.clone(),eye:camera.position.clone(),to,end:to.clone().add(offset)};
    dirty=true;
  }
  const shopBuildings:Record<string,string>={n5424651934:'w510393876',n14220106202:'w510393876',n14220106203:'w510393875',n14220106204:'w510393874',n14220106205:'w510393874'};
  function focus(pos:Point,distance=260,courtyard=false,placeId=''){
    const streetId=shopBuildings[placeId]??placeId,profile=mahala[streetId];
    if(!flat&&profile&&profile.style!=='house'){
      const building=city.buildings.find(b=>b.id===streetId);
      if(building){
        const ring=building.points,i=profile.fronts?.[0]??0,a=ring[i],b=ring[(i+1)%ring.length];
        const direction=Math.sign(ring.reduce((sum,a,j)=>{const b=ring[(j+1)%ring.length];return sum+a[0]*b[1]-a[1]*b[0]},0));
        const face=new T.Vector3(b[1]-a[1],0,a[0]-b[0]).normalize().multiplyScalar(direction);
        const corner=profile.style==='corner';
        const [x,z]=corner?centerOf(ring):[(a[0]+b[0])/2,(a[1]+b[1])/2];
        // Keep the bakery viewpoint in the lane, in front of the courtyard canopy.
        const alley=building.tags['addr:street']==='Hamzibegova ulica';
        const reach=corner?57:profile.style==='bakery'?14:20;
        const offset=face.multiplyScalar(reach);
        // Look along the narrow street from the junction, clear of the opposite roof.
        offset.applyAxisAngle(new T.Vector3(0,1,0),alley?-1.18:corner?-.28:.10);
        offset.y=reach*(corner?.4:.30);
        go(new T.Vector3(x,ground.height(x,z)+profile.height*.47,z),offset);return;
      }
    }
    if(courtyard&&!flat&&mosque){const model=special.children[0];const target=new T.Vector3(0,21,-6).applyMatrix4(model.matrixWorld);const offset=new T.Vector3(-17,41,-Math.max(110,78/camera.aspect)).applyQuaternion(model.quaternion);go(target,offset);return}
    const offset=camera.position.clone().sub(controls.target).normalize().multiplyScalar(distance);
    go(new T.Vector3(pos[0],ground.height(...pos)+3,pos[1]),offset)}
  function home(){flat=false;controls.enableRotate=true;go(homeTarget.clone(),homeOffset)}
  function top(){flat=!flat;controls.enableRotate=!flat;const d=camera.position.distanceTo(controls.target);
    go(controls.target.clone(),flat?new T.Vector3(0,d,.1):homeOffset.clone().normalize().multiplyScalar(d));return flat}
  function north(){go(controls.target.clone(),new T.Vector3(0,flat?1:.79,flat?.0001:.75).normalize().multiplyScalar(camera.position.distanceTo(controls.target)))}
  function zoom(f:number){const offset=camera.position.clone().sub(controls.target);go(controls.target.clone(),offset.setLength(T.MathUtils.clamp(offset.length()*f,72,3200)),280)}
  function night(active:boolean){
    sky.set(active?'#223641':'#d4dfd2');(scene.fog as T.FogExp2).color.copy(sky);
    light.color.set(active?'#96acdd':'#f4f8ff');light.intensity=active?.53:1.8;sun.color.set(active?'#afc2ff':'#fff2db');sun.intensity=active?.48:2.22;
    blocks.wallMat.emissiveIntensity=active?.94:0;life.glow.visible=active;life.bulbMat.color.set(active?'#ffd289':'#d8d7bc');
    (water.material as T.ShaderMaterial).uniforms.night.value=active?1:0;dirty=true;
  }
  const overlay=document.querySelector<HTMLElement>('#labels')!;
  function project(place:Place,h:number){
    const v=new T.Vector3(place.pos[0],ground.height(...place.pos)+h,place.pos[1]).project(camera);
    return {x:(v.x*.5+.5)*host.clientWidth,y:(.5-v.y*.5)*host.clientHeight,visible:v.z>-1&&v.z<1};
  }
  const layers={buildings:blocks.group,trees:life.trees,cars:life.traffic};
  function layer(k:string,value:boolean){
    if(k==='labels')overlay.hidden=!value;
    else if(k in layers){layers[k as keyof typeof layers].visible=value;if(k==='buildings')special.visible=value;renderer.shadowMap.needsUpdate=true}
    dirty=true;
  }
  let down=[0,0],previousTouch=0;
  renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];if(!e.isPrimary)previousTouch=performance.now()});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(e.button!==0||performance.now()-previousTouch<350||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;
    const r=host.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
    const clickable:T.Object3D[]=[ground.land.children[0],...life.spans.children];
    if(blocks.group.visible)clickable.push(...special.children,...blocks.group.children.filter(c=>c.userData.ids));
    const hits=ray.intersectObjects(clickable,true);
    const hit=hits[0];if(!hit)return;let o:T.Object3D|null=hit.object;
    while(o){if(o.userData.place){select(o.userData.place);return}o=o.parent}
    if(hit.faceIndex!=null&&hit.object.userData.ids){select(city.buildings[hit.object.userData.ids[hit.faceIndex]].id);return}
    const {x,z}=hit.point;
    for(const r of city.roads.filter(r=>r.bridge)){
      for(let i=1;i<r.points.length;i++){
        const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
        const t=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
        if(Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<r.width/2+1.3){select(r.id);return}
      }
    }
    for(const area of city.areas.filter(a=>a.name&&a.kind==='park')){
      let inside=false;const pts=area.points;
      for(let i=0,j=pts.length-1;i<pts.length;j=i++){
        const a=pts[i],b=pts[j];
        if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      }
      if(inside){select(area.id);return}
    }
  });
  renderer.domElement.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;
    e.preventDefault();onManual();
    if(e.key==='Home')home();else if(e.key==='-'||e.key==='+'||e.key==='=')zoom(e.key==='-'?1.35:.75);
    else{const factor=camera.position.distanceTo(controls.target)*.09,dir=new T.Vector3();camera.getWorldDirection(dir);dir.y=0;dir.normalize();
      const right=dir.clone().cross(new T.Vector3(0,1,0));const delta=(e.key==='ArrowLeft'||e.key==='ArrowRight'?right:dir).multiplyScalar(factor*(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1));
      go(controls.target.clone().add(delta),camera.position.clone().sub(controls.target),200)}
  });
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true}
  new ResizeObserver(resize).observe(host);resize();
  const rate=matchMedia('(max-width:700px)').matches?24:30;
  let visible=true;document.addEventListener('visibilitychange',()=>{visible=!document.hidden;last=0;dirty=true});
  function draw(now:number){
    requestAnimationFrame(draw);if(!visible || now-until<1000/rate)return;until=now;
    const dt=last?Math.min(.12,(now-last)/1000):0;last=now;
    if(flight){const t=Math.min(1,(now-flight.start)/flight.duration),s=t*t*(3-2*t);
      controls.target.lerpVectors(flight.from,flight.to,s);camera.position.lerpVectors(flight.eye,flight.end,s);if(t===1)flight=null;dirty=true}
    const before=controls.target.clone();controls.target.x=T.MathUtils.clamp(before.x,-1480,1480);controls.target.z=T.MathUtils.clamp(before.z,-1480,1480);
    camera.position.x+=controls.target.x-before.x;camera.position.z+=controls.target.z-before.z;controls.update();
    if(Math.hypot(controls.target.x-shadowX,controls.target.z-shadowZ)>250){
      shadowX=controls.target.x;shadowZ=controls.target.z;sun.target.position.set(shadowX,0,shadowZ);sun.position.set(shadowX-720,1080,shadowZ-525);renderer.shadowMap.needsUpdate=true;
    }
    if(!motion){if(life.traffic.visible)life.updateCars(dt);(water.material as T.ShaderMaterial).uniforms.time.value=now*.001}
    if(dirty||!motion){renderer.render(scene,camera);if(dirty)onMove();dirty=false}
  }
  renderer.render(scene,camera);requestAnimationFrame(draw);
  return {focus,home,top,north,zoom,night,layer,project,get flat(){return flat},
    get bearing(){return Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z)},
    get target():Point{return [controls.target.x,controls.target.z]},
    get distance(){return camera.position.distanceTo(controls.target)},
    setTourRotate(active:boolean){controls.autoRotate=active&&!motion;controls.autoRotateSpeed=.45;dirty=true},
    onMove(cb:()=>void){onMove=cb;dirty=true},onManual(cb:()=>void){onManual=cb}};
}

