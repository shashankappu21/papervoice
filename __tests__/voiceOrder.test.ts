import { describe, expect, it } from 'vitest';
import { labelPhoneVoices, orderCatalog } from '../src/voices/order';

describe('the order of downloadable voices', () => {
  const voices = [
    { id: 'manyvoice-7', name: 'James' },
    { id: 'en_GB-cori-medium', name: 'Cori' },
    { id: 'manyvoice-1', name: 'Kara' },
    { id: 'ljspeech-medium', name: 'Lyra' },
    { id: 'en_US-kristin-medium', name: 'Kristin' },
    { id: 'manyvoice-4', name: 'Mike' },
  ];

  it('puts the recommended voices first, then A to Z', () => {
    expect(orderCatalog(voices).map((v) => v.name)).toEqual([
      'Lyra',
      'Kristin',
      'Cori',
      'James',
      'Kara',
      'Mike',
    ]);
  });

  it('does not depend on what is installed or the order it came in', () => {
    expect(orderCatalog([...voices].reverse())).toEqual(orderCatalog(voices));
  });

  it('keeps the order through a filter', () => {
    const us = voices.filter((v) => v.id !== 'en_GB-cori-medium');
    expect(orderCatalog(us).map((v) => v.name)).toEqual(['Lyra', 'Kristin', 'James', 'Kara', 'Mike']);
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
    'en-us-x-sfg-local': { name: 'Sophie', gender: 'female' as const },
    'en-gb-x-rjs-local': { name: 'Oliver', gender: 'male' as const },
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
