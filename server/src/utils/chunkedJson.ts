/**
 * Azure Table Storage caps a string property at 64KB (about 32K UTF-16
 * characters). A route's path and turn-by-turn steps can run past that, so
 * large JSON values are split across numbered properties and joined on read.
 *
 * A value is stored as `<name>Chunks` (the count) plus `<name>0`, `<name>1`, …
 * Values that fit are stored whole under `<name>`, as before, so routes saved
 * earlier still read back.
 */

/** Characters per property, kept well under the 32K UTF-16 character limit. */
export const CHUNK_CHARS = 30_000;

export function toChunkedProps(name: string, value: unknown): Record<string, string | number> {
  if (value === undefined || value === null) return { [name]: '' };
  const json = JSON.stringify(value);
  if (json.length <= CHUNK_CHARS) return { [name]: json, [`${name}Chunks`]: 0 };
  const props: Record<string, string | number> = { [name]: '', [`${name}Chunks`]: 0 };
  let count = 0;
  for (let start = 0; start < json.length; start += CHUNK_CHARS) {
    props[`${name}${count}`] = json.slice(start, start + CHUNK_CHARS);
    count += 1;
  }
  props[`${name}Chunks`] = count;
  return props;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromChunkedProps<T = any>(entity: Record<string, unknown>, name: string): T | undefined {
  const count = Number(entity[`${name}Chunks`] ?? 0);
  let json: unknown = entity[name];
  if (count > 0) {
    json = '';
    for (let i = 0; i < count; i += 1) json = `${json}${entity[`${name}${i}`] ?? ''}`;
  }
  if (typeof json !== 'string' || json === '') return undefined;
  return JSON.parse(json) as T;
}
