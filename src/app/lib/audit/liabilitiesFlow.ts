import type { FinancialSnapshot } from '@/app/lib/strategies/types';

export type LiabilityDebtType = 'car_loan' | 'student_loan' | 'personal_loan' | 'credit_card' | 'business_loan' | 'other';
type LiabilitySelectionField = 'hasCarLoan' | 'hasStudentLoan' | 'hasPersonalLoan' | 'hasCreditCard' | 'hasBusinessLoan' | 'hasOtherDebt';
type LiabilityStringField = Exclude<keyof LiabilitiesFormState, LiabilitySelectionField>;

/** Local Liability answers held until the full Audit saves a snapshot. */
export interface LiabilitiesFormState {
  hasCarLoan: boolean; hasStudentLoan: boolean; hasPersonalLoan: boolean; hasCreditCard: boolean; hasBusinessLoan: boolean; hasOtherDebt: boolean;
  carLoanBalance: string; carLoanRate: string; carLoanPayment: string;
  studentLoanBalance: string; studentLoanRate: string; studentLoanPayment: string;
  personalLoanBalance: string; personalLoanRate: string; personalLoanPayment: string;
  creditCardBalance: string; creditCardRate: string; creditCardPayment: string;
  businessLoanBalance: string; businessLoanRate: string; businessLoanPayment: string;
  otherDebtLabel: string; otherDebtBalance: string; otherDebtRate: string; otherDebtPayment: string;
  carLoanOriginalBalance: string; studentLoanOriginalBalance: string; personalLoanOriginalBalance: string;
  creditCardOriginalBalance: string; businessLoanOriginalBalance: string; otherDebtOriginalBalance: string;
}

/** A live debt record used to render a read-only Audit summary. */
export interface TrackedLiabilityDebt { name: string; balance: number; rate: number; payment: number; }

export interface LiabilityDebtDefinition {
  type: LiabilityDebtType; label: string; selectionKey: LiabilitySelectionField;
  balanceKey: LiabilityStringField; rateKey: LiabilityStringField; paymentKey: LiabilityStringField;
  originalBalanceKey: LiabilityStringField; labelKey?: LiabilityStringField;
}

export const LIABILITY_DEBT_DEFINITIONS: readonly LiabilityDebtDefinition[] = [
  { type: 'car_loan', label: 'Car loan', selectionKey: 'hasCarLoan', balanceKey: 'carLoanBalance', rateKey: 'carLoanRate', paymentKey: 'carLoanPayment', originalBalanceKey: 'carLoanOriginalBalance' },
  { type: 'student_loan', label: 'Student loans', selectionKey: 'hasStudentLoan', balanceKey: 'studentLoanBalance', rateKey: 'studentLoanRate', paymentKey: 'studentLoanPayment', originalBalanceKey: 'studentLoanOriginalBalance' },
  { type: 'personal_loan', label: 'Personal loan', selectionKey: 'hasPersonalLoan', balanceKey: 'personalLoanBalance', rateKey: 'personalLoanRate', paymentKey: 'personalLoanPayment', originalBalanceKey: 'personalLoanOriginalBalance' },
  { type: 'credit_card', label: 'Credit card debt', selectionKey: 'hasCreditCard', balanceKey: 'creditCardBalance', rateKey: 'creditCardRate', paymentKey: 'creditCardPayment', originalBalanceKey: 'creditCardOriginalBalance' },
  { type: 'business_loan', label: 'Business loan', selectionKey: 'hasBusinessLoan', balanceKey: 'businessLoanBalance', rateKey: 'businessLoanRate', paymentKey: 'businessLoanPayment', originalBalanceKey: 'businessLoanOriginalBalance' },
  { type: 'other', label: 'Other', selectionKey: 'hasOtherDebt', balanceKey: 'otherDebtBalance', rateKey: 'otherDebtRate', paymentKey: 'otherDebtPayment', originalBalanceKey: 'otherDebtOriginalBalance', labelKey: 'otherDebtLabel' },
];

export const LIABILITY_MAX_STEPS = 26;
export type LiabilityStep = 'debt-types' | `${LiabilityDebtType}-tracked` | `${LiabilityDebtType}-paid-off` | `${LiabilityDebtType}-label` | `${LiabilityDebtType}-balance` | `${LiabilityDebtType}-rate` | `${LiabilityDebtType}-payment` | `${LiabilityDebtType}-original-balance`;

type LiabilitySnapshotFields = Pick<FinancialSnapshot, 'carLoanBalance' | 'carLoanRate' | 'carLoanPayment' | 'studentLoanBalance' | 'studentLoanRate' | 'studentLoanPayment' | 'personalLoanBalance' | 'personalLoanRate' | 'personalLoanPayment' | 'creditCardBalance' | 'creditCardRate' | 'creditCardPayment' | 'businessLoanBalance' | 'businessLoanRate' | 'businessLoanPayment' | 'otherDebtLabel' | 'otherDebtBalance' | 'otherDebtRate' | 'otherDebtPayment' | 'debts'>;

/** Supplies blank, local-only Liability answers for a new Audit flow. */
export function createEmptyLiabilitiesForm(): LiabilitiesFormState {
  return { hasCarLoan: false, hasStudentLoan: false, hasPersonalLoan: false, hasCreditCard: false, hasBusinessLoan: false, hasOtherDebt: false, carLoanBalance: '', carLoanRate: '', carLoanPayment: '', studentLoanBalance: '', studentLoanRate: '', studentLoanPayment: '', personalLoanBalance: '', personalLoanRate: '', personalLoanPayment: '', creditCardBalance: '', creditCardRate: '', creditCardPayment: '', businessLoanBalance: '', businessLoanRate: '', businessLoanPayment: '', otherDebtLabel: '', otherDebtBalance: '', otherDebtRate: '', otherDebtPayment: '', carLoanOriginalBalance: '', studentLoanOriginalBalance: '', personalLoanOriginalBalance: '', creditCardOriginalBalance: '', businessLoanOriginalBalance: '', otherDebtOriginalBalance: '' };
}

/** Builds the active liability path while holding the maximum step count fixed. */
export function getLiabilitySteps(form: LiabilitiesFormState, trackedDebts: Readonly<Record<string, TrackedLiabilityDebt>>, paidOffDebtTypes: ReadonlySet<string>): LiabilityStep[] {
  const steps: LiabilityStep[] = ['debt-types'];
  for (const debt of LIABILITY_DEBT_DEFINITIONS) {
    if (!form[debt.selectionKey]) continue;
    if (trackedDebts[debt.type]) { steps.push(`${debt.type}-tracked`); continue; }
    if (paidOffDebtTypes.has(debt.type)) { steps.push(`${debt.type}-paid-off`); continue; }
    if (debt.labelKey) steps.push(`${debt.type}-label`);
    steps.push(`${debt.type}-balance`, `${debt.type}-rate`, `${debt.type}-payment`, `${debt.type}-original-balance`);
  }
  return steps;
}

/** Converts local Liability answers into the existing zero-safe snapshot fields. */
export function buildLiabilitiesSnapshotFields(form: LiabilitiesFormState): LiabilitySnapshotFields {
  const number = (value: string): number => value === '' ? 0 : Number.parseFloat(value.replace(/,/g, '')) || 0;
  const selected = (key: LiabilitySelectionField, value: string): number => form[key] ? number(value) : 0;
  return {
    carLoanBalance: selected('hasCarLoan', form.carLoanBalance), carLoanRate: selected('hasCarLoan', form.carLoanRate), carLoanPayment: selected('hasCarLoan', form.carLoanPayment),
    studentLoanBalance: selected('hasStudentLoan', form.studentLoanBalance), studentLoanRate: selected('hasStudentLoan', form.studentLoanRate), studentLoanPayment: selected('hasStudentLoan', form.studentLoanPayment),
    personalLoanBalance: selected('hasPersonalLoan', form.personalLoanBalance), personalLoanRate: selected('hasPersonalLoan', form.personalLoanRate), personalLoanPayment: selected('hasPersonalLoan', form.personalLoanPayment),
    creditCardBalance: selected('hasCreditCard', form.creditCardBalance), creditCardRate: selected('hasCreditCard', form.creditCardRate), creditCardPayment: selected('hasCreditCard', form.creditCardPayment),
    businessLoanBalance: selected('hasBusinessLoan', form.businessLoanBalance), businessLoanRate: selected('hasBusinessLoan', form.businessLoanRate), businessLoanPayment: selected('hasBusinessLoan', form.businessLoanPayment),
    otherDebtLabel: form.hasOtherDebt ? form.otherDebtLabel.trim() : '', otherDebtBalance: selected('hasOtherDebt', form.otherDebtBalance), otherDebtRate: selected('hasOtherDebt', form.otherDebtRate), otherDebtPayment: selected('hasOtherDebt', form.otherDebtPayment),
    debts: [
      ...(form.hasCarLoan ? [{ type: 'car', balance: number(form.carLoanBalance), rate: number(form.carLoanRate) / 100, payment: number(form.carLoanPayment) }] : []),
      ...(form.hasStudentLoan ? [{ type: 'student', balance: number(form.studentLoanBalance), rate: number(form.studentLoanRate) / 100, payment: number(form.studentLoanPayment) }] : []),
      ...(form.hasPersonalLoan ? [{ type: 'personal', balance: number(form.personalLoanBalance), rate: number(form.personalLoanRate) / 100, payment: number(form.personalLoanPayment) }] : []),
      ...(form.hasCreditCard ? [{ type: 'creditCard', balance: number(form.creditCardBalance), rate: number(form.creditCardRate) / 100, payment: number(form.creditCardPayment) }] : []),
      ...(form.hasBusinessLoan ? [{ type: 'business', balance: number(form.businessLoanBalance), rate: number(form.businessLoanRate) / 100, payment: number(form.businessLoanPayment) }] : []),
      ...(form.hasOtherDebt ? [{ type: form.otherDebtLabel.trim() || 'other', balance: number(form.otherDebtBalance), rate: number(form.otherDebtRate) / 100, payment: number(form.otherDebtPayment) }] : []),
    ],
  };
}
