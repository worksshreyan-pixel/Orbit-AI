import { cn } from '@/lib/utils';

export function OrbitIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="7.5" fill="currentColor" />
      <ellipse cx="16" cy="16" rx="14" ry="6" stroke="currentColor" strokeWidth="1.5" opacity="0.5" transform="rotate(-20 16 16)" />
      <circle cx="28" cy="11" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="4" cy="21" r="1.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
