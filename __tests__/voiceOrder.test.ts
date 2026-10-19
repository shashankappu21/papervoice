import { describe, expect, it } from 'vitest';
import { isLanguageAlias, labelPhoneVoices, orderCatalog, VOICE_ORDER } from '../src/voices/order';
import { OFFERED_VOICES } from '../src/voices/catalog';
import { PHONE_VOICE_NAMES } from '../src/voices/phoneVoiceNames';

describe('the order of downloadable voices', () => {
  const voices = [
    { id: 'manyvoice-7', name: 'James' },
    { id: 'en_GB-cori-medium', name: 'Cori' },
    { id: 'manyvoice-1', name: 'Kara' },
    { id: 'ljspeech-medium', name: 'Lyra' },
    { id: 'en_US-kristin-medium', name: 'Kristin' },
    { id: 'manyvoice-4', name: 'Mike' },
  ];

  it('follows the one fixed list: Lyra, Kristin and Cori first', () => {
    expect(orderCatalog(voices).map((v) => v.name)).toEqual([
      'Lyra',
      'Kristin',
      'Cori',
      'Mike',
      'James',
      'Kara',
    ]);
  });

  it('puts anything the list does not name after it, A to Z', () => {
    const extra = [...voices, { id: 'new-b', name: 'Bea' }, { id: 'new-a', name: 'Abe' }];
    expect(orderCatalog(extra).slice(-2).map((v) => v.name)).toEqual(['Abe', 'Bea']);
  });

  it('does not depend on what is installed or the order it came in', () => {
    expect(orderCatalog([...voices].reverse())).toEqual(orderCatalog(voices));
  });

  it('keeps the order through a filter', () => {
    const us = voices.filter((v) => v.id !== 'en_GB-cori-medium');
    expect(orderCatalog(us).map((v) => v.name)).toEqual(['Lyra', 'Kristin', 'Mike', 'James', 'Kara']);
  });

  it('every offered voice and every featured phone voice is in the list, once', () => {
    const missing = [
      ...OFFERED_VOICES.map((v) => v.id),
      ...Object.entries(PHONE_VOICE_NAMES)
        .filter(([, name]) => name.featured)
        .map(([id]) => `system:${id}`),
    ].filter((id) => !VOICE_ORDER.includes(id));
    expect(missing).toEqual([]);
    expect(new Set(VOICE_ORDER).size).toBe(VOICE_ORDER.length);
  });

  const regionOf = (id: string) => {
    const natural = OFFERED_VOICES.find((v) => v.id === id);
    if (natural) return natural.accent;
    return id.split('-')[1].toUpperCase();
  };
  const genderOf = (id: string) =>
    OFFERED_VOICES.find((v) => v.id === id)?.gender ?? PHONE_VOICE_NAMES[id.replace('system:', '')]?.gender;

  it('opens with eight of the best, across the US, UK and Australian accents and both genders', () => {
    const top = VOICE_ORDER.slice(0, 8);
    expect(top.slice(0, 3)).toEqual(['ljspeech-medium', 'en_US-kristin-medium', 'en_GB-cori-medium']);
    expect(new Set(top.map(regionOf))).toEqual(new Set(['US', 'GB', 'AU']));
    const genders = top.slice(3).map(genderOf);
    for (let i = 1; i < genders.length; i++) expect(genders[i]).not.toBe(genders[i - 1]);
  });

  it('then the rest by accent -- US alternating men and women, UK, AU -- and India last', () => {
    const rest = VOICE_ORDER.slice(8);
    const regions = rest.map(regionOf);
    const lastOf = (r: string) => regions.lastIndexOf(r);
    const firstOf = (r: string) => regions.indexOf(r);
    expect(lastOf('US')).toBeLessThan(firstOf('GB'));
    expect(lastOf('GB')).toBeLessThan(firstOf('AU'));
    expect(regions[regions.length - 1]).toBe('IN');
    expect(VOICE_ORDER.slice(0, 8).map(regionOf)).not.toContain('IN');
    const us = rest.filter((id) => regionOf(id) === 'US').map(genderOf);
    for (let i = 1; i < us.length; i++) expect(us[i]).not.toBe(us[i - 1]);
  });
});

describe('phone voice names', () => {
  const phone = [
    { id: 'en-us-x-tpf-local', locale: 'en-US' },
    { id: 'en-gb-x-rjs-local', locale: 'en-GB' },
    { id: 'en-us-x-iol-local', locale: 'en-US' },
    { id: 'en-us-x-sfg-local', locale: 'en-US' },
    { id: 'en-in-x-ahp-local', locale: 'en-IN' },
  ];
  const names = {
    'en-us-x-sfg-local': { name: 'Sophie', gender: 'female' as const, description: 'Bright and lively', featured: true },
    'en-gb-x-rjs-local': { name: 'Oliver', gender: 'male' as const, description: 'Deep and even' },
  };

  it('uses the name we gave, with accent and gender, and says it is a phone voice', () => {
    const labelled = labelPhoneVoices(phone, names);
    expect(labelled[0]).toMatchObject({ label: 'Oliver', detail: 'UK · male · phone voice' });
    expect(labelled[1]).toMatchObject({ label: 'Sophie', detail: 'US · female · phone voice' });
  });

  it('numbers the rest within their accent, in a stable order', () => {
    const rest = labelPhoneVoices(phone, names).slice(2);
    expect(rest.map((v) => v.label)).toEqual([
      'Indian English · voice 1',
      'US English · voice 1',
      'US English · voice 2',
    ]);
    expect(rest.map((v) => v.voice.id)).toEqual([
      'en-in-x-ahp-local',
      'en-us-x-iol-local',
      'en-us-x-tpf-local',
    ]);
    expect(rest.every((v) => v.detail === 'phone voice')).toBe(true);
  });

  it('gives the same names whatever order the phone lists them in', () => {
    expect(labelPhoneVoices([...phone].reverse(), names)).toEqual(labelPhoneVoices(phone, names));
  });
});

describe("Google's per-language aliases", () => {
  it('recognises the alias form and nothing else', () => {
    expect(isLanguageAlias('en-US-language')).toBe(true);
    expect(isLanguageAlias('en-AU-language')).toBe(true);
    expect(isLanguageAlias('en-us-x-iob-local')).toBe(false);
    expect(isLanguageAlias('en-US')).toBe(false);
    expect(isLanguageAlias('en-us-language')).toBe(false);
  });

  it('are left out of the list, and the rest numbered from 1', () => {
    const labelled = labelPhoneVoices(
      [
        { id: 'en-US-language', locale: 'en-US' },
        { id: 'en-us-x-iog-local', locale: 'en-US' },
        { id: 'en-us-x-iol-local', locale: 'en-US' },
      ],
      {},
    );
    expect(labelled.map((v) => [v.voice.id, v.label])).toEqual([
      ['en-us-x-iog-local', 'US English · voice 1'],
      ['en-us-x-iol-local', 'US English · voice 2'],
    ]);
  });
});

describe('what a phone voice carries', () => {
  const phone = [
    { id: 'en-au-x-aub-local', locale: 'en-AU' },
    { id: 'en-in-x-end-local', locale: 'en-IN' },
  ];
  const names = {
    'en-au-x-aub-local': { name: 'Jack', gender: 'male' as const, description: 'Light and even', featured: true },
  };

  it('a named one: its description, whether it is featured, gender and region', () => {
    expect(labelPhoneVoices(phone, names)[0]).toMatchObject({
      label: 'Jack',
      description: 'Light and even',
      featured: true,
      gender: 'male',
      region: 'AU',
    });
  });

  it('a numbered one: region, not featured, no description or gender', () => {
    const numbered = labelPhoneVoices(phone, names)[1];
    expect(numbered).toMatchObject({ region: 'IN', featured: false });
    expect(numbered.description).toBeUndefined();
    expect(numbered.gender).toBeUndefined();
  });
});
