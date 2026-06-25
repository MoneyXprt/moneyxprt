import { NextResponse } from 'next/server';
import { evaluateAll } from '@/app/lib/strategies';
import type { FinancialSnapshot } from '@/app/lib/strategies';

const TEST_SNAPSHOT: FinancialSnapshot = {
  w2Income:             243_500,
  bonusIncome:          111_692,
  bonusDeferred:              0,
  bonusTakenAsCash:     111_692,
  income1099:             6_600,
  spouseWorks:          false,
  filingStatus:         'mfj',
  state:                'CA',
  dependentsUnder18:    1,
  hasBusinessEntity:              true,
  businessRevenue:                5_000,
  primaryBusinessNetProfit:       4_000,
  primaryBusinessType:            'smllc',
  primaryHoursPerWeekInBusiness:  5,
  spouseW2Income:                 0,
  spouseBusinessRevenue:          0,
  spouseBusinessNetProfit:        0,
  spouseBusinessType:             '',
  spouseHoursPerWeekInBusiness:   0,
  currentTaxPaid:       110_000,
  monthlySpend:         8_300,
  emergencyFund:        13_000,
  retirementBalance:    200_000,
  homeEquity:             490_000,
  traditionalIraBalance:  300,
  monthlyRentalIncome:    0,
  monthlyDividendIncome:  0,
  hasHsaAvailable:      false,
  consideringRealEstate: true,
  plannedPropertyValue: 350_000,
  repsQualified: true,

  debts:                [],
};

export function GET() {
  const results = evaluateAll(TEST_SNAPSHOT);
  return NextResponse.json(
    { snapshot: TEST_SNAPSHOT, results },
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}
