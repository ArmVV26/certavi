import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AlertsModule = typeof import('./restAlerts');

/** The module keeps the audio context between calls, so each test loads a fresh copy. */
async function loadModule(): Promise<AlertsModule> {
  vi.resetModules();
  return import('./restAlerts');
}

interface FakeAudio {
  state: 'running' | 'suspended';
  currentTime: number;
  resume: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  destination: object;
}

function stubAudio(state: FakeAudio['state'] = 'running') {
  const instances: FakeAudio[] = [];
  class FakeAudioContext implements FakeAudio {
    state = state;
    currentTime = 10;
    destination = {};
    resume = vi.fn(() => Promise.resolve());
    createOscillator = vi.fn(() => ({
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }));
    createGain = vi.fn(() => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }));
    constructor() {
      instances.push(this);
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return instances;
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'vibrate');
});

describe('alertRestEnd', () => {
  it('plays two beeps when sound is on, after the audio was unlocked', async () => {
    const instances = stubAudio();
    const { unlockAudio, alertRestEnd } = await loadModule();
    unlockAudio();
    alertRestEnd({ sound: true, vibration: false });
    expect(instances).toHaveLength(1);
    expect(instances[0]?.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('plays nothing when sound is off', async () => {
    const instances = stubAudio();
    const { unlockAudio, alertRestEnd } = await loadModule();
    unlockAudio();
    alertRestEnd({ sound: false, vibration: false });
    expect(instances[0]?.createOscillator).not.toHaveBeenCalled();
  });

  it('plays nothing if the audio was never unlocked by a tap', async () => {
    const instances = stubAudio();
    const { alertRestEnd } = await loadModule();
    alertRestEnd({ sound: true, vibration: false });
    expect(instances).toHaveLength(0);
  });

  it('vibrates when vibration is on, and not when it is off', async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const { alertRestEnd } = await loadModule();
    alertRestEnd({ sound: false, vibration: false });
    expect(vibrate).not.toHaveBeenCalled();
    alertRestEnd({ sound: false, vibration: true });
    expect(vibrate).toHaveBeenCalledWith([250, 120, 250]);
  });

  it('does not fail where there is no AudioContext or vibration', async () => {
    const { unlockAudio, alertRestEnd } = await loadModule();
    expect(() => {
      unlockAudio();
      alertRestEnd({ sound: true, vibration: true });
    }).not.toThrow();
  });

  it('survives an audio context or a vibration that throw', async () => {
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function broken() {
        throw new Error('no audio');
      }),
    );
    Object.defineProperty(navigator, 'vibrate', {
      value: () => {
        throw new Error('no vibration');
      },
      configurable: true,
    });
    const { unlockAudio, alertRestEnd } = await loadModule();
    expect(() => {
      unlockAudio();
      alertRestEnd({ sound: true, vibration: true });
    }).not.toThrow();
  });

  it('survives beeps that fail after the context exists', async () => {
    const instances = stubAudio();
    const { unlockAudio, alertRestEnd } = await loadModule();
    unlockAudio();
    instances[0]?.createOscillator.mockImplementation(() => {
      throw new Error('broken');
    });
    expect(() => {
      alertRestEnd({ sound: true, vibration: false });
    }).not.toThrow();
  });
});

describe('unlockAudio', () => {
  it('resumes a suspended context and creates only one', async () => {
    const instances = stubAudio('suspended');
    const { unlockAudio } = await loadModule();
    unlockAudio();
    unlockAudio();
    expect(instances).toHaveLength(1);
    expect(instances[0]?.resume).toHaveBeenCalledTimes(2);
  });
});
