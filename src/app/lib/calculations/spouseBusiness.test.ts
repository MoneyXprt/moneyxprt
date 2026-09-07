import { describe, it, expect } from 'vitest';
import {
  getRevenueTier,
  normalizeSpouseBusinessInputs,
  evaluateSpouseBusinessStrategies,
  sumUnlockedAnnualSavings,
  type SpouseBusinessInputs,
} from './spouseBusiness';

/** Fixed "now" so deadline assertions are deterministic. Sept 1, 2026. */
const NOW = new Date(2026, 8, 1);

/** Minimal valid input; override per test. */
function inputs(overrides: Partial<SpouseBusinessInputs> = {}): SpouseBusinessInputs {
  return {
    monthlyRevenue: 0,
    expenseCategories: [],
    familyInvolvement: 'spouse_only',
    marginalRate: 0.32,
    filingStatus: 'mfj',
    dependentsUnder18: 0,
    ownsHome: false,
    ...overrides,
  };
}

function byId(list: ReturnType<typeof evaluateSpouseBusinessStrategies>, id: string) {
  const found = list.find((s) => s.id === id);
  if (!found) throw new Error(`strategy "${id}" not in results`);
  return found;
}

// ─── getRevenueTier ─────────────────────────────────────────────────────────

describe('getRevenueTier', () => {
  it('bands revenue into the four tiers', () => {
    expect(getRevenueTier(0).id).toBe('none');
    expect(getRevenueTier(1).id).toBe('startup');
    expect(getRevenueTier(12_000).id).toBe('startup'); // $1k/mo is still "startup"
    expect(getRevenueTier(12_000.01).id).toBe('growing');
    expect(getRevenueTier(50_000).id).toBe('growing');
    expect(getRevenueTier(50_000.01).id).toBe('established');
    expect(getRevenueTier(500_000).id).toBe('established');
  });

  it('treats negative / non-finite revenue as none (not a valid revenue)', () => {
    expect(getRevenueTier(-100).id).toBe('none');
    expect(getRevenueTier(Number.NaN).id).toBe('none');
    expect(getRevenueTier(Number.POSITIVE_INFINITY).id).toBe('none');
  });
});

// ─── normalizeSpouseBusinessInputs (edge cases) ─────────────────────────────

describe('normalizeSpouseBusinessInputs', () => {
  it('coerces null / undefined revenue to 0', () => {
    expect(normalizeSpouseBusinessInputs(inputs({ monthlyRevenue: null })).monthlyRevenue).toBe(0);
    expect(
      normalizeSpouseBusinessInputs(inputs({ monthlyRevenue: undefined })).monthlyRevenue,
    ).toBe(0);
    expect(normalizeSpouseBusinessInputs(inputs({ monthlyRevenue: -50 })).monthlyRevenue).toBe(0);
  });

  it('coerces undefined / non-array expenses to an empty set', () => {
    expect(
      normalizeSpouseBusinessInputs(inputs({ expenseCategories: undefined })).expenseCategories.size,
    ).toBe(0);
    expect(
      normalizeSpouseBusinessInputs(inputs({ expenseCategories: null })).expenseCategories.size,
    ).toBe(0);
  });

  it('drops unknown expense category ids', () => {
    const normalized = normalizeSpouseBusinessInputs(
      inputs({ expenseCategories: ['home_office', 'bogus' as never] }),
    );
    expect([...normalized.expenseCategories]).toEqual(['home_office']);
  });

  it('records a missing / out-of-range marginal rate as null (fallback applied later)', () => {
    expect(normalizeSpouseBusinessInputs(inputs({ marginalRate: null })).marginalRate).toBeNull();
    expect(
      normalizeSpouseBusinessInputs(inputs({ marginalRate: undefined })).marginalRate,
    ).toBeNull();
    expect(normalizeSpouseBusinessInputs(inputs({ marginalRate: 0 })).marginalRate).toBeNull();
    expect(normalizeSpouseBusinessInputs(inputs({ marginalRate: 42 })).marginalRate).toBeNull();
  });

  it('defaults an unknown family-involvement value to spouse_only', () => {
    expect(
      normalizeSpouseBusinessInputs(inputs({ familyInvolvement: 'whoever' as never }))
        .familyInvolvement,
    ).toBe('spouse_only');
  });

  it('floors negative dependents to 0', () => {
    expect(normalizeSpouseBusinessInputs(inputs({ dependentsUnder18: -3 })).dependentsUnder18).toBe(
      0,
    );
  });
});

// ─── Tier: $0 revenue ───────────────────────────────────────────────────────

describe('evaluateSpouseBusinessStrategies — $0 revenue', () => {
  const result = evaluateSpouseBusinessStrategies(inputs({ monthlyRevenue: 0 }), { now: NOW });

  it('unlocks nothing and totals $0', () => {
    expect(result.every((s) => !s.unlocked)).toBe(true);
    expect(result.every((s) => s.annualSavings === 0)).toBe(true);
    expect(sumUnlockedAnnualSavings(result)).toBe(0);
  });

  it('still surfaces the always-relevant strategies with an unlock condition', () => {
    for (const id of ['qbi', 'solo-401k', 's-corp-election']) {
      expect(byId(result, id).unlockCondition.length).toBeGreaterThan(0);
      expect(byId(result, id).deadline).toBeNull();
    }
  });

  it('omits strategies that are not relevant with these answers', () => {
    for (const id of ['hire-children', 'augusta-rule', 'home-office', 'section-179']) {
      expect(result.find((s) => s.id === id)).toBeUndefined();
    }
  });
});

// ─── Tier: $1–$12K/yr (user has $1,000/month) ───────────────────────────────

describe('evaluateSpouseBusinessStrategies — startup tier ($12,000/yr)', () => {
  const result = evaluateSpouseBusinessStrategies(
    inputs({ monthlyRevenue: 1_000, marginalRate: 0.32 }),
    { now: NOW },
  );

  it('unlocks QBI with a value from real revenue × margin × rate', () => {
    // 12,000 × 0.35 margin × 20% QBI × 0.32 rate = 268.8
    expect(byId(result, 'qbi')).toMatchObject({ unlocked: true, annualSavings: 269 });
  });

  it('unlocks the solo 401(k), capped at net self-employment earnings', () => {
    // net SE = 12,000 × 0.35 × 0.9235 = 3,878.7 ; × 0.32 = 1,241.2
    expect(byId(result, 'solo-401k')).toMatchObject({ unlocked: true, annualSavings: 1241 });
  });

  it('keeps the S-corp locked below $50,000 with its threshold in the message', () => {
    const scorp = byId(result, 's-corp-election');
    expect(scorp.unlocked).toBe(false);
    expect(scorp.annualSavings).toBe(0);
    expect(scorp.unlockCondition).toContain('$50,000');
  });

  it('orders unlocked strategies by savings descending', () => {
    const unlocked = result.filter((s) => s.unlocked).map((s) => s.id);
    expect(unlocked).toEqual(['solo-401k', 'qbi']);
  });

  it('sets the December 31 deadline on the retirement contribution', () => {
    expect(byId(result, 'solo-401k').deadline).toEqual(new Date(2026, 11, 31));
  });
});

// ─── Tier: $12K–$50K/yr ─────────────────────────────────────────────────────

describe('evaluateSpouseBusinessStrategies — growing tier ($36,000/yr)', () => {
  const result = evaluateSpouseBusinessStrategies(
    inputs({ monthlyRevenue: 3_000, marginalRate: 0.32 }),
    { now: NOW },
  );

  it('scales QBI with revenue', () => {
    // 36,000 × 0.35 × 0.20 × 0.32 = 806.4
    expect(byId(result, 'qbi').annualSavings).toBe(806);
  });

  it('still keeps the S-corp locked', () => {
    expect(byId(result, 's-corp-election').unlocked).toBe(false);
  });

  it('unlocks hire-your-children when kids help', () => {
    const withKids = evaluateSpouseBusinessStrategies(
      inputs({ monthlyRevenue: 3_000, marginalRate: 0.32, familyInvolvement: 'kids_help' }),
      { now: NOW },
    );
    // wage/child = min(14,600, 36,000 × 0.20 / 1) = 7,200 ; × 0.32 = 2,304
    expect(byId(withKids, 'hire-children')).toMatchObject({ unlocked: true, annualSavings: 2304 });
    expect(byId(withKids, 'hire-children').deadline).toEqual(new Date(2026, 11, 31));
  });
});

// ─── Tier: $50K+/yr ─────────────────────────────────────────────────────────

describe('evaluateSpouseBusinessStrategies — established tier ($72,000/yr)', () => {
  const result = evaluateSpouseBusinessStrategies(
    inputs({ monthlyRevenue: 6_000, marginalRate: 0.32 }),
    { now: NOW },
  );

  it('unlocks the S-corp election with SE-tax savings on the distribution portion', () => {
    // 72,000 × 0.40 distribution × 0.153 SE rate = 4,406.4
    expect(byId(result, 's-corp-election')).toMatchObject({ unlocked: true, annualSavings: 4406 });
  });

  it('gives the S-corp the March 15 election deadline (next year, since this year passed)', () => {
    expect(byId(result, 's-corp-election').deadline).toEqual(new Date(2027, 2, 15));
  });

  it('totals every unlocked strategy', () => {
    // solo 7,447 + s-corp 4,406 + qbi 1,613
    expect(sumUnlockedAnnualSavings(result)).toBe(7447 + 4406 + 1613);
  });
});

// ─── Edge case: missing marginal rate → labelled fallback ───────────────────

describe('evaluateSpouseBusinessStrategies — missing marginal rate', () => {
  const result = evaluateSpouseBusinessStrategies(
    inputs({ monthlyRevenue: 1_000, marginalRate: null }),
    { now: NOW },
  );

  it('uses the 24% fallback and flags it in the copy', () => {
    // 12,000 × 0.35 × 0.20 × 0.24 = 201.6
    expect(byId(result, 'qbi').annualSavings).toBe(202);
    expect(byId(result, 'qbi').description).toContain('estimated');
  });
});

// ─── Edge case: undefined expenses / expense-driven strategies ──────────────

describe('evaluateSpouseBusinessStrategies — expense-driven strategies', () => {
  it('does not surface home-office or §179 when no expenses are selected', () => {
    const result = evaluateSpouseBusinessStrategies(
      inputs({ monthlyRevenue: 2_000, expenseCategories: undefined }),
      { now: NOW },
    );
    expect(result.find((s) => s.id === 'home-office')).toBeUndefined();
    expect(result.find((s) => s.id === 'section-179')).toBeUndefined();
  });

  it('surfaces home-office as locked when selected but no square footage is known', () => {
    const result = evaluateSpouseBusinessStrategies(
      inputs({ monthlyRevenue: 2_000, expenseCategories: ['home_office'] }),
      { now: NOW },
    );
    const homeOffice = byId(result, 'home-office');
    expect(homeOffice.unlocked).toBe(false);
    expect(homeOffice.unlockCondition).toContain('square feet');
  });

  it('unlocks home-office once square footage is provided', () => {
    const result = evaluateSpouseBusinessStrategies(
      inputs({
        monthlyRevenue: 2_000,
        marginalRate: 0.32,
        expenseCategories: ['home_office'],
        homeOfficeSquareFootage: 150,
      }),
      { now: NOW },
    );
    // min(150, 300) × $5 × 0.32 = 240
    expect(byId(result, 'home-office')).toMatchObject({ unlocked: true, annualSavings: 240 });
  });

});

// ─── Augusta rule depends on home ownership ─────────────────────────────────

describe('evaluateSpouseBusinessStrategies — Augusta rule', () => {
  it('is omitted when the household does not own a home', () => {
    const result = evaluateSpouseBusinessStrategies(
      inputs({ monthlyRevenue: 2_000, ownsHome: false }),
      { now: NOW },
    );
    expect(result.find((s) => s.id === 'augusta-rule')).toBeUndefined();
  });

  it('unlocks with a fixed 14-day value when the household owns a home', () => {
    const result = evaluateSpouseBusinessStrategies(
      inputs({ monthlyRevenue: 2_000, marginalRate: 0.32, ownsHome: true }),
      { now: NOW },
    );
    // $400 × 14 days × 0.32 = 1,792
    expect(byId(result, 'augusta-rule')).toMatchObject({ unlocked: true, annualSavings: 1792 });
  });
});
