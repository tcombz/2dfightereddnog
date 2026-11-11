import Phaser from 'phaser';
import { LocalKeyboard } from './dev/localKeyboard';
import type { InputSource } from './dev/localKeyboard';
import { TouchControls, isTouchDevice } from './dev/touchControls';
import { GameScene, VIEW_HEIGHT, VIEW_WIDTH } from './render/GameScene';

const keyboard = new LocalKeyboard();
const touch = isTouchDevice();
let inputs: InputSource = keyboard;
if (touch) {
  // Phone or tablet: on-screen buttons drive P1 and the computer plays P2.
  document.body.classList.add('touch');
  const pads = new TouchControls(document.body);
  inputs = {
    read: () => {
      const [a, b] = keyboard.read();
      return [a | pads.read(), b];
    },
  };
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: '#1b1f2a',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: new GameScene(inputs, touch),
});
