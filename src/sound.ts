import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { CLICK_SOUND } from './config';

const POOL_SIZE = 4;
const pools = new Map<any, { players: AudioPlayer[]; index: number }>();
let audioModeReady = false;
// Browsers reject playback before the first user gesture, and the stick makes
// noise on its own (it drops and bounces), so stay silent until first touch.
let unlocked = Platform.OS !== 'web';

export function unlockAudio() {
  unlocked = true;
}

async function ensureAudioMode() {
  if (audioModeReady) return;
  audioModeReady = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
  } catch {
    // no-op on platforms/environments where this isn't supported
  }
}

function getPool(source: any) {
  let pool = pools.get(source);
  if (!pool) {
    const players = Array.from({ length: POOL_SIZE }, () => createAudioPlayer(source));
    pool = { players, index: 0 };
    pools.set(source, pool);
  }
  return pool;
}

export function playSwingSound(source: any, volume: number, rate: number) {
  if (!unlocked) return;
  ensureAudioMode();
  const pool = getPool(source);
  const player = pool.players[pool.index];
  pool.index = (pool.index + 1) % pool.players.length;
  try {
    player.volume = Math.max(0, Math.min(1, volume));
    player.setPlaybackRate(Math.max(0.5, Math.min(2, rate)), 'medium' as any);
    player.seekTo(0);
    player.play();
  } catch {
    // ignore playback errors (e.g. web autoplay restrictions before first gesture)
  }
}

let clickPlayer: AudioPlayer | null = null;
export function playClickSound() {
  unlocked = true;
  ensureAudioMode();
  try {
    if (!clickPlayer) clickPlayer = createAudioPlayer(CLICK_SOUND);
    clickPlayer.volume = Platform.OS === 'web' ? 0.5 : 0.7;
    clickPlayer.seekTo(0);
    clickPlayer.play();
  } catch {
    // ignore
  }
}
