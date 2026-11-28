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
      const rib=side*(edge-.12-i*(depth-.24)/16);
      m.beam(vector(rib,slope(a),a),vector(rib,slope(b),b),.21,.11,metal);
    }
    m.beam(vector(outer,slope(a)-.09,a),vector(outer,slope(b)-.09,b),.15,.23,trim);
  }
  const wall=new T.Shape();
  wall.moveTo(-side*peak,0);wall.lineTo(-side*end,0);wall.lineTo(-side*end,tail);wall.lineTo(-side*peak,head-.12);wall.closePath();
  m.add(new T.ExtrudeGeometry(wall,{depth:.17,bevelEnabled:false}),dark,outer,0,0,side*Math.PI/2);
  for(const support of [outer,inner])for(const z of [start+.18,peak-.19]){
    m.box(support,1.41,z,.12,2.82,.12,metal);
  }
  m.box(x,1.29,peak+.14,depth-.29,2.58,.12,black);
  const ramp=new T.BoxGeometry(depth-.34,.08,5.8);ramp.rotateX(.15);
  m.add(ramp,dark,x,-.29,peak-1.6);
  if(side<0){
    m.box(inner+side*.29,.51,start+2,.29,1.02,.33,dark);
    for(let i=0;i<9;i++)m.box(x+(i-4)*.32,.94,start+2,.32,.075,.074,finish(i%2?'#b63837':'#efeee7'));
  }
  for(const boundary of [outer,inner])for(const z of [start-2.4,start-.85,start+.75]){
    m.box(boundary,.035,z,.085,.022,.7,finish('#f3f0df'));
  }
}

function parking(m:Model,w:number,front:number,edge:number,grade:(x:number,z:number)=>number){
  const asphalt=finish('#737574'),paint=finish('#efeee5');
  function surface(x1:number,z1:number,x2:number,z2:number,lift:number,material:T.Material){
    const vertices=[[x1,z1],[x1,z2],[x2,z2],[x1,z1],[x2,z2],[x2,z1]];
    const mesh=new T.BufferGeometry();
    mesh.setAttribute('position',new T.Float32BufferAttribute(vertices.flatMap(([x,z])=>[x,grade(x,z)+lift,z]),3));
    mesh.computeVertexNormals();m.add(mesh,material);
  }
  const left=-w/2+.7,right=w/2-.7,depth=4.9;
  for(let x=left;x<right;x+=2.5){
    surface(x,front,Math.min(x+2.5,right),edge,.04,asphalt);
    surface(x,front+.45,x+.09,front+depth,.067,paint);
  }
  surface(left,front+.45,right,front+.54,.07,paint);
  surface(right-.09,front+.45,right,front+depth,.07,paint);
}

function plaza(m:Model,w:number,l:number,grade:(x:number,z:number)=>number){
  const grey=finish('#a6afb7'),sand=finish('#baaa95'),green=finish('#55a82b'),dark=finish('#323b42'),metal=finish('#d8dada');
  const h=9.4,back=-l/2,front=l/2-8;
  const start=-28,end=-7.3,depth=4.05;
  const garageWall=w/2-depth;
  for(const [a,b,width] of [[back,end,2*garageWall],[end,front,w]]){
    m.box(0,h/2-.55,(a+b)/2,width,h+1.1,b-a,grey);
    m.box(0,h+.09,(a+b)/2,width,.18,b-a,finish('#dadad3'));
  }
  for(const side of [-1,1]){
    const x=side*w/2;
    for(const [a,b,wallX] of [[back,end,side*garageWall],[end,front,x]]){
      for(let y=1.25;y<h;y+=1.23)m.box(wallX,y,(a+b)/2,.035,.04,b-a,finish('#8b969f'));
    }
    m.box(side*garageWall,6.55,back+7,.14,5.7,14,sand);
    m.box(x,6.55,front-7,.14,5.7,14,sand);
    for(const z of [9,13,16,20,22,26,29]){
      m.box(x,4.75,z,.35,9.5,.55,z===20||z===22?green:z%2?dark:sand);
    }
    for(let j=0;j<12;j++)m.box(x,7.35,-6+j*.95,.42,4.1,.30,sand);
    m.box(x+side*.15,2.25,0,.42,4.5,8,dark);
    m.box(x+side*.4,2,0,.12,3.9,6.9,finish('#65818a'));
    for(const z of [-3.4,0,3.4])m.box(x+side*.49,2,z,.12,4,.12,dark);
    m.box(x,4.9,0,.95,1.1,13,green);
    m.box(x,2.25,6,.95,4.5,.8,green);
    m.box(x,4.95,-6.4,1.18,9.9,1.5,sand);
    // Open the lane toward the market by setting the entry back into the corner bay.
    garage(m,side,w/2,depth,start,end);
  }
  for(const side of [-1,1])m.box(side*(w/2-7),6.55,front,14,5.7,.14,sand);
  m.box(-garageWall+6,6.55,back,12,5.7,.14,sand);
  wordmark(m,'LC Waikiki',-garageWall-.085,8.1,back+7,12,2.35,-Math.PI/2,'#284b9a');
  wordmark(m,'pepco',-garageWall-.10,5.9,back+7,11.5,1.85,-Math.PI/2,'#fff','#27519c');
  wordmark(m,'LC Waikiki',-w/2-.085,8.1,front-7,12,2.35,-Math.PI/2,'#284b9a');
  wordmark(m,'sinsay',-garageWall+5.5,8,back-.10,8.8,2.1,Math.PI,'#fff','#202227');
  wordmark(m,'SPORT REALITY',-garageWall+5.5,6.1,back-.085,6.8,1.18,Math.PI,'#285494');
  wordmark(m,'LC Waikiki',w/2-6.6,8.1,front+.085,11,2.35,0,'#284b9a');
  for(let i=-4;i<=4;i++)m.box(i*1.35,4.8,front,.45,9.6,.35,i%3===0?green:dark);
  for(let i=0;i<5;i++);
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
