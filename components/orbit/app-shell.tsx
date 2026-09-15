'use client';

import { ReactNode, useEffect } from 'react';
import { Sidebar, MobileNav } from './navigation';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { OrbitIcon } from './orbit-icon';
import { VoiceNotificationListener } from '@/lib/voice/listener';

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



  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <span className="text-primary animate-pulse">
              <OrbitIcon className="h-12 w-12" />
            </span>
            <p className="text-sm text-muted-foreground">Initializing ORBIT...</p>
          </div>
        </div>
      )}

      <div style={{ display: loading ? 'none' : 'block', width: '100%', height: '100%' }}>
        <div className={user ? "flex min-h-screen bg-background" : "min-h-screen bg-background"}>
          {user && <Sidebar />}
          <main className={user ? "flex-1 min-w-0 pb-20 md:pb-0" : ""}>
            {children}
            {user && <VoiceNotificationListener />}
          </main>
          {user && <MobileNav />}
        </div>
      </div>
    </>
  );
}
