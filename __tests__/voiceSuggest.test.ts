import { describe, expect, it } from 'vitest';
import { profileText, suggestVoices } from '../src/voices/suggest';

const repeat = (text: string, times: number) => Array.from({ length: times }, () => text).join(' ');

const story = repeat(
  '“Where are you going?” she asked. “Home,” he said, and turned away. She watched him walk down the road until he was gone, and then she went back inside.',
  30,
);
const study = repeat(
  'Figure 3 shows the results of the analysis. As Table 2 indicates, 45% of respondents (n = 120) preferred the second option; see Section 4.2 for the method, e.g. the sampling frame described by Smith et al. (2019).',
  30,
);
const form = repeat('PNR: G8RJMC. Seat 14C. Gate 22. Departure 06:45. Flight 6E 2134. Bag 15 kg. Total INR 4,560.', 40);

describe('what kind of text a book is', () => {
  it('a story: dialogue and narration', () => {
    expect(profileText(story).kind).toBe('story');
  });

  it('study or work: figures, tables, citations and numbers', () => {
    expect(profileText(study).kind).toBe('study');
  });

  it('non-fiction that tells stories is still not a story', () => {
    // Pitched at the rates measured in a real negotiation book: per thousand
    // words about 5 speech verbs, 20 he/she/his, and 5 research words.
    const paragraph = [
      '"We need more time," he said.',
      'The negotiation went on through the long night while everyone in the room waited for a sign that things would change soon.'.repeat(1),
      'Over the years the team learned to listen first and to slow the whole conversation down, so that nobody felt rushed into a decision they would regret later on.',
      'His partner kept notes, and she wrote down every word the caller used, because small words often carry the most weight when people are afraid.',
      'The research behind this approach is simple to follow once you have seen it work a few times in a real room with real stakes.',
      'They kept going until morning came and the phones finally went quiet, and then they went home and slept for most of the following day without any trouble.',
    ].join(' ');
    expect(profileText(repeat(paragraph, 12)).kind).toBe('study');
  });

  it('a form: short fragments full of codes and numbers', () => {
    expect(profileText(form).kind).toBe('form');
  });

  it('too little to tell', () => {
    expect(profileText('A short note.').kind).toBe('unknown');
  });
});

describe('which spelling a book uses', () => {
  const base = repeat('The road ran on past the houses and the fields.', 60);

  it('British, from its spellings', () => {
    expect(profileText(`${base} The colour of the centre, whilst we realised its honour.`).spelling).toBe('GB');
  });

  it('American, from its spellings', () => {
    expect(profileText(`${base} The color of the center, while we realized its honor.`).spelling).toBe('US');
  });

  it('neither, when the text does not say', () => {
    expect(profileText(base).spelling).toBeNull();
  });
});

describe('the voices suggested', () => {
  const everything = (id: string) => id !== 'nothing';

  it('an expressive storyteller for a story', () => {
    const suggestion = suggestVoices({ kind: 'story', spelling: null }, everything);
    expect(suggestion?.voiceIds[0]).toBe('ljspeech-medium');
    expect(suggestion?.reason).toMatch(/dialogue|story/i);
  });

  it('a British voice for a British story', () => {
    expect(suggestVoices({ kind: 'story', spelling: 'GB' }, everything)?.voiceIds[0]).toBe('system:en-gb-x-gbb-local');
  });

  it('a steady voice for study', () => {
    expect(suggestVoices({ kind: 'study', spelling: 'US' }, everything)?.voiceIds[0]).toBe('en_US-kristin-medium');
  });

  it('only voices this phone can offer, two at most', () => {
    const noPhoneVoices = (id: string) => !id.startsWith('system:');
    const suggestion = suggestVoices({ kind: 'story', spelling: 'GB' }, noPhoneVoices);
    expect(suggestion?.voiceIds.every(noPhoneVoices)).toBe(true);
    expect(suggestion?.voiceIds.length).toBeLessThanOrEqual(2);
  });

  it('nothing when the book could not be read for it', () => {
    expect(suggestVoices({ kind: 'unknown', spelling: null }, everything)).toBeNull();
  });
});
