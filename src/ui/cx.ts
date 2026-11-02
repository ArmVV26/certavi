/** Joins class names, skipping empty values: cx('a', cond && 'b', undefined) → 'a b'. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
