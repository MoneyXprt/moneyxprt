import { describe, expect, it } from 'vitest';
import { normalizeWaitlistEmail } from './waitlist';

describe('normalizeWaitlistEmail', () => {
  it('trims and lowercases a valid address', () => {
    expect(normalizeWaitlistEmail('  HELLO@Example.COM ')).toBe('hello@example.com');
  });

  it.each(['', 'name', 'name@example', 'name @example.com', 'name@example .com'])('rejects malformed input %j', (value) => {
    expect(normalizeWaitlistEmail(value)).toBeNull();
  });

  it('rejects non-strings and excessive input', () => {
    expect(normalizeWaitlistEmail(null)).toBeNull();
    expect(normalizeWaitlistEmail(`a@${'x'.repeat(320)}.com`)).toBeNull();
  });
});
