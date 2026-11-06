// What the rest timer does when the time is up: two beeps and/or a vibration.
// Browsers only let a page play sound after a tap, so the audio is "unlocked" when ✓ is pressed.
import type { RestAlerts } from '../../data/restSettings';

let audio: AudioContext | null = null;

/** Call from a tap handler (✓): creates or resumes the audio context. Silent if unsupported. */
export function unlockAudio(): void {
  if (typeof AudioContext === 'undefined') return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    // No audio on this device: the timer still works, without sound.
  }
}

const BEEP_HZ = 880;
const BEEP_SECONDS = 0.16;
const BEEP_GAP_SECONDS = 0.22;
const BEEPS = 2;

function beeps(): void {
  if (!audio) return;
  try {
    const start = audio.currentTime;
    for (let i = 0; i < BEEPS; i += 1) {
      const at = start + i * BEEP_GAP_SECONDS;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = BEEP_HZ;
      gain.gain.setValueAtTime(0.3, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + BEEP_SECONDS);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + BEEP_SECONDS);
    }
  } catch {
    // Ignore: a failed beep must never break the screen.
  }
}

const VIBRATION_PATTERN = [250, 120, 250];

function vibrate(): void {
  if (!('vibrate' in navigator)) return;
  try {
    navigator.vibrate(VIBRATION_PATTERN);
  } catch {
    // Ignore: vibration is optional.
  }
}

/** Plays what the device settings ask for. */
export function alertRestEnd({ sound, vibration }: RestAlerts): void {
  if (sound) beeps();
  if (vibration) vibrate();
}
