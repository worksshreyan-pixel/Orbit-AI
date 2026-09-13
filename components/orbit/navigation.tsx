'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  Bot,
  FolderKanban,
  CheckSquare,
  Lightbulb,
  Search,
  Brain,
  ShieldCheck,
  Bell,
  Settings,
} from 'lucide-react';

export const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/agent', label: 'Agent', icon: Bot },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/ideas', label: 'Ideas', icon: Lightbulb },
  { href: '/research', label: 'Research', icon: Search },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 border-r border-border bg-sidebar h-screen sticky top-0 shrink-0">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
        <span className="text-primary">
          <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="7.5" fill="currentColor" />
            <ellipse cx="16" cy="16" rx="14" ry="6" stroke="currentColor" strokeWidth="1.5" opacity="0.5" transform="rotate(-20 16 16)" />
            <circle cx="28" cy="11" r="2" fill="currentColor" opacity="0.7" />
          </svg>
        </span>
        <span className="font-semibold text-lg tracking-tight">ORBIT</span>
      </div>
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  const mobileItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/agent', label: 'Agent', icon: Bot },
    { href: '/tasks', label: 'Tasks', icon: CheckSquare },
    { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-sidebar border-t border-sidebar-border pb-safe-area">
      <div className="flex items-stretch justify-around px-2 pt-1.5 pb-2">
        {mobileItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-[56px] transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
