import alley from '../../assets/stages/alley.png';
import concert from '../../assets/stages/concert.png';
import rooftop from '../../assets/stages/rooftop.png';

export type Ambient = 'storm' | 'concert' | 'rain';

export interface StageDef {
  id: string;
  name: string;
  place: string;
  url: string;
  /** Source-pixel row the fighters' feet stand on (the art is drawn at 2x). */
  groundSrcY: number;
  music: string;
  ambient: Ambient;
  /** Multiplied into the fighters so they sit in the stage's light. */
  tint: number;
  /** Source-pixel rects for animated details. */
  neon?: { x: number; y: number; w: number; h: number; color: number };
  crowd?: { y: number; h: number };
  steam?: { x: number; y: number };
}

export const STAGES: StageDef[] = [
  {
    id: 'rooftop',
    name: 'ROOFTOP',
    place: 'Downtown, 2 a.m.',
    url: rooftop,
    groundSrcY: 290,
    music: 'rooftop',
    ambient: 'storm',
    tint: 0xdde4ff,
    neon: { x: 560, y: 2, w: 130, h: 98, color: 0x3d9bff },
  },
  {
    id: 'concert',
    name: 'MAIN STAGE',
    place: 'Sold out, encore pending',
    url: concert,
    groundSrcY: 284,
    music: 'concert',
    ambient: 'concert',
    tint: 0xfff0e8,
    crowd: { y: 168, h: 82 },
  },
  {
    id: 'alley',
    name: 'BACK ALLEY',
    place: 'Rain all night',
    url: alley,
    groundSrcY: 292,
    music: 'alley',
    ambient: 'rain',
    tint: 0xe9e2ff,
    steam: { x: 150, y: 250 },
  },
];
