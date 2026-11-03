import type { TFunction } from 'i18next';
import type { TextRef } from '../domain';

/** Text of a `TextRef`: seed data holds an i18n key, user data the text as typed. */
export function resolveText(t: TFunction, ref: TextRef): string {
  if ('text' in ref) return ref.text;
  // Seed keys are data, so the type system cannot check them; seedKeys.test.ts does.
  return (t as unknown as (key: string) => string)(ref.key);
}
