import * as T from 'three';
import {Building,centerOf} from './types';
import {Model,canvasMaterial,finish} from './civic-geometry';

export const marketNames:Record<string,string>={
  w1185290181:'Vakufski tržni centar · Plaza', w1185290176:'Stara pijaca · Mahala',
  w1185290178:'Stara pijaca · Hamzibegova', w1081336451:'Stara pijaca · tezge istok',
  w1081336452:'Stara pijaca · tezge zapad'
};
function sign(m:Model,label:string,x:number,y:number,z:number,w:number,h:number,yaw:number,ink:string,background:string){
  const mat=canvasMaterial(512,96,g=>{
    g.fillStyle=background;g.fillRect(0,0,512,96);g.fillStyle=ink;
    g.textAlign='center';g.textBaseline='middle';g.font='bold 72px Arial';g.fillText(label,256,52,490);
  });
  m.add(new T.PlaneGeometry(w,h),mat,x,y,z,yaw);
}
function plaza(m:Model,w:number,l:number){
  const grey=finish('#b9bfc3'),sand=finish('#bcab97'),green=finish('#64ad36'),dark=finish('#343c41'),metal=finish('#d8dada');
  const h=9.4;
  m.box(0,h/2-.55,0,w,h+1.1,l,grey);
  m.box(0,h+.09,0,w-.25,.18,l-.25,finish('#dadad3'));
  for(const side of [-1,1]){
    const x=side*w/2;
    for(const end of [-1,1])m.box(x,6.55,end*(l/2-7),.14,5.7,14,sand);
    for(const z of [4,7,10,21,23,25,34,36,38]){
      m.box(x,4.75,z,.35,9.5,.55,z===21||z===23?green:z%2?dark:sand);
    }
    for(let j=0;j<12;j++)m.box(x,7.35,-6+j*.95,.42,4.1,.30,sand);
    m.box(x+side*.15,2.25,0,.42,4.5,8,dark);
    m.box(x+side*.4,2,0,.12,3.9,6.9,finish('#65818a'));
    for(const z of [-3.4,0,3.4])m.box(x+side*.49,2,z,.12,4,.12,dark);
    m.box(x,4.9,0,.95,1.1,13,green);
    m.box(x,2.25,6,.95,4.5,.8,green);
    m.box(x,4.95,-6.4,1.18,9.9,1.5,sand);
    // Covered garage lane opens toward the old market and drops near the pedestrian portal.
    const rampX=x+side*1.8;
    const canopy=new T.BoxGeometry(3.65,.18,17);canopy.rotateX(.16);
    m.add(canopy,metal,rampX,1.85,-16);
    for(const z of [-24,-17,-9])m.box(x+side*3.5,(1.85-(z+16)*.16)/2,z,.13,1.85-(z+16)*.16,.13,metal);
    m.box(rampX,.038,-24,3.6,.08,3,dark);
    for(const z of [-24,-19,-14,-9])m.box(rampX,.095,z,.13,.03,1.6,metal);
  }
  sign(m,'LC Waikiki',-w/2-.09,8,-l/2+7,12,2,-Math.PI/2,'#243d86','#bcab97');
  sign(m,'pepco',-w/2-.1,5.8,-l/2+7,10,1.7,-Math.PI/2,'white','#3455a0');
  sign(m,'LC Waikiki',-w/2-.09,8,l/2-7,12,2,-Math.PI/2,'#243d86','#bcab97');
  sign(m,'Sinsay',-w/2+5,8,-l/2-.09,8,2.1,Math.PI,'white','#232323');
  sign(m,'SPORT REALITY',-w/2+5,5.8,-l/2-.09,8,1.2,Math.PI,'#273e75','#bcab97');
  sign(m,'LC Waikiki',w/2-6,8,l/2+.09,11,2,0,'#243d86','#bcab97');
  for(let i=-4;i<=4;i++)m.box(i*1.35,4.8,l/2,.45,9.6,.35,i%3===0?green:dark);
  for(let i=0;i<5;i++)m.box(w/2-4-i*1.3,1,l/2+.7,1.15,1.6,1.1,metal);
}
function stalls(m:Model,w:number,l:number,outer:number){
  const timber=finish('#6d5043'),pink=finish('#c29485'),tile=finish('#965d48');
  const bayCount=Math.max(4,Math.round(l/4)),bay=l/bayCount;
  for(let i=0;i<bayCount;i++){
    const z=-l/2+(i+.5)*bay;
    if(i===1&&outer)continue;
    if(outer){
      m.box(outer*(w/2-.12),1.23,z,.24,2.6,bay,pink);
      if(i%2===0)m.box(outer*w/2,1.55,z,.1,.65,.64,timber);
    }
    for(const s of [-1,1]){
      m.box(s*(w/2-.13),1.25,z-bay/2+.1,.16,2.6,.18,timber);
      const roof=new T.BoxGeometry(w*.56,.16,bay+.025);roof.rotateZ(-s*.31);
      
    }
    
    for(let j=0;j<3;j++)m.box(0,1.07,z+(j-1)*bay*.22,w*.50,.20,bay*.18,finish(['#979242','#be6943','#65824c'][(j+i)%3]));
  }
  if(outer)sign(m,'VAKUFSKA PIJACA',outer*(w/2+.06),1.5,-l/2+bay*.6,2.5,.95,outer*Math.PI/2,'#396147','#e7e1cf');
}
export function marketBuilding(b:Building,height:(x:number,z:number)=>number){
  const [x,z]=centerOf(b.points);
  const edges=b.points.map((p,i)=>new T.Vector2(p[0]-b.points[(i+1)%b.points.length][0],p[1]-b.points[(i+1)%b.points.length][1]));
  const axis=edges.sort((a,b)=>b.lengthSq()-a.lengthSq())[0].normalize();
  if(axis.y<0)axis.negate();
  const span=(dx:number,dz:number)=>{const values=b.points.map(p=>p[0]*dx+p[1]*dz);return Math.max(...values)-Math.min(...values)};
  const w=span(axis.y,-axis.x),l=span(axis.x,axis.y),m=new Model();
  if(b.id==='w1185290181')plaza(m,w,l);
  else stalls(m,w,l,b.id==='w1185290176'?-1:b.id==='w1185290178'?1:0);
  const group=m.build(b.id);group.rotation.y=Math.atan2(axis.x,axis.y);return group;
}
export function memorial(x:number,z:number,y:number,id:string){
  const m=new Model(),stone=finish('#a59a83'),white=finish('#e9e5d8');
  
  for(const s of [-1,1]){
    
    
  }
  
  const lily=new T.Shape();
  
  
  for(const dx of [1.76,2.84])m.box(dx,.2,.7,.19,.4,.3,stone);
  const group=m.build(id);group.rotation.y=2.8;group.name='Šehidsko spomen obilježje Lijeva obala';return group;
}
