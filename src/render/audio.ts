// Music and sound effects. Music loops seamlessly between loop points; volumes are remembered per browser.
import Phaser from 'phaser';

const SFX_URLS = import.meta.glob('../../assets/audio/sfx/*.wav', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const MUSIC_URLS = import.meta.glob('../../assets/audio/music/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const nameOf = (path: string): string => path.split('/').pop()!.replace(/\.\w+$/, '');

export const SFX: Record<string, string> = Object.fromEntries(Object.entries(SFX_URLS).map(([p, u]) => [nameOf(p), u]));
export const MUSIC: Record<string, string> = Object.fromEntries(Object.entries(MUSIC_URLS).map(([p, u]) => [nameOf(p), u]));

/** Loop points in seconds: play to `end`, then jump back to `start`. */
const LOOPS: Record<string, { start: number; end: number }> = {
  menu: { start: 51.688, end: 148.704 },
  concert: { start: 43.909, end: 128.811 },
  rooftop: { start: 48.089, end: 155.088 },
  alley: { start: 52.082, end: 152.844 },
  embassy: { start: 55.124, end: 148.599 },
  crown: { start: 50.55, end: 152.455 },
  fortress: { start: 46.347, end: 128.182 },
  helipad: { start: 49.459, end: 148.69 },
};

interface Settings {
  music: number;
  sfx: number;
  /** The announcer's voice (the browser's speech voice). */
  voice: boolean;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('afterhours.audio');
    if (raw) return { music: 0.55, sfx: 0.8, voice: true, ...JSON.parse(raw) };
  } catch {
    // Storage blocked: use defaults.
  }
  return { music: 0.55, sfx: 0.8, voice: true };
}

export const settings: Settings = loadSettings();

export function saveSettings(): void {
  try {
    localStorage.setItem('afterhours.audio', JSON.stringify(settings));
  } catch {
    // Not saved; the setting still applies for this visit.
  }
}

/** Queue every sound effect and the menu music on a scene's loader. */
export function preloadAudio(scene: Phaser.Scene): void {
  for (const [name, url] of Object.entries(SFX)) scene.load.audio(`sfx_${name}`, url);
  if (MUSIC.menu) scene.load.audio('music_menu', MUSIC.menu);
}

/** Make sure a track is loaded, then call `done` (immediately if it already is). */
export function ensureMusic(scene: Phaser.Scene, name: string, done: () => void): void {
  const key = `music_${name}`;
  if (scene.cache.audio.exists(key) || !MUSIC[name]) {
    done();
    return;
  }
  scene.load.audio(key, MUSIC[name]);
  scene.load.once(Phaser.Loader.Events.COMPLETE, done);
  scene.load.start();
}

let current: Phaser.Sound.BaseSound | null = null;
let currentName = '';

export function playMusic(scene: Phaser.Scene, name: string): void {
  if (currentName === name && current?.isPlaying) return;
  stopMusic(scene);
  const key = `music_${name}`;
  if (!scene.cache.audio.exists(key)) return;
  const snd = scene.sound.add(key, { volume: settings.music });
  const loop = LOOPS[name];
  if (loop) {
    snd.addMarker({ name: 'intro', start: 0, duration: loop.end, config: { volume: settings.music } });
    snd.addMarker({ name: 'loop', start: loop.start, duration: loop.end - loop.start, config: { volume: settings.music, loop: true } });
    snd.once(Phaser.Sound.Events.COMPLETE, () => {
      if (current === snd) snd.play('loop');
    });
    snd.play('intro');
  } else {
    snd.play({ loop: true });
  }
  current = snd;
  currentName = name;
}

export function stopMusic(scene: Phaser.Scene, fadeMs = 0): void {
  const old = current;
  current = null;
  currentName = '';
  if (!old) return;
  if (fadeMs > 0) {
    scene.tweens.add({ targets: old, volume: 0, duration: fadeMs, onComplete: () => old.destroy() });
  } else {
    old.destroy();
  }
}

export function setMusicVolume(v: number): void {
  settings.music = Math.max(0, Math.min(1, v));
  if (current) (current as Phaser.Sound.WebAudioSound).setVolume(settings.music);
  saveSettings();
}

export function setSfxVolume(v: number): void {
  settings.sfx = Math.max(0, Math.min(1, v));
  saveSettings();
}

export function sfx(scene: Phaser.Scene, name: string, volume = 1, detune = 0): void {
  const key = `sfx_${name}`;
  if (settings.sfx <= 0 || !scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume: settings.sfx * volume, detune });
}

export function setVoice(on: boolean): void {
  settings.voice = on;
  saveSettings();
  if (!on) window.speechSynthesis?.cancel();
}

// ---------- the announcer ----------

let voice: SpeechSynthesisVoice | null | undefined;

/** A deep, clear English voice if the browser has one. */
function pickVoice(): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis?.getVoices() ?? [];
  const en = all.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const prefer = ['Google UK English Male', 'Daniel', 'Microsoft Guy', 'Microsoft David', 'Alex', 'Fred', 'Male'];
  for (const name of prefer) {
    const v = en.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return en[0] ?? null;
}

/** The announcer calls something out (cutting off whatever it was saying). */
export function announce(text: string, urgent = true): void {
  const synth = window.speechSynthesis;
  if (!settings.voice || !synth || !text || settings.sfx <= 0) return;
  try {
    if (voice === undefined || voice === null) voice = pickVoice();
    if (urgent) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 1.0;
    u.pitch = 0.5;
    u.volume = Math.min(1, settings.sfx * 1.15);
    synth.speak(u);
  } catch {
    // No speech in this browser: the banners still show.
  }
}
