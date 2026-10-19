import { VOICES, type VoiceMeta } from './catalog';
import { orderCatalog, type LabelledPhoneVoice, type PhoneVoice } from './order';

/**
 * The one list someone chooses a voice from.
 *
 * Papervoice's natural voices, and beside them the few phone voices good
 * enough to stand there -- marked `featured` where they are named. The rest of
 * the phone's voices are listed separately, below, as the fallback they are.
 * Pure, so what goes in the list and in what order is tested.
 */

/** Upper-case region: US, GB, AU, IN, or whatever else a phone reports. */
export type Region = string;

export interface ListedVoice {
  /** The id a voice is chosen and saved by: the catalog id, or `system:` + the engine's. */
  id: string;
  name: string;
  region: Region;
  gender: 'female' | 'male';
  description?: string;
  /** Set for a natural voice: it downloads, and can be removed. */
  natural?: VoiceMeta;
}

export function mainList<T extends PhoneVoice>(
  natural: VoiceMeta[],
  phone: Array<LabelledPhoneVoice<T>>,
  systemId: (voice: T) => string,
): ListedVoice[] {
  const listed: ListedVoice[] = natural.map((voice) => ({
    id: voice.id,
    name: voice.name,
    region: voice.accent,
    gender: voice.gender,
    description: voice.description,
    natural: voice,
  }));
  for (const entry of phone) {
    if (!entry.featured || !entry.gender) continue;
    listed.push({
      id: systemId(entry.voice),
      name: entry.label,
      region: entry.region,
      gender: entry.gender,
      description: entry.description,
    });
  }
  // One order for both: a phone voice is not filed after the natural ones.
  return orderCatalog(listed);
}

const REGION_ORDER = ['US', 'GB', 'AU', 'IN'];

/** The accents present, for the filter chips: a phone without Australian voices shows no AU. */
export function regionsIn(list: ListedVoice[]): Region[] {
  const present = [...new Set(list.map((voice) => voice.region))];
  const rank = (region: Region) => {
    const at = REGION_ORDER.indexOf(region);
    return at === -1 ? REGION_ORDER.length : at;
  };
  return present.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const REGION_LABELS: Record<string, string> = { US: 'US', GB: 'UK', AU: 'AU', IN: 'India' };

export const regionLabel = (region: Region): string => REGION_LABELS[region] ?? region;

/**
 * What to call any saved voice id: its catalog name (hidden voices included,
 * since someone may still be using one), its label on this phone, or -- for a
 * phone voice no longer offered -- just that.
 */
export function voiceDisplayName(id: string, phoneLabels: Map<string, string>): string {
  const natural = VOICES.find((voice) => voice.id === id);
  if (natural) return natural.name;
  const phone = phoneLabels.get(id);
  if (phone) return phone;
  return id.startsWith('system:') ? 'a phone voice' : id;
}
