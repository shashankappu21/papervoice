import { describe, expect, it } from 'vitest';
import { OFFERED_VOICES } from '../src/voices/catalog';
import { mainList, regionLabel, regionsIn } from '../src/voices/listing';
import { labelPhoneVoices } from '../src/voices/order';

const systemId = (voice: { id: string }) => `system:${voice.id}`;

const natural = OFFERED_VOICES.filter((voice) =>
  ['ljspeech-medium', 'en_GB-cori-medium', 'manyvoice-7', 'manyvoice-4'].includes(voice.id),
);

const phone = labelPhoneVoices(
  [
    { id: 'en-au-x-aub-local', locale: 'en-AU' },
    { id: 'en-gb-x-gbg-local', locale: 'en-GB' },
    { id: 'en-us-x-sfg-local', locale: 'en-US' },
  ],
  {
    'en-au-x-aub-local': { name: 'Jack', gender: 'male', description: 'Light and even', featured: true },
    'en-gb-x-gbg-local': { name: 'Harriet', gender: 'female', description: 'Bright and very lively' },
  },
);

describe('the main list of voices', () => {
  it('has the natural voices and the featured phone voices, under their system ids', () => {
    const ids = mainList(natural, phone, systemId).map((voice) => voice.id);
    expect(ids).toContain('system:en-au-x-aub-local');
    expect(ids).not.toContain('system:en-gb-x-gbg-local');
    expect(ids).not.toContain('system:en-us-x-sfg-local');
    expect(ids).toContain('ljspeech-medium');
  });

  it('orders them together: recommended first, then A to Z', () => {
    expect(mainList(natural, phone, systemId).map((voice) => voice.name)).toEqual([
      'Lyra',
      'Cori',
      'Jack',
      'James',
      'Mike',
    ]);
  });

  it('carries what a card shows', () => {
    const jack = mainList(natural, phone, systemId).find((voice) => voice.name === 'Jack');
    expect(jack).toMatchObject({ region: 'AU', gender: 'male', description: 'Light and even' });
    expect(jack?.natural).toBeUndefined();
    const lyra = mainList(natural, phone, systemId).find((voice) => voice.name === 'Lyra');
    expect(lyra?.natural?.id).toBe('ljspeech-medium');
  });
});

describe('the accent filters', () => {
  it('offers only the accents present, US and UK first', () => {
    expect(regionsIn(mainList(natural, [], systemId))).toEqual(['US', 'GB']);
    expect(regionsIn(mainList(natural, phone, systemId))).toEqual(['US', 'GB', 'AU']);
  });

  it('names them as a listener would', () => {
    expect(['US', 'GB', 'AU', 'IN'].map(regionLabel)).toEqual(['US', 'UK', 'AU', 'India']);
  });
});

describe('natural voice descriptions', () => {
  it('every offered voice has one', () => {
    const missing = OFFERED_VOICES.filter((voice) => !voice.description).map((voice) => voice.name);
    expect(missing).toEqual([]);
  });
});
