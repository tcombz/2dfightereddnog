import alley from '../../assets/stages/alley.png';
import concert from '../../assets/stages/concert.png';
import crown from '../../assets/stages/crown.png';
import embassy from '../../assets/stages/embassy.png';
import fortress from '../../assets/stages/fortress.png';
import helipad from '../../assets/stages/helipad.png';
import penthouse from '../../assets/stages/penthouse.png';
import rooftop from '../../assets/stages/rooftop.png';

export type Ambient = 'storm' | 'concert' | 'rain' | 'smoke' | 'embers';

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
  /** A soft pulsing glow (lamps, the globe). */
  glow?: { x: number; y: number; r: number; color: number };
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
    groundSrcY: 290,
    music: 'alley',
    ambient: 'rain',
    tint: 0xe9e2ff,
    steam: { x: 150, y: 250 },
  },
  {
    id: 'embassy',
    name: 'MAP ROOM',
    place: 'Late-night negotiations',
    url: embassy,
    groundSrcY: 290,
    music: 'embassy',
    ambient: 'smoke',
    tint: 0xfff0e2,
    glow: { x: 236, y: 205, r: 60, color: 0xffc860 },
  },
  {
    id: 'crown',
    name: 'THE TERRACE',
    place: 'Sunset over the capital',
    url: crown,
    groundSrcY: 292,
    music: 'crown',
    ambient: 'embers',
    tint: 0xffe6d2,
    glow: { x: 452, y: 196, r: 70, color: 0xffa040 },
  },
  {
    id: 'fortress',
    name: 'THE FORTRESS',
    place: 'Ruins under a green storm',
    url: fortress,
    groundSrcY: 292,
    music: 'fortress',
    ambient: 'embers',
    tint: 0xf2ffe8,
    glow: { x: 104, y: 192, r: 46, color: 0xffb040 },
  },
  {
    id: 'helipad',
    name: 'THE HELIPAD',
    place: 'Command post over the city',
    url: helipad,
    groundSrcY: 292,
    music: 'helipad',
    ambient: 'storm',
    tint: 0xe8f0ff,
    glow: { x: 478, y: 118, r: 40, color: 0x8fd0ff },
  },
  {
    id: 'penthouse',
    name: 'THE PENTHOUSE',
    place: 'Gamer loft above the city',
    url: penthouse,
    groundSrcY: 298,
    music: 'penthouse',
    ambient: 'smoke',
    tint: 0xf4ecff,
    glow: { x: 210, y: 180, r: 46, color: 0xb070ff },
  },
];
