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
  controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=72;controls.maxDistance=3200;controls.maxPolarAngle=Math.PI*.414;
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
  function focus(pos:Point,distance=260,courtyard=false){
    if(courtyard&&!flat&&mosque){const model=special.children[0];const target=new T.Vector3(0,21,-6).applyMatrix4(model.matrixWorld);const offset=new T.Vector3(-17,41,-Math.max(110,78/camera.aspect)).applyQuaternion(model.quaternion);go(target,offset);return}
    const offset=camera.position.clone().sub(controls.target).normalize().multiplyScalar(distance);
    go(new T.Vector3(pos[0],ground.height(...pos)+3,pos[1]),offset)}
  function home(){flat=false;controls.enableRotate=true;go(homeTarget.clone(),homeOffset)}
  function top(){flat=!flat;controls.enableRotate=!flat;const d=camera.position.distanceTo(controls.target);
    go(controls.target.clone(),flat?new T.Vector3(0,d,.1):homeOffset.clone().normalize().multiplyScalar(d));return flat}
  function north(){go(controls.target.clone(),new T.Vector3(0,flat?1:.79,flat?.0001:.75).normalize().multiplyScalar(camera.position.distanceTo(controls.target)))}
  function zoom(f:number){const offset=camera.position.clone().sub(controls.target);go(controls.target.clone(),offset.setLength(T.MathUtils.clamp(offset.length()*f,72,3200)),280)}
  const overlay=document.querySelector<HTMLElement>('#labels')!;
  const layers={buildings:blocks.group,trees:life.trees,cars:life.traffic};
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
  renderer.render(scene,camera);requestAnimationFrame(draw);
  return {focus,home,top,north,zoom,night,layer,project,get flat(){return flat},
    get bearing(){return Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z)},
    get target():Point{return [controls.target.x,controls.target.z]},
    get distance(){return camera.position.distanceTo(controls.target)},
    setTourRotate(active:boolean){controls.autoRotate=active&&!motion;controls.autoRotateSpeed=.45;dirty=true},
    onMove(cb:()=>void){onMove=cb;dirty=true},onManual(cb:()=>void){onManual=cb}};
}

