// Entry: a phone joining a game on the TV gets the light controller page; everything else gets the game.
import '@fontsource/bungee/400.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';

const params = new URLSearchParams(location.search);
const embedded = !!(window as unknown as { claude?: unknown }).claude || window.top !== window.self;
// A touch screen with no mouse or trackpad: a phone or tablet. It can still play here with ?tv=1.
const touchOnly = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

if (params.has('pad') || (touchOnly && !embedded && !params.has('tv') && !params.has('join'))) {
  void import('./phone/app').then((m) => m.startPhone());
} else {
  void import('./game').then((m) => m.startGame());
}
