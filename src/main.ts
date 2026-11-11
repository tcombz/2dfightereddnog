import Phaser from 'phaser';
import { LocalKeyboard } from './dev/localKeyboard';
import { GameScene, VIEW_HEIGHT, VIEW_WIDTH } from './render/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: '#1b1f2a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: new GameScene(new LocalKeyboard()),
});
