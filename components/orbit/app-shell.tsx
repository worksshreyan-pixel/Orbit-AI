'use client';

import { ReactNode, useEffect } from 'react';
import { Sidebar, MobileNav } from './navigation';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { OrbitIcon } from './orbit-icon';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await fetch('/api/seed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
      } catch {
        // Silently fail — seeding is best-effort
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <span className="text-primary animate-pulse">
            <OrbitIcon className="h-12 w-12" />
          </span>
          <p className="text-sm text-muted-foreground">Initializing ORBIT...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
