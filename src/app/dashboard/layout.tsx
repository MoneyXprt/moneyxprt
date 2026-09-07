'use client';

import { usePathname } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

// Fullscreen wizard-style pages (dark/light full-height flex-column layout with a
// bottom-pinned CTA) that would visually collide with the fixed BottomNav + its
// reserved-space spacer below. Route groups can't solve this: a nested layout only
// ever adds to the layout chain, it can never remove dashboard/layout.tsx from routes
// nested under app/dashboard/ — so gating here, by pathname, is the actual fix.
const FULLSCREEN_ROUTES = [
  '/dashboard/freedom-vision',
  '/dashboard/freedom-calculator',
  // Life Events Engine — selection screen + every guided flow run as a
  // distraction-free wizard with their own back nav, no BottomNav.
  '/dashboard/life-events',
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_ROUTES.some(route => pathname.startsWith(route));

  if (isFullscreen) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <div className="h-20" />
      <BottomNav />
    </>
  );
}
