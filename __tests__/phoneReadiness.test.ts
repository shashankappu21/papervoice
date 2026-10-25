import { describe, expect, it } from 'vitest';
import { ensureReady, voicesToPrefetch, VoiceNotReadyError } from '../src/voices/phoneReadiness';
import { phoneAudioFolders } from '../src/tts/audioCache';

/** A pretend engine: ready after `fetch` plus `afterChecks` more checks, or never. */
function engine(options: { ready?: boolean; afterChecks?: number }) {
  let checks = 0;
  let fetched = 0;
  let clock = 0;
  const events: string[] = [];
  return {
    events,
    get fetched() {
      return fetched;
    },
    deps: {
      isReady: async () => {
        if (options.ready) return true;
        if (fetched === 0 || options.afterChecks === undefined) return false;
        checks += 1;
        return checks > options.afterChecks;
      },
      fetch: async () => {
        fetched += 1;
      },
      sleep: async (ms: number) => {
        clock += ms;
      },
      now: () => clock,
      onWaiting: (id: string) => events.push(`waiting ${id}`),
      onReady: (id: string) => events.push(`ready ${id}`),
    },
  };
}

describe('making sure a phone voice is really there before it speaks', () => {
  it('goes straight ahead with an installed voice, and fetches nothing', async () => {
    const phone = engine({ ready: true });
    await expect(ensureReady('en-gb-x-gbb-local', phone.deps)).resolves.toBe('ready');
    expect(phone.fetched).toBe(0);
    expect(phone.events).toEqual([]);
  });

  it('starts the download of one that is not, says so, and waits until it is in', async () => {
    const phone = engine({ afterChecks: 3 });
    await expect(ensureReady('en-ng-x-tfn-local', phone.deps)).resolves.toBe('downloaded');
    expect(phone.fetched).toBe(1);
    expect(phone.events).toEqual(['waiting en-ng-x-tfn-local', 'ready en-ng-x-tfn-local']);
  });

  it('gives up with a reason it can show, rather than speaking in another voice', async () => {
    const phone = engine({});
    await expect(ensureReady('en-ng-x-tfn-local', phone.deps)).rejects.toBeInstanceOf(VoiceNotReadyError);
    await expect(ensureReady('en-ng-x-tfn-local', engine({}).deps)).rejects.toThrow(/Wi-Fi/);
  });
});

describe('which voice packs to fetch ahead of time', () => {
  const named = {
    'en-gb-x-gbb-local': { name: 'Oliver', gender: 'male' as const, description: '', featured: true },
    'en-gb-x-gbd-local': { name: 'Arthur', gender: 'male' as const, description: '', featured: true },
    'en-au-x-aub-local': { name: 'Jack', gender: 'male' as const, description: '', featured: true },
  };

  it('one voice per missing language, only for voices we name', () => {
    const voices = [
      { id: 'en-gb-x-gbd-local', locale: 'en-GB', notInstalled: true },
      { id: 'en-gb-x-gbb-local', locale: 'en-GB', notInstalled: true },
      { id: 'en-au-x-aub-local', locale: 'en-AU', notInstalled: false },
      { id: 'en-ng-x-tfn-local', locale: 'en-NG', notInstalled: true },
      { id: 'en-GB-language', locale: 'en-GB', notInstalled: true },
    ];
    // A pack holds a whole language, so fetching one of its voices fetches them all.
    expect(voicesToPrefetch(voices, named)).toEqual(['en-gb-x-gbb-local']);
  });

  it('nothing when everything named is already on the phone', () => {
    expect(voicesToPrefetch([{ id: 'en-gb-x-gbb-local', locale: 'en-GB', notInstalled: false }], named)).toEqual([]);
  });
});

describe('audio made with the phone voices', () => {
  it('finds every phone voice folder, in every book, and nothing else', () => {
    const tree: Record<string, string[]> = {
      'root/': ['1', '7'],
      'root/1/': ['system_en-ng-x-tfn-local', 'ljspeech-medium'],
      'root/7/': ['system_en-gb-x-gbb-local'],
    };
    expect(phoneAudioFolders('root/', (path) => tree[path] ?? [])).toEqual([
      'root/1/system_en-ng-x-tfn-local',
      'root/7/system_en-gb-x-gbb-local',
    ]);
  });
});
