/**
 * The voice-sample markup on papervoice.app, rendered from the files present.
 *
 * Pure, so it is tested. Only voices with a recording get a button: a control
 * that cannot play anything is worse than no control, so a missing file is a
 * missing button rather than a broken one.
 */

/** The voices shown before "All voices": a spread of accents and genders. */
export const FEATURED = [
  'ljspeech-medium', // Lyra
  'en_US-kristin-medium', // Kristin
  'en_GB-cori-medium', // Cori
  'manyvoice-4', // Mike
  'manyvoice-7', // James
  'manyvoice-10', // Steve
];

export const HERO_VOICE = 'ljspeech-medium';

const escape = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const seconds = (s) => `${Math.max(1, Math.round(s))} s`;
const accent = (code) => (code === 'GB' ? 'UK' : code);

function button(sample, className, label) {
  const idle = seconds(sample.seconds);
  return [
    `<button class="${className}" type="button" data-sample="${escape(sample.id)}" data-name="${escape(sample.name)}"`,
    `        data-idle="${idle}" data-state="idle" aria-pressed="false">`,
    `  <span class="sample-icon" aria-hidden="true"></span>`,
    label,
    `  <span class="sample-state">${idle}</span>`,
    `</button>`,
  ].join('\n');
}

/** "Hear Lyra" under the hero image, or nothing when there is no recording. */
export function renderHero(sample) {
  if (!sample) return '';
  return [
    `<div class="hear-wrap">`,
    button(sample, 'hear', `  <span>Hear ${escape(sample.name)}</span>`),
    `</div>`,
  ].join('\n');
}

/**
 * The compact sample list in the voices section.
 *
 * The featured voices show; the rest sit behind a disclosure, so the section
 * keeps its size whether there are six recordings or sixteen.
 *
 * @param {Array<{ id: string, name: string, accent: string, gender: string, seconds: number }>} samples
 * @param {{ sentence?: string | null, featured?: string[] }} [options]
 */
export function renderVoices(samples, { sentence, featured = FEATURED } = {}) {
  if (samples.length === 0) return '';
  const item = (sample) =>
    `<li>${button(
      sample,
      'sample',
      `  <span class="sample-text"><span class="sample-name">${escape(sample.name)}</span><span class="sample-meta">${accent(sample.accent)} · ${escape(sample.gender)}</span></span>`,
    )}</li>`;

  const first = featured.map((id) => samples.find((s) => s.id === id)).filter(Boolean);
  const rest = samples.filter((s) => !featured.includes(s.id));
  const sameLine = sentence ? ` Each reads the same line: “${escape(sentence)}”` : '';

  const out = [
    `<p class="samples-note">Hear them before you download one.${sameLine}</p>`,
    `<ul class="sample-list">`,
    ...first.map(item),
    `</ul>`,
  ];
  if (rest.length) {
    out.push(
      `<details class="more-samples">`,
      `  <summary>All ${samples.length} voices</summary>`,
      `  <ul class="sample-list">`,
      ...rest.map(item),
      `  </ul>`,
      `</details>`,
    );
  }
  return out.join('\n');
}

/** Replaces what is between <!-- samples:NAME ... --> and <!-- /samples:NAME -->. */
export function replaceBlock(html, name, inner) {
  const pattern = new RegExp(`(<!-- samples:${name}\\b[^>]*-->)[\\s\\S]*?(\\s*<!-- /samples:${name} -->)`);
  if (!pattern.test(html)) throw new Error(`site/index.html has no samples:${name} block.`);
  return html.replace(pattern, (_m, open, close) => `${open}${inner ? `\n${inner}` : ''}${close}`);
}
