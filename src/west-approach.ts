import {Point} from './types';

const origin:Point=[-208.77,216.37],dx=71.11,dz=-16.6;
export const westLength=Math.hypot(dx,dz);
const ux=dx/westLength,uz=dz/westLength;
export const westBridgeY=2.35;
export const frontageY=.64;

export function westCoordinates(x:number,z:number){
  const a=x-origin[0],b=z-origin[1];
  return [a*ux+b*uz,b*ux-a*uz] as const;
}

export function westPoint(s:number,w:number):Point{
  return [origin[0]+s*ux-w*uz,origin[1]+s*uz+w*ux];
}

export function westRoadY(s:number){
  // Ease the last few metres into the crown at the bridge entrance.
  const ease=8,station=Math.min(westLength,Math.max(-24,s)),remaining=westLength-station;
  const distance=remaining<ease?westLength-ease/2-remaining*remaining/(2*ease):station;
  return .91+(westBridgeY-.91)*distance/(westLength-ease/2);
}

const smooth=(t:number)=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u)};

export function gradeWestBank(x:number,z:number,original:number){
  const [s,w]=westCoordinates(x,z);
  if(s< -61||s>83||w< -39||w>27)return original;
  const roadWeight=smooth((s+61)/17)*smooth((82-s)/13)*smooth((27-w)/12)*smooth((w+26)/13);
  const road=original+(westRoadY(s)-.024-original)*roadWeight;
  const frontageWeight=smooth((s+41)/9)*smooth((72-s)/6)*smooth((-.8-w)/3.25)*smooth((w+39)/9);
  return road+(frontageY-.15-road)*frontageWeight;
}

export function terrainAxis(min:number,max:number,detailStart:number,detailEnd:number){
  const coordinates=[min];
  for(let p=min;p<max;p+=9){
    const divisions=p>=detailStart&&p<detailEnd?6:1;
    for(let j=1;j<=divisions;j++)coordinates.push(p+9*j/divisions);
  }
  return coordinates;
}
