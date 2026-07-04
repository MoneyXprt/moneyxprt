import type { ReactNode } from 'react';

type Variant = 'default' | 'hero' | 'accent' | 'muted' | 'warning';

const variantClasses: Record<Variant, string> = {
  default: 'bg-white border border-gray-100 shadow-sm',
  hero:    'bg-[#1B3A2D] text-white',
  accent:  'bg-white border-l-4 border-l-emerald-500 border border-gray-100 shadow-sm',
  muted:   'bg-gray-50 border border-gray-100',
  warning: 'bg-white border-l-4 border-l-amber-400 border border-gray-100 shadow-sm',
};

export function Card({
  variant = 'default',
  className = '',
  children,
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl p-5 ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
