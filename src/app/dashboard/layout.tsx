import BottomNav from '@/components/BottomNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="h-20" />
      <BottomNav />
    </>
  );
}
