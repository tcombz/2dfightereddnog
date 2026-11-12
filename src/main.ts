import '@fontsource/bungee/400.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from './render/config';
import { BootScene } from './render/scenes/BootScene';
import { ControllerScene } from './render/scenes/ControllerScene';
import { FightScene } from './render/scenes/FightScene';
import { HowToScene } from './render/scenes/HowToScene';
import { PartyScene } from './render/scenes/PartyScene';
import { ResultScene } from './render/scenes/ResultScene';
import { SelectScene } from './render/scenes/SelectScene';
import { TitleScene } from './render/scenes/TitleScene';
import { VersusScene } from './render/scenes/VersusScene';
import { OnlineScene } from './render/scenes/OnlineScene';
import { ReplaysScene } from './render/scenes/ReplaysScene';
import { SettingsScene } from './render/scenes/SettingsScene';

async function start(): Promise<void> {
  // Text is drawn to canvases, so the web fonts must be ready before the first scene draws any.
  try {
    await Promise.all([document.fonts.load('40px "Bungee"'), document.fonts.load('600 16px "Chakra Petch"')]);
  } catch {
    // Fallback fonts are fine.
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#070912',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { gamepad: false },
    scene: [BootScene, TitleScene, SelectScene, VersusScene, FightScene, ResultScene, HowToScene, ControllerScene, PartyScene, OnlineScene, ReplaysScene, SettingsScene],
  });
  // Exposed for automated play-testing.
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

void start();
