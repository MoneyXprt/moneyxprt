import { useMemo, useState } from 'react';

/** Controls a locally held, branchable question sequence without persisting answers. */
export function useQuestionFlow<TStep extends string>(steps: readonly TStep[]) {
  const [currentStep, setCurrentStep] = useState<TStep>(steps[0]);
  const [, setHistory] = useState<TStep[]>([]);
  const currentIndex = Math.max(0, steps.indexOf(currentStep));

  return useMemo(() => ({
    currentStep,
    currentIndex,
    totalSteps: steps.length,
    goTo: (next: TStep) => {
      setHistory((previous) => [...previous, currentStep]);
      setCurrentStep(next);
    },
    back: () => {
      setHistory((previous) => {
        const prior = previous.at(-1);
        if (prior) setCurrentStep(prior);
        return previous.slice(0, -1);
      });
    },
  }), [currentIndex, currentStep, steps.length]);
}
