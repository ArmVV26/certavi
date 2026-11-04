// Ids for records created on this device: a type prefix, the time and random characters, so two
// devices offline never pick the same id.

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const RANDOM_LENGTH = 10;

function randomPart(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** A new id such as `ses_mh2x9k1c_4f8k2m9q0z`. */
export function newId(prefix: string, now: number = Date.now()): string {
  return `${prefix}_${now.toString(36)}_${randomPart()}`;
}

/** Id prefixes per record type created from the app. */
export const ID_PREFIX = {
  session: 'ses',
  activity: 'act',
  set: 'set',
} as const;
