const LATIN_LETTER = /\p{Script=Latin}/u;
const MARK = /^\p{M}$/u;
const PUNCTUATION = /^\p{P}$/u;

/** Comparison-only key; callers must continue rendering the original label. */
export function countryNameKey(value: string): string {
  const decomposed = value.trim().normalize('NFD').toLowerCase();
  let previousBaseWasLatin = false;
  let result = '';
  for (const character of decomposed) {
    if (MARK.test(character)) {
      if (previousBaseWasLatin) continue;
      result += character;
      continue;
    }
    if (PUNCTUATION.test(character)) {
      previousBaseWasLatin = false;
      continue;
    }
    result += character;
    previousBaseWasLatin = LATIN_LETTER.test(character);
  }
  return result;
}
