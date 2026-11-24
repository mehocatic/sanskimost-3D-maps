export type Point = [number, number];
export type Tags = Record<string, string>;
export interface Feature {
  id: string;
  name?: string;
  kind: string;
  points: Point[];
  holes?: Point[][];
  tags: Tags;
}
export interface Building extends Feature {height: number; heightSource: string}
export interface Road extends Feature {width: number; bridge: boolean}
export interface Poi {id: string; name: string; kind: string; x: number; z: number; tags: Tags}
export interface City {
  meta: {center: Point; bounds: [number,number,number,number]};
  areas: Feature[]; buildings: Building[]; roads: Road[]; waterways: Road[];
  pois: Poi[]; trees: Point[]; lamps: Point[];
}
export interface Terrain {
  cols: number; rows: number; x0: number; z0: number; step: number;
  heights: number[]; baseElevation: number; attribution: string;
}
export interface Place {
  id: string; name: string; category: string; icon: string; art?: string; pos: Point;
  description?: string; height?: number; heightSource?: string; tags?: Tags;
}
export function centerOf(points: Point[]): Point {
  const bounds = points.reduce((b,[x,z])=>[Math.min(b[0],x),Math.min(b[1],z),Math.max(b[2],x),Math.max(b[3],z)], [Infinity,Infinity,-Infinity,-Infinity]);
  return [(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2];
}
export function sampleTerrain(t: Terrain, x: number, z: number) {
  const u=Math.max(0,Math.min(t.cols-1.001,(x-t.x0)/t.step));
  const v=Math.max(0,Math.min(t.rows-1.001,(z-t.z0)/t.step));
  const i=Math.floor(u), j=Math.floor(v), a=u-i, b=v-j, k=j*t.cols+i, h=t.heights;
  return (h[k]*(1-a)+h[k+1]*a)*(1-b)+(h[k+t.cols]*(1-a)+h[k+t.cols+1]*a)*b-t.baseElevation;
}
export function rng(seed: number) {
  return () => {seed=(Math.imul(1664525,seed)+1013904223)>>>0; return seed/4294967296};
}

