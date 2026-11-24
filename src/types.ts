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
export function rng(seed: number) {
  return () => {seed=(Math.imul(1664525,seed)+1013904223)>>>0; return seed/4294967296};
}

