import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {Point,Road} from './types';
import {Model,finish,canvasMaterial} from './civic-geometry';
import {frontageY,westBridgeY,westCoordinates,westLength,westRoadY} from './west-approach';

function lampHead(){
  const length=.84,drop=.07;
  const body=new RoundedBoxGeometry(.58,.14,length,5,.055);
  const {position,normal}=body.attributes;
  const direction=new T.Vector3();
  for(let i=0;i<position.count;i++){
    const along=position.getZ(i)/length+.5;
    position.setY(i,position.getY(i)-drop*along*along);
    direction.set(normal.getX(i),normal.getY(i),normal.getZ(i)+2*drop*along/length*normal.getY(i)).normalize();
    normal.setXYZ(i,direction.x,direction.y,direction.z);
  }
  return body;
}

function cityShield(){
  return canvasMaterial(256,320,g=>{
    g.fillStyle='#cccac0';g.fillRect(0,0,256,320);
    const shield=new Path2D('M33 17H223V193Q223 262 128 299Q33 262 33 193Z');
    g.fillStyle='#abaea8';g.fill(shield);g.strokeStyle='#515751';g.lineWidth=7;g.stroke(shield);
    g.textAlign='center';g.fillStyle='#3d423e';g.font='bold 25px sans-serif';g.fillText('SANSKI MOST',128,53,174);
    g.fillRect(41,67,174,66);g.fillStyle='#d4d2c7';
    g.fill(new Path2D('M46 124L83 89L112 121L128 111L144 121L177 91L211 124Z'));
    g.fill(new Path2D('M127 117Q125 100 110 103Q101 86 115 88Q122 88 125 98Q115 77 128 70Q141 79 131 98Q138 80 147 90Q153 99 141 104Q135 98 130 117Z'));
    g.fillStyle='#515751';for(const [x,w] of [[44,38],[92,69],[172,39]]){
      g.beginPath();g.moveTo(x,188);g.lineTo(x,155);g.quadraticCurveTo(x+w/2,144,x+w,155);g.lineTo(x+w,187);g.closePath();g.fill();
    }
    g.beginPath();g.moveTo(48,202);g.bezierCurveTo(99,221,145,180,207,199);g.lineWidth=10;g.stroke();
    g.font='bold 24px serif';g.fillText('1244',128,254);
  });
}
export function townBridge(road:Road,west:Road,east:Road,waterY:number,ground:(x:number,z:number)=>number,
  lamp:(x:number,z:number,y:number,head:T.Vector3)=>void){
  const model=new Model(),path=road.points,marks=[0];
  for(let i=1;i<path.length;i++)marks.push(marks[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
  const len=marks.at(-1)!,half=road.width/2,walk=2.1,edge=half+walk;
  const concrete=finish('#aaa99d'),rim=finish('#c8c6b9'),metal=finish('#a4aeae'),asphalt=finish('#999a96');
  const paint=finish('#e7e5d8');
  const smooth=(t:number)=>t*t*(3-2*t);
  const shoreStart=westBridgeY,shoreEnd=-.75;
  const heightAt=(s:number)=>T.MathUtils.lerp(shoreStart,shoreEnd,smooth(s/len))+
    (s<22?.34*Math.sin(Math.PI*s/22)**2:0);
  function crossSection(a:Point,b:Point){
    return new T.Vector2(b[0]-a[0],b[1]-a[1]).normalize();
  }
  function at(s:number,side:number,up:number){
    const i=Math.max(1,marks.findIndex((d,i)=>i>0&&d>=s-1e-6));
    const a=path[i-1],b=path[i],seg=marks[i]-marks[i-1],ux=(b[0]-a[0])/seg,uz=(b[1]-a[1])/seg;
    const direction=new T.Vector2(ux,uz);
    if(i<path.length-1&&s===marks[i]){
      const next=crossSection(b,path[i+1]);
      direction.add(next).multiplyScalar(1/(1+ux*next.x+uz*next.y));
    }
    return new T.Vector3(a[0]+ux*(s-marks[i-1])-direction.y*side,heightAt(s)+up,a[1]+uz*(s-marks[i-1])+direction.x*side);
  }
  function beam(s:number,end:number,offset:number,y:number,w:number,h:number,mat:T.Material){
    model.beam(at(s,offset,y),at(end,offset,y),w,h,mat);
  }
  function ribbon(stations:number[],left:(s:number)=>T.Vector3,right:(s:number)=>T.Vector3,mat:T.Material){
    const vertices:number[]=[],uv:number[]=[],indices:number[]=[];
    stations.forEach((s,i)=>{
      vertices.push(...left(s).toArray(),...right(s).toArray());
      uv.push(0,s,1,s);
      const j=2*i;
      if(i)indices.push(j-2,j,j-1,j-1,j,j+1);
    });
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    model.add(geometry,mat);
  }
  function samples(length:number){
    const steps=Math.ceil(length);
    return Array.from({length:steps+1},(_,i)=>length*i/steps);
  }
  const stations=[...new Set([...marks,...samples(len)])].sort((a,b)=>a-b);
  const deck=(a:number,b:number,ya:number,yb:number,mat:T.Material)=>
    ribbon(stations,s=>at(s,a,ya),s=>at(s,b,yb),mat);
  deck(half,-half,.027,.027,asphalt);
  deck(edge,half,.18,.18,rim);
  deck(-half,-edge,.18,.18,rim);
  deck(half,half,.18,.027,rim);
  deck(-half,-half,.027,.18,rim);
  deck(edge,edge,-.05,.18,rim);
  deck(-edge,-edge,.18,-.05,rim);
  deck(-edge,edge,-1.095,-1.095,concrete);
  deck(edge,edge,-1.095,-.05,concrete);
  deck(-edge,-edge,-.05,-1.095,concrete);

  function approach(r:Road,side:-1|1,length:number){
    const start=side<0?0:len,anchor=at(start,0,0);
    const towardLand=side<0?crossSection(west.points.at(-1)!,west.points.at(-2)!):crossSection(east.points[0],east.points.at(-1)!);
    const joinDirection=side<0?crossSection(path[1],path[0]):crossSection(path.at(-2)!,path.at(-1)!);
    const end=anchor.clone().add(new T.Vector3(towardLand.x*length,0,towardLand.y*length));
    const base=ground(end.x,end.z)+.065;
    function point(s:number,w:number,curb:number){
      const t=s/length,frame=joinDirection.clone().lerp(towardLand,smooth(t)).normalize();
      const shift=joinDirection.clone().lerp(towardLand,smooth(t));
      const x=anchor.x+s*shift.x-frame.y*w,z=anchor.z+s*shift.y+frame.x*w;
      if(side<0){
        const curbBlend=smooth(Math.min(1,(length-s)/5));
        return new T.Vector3(x,westRoadY(length-s)+.027+curb*curbBlend,z);
      }
      const endHeight=ground(end.x-towardLand.y*w,end.z+towardLand.x*w)+.065;
      const profile=T.MathUtils.lerp(heightAt(start)+.027,base,smooth(t));
      const tie=smooth(Math.max(0,(t-.78)/.22));
      return new T.Vector3(x,T.MathUtils.lerp(profile+curb*(1-t),endHeight,tie),z);
    }
    const sequence=samples(length);
    const strip=(a:number,b:number,ha:number,hb:number,m:T.Material)=>
      ribbon(sequence,s=>point(s,a,ha),s=>point(s,b,hb),m);
    strip(half,-half,0,0,asphalt);
    strip(edge,half,.153,.153,rim);
    strip(-half,-edge,.153,.153,rim);
    strip(half,half,.153,0,rim);
    strip(-half,-half,0,.153,rim);
    const baseEdge=(s:number,w:number)=>{
      const p=point(s,w,0);
      p.y=ground(p.x,p.z)-.08;
      return p;
    };
    ribbon(sequence,s=>baseEdge(s,edge),s=>point(s,edge,.153),concrete);
    ribbon(sequence,s=>point(s,-edge,.153),s=>baseEdge(s,-edge),concrete);
    const across=samples(2*edge).map(d=>d-edge);
    ribbon(across,w=>baseEdge(0,w),w=>point(0,w,-1.12),concrete);
    const stairStart=10.4,stairEnd=14.6;
    for(const w of [-edge,edge]){
      const frontage=side<0&&w>0;
      const railLength=frontage?58:side<0?16:10;
      const railPosts=samples(railLength).filter((_,i)=>i%2===0);
      if(frontage){
        railPosts.push(stairStart,stairEnd);
        railPosts.sort((a,b)=>a-b);
      }
      const railPoint=(d:number,h:number)=>point(d,w,.153).add(new T.Vector3(0,h-.18,0));
      railPosts.forEach((d,i)=>{
        if(i===0||(frontage&&d>stairStart&&d<stairEnd))return;
        const material=frontage&&d>8?finish('#60685c'):metal;
        model.beam(railPoint(d,.18),railPoint(d,1.31),.09,.09,material);
        if(frontage&&d===stairEnd)return;
        for(const h of [.39,.61,.83,1.06,1.32]){
          model.beam(railPoint(railPosts[i-1],h),railPoint(d,h),h>1.3?.105:.043,h>1.3?.09:.043,material);
        }
      });
    }
    if(side<0){
      const stairCentre=(stairStart+stairEnd)/2,upper=point(stairCentre,edge,.153).y;
      const steps=Math.ceil((upper-frontageY)/.17),tread=.34,stairWidth=stairEnd-stairStart;
      const yaw=Math.atan2(towardLand.y,-towardLand.x);
      const treadTop=(i:number)=>T.MathUtils.lerp(upper,frontageY,(i+1)/steps);
      for(let i=0;i<steps-1;i++){
        const y=treadTop(i),p=point(stairCentre,edge+(i+.5)*tread,0);
        model.box(p.x,(y+frontageY-.08)/2,p.z,stairWidth,y-frontageY+.08,tread+.012,rim,yaw);
      }
      for(const station of [stairStart+.12,stairEnd-.12]){
        const high=point(station,edge,.153),low=point(station,edge+(steps-1)*tread,0);
        low.y=frontageY;
        const topHigh=high.clone().add(new T.Vector3(0,.85,0)),topLow=low.clone().add(new T.Vector3(0,.85,0));
        for(const [foot,top] of [[high,topHigh],[low,topLow]]){
          model.beam(foot,top,.058,.058,finish('#60685c'));
        }
        model.beam(topHigh,topLow,.064,.064,finish('#60685c'));
      }
      for(let s=1;s<length-3;s+=7){
        if(s<stairEnd&&s+3.4>stairStart)continue;
        const dash=samples(3.4).map(d=>s+d);
        const stripe=(d:number,w:number)=>point(d,w,0).add(new T.Vector3(0,.016,0));
        ribbon(dash,d=>stripe(d,.065),d=>stripe(d,-.065),paint);
      }
      for(let w=-half+.45;w<half-.15;w+=.82){
        const stripe=(s:number,side:number)=>point(s,side,.014);
        ribbon([stairStart+.8,stairEnd-.8],s=>stripe(s,w+.42),s=>stripe(s,w),paint);
      }
    }
    return {id:r.id,height(x:number,z:number){
      if(side<0)return westRoadY(westCoordinates(x,z)[0]);
      const dx=x-anchor.x,dz=z-anchor.z,s=dx*towardLand.x+dz*towardLand.y;
      if(s<0||s>length)return ground(x,z);
      const w=dz*towardLand.x-dx*towardLand.y;
      return point(s,w,0).y-.027;
    }};
  }
  const approaches=[approach(west,-1,westLength),approach(east,1,13.5)];
  for(let s=3;s<len-2;s+=7){
    const dash=samples(Math.min(len-s,3.4)).map(d=>s+d);
    ribbon(dash,d=>at(d,.065,.043),d=>at(d,-.065,.043),paint);
  }
  const platformCentres=[len*.35,len*.65],extent=4.4,extra=1.65;
  const middle=len/2,plaqueHalfWidth=1.05;
  const lampSpacing=len/4;
  for(const sign of [-1,1]){
    const centres=sign<0?platformCentres:[];
    const platformDistance=(s:number)=>Math.min(...centres.map(c=>Math.abs(c-s)));
    const offsets=(s:number)=>edge+extra*Math.max(0,Math.min(1,(extent-platformDistance(s))/1.35));
    const stops=[0,len,...marks];
    for(const s0 of centres){
      for(const s of [s0-extent,s0+extent]){
        model.beam(at(s,sign*(edge-.1),.08),at(s0,sign*(edge+extra-.2),.08),.24,.3,concrete);
      }
      const coords=[at(s0-extent,sign*(edge-.15),0),at(s0-extent+1.35,sign*(edge+extra),0),at(s0+extent-1.35,sign*(edge+extra),0),at(s0+extent,sign*(edge-.15),0)];
      const base=at(s0,0,0).y,shape=new T.Shape(coords.map(p=>new T.Vector2(p.x,-p.z)));
      const slab=new T.ExtrudeGeometry(shape,{depth:.35,bevelEnabled:false});slab.rotateX(-Math.PI/2);
      const pos=slab.attributes.position,centre=at(s0,0,0),forward=at(s0+1,0,0).sub(centre);
      for(let i=0;i<pos.count;i++){
        const s=s0+(pos.getX(i)-centre.x)*forward.x+(pos.getZ(i)-centre.z)*forward.z;
        pos.setY(i,pos.getY(i)+heightAt(s)-base);
      }
      slab.computeVertexNormals();
      model.add(slab,rim,0,base-.18,0);
      stops.push(s0-extent,s0-extent+1.35,s0+extent-1.35,s0+extent);
    }
    if(sign>0)stops.push(middle-plaqueHalfWidth,middle+plaqueHalfWidth);
    for(let s=2;s<len;s+=2.65)stops.push(s);
    const posts=[...new Set(stops)].sort((a,b)=>a-b);
    posts.forEach((s,i)=>{
      if(sign>0&&s>middle-plaqueHalfWidth&&s<middle+plaqueHalfWidth)return;
      const shift=sign*offsets(s);
      model.beam(at(s,shift,.16),at(s,shift,1.31),.09,.09,metal);
      if(i===0||(sign>0&&s===middle+plaqueHalfWidth))return;
      const prev=posts[i-1];
      for(const h of [.39,.61,.83,1.06,1.32]){
        model.beam(at(prev,sign*offsets(prev),h),at(s,shift,h),h>1.3?.105:.043,h>1.3?.09:.043,metal);
      }
    });
    if(sign>0){
      const a=at(middle,edge,.17),front=at(middle,edge-.204,.17);
      const yaw=Math.atan2(front.x-a.x,front.z-a.z);
      model.box(a.x,a.y+.96,a.z,2*plaqueHalfWidth,1.92,.39,concrete,yaw);
      model.add(new T.PlaneGeometry(1.42,1.67),cityShield(),front.x,a.y+1.02,front.z,yaw);
      model.box(a.x,a.y+1.97,a.z,2.23,.13,.48,rim,yaw);
    }
    // Mirror the rows so the two lamps flanking the plaque sit equally far from it.
    for(const index of [-1,0,1]){
      const s=middle+(index+sign*.5)*lampSpacing;
      const offset=offsets(s)-.22;
      const p=at(s,sign*offset,.18);
      const tip=at(s,sign*(offset-1.05),5.535);
      const armStart=new T.Vector3(p.x,tip.y,p.z);
      const yaw=Math.atan2(tip.x-p.x,tip.z-p.z);
      model.beam(armStart,tip,.12,.09,metal);
      
      
    }
    for(let s=5;s<len-2;s+=6.8){
      if(centres.some(c=>s<c+extent&&s+1.2>c-extent))continue;
      if(sign>0&&s<middle+plaqueHalfWidth&&s+1.2>middle-plaqueHalfWidth)continue;
      
      
      for(let k=0;k<4;k++){
        const p=at(s+.16+k*.26,sign*(edge+.21),1.14);
        
      }
    }
  }
  for(let i=1;i<=3;i++){
    const s=len*i/4,p=at(s,0,-.91),q=at(s+.1,0,0),yaw=Math.atan2(q.x-p.x,q.z-p.z);
    const bottom=waterY-2.2,h=p.y-bottom;
    
    
  }
  return {group:model.build(road.id),heightAt,approaches};
}
