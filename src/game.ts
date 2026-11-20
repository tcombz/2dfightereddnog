// The game on the big screen: Phaser and every scene.
import Phaser from 'phaser';
import { phones } from './input/phones';
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
import { PhonesScene } from './render/scenes/PhonesScene';
import { BracketScene } from './render/scenes/BracketScene';

export async function startGame(): Promise<void> {
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
    scene: [BootScene, TitleScene, SelectScene, VersusScene, FightScene, ResultScene, HowToScene, ControllerScene, PartyScene, OnlineScene, ReplaysScene, SettingsScene, PhonesScene, BracketScene],
  });
  phones.attach(game);
  showCrashes();
  // Exposed for automated play-testing.
  (window as unknown as { __game: Phaser.Game; __phones: typeof phones }).__game = game;
  (window as unknown as { __phones: typeof phones }).__phones = phones;
}

/**
 * If something breaks, say so on screen (the game would otherwise just freeze), with the error
 * text to pass on, and a way back.
 */
function showCrashes(): void {
  let box: HTMLDivElement | null = null;
  const show = (msg: string): void => {
    if (box) return;
    box = document.createElement('div');
    box.style.cssText =
      'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);max-width:min(560px,90vw);padding:18px 20px;' +
      'background:#0b0e1c;color:#f3f1ff;border:2px solid #ff6a3d;border-radius:12px;font:15px system-ui,sans-serif;z-index:20;text-align:center';
    const title = document.createElement('div');
    title.textContent = 'Something went wrong';
    title.style.cssText = 'font-weight:700;font-size:18px;margin-bottom:8px';
    const detail = document.createElement('div');
    detail.textContent = msg.slice(0, 300);
    detail.style.cssText = 'opacity:0.75;font-size:13px;margin-bottom:12px;word-break:break-word';
    const btn = document.createElement('button');
    btn.textContent = 'Reload the game';
    btn.style.cssText = 'padding:8px 16px;border-radius:8px;border:0;background:#ffc23d;color:#120c02;font-weight:700;cursor:pointer';
    btn.onclick = () => location.reload();
    box.append(title, detail, btn);
    document.body.appendChild(box);
  };
  window.addEventListener('error', (e) => show(`${e.message}${e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''}`));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string } | undefined;
    // Network refusals from the matchmaking service are handled where they happen.
    if (r?.message && /peer|websocket|network|fetch/i.test(r.message)) return;
    show(String(r?.message ?? r));
  });
}

