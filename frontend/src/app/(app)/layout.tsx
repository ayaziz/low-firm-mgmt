'use client';

import AppShell from '@/components/layout/AppShell';
import IdleTimeout from '@/components/IdleTimeout';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <IdleTimeout />
      <AppShell>{children}</AppShell>
    </>
  );
}
