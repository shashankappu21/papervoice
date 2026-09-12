/**
 * Re-derives every voice's licence from its primary source.
 *
 *   npm run audit:licences
 *
 * The brief says the licence registry lives in the repo and that every
 * MODEL_CARD is re-read before launch. This is that, done by a script rather
 * than by someone reading model cards and writing down what they remember.
 *
 * Why it is a script and not a test: it needs the network, and a test that
 * fails when HuggingFace is slow teaches people to ignore the test. So this
 * writes `docs/voice-licences.json`, which is committed, and
 * `__tests__/licences.test.ts` enforces it offline. The split matters --
 * refreshing is an act someone performs and reviews in a diff; enforcing runs
 * on every commit.
 *
 * The part worth having is the lineage chain. A model card can say CC BY 4.0
 * and still be unsellable, because what a voice descends from binds it: Piper's
 * own maintainer confirms the repo's MIT licence "does not impose any
 * additional licenses on the checkpoints or voice models", and a voice
 * finetuned from lessac inherits Blizzard's research-only terms whatever its
 * own label says. That is exactly how `arctic` -- CC-clean dataset, 18 speakers
 * -- turned out to be unusable. So a card that says "Finetuned from X" is not
 * an answer here, it is a question, and the script follows it.
 */

import { writeFileSync } from 'node:fs';
import { VOICES, type VoiceMeta } from '../src/voices/catalog';

/** Where Piper's voices are documented, as opposed to where we download them. */
const PIPER_CARDS = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en';

/**
 * Verdicts. Only `clear` may be offered in an app that is sold.
 *
 * `unknown` is deliberately not a middle ground: a lineage that cannot be
 * resolved is treated exactly like one known to be bad, because "we could not
 * find out" is not a defence. `bryce` is the live example -- public domain
 * dataset, but finetuned from an unreleased voice nobody has documented.
 */
type Verdict = 'clear' | 'attribution' | 'blocked' | 'unknown';

interface Audited {
  id: string;
  name: string;
  offered: boolean;
  /** The upstream name, so a human can go and read the same page. */
  key: string;
  cardUrl: string;
  dataset: string;
  datasetLicence: string;
  training: string;
  /** What it was finetuned from, resolved to the voice it names. */
  derivedFrom: string | null;
  /** Every card in the chain, this voice first. */
  chain: string[];
  verdict: Verdict;
  why: string;
}

/**
 * Licence text that forbids sale, matched on the licence line and on the
 * dataset URL both -- several cards give only a link, and the terms live behind
 * it. Blizzard is here because lessac's card links to it rather than naming a
 * licence, and its terms exclude "any commercial purpose, including... voice
 * synthesis products or services".
 */
const FORBIDS_SALE = [/by-nc/i, /non-?commercial/i, /\bresearch\b/i, /blizzard/i];

/** Licence text that permits sale outright, with nothing to carry downstream. */
const PERMITS_SALE = [/public domain/i, /\bcc0\b/i];

/** Permits sale but obliges us to credit, which the About screen must then do. */
const PERMITS_WITH_CREDIT = [/cc[ -]?by[ -]?4\.0/i, /\bmit\b/i, /apache/i, /\bbsd\b/i];

/**
 * Turns the prose of a "Training" section into the voice it descends from.
 *
 * Deliberately a short list of exact phrasings rather than something clever.
 * A loose regex that half-matches an unfamiliar sentence would return a wrong
 * parent, and a wrong parent is worse here than no parent: no parent is
 * reported as `unknown` and blocks the voice, while a wrong one could clear a
 * voice that should be blocked. When this list does not match, that is the
 * script telling you to go and read the card yourself.
 */
const PARENTS: Array<[RegExp, string]> = [
  [/finetuned from u\.s\. english lessac/i, 'en_US-lessac-medium'],
  [/fine-?tuned from english lessac medium/i, 'en_US-lessac-medium'],
  [/finetuned from u\.s\. english ryan/i, 'en_US-ryan-medium'],
  [/finetuned from kristin/i, 'en_US-kristin-medium'],
];

/** Reads a model card, or null where the voice is not documented upstream. */
async function fetchCard(url: string): Promise<string | null> {
  const response = await fetch(url);
  return response.ok ? await response.text() : null;
}

/**
 * What the repository we actually download from declares about itself.
 *
 * Piper's own repo does not document every voice we ship: miro and dii were
 * never uploaded to it, and Kitten is not a Piper voice at all. For those, the
 * repo holding the file is the only statement there is.
 *
 * It is a weaker kind of evidence and the registry says so. A mirror asserting
 * apache-2.0 is the mirror's assertion, not the trained model's provenance --
 * which is precisely the gap that makes Kitten a judgement call rather than a
 * cleared voice.
 */
async function fetchRepoCard(modelUrl: string): Promise<{
  url: string;
  licence: string;
  card: string;
  baseModel: string;
  dataset: string;
} | null> {
  const repo = modelUrl.match(/huggingface\.co\/([^/]+\/[^/]+)\//);
  if (!repo) return null;
  const api = await fetch(`https://huggingface.co/api/models/${repo[1]}`);
  if (!api.ok) return null;
  const meta = (await api.json()) as {
    cardData?: { license?: string; base_model?: string | string[]; datasets?: string[] };
  };
  const card = meta.cardData ?? {};
  const readme = (await fetchCard(`https://huggingface.co/${repo[1]}/raw/main/README.md`)) ?? '';

  /*
   * The declared licence, then the prose, in that order.
   *
   * Several of these repos leave the metadata field empty and state the terms
   * in the body instead -- miro says CC BY-NC-SA in a "# License" heading and
   * declares nothing machine-readable. Reading only the field would have
   * cleared a voice that forbids sale, which is the failure worth engineering
   * against.
   */
  const stated = card.license ?? '';
  const fromBody = readme.match(
    /(CC[ -]?BY[ -]?NC[ -]?(?:SA[ -]?)?4\.0|creativecommons\.org\/licenses\/[a-z-]+|apache-?2\.0|\bMIT\b|public domain)/i,
  );

  return {
    url: `https://huggingface.co/${repo[1]}`,
    licence: stated || (fromBody ? fromBody[1] : ''),
    card: readme,
    // HuggingFace's own lineage field. Where it is filled in it is better
    // evidence than prose, because it names a repository rather than describing
    // one -- miro records `OpenVoiceOS/pipertts_nl-NL_miro` as its parent.
    baseModel: [card.base_model ?? []].flat().join(', '),
    dataset: (card.datasets ?? []).join(', '),
  };
}

const field = (card: string, label: string): string => {
  const found = card.match(new RegExp(`^\\s*\\*?\\s*${label}:\\s*(.+)$`, 'im'));
  return found ? found[1].trim() : '';
};

const trainingText = (card: string): string => {
  const section = card.split(/^##\s*Training\s*$/im)[1] ?? '';
  return section.split(/^##/m)[0].replace(/\s+/g, ' ').trim();
};

/** The upstream name, recovered from the URL we download the model from. */
function keyOf(voice: VoiceMeta): string {
  const piper = voice.modelUrl.match(/vits-piper-([a-z]{2}_[A-Z]{2}-[^/]+)\//);
  if (piper) return piper[1];
  const repo = voice.modelUrl.match(/huggingface\.co\/[^/]+\/([^/]+)\//);
  return repo ? repo[1] : voice.id;
}

/** `en_US-ljspeech-medium` is documented at `en/en_US/ljspeech/medium`. */
function cardUrlFor(key: string): string | null {
  const parts = key.match(/^(([a-z]{2})_[A-Z]{2})-(.+)-([a-z]+)$/);
  if (!parts) return null;
  const [, locale, , name, quality] = parts;
  return `${PIPER_CARDS}/${locale}/${name}/${quality}/MODEL_CARD`;
}

function judge(licence: string, dataset: string): { verdict: Verdict; why: string } {
  const text = `${licence} ${dataset}`;
  const bad = FORBIDS_SALE.find((pattern) => pattern.test(text));
  if (bad) return { verdict: 'blocked', why: `licence matches ${bad}` };
  if (PERMITS_SALE.some((pattern) => pattern.test(text)))
    return { verdict: 'clear', why: licence };
  if (PERMITS_WITH_CREDIT.some((pattern) => pattern.test(text)))
    return { verdict: 'attribution', why: `${licence} -- credit required` };
  return { verdict: 'unknown', why: `unrecognised licence: ${licence || '(none stated)'}` };
}

/**
 * Audits one voice, following its lineage until it reaches a voice trained from
 * scratch -- or runs out of documentation, which blocks it.
 *
 * The chain is capped because a card that names itself, or two that name each
 * other, would otherwise spin for ever. A chain that deep is not a real
 * lineage; it is a parse gone wrong, and it should be looked at by a person.
 */
async function audit(voice: VoiceMeta): Promise<Audited> {
  const key = keyOf(voice);
  const chain: string[] = [];
  let current = key;
  let first: { card: string; url: string } | null = null;
  let derivedFrom: string | null = null;

  for (let hop = 0; hop < 6; hop += 1) {
    const url = cardUrlFor(current);
    if (!url) break;
    const card = await fetchCard(url);
    if (!card) break;

    chain.push(current);
    if (!first) first = { card, url };
    // The voice we were asked about, as opposed to whichever ancestor this hop
    // is looking at. Bound to a const so it reads as what it is.
    const asked = first;

    const training = trainingText(card);
    const parent = PARENTS.find(([pattern]) => pattern.test(training));

    // The end of the line: nothing above it to inherit from.
    if (!parent) {
      const licence = field(card, 'License');
      const dataset = field(card, 'URL');
      // A voice is bound by the strictest licence anywhere in its chain, so
      // re-judge at the root with what the root's own card says.
      const rootCard = chain.length > 1 ? card : asked.card;
      const verdict = judge(field(rootCard, 'License'), field(rootCard, 'URL'));
      return {
        id: voice.id,
        name: voice.name,
        offered: !voice.hidden,
        key,
        cardUrl: asked.url,
        dataset: field(asked.card, 'URL'),
        datasetLicence: field(asked.card, 'License'),
        training: trainingText(asked.card),
        derivedFrom,
        chain,
        ...verdict,
        why:
          chain.length > 1
            ? `${verdict.why} (inherited from ${current}: ${licence || dataset})`
            : verdict.why,
      };
    }

    derivedFrom = derivedFrom ?? parent[1];
    current = parent[1];
  }

  /*
   * A licence the catalog says lives somewhere specific.
   *
   * Checked before the download repo, because for Kitten the two disagree: the
   * mirror we fetch the model from states nothing, and the Apache-2.0 is
   * KittenML's. Following the pointer is what makes the catalog's claim
   * falsifiable instead of self-asserted.
   */
  if (!first && voice.licenceSource) {
    const stated = await fetchCard(voice.licenceSource);
    if (stated) {
      const licence = stated.match(/^license:\s*(.+)$/im)?.[1]?.trim() ?? '';
      const verdict = judge(licence, '');
      return {
        id: voice.id,
        name: voice.name,
        offered: !voice.hidden,
        key,
        cardUrl: voice.licenceSource,
        dataset: '',
        datasetLicence: licence,
        training: '',
        derivedFrom: null,
        chain: [key],
        ...verdict,
        // Said out loud on every row rather than left for someone to notice.
        // A permissive label over training data nobody has described is a
        // different kind of fact from a documented public-domain lineage, and
        // the registry should not flatten the two into one tick.
        why: `${verdict.why} -- upstream states this; training data undisclosed`,
      };
    }
  }

  // Not in Piper's repo. Fall back to what the repo we download from declares.
  if (!first) {
    const repo = await fetchRepoCard(voice.modelUrl);
    if (repo) {
      const dataset = repo.dataset || field(repo.card, 'Dataset') || field(repo.card, 'URL');
      const verdict = judge(repo.licence, dataset);
      return {
        id: voice.id,
        name: voice.name,
        offered: !voice.hidden,
        key,
        cardUrl: repo.url,
        dataset,
        datasetLicence: repo.licence,
        training: trainingText(repo.card),
        derivedFrom: repo.baseModel || null,
        chain: repo.baseModel ? [key, repo.baseModel] : [key],
        ...verdict,
        why:
          `${verdict.why} -- stated by the distributing repo, not a Piper model card` +
          (dataset ? '' : '; training data undisclosed'),
      };
    }
  }

  // Either undocumented anywhere, or its lineage does not terminate.
  return {
    id: voice.id,
    name: voice.name,
    offered: !voice.hidden,
    key,
    cardUrl: first?.url ?? '',
    dataset: first ? field(first.card, 'URL') : '',
    datasetLicence: first ? field(first.card, 'License') : '',
    training: first ? trainingText(first.card) : '',
    derivedFrom,
    chain,
    verdict: 'unknown',
    why: first
      ? 'lineage could not be followed to a voice trained from scratch'
      : 'no model card anywhere -- verify by hand',
  };
}

/**
 * The size above which a model cannot be used for live synthesis on a phone.
 *
 * From the brief, which set it after four models failed at a real-time factor
 * around 1.0. It is checked here because licence is not the only way a
 * candidate dies, and finding out after reading the terms is the wrong order:
 * Higgs Audio v3 is 4B parameters, roughly 8GB, and no licence would have
 * saved it.
 */
const LIVE_SYNTH_LIMIT = 130_000_000;

/** File extensions that are the model itself rather than its paperwork. */
const WEIGHTS = /\.(onnx|safetensors|bin|gguf|tflite|pt|pth|ckpt)$/i;

/**
 * Judges one model that is not in the catalog yet.
 *
 * The point is the "yet". Auditing what has already been adopted finds
 * mistakes after they have been built on; this is the same evidence gathered
 * before the decision, which is when it is worth something. It exists because
 * `arctic` reached a planning document as the paid tier before anyone followed
 * its lineage, and because a model named similarly to a good one was nearly
 * taken for it.
 *
 * Accepts a HuggingFace repo (URL or `owner/name`), a Piper voice key such as
 * `en_US-arctic-medium`, or any URL whose text can be read for licence terms.
 */
async function check(target: string) {
  console.log(`\nChecking ${target}\n`);
  const lines: string[] = [];
  let licence = '';
  let dataset = '';
  let lineage = '';
  let bytes = 0;
  let source = '';

  // A Piper voice key: its model card is the authority, and it may have a
  // parent whose terms override whatever this one says.
  const piperCard = cardUrlFor(target);
  if (piperCard) {
    const card = await fetchCard(piperCard);
    if (card) {
      source = piperCard;
      licence = field(card, 'License');
      dataset = field(card, 'URL');
      const training = trainingText(card);
      const parent = PARENTS.find(([pattern]) => pattern.test(training));
      lineage = parent ? parent[1] : 'trained from scratch';
      lines.push(`training: ${training.slice(0, 160)}`);

      if (parent) {
        const parentCard = await fetchCard(cardUrlFor(parent[1]) ?? '');
        if (parentCard) {
          const parentLicence = field(parentCard, 'License');
          lines.push(`parent ${parent[1]}: ${parentLicence || field(parentCard, 'URL')}`);
          // The parent binds the child. This is the whole reason the tool
          // exists, so it is the licence that gets judged.
          licence = parentLicence || field(parentCard, 'URL');
          dataset = field(parentCard, 'URL');
        }
      }
    }
  }

  // A HuggingFace repository.
  const repoId = target.match(/huggingface\.co\/([^/]+\/[^/?#]+)/)?.[1] ?? (
    /^[\w.-]+\/[\w.-]+$/.test(target) ? target : null
  );
  if (!source && repoId) {
    const api = await fetch(`https://huggingface.co/api/models/${repoId}`);
    if (api.ok) {
      const meta = (await api.json()) as {
        cardData?: {
          license?: string;
          license_name?: string;
          license_link?: string;
          base_model?: string | string[];
          datasets?: string[];
        };
        siblings?: Array<{ rfilename: string }>;
      };
      const card = meta.cardData ?? {};
      source = `https://huggingface.co/${repoId}`;
      licence = [card.license, card.license_name, card.license_link].filter(Boolean).join(' ');
      dataset = (card.datasets ?? []).join(', ');
      lineage = [card.base_model ?? []].flat().join(', ') || 'not stated';

      const readme = await fetchCard(`https://huggingface.co/${repoId}/raw/main/README.md`);
      if (readme && !licence) {
        licence = readme.match(/^license:\s*(.+)$/im)?.[1]?.trim() ?? '';
      }
      // The body, always -- a repo can declare `other` in metadata and spell
      // out non-commercial terms in prose underneath it.
      if (readme) {
        const prose = readme.match(
          /(research and non-?commercial|non-?commercial|CC[ -]?BY[ -]?NC[^\s,.]*|research (?:use )?only)/i,
        );
        if (prose) {
          lines.push(`README says: "${prose[1]}"`);
          licence = `${licence} ${prose[1]}`.trim();
        }
      }

      const tree = await fetch(`https://huggingface.co/api/models/${repoId}/tree/main`);
      if (tree.ok) {
        const files = (await tree.json()) as Array<{ path: string; size?: number }>;
        bytes = files
          .filter((file) => WEIGHTS.test(file.path))
          .reduce((total, file) => total + (file.size ?? 0), 0);
      }
    }
  }

  /*
   * Anything else with readable text.
   *
   * Every licence statement on the page, not the first -- because a page is
   * often not about one model. Bryce Beattie's lists eleven, under four
   * different licences, and answering for "the page" would be answering a
   * question nobody asked. Where the statements disagree the honest output is
   * to show them and decline the verdict, rather than quote whichever matched
   * first and sound certain about it.
   */
  if (!source) {
    const page = await fetchCard(target);
    if (!page) {
      console.log('Could not read anything at that address. Check it by hand.');
      process.exitCode = 1;
      return;
    }
    source = target;
    lineage = 'not stated';

    const text = page
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ');

    const stated = [
      ...text.matchAll(/licen[cs]e:\s*([^|.]{3,60}?)(?=\s{2,}|\s+Downloads|\s*[|.]|$)/gi),
    ].map((match) => match[1].trim().replace(/\s+/g, ' '));
    const distinct = [...new Set(stated.map((one) => one.toLowerCase()))];

    if (distinct.length > 1) {
      console.log(`This page states ${distinct.length} different licences:`);
      for (const one of distinct) console.log(`  - ${one}`);
      console.log('\nIt describes more than one model. Check the specific model you want,');
      console.log('by its own page or its HuggingFace repo -- a verdict for "this page"');
      console.log('would not mean anything.');
      process.exitCode = 1;
      return;
    }
    licence = stated[0] ?? '';
  }

  const verdict = judge(licence, dataset);
  const tooBig = bytes > LIVE_SYNTH_LIMIT;

  console.log(`source   ${source}`);
  console.log(`licence  ${licence || '(none stated)'}`);
  console.log(`data     ${dataset || 'NOT STATED -- provenance unknown'}`);
  console.log(`lineage  ${lineage}`);
  if (bytes) console.log(`weights  ${(bytes / 1e6).toFixed(1)} MB`);
  for (const line of lines) console.log(`         ${line}`);

  console.log();
  if (tooBig) {
    console.log(`TOO BIG -- ${(bytes / 1e6).toFixed(0)} MB of weights against a ${
      LIVE_SYNTH_LIMIT / 1e6
    } MB ceiling for live synthesis.`);
  }
  console.log(`${SYMBOL[verdict.verdict]} -- ${verdict.why}`);
  if (!dataset) {
    console.log('Training data is not described. A permissive label over undescribed');
    console.log('data is a judgement to make deliberately, not a clearance.');
  }
  if (verdict.verdict === 'blocked') {
    console.log('\nFinetuning, quantizing or converting does NOT lift this. A derivative');
    console.log('of restricted weights carries the same restriction -- which is how');
    console.log('arctic, with a permissive dataset, turned out to be unusable.');
  }
  process.exitCode = verdict.verdict === 'clear' || verdict.verdict === 'attribution' ? 0 : 1;
}

const SYMBOL: Record<Verdict, string> = {
  clear: 'OK',
  attribution: 'OK+credit',
  blocked: 'BLOCKED',
  unknown: 'UNKNOWN',
};

async function main() {
  console.log(`Auditing ${VOICES.length} voices against their primary sources\n`);
  const results: Audited[] = [];

  for (const voice of VOICES) {
    const row = await audit(voice);
    results.push(row);
    console.log(
      `${SYMBOL[row.verdict].padEnd(9)} ${row.name.padEnd(16)} ${row.key.padEnd(30)} ${row.why}`,
    );
  }

  const registry = {
    // Dated because a licence is a fact about a moment. A registry with no date
    // cannot be told apart from one nobody has refreshed in a year.
    audited: new Date().toISOString().slice(0, 10),
    source: 'https://huggingface.co/rhasspy/piper-voices',
    voices: results,
  };
  writeFileSync('docs/voice-licences.json', `${JSON.stringify(registry, null, 2)}\n`);

  const offenders = results.filter(
    (row) => row.offered && row.verdict !== 'clear' && row.verdict !== 'attribution',
  );
  console.log(`\nWrote docs/voice-licences.json (${results.length} voices)`);
  console.log(
    offenders.length === 0
      ? 'Every offered voice is sellable.'
      : `NOT sellable while offered: ${offenders.map((row) => row.name).join(', ')}`,
  );
}

const [command, ...rest] = process.argv.slice(2);

// No arguments audits the catalog; `check` judges something not in it yet.
const run =
  command === 'check' && rest.length === 1
    ? check(rest[0])
    : command === undefined
      ? main()
      : Promise.reject(
          new Error(
            'usage:\n' +
              '  npm run audit:licences                  audit every voice in the catalog\n' +
              '  npm run audit:licences -- check <model>  judge one before adopting it\n' +
              '      <model> is a HuggingFace URL or owner/name, a Piper voice key\n' +
              '      such as en_US-arctic-medium, or any page stating terms.',
          ),
        );

run.catch((cause: Error) => {
  console.error(cause.message);
  process.exit(1);
});
