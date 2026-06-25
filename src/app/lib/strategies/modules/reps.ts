/**
 * Real Estate Professional Status — IRC §469(c)(7)
 *
 * Under the passive activity loss rules, rental losses are normally
 * "passive" and can only offset passive income. IRC §469(c)(7) carves out
 * an exception: a taxpayer who qualifies as a Real Estate Professional (REPS)
 * treats rental activities as non-passive, meaning rental losses — including
 * paper losses from depreciation — can offset any income, including a spouse's
 * W-2 wages.
 *
 * Two statutory tests must BOTH be satisfied each year:
 *   1. More than 750 hours of personal services in real estate trades or
 *      businesses in which the taxpayer materially participates.
 *   2. More than 50% of all personal services performed that year (across
 *      all occupations) are in qualifying real estate activities.
 *
 * In a married-filing-jointly household where one spouse earns a high W-2
 * and the other does not work (or works minimal hours), the non-working
 * spouse can credibly satisfy both tests. The working spouse's W-2 hours
 * will almost always prevent them from clearing test #2.
 *
 * Critical documentation requirement: the IRS requires contemporaneous
 * time logs. Reconstructed records from memory are routinely disallowed
 * on audit (see Moss v. Commissioner, T.C. Memo 2012-219).
 *
 * This strategy itself carries no stand-alone dollar value — its role is
 * to convert otherwise-suspended passive depreciation losses into active
 * deductions against W-2 income, unlocking the depreciation module's value.
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';

const ID   = 'reps';
const NAME = 'Real Estate Professional Status (IRC §469)';

export const reps: Strategy = {
  id: ID,
  name: NAME,
  category: 'realEstate',

  evaluate(s: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category'> = {
      id: ID,
      name: NAME,
      category: 'realEstate',
    };

    // ── Gate 1: no real estate planned → LOCKED ─────────────────────────────
    if (!s.consideringRealEstate) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'Real Estate Professional Status requires active participation in rental real ' +
          'estate activities. No property acquisition is currently planned.',
        unlockCondition:
          'Acquire a rental property and have a non-working spouse commit to tracking ' +
          '750+ hours per year of qualifying real estate activity with contemporaneous logs.',
      };
    }

    // ── Gate 2: spouse works AND business hours are known → VERIFY ──────────
    // If we have the spouse's actual non-RE work hours we can show the exact
    // math rather than a blanket LOCKED. REPS requires RE hours > 50% of all
    // work hours, which simplifies to: RE hours must exceed non-RE hours.
    if (s.spouseWorks && s.spouseHoursPerWeekInBusiness > 0) {
      const annualNonREHours    = Math.round(s.spouseHoursPerWeekInBusiness * 52);
      // 50% test: RE hours must EXCEED non-RE hours.
      // 750-hour test: RE hours must be > 750.
      // Binding constraint = the larger of the two.
      const minREHoursFor50pct  = annualNonREHours + 1;
      const minREHoursRequired  = Math.max(750, minREHoursFor50pct);
      const bindingTest         = minREHoursFor50pct >= 750 ? '50% test' : '750-hour test';

      return {
        ...base,
        state: 'VERIFY',
        estimatedAnnualValue: 0,
        reason:
          `Your spouse spends ${s.spouseHoursPerWeekInBusiness} hours/week ` +
          `(${annualNonREHours} hours/year) in their business. ` +
          `REPS requires real estate hours to exceed 50% of total working hours ` +
          `(IRC §469(c)(7)(B)(ii)). With ${annualNonREHours} annual business hours, ` +
          `the ${bindingTest} requires at least ${minREHoursRequired} real estate hours per year. ` +
          `This is achievable but must be documented with contemporaneous time logs.`,
        blockedBy:
          `spouseHoursPerWeekInBusiness: to satisfy the 50% test, real estate hours must ` +
          `exceed ${annualNonREHours} hours/year. To satisfy both tests, ` +
          `${minREHoursRequired} real estate hours/year are required.`,
      };
    }

    // ── Gate 2b: spouse works but hours unknown → LOCKED ────────────────────
    if (s.spouseWorks) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'REPS requires that more than 50% of a taxpayer\'s total annual working hours ' +
          'be spent in qualifying real estate activities (IRC §469(c)(7)(B)(ii)). A spouse ' +
          'with a full-time W-2 job will almost certainly fail this test because their ' +
          'employment hours count against the 50% threshold — making REPS structurally ' +
          'unavailable to dual-income W-2 households without exceptional circumstances.',
        unlockCondition:
          'Enter your spouse\'s business hours per week in the financial snapshot — ' +
          'if their total non-real-estate hours are low enough, REPS may still be achievable. ' +
          'REPS becomes clearly viable when one spouse leaves traditional employment.',
        blockedBy: 'spouseWorks',
      };
    }

    // ── ACTIVE: considering real estate, non-working spouse available ────────
    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue: 0,  // multiplier — value is realised through the depreciation module
      reason:
        'Your non-working spouse can qualify as a Real Estate Professional by ' +
        'spending 750+ hours per year materially participating in rental real estate ' +
        'activities (property management, tenant relations, maintenance coordination, ' +
        'acquisition research, etc.), provided those hours represent more than 50% of ' +
        'their total annual working time. ' +
        'Once qualified, rental losses — including substantial paper losses from ' +
        'depreciation and cost segregation — are reclassified as non-passive and can ' +
        'directly offset your W-2 income, dollar-for-dollar. ' +
        'REPS is a force-multiplier: it activates the depreciation strategy\'s full value. ' +
        'Critical requirement: maintain contemporaneous time logs throughout the year. ' +
        'Reconstructed records are routinely rejected on audit (IRC §469(c)(7); ' +
        'Reg. §1.469-5T(f)(4)).',
    };
  },
};
