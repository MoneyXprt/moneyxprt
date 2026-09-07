export const GOAL_CATEGORIES = [
  'emergency', 'home', 'travel', 'investment', 'education', 'other',
] as const;

export type GoalCategory = typeof GOAL_CATEGORIES[number];

export interface GoalBucketInput {
  name: string;
  category: GoalCategory;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | null;
}

export interface GoalBucket extends GoalBucketInput {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/** Normalizes a goal bucket at the application boundary before saving it. */
export function normalizeGoalBucket(input: GoalBucketInput): GoalBucketInput {
  const name = input.name.trim();
  if (!name || name.length > 80) throw new Error('Goal name must be 1–80 characters.');
  if (!GOAL_CATEGORIES.includes(input.category)) throw new Error('Choose a valid goal category.');
  if (!isAmount(input.targetAmount) || input.targetAmount <= 0) throw new Error('Target amount must be greater than zero.');
  if (!isAmount(input.currentAmount)) throw new Error('Current amount must be zero or greater.');
  if (input.targetDate && !isIsoDate(input.targetDate)) throw new Error('Target date must use YYYY-MM-DD.');
  return {
    name,
    category: input.category,
    targetAmount: roundCurrency(input.targetAmount),
    currentAmount: roundCurrency(input.currentAmount),
    targetDate: input.targetDate || null,
  };
}

/** Returns a bounded, display-ready completion percentage. */
export function goalProgressPercent(goal: Pick<GoalBucket, 'targetAmount' | 'currentAmount'>): number {
  return Math.max(0, Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)));
}

function isAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
