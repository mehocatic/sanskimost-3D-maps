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
function wordmark(m:Model,label:string,x:number,y:number,z:number,w:number,h:number,yaw:number,ink:string,face?:string){
  const depth=.18;
  if(face)m.box(x,y,z,w,h,depth,finish(face),yaw);
  const mat=canvasMaterial(1024,256,g=>{
    if(label==='pepco'){
      const gradient=g.createLinearGradient(0,0,1024,0);
      gradient.addColorStop(0,'#1458a1');gradient.addColorStop(.83,'#28549a');gradient.addColorStop(1,'#884858');
      g.fillStyle=gradient;g.fillRect(0,0,1024,256);
    }
    g.fillStyle=ink;g.textAlign='center';g.textBaseline='middle';
    g.font=label==='pepco'?'160px Arial':'bold 174px Arial';
    if(label==='SPORT REALITY'){
      // Continuous bent strokes form the interlocked blue SR monogram on the facade.
      g.strokeStyle=ink;g.lineWidth=17;g.lineJoin='round';g.lineCap='round';
      g.beginPath();g.moveTo(82,201);g.lineTo(174,201);
      g.quadraticCurveTo(193,201,193,182);g.lineTo(193,151);
      g.quadraticCurveTo(193,132,174,132);g.lineTo(117,132);
      g.quadraticCurveTo(94,132,94,109);g.lineTo(94,85);
      g.quadraticCurveTo(94,57,123,57);g.lineTo(312,57);
      g.quadraticCurveTo(343,57,343,86);g.lineTo(343,102);
      g.quadraticCurveTo(343,133,311,133);g.lineTo(224,133);
      g.lineTo(224,200);g.stroke();
      g.beginPath();g.moveTo(295,133);g.lineTo(346,200);g.stroke();
      g.fillRect(375,50,6,156);
      g.font='bold 89px Arial';g.textAlign='left';g.fillText('SPORT',410,87,494);g.fillText('REALITY',410,171,535);
    }else g.fillText(label,512,137,label==='pepco'?670:945);
  });
  mat.alphaTest=.45;
  const outward=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  if(!face){
    // Project individual letters from the panels using the same silhouette for their return.
    const backing=mat.clone();backing.color.set('#59616c');
    m.add(new T.PlaneGeometry(w,h),backing,x+outward.x*.025,y-.035,z+outward.z*.025,yaw);
  }
  m.add(new T.PlaneGeometry(w,h),mat,x+outward.x*.105,y,z+outward.z*.105,yaw);
}

function garage(m:Model,side:number,edge:number,depth:number,start:number,end:number){
  const metal=finish('#d9dce0'),trim=finish('#969fa8'),dark=finish('#30353a'),black=finish('#14191c');
  const x=side*(edge-depth/2),outer=side*(edge-.13),inner=side*(edge-depth+.13);
  const peak=start+3.9,head=2.95,tail=.31;
  const vector=(a:number,b:number,c:number)=>new T.Vector3(a,b,c);
  const slope=(z:number)=>z<=peak?head:head+(tail-head)*(z-peak)/(end-peak);
  for(const [a,b] of [[start,peak],[peak,end]]){
    for(let i=0;i<17;i++){
      ;
      ;
    }
    ;
  }
  ;
  ;;;;;
  ;
  ;
  ;
  ;;
  ;
  ;
  ;
}

;

function plaza(m:Model,w:number,l:number,grade:(x:number,z:number)=>number){
  const grey=finish('#a6afb7'),sand=finish('#baaa95'),green=finish('#55a82b'),dark=finish('#323b42'),metal=finish('#d8dada');
  const h=9.4,back=-l/2,front=l/2-8;
  const start=-28,end=-7.3,depth=4.05;
  const garageWall=w/2-depth;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
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
      m.add(roof,tile,s*w*.25,2.72+w*.08,z);
    }
    m.box(0,.85,z,w*.70,.22,bay*.77,timber);
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
  const base=height(x,z);
  const grade=(across:number,along:number)=>height(x+axis.y*across+axis.x*along,z-axis.x*across+axis.y*along)-base;
  if(b.id==='w1185290181')plaza(m,w,l,grade);
  else stalls(m,w,l,b.id==='w1185290176'?-1:b.id==='w1185290178'?1:0);
  const group=m.build(b.id);group.position.set(x,base,z);group.rotation.y=Math.atan2(axis.x,axis.y);return group;
}
export function memorial(x:number,z:number,y:number,id:string){
  const m=new Model(),mortar=finish('#6d685e'),coping=finish('#aeaa9b'),white=finish('#e5e4dc');
  const stones=['#99917f','#817a6a','#a69e8b','#8b897b','#b1a68f','#79776c'].map(finish);
  ;
  ;
  ;
  ;
  ;
  const plaque=canvasMaterial(384,608,g=>{
    ;;;;
    ;;;
    ;
    ;
  });
  ;
  const plate=new T.PlaneGeometry(1.22,1.79);
  ;
  ;
  const lily=new T.Shape();
  ;;;
  ;;
  ;;
  ;;
  ;
  ;;
  ;
  ;
  ;
  ;
  const group=m.build(id);
  ;;
  ;return group;
}
