'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/orbit/app-shell';
import { supabaseClient } from '@/lib/supabase/client';
import type { Approval, ApprovalStatus, PermissionLevel } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/orbit/empty-state';
import { ShieldCheck, Check, X, ShieldAlert, Lock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const levelConfig: Record<PermissionLevel, { label: string; icon: typeof Shield; color: string }> = {
  safe: { label: 'Safe', icon: ShieldCheck, color: 'bg-success/10 text-success' },
  approval: { label: 'Approval Required', icon: Shield, color: 'bg-warning/10 text-warning' },
  explicit: { label: 'Explicit Confirmation', icon: Lock, color: 'bg-destructive/10 text-destructive' },
};

const statusConfig: Record<ApprovalStatus, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  expired: 'bg-muted text-muted-foreground',
};

export default function ApprovalsPage() {
  return (
    <AppShell>
      <ApprovalsContent />
    </AppShell>
  );
}

function ApprovalsContent() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [reviewNote, setReviewNote] = useState<string>('');

  const load = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    let query = supabaseClient.from('approvals').select('*').order('created_at', { ascending: false });
    if (filter === 'pending') query = query.eq('status', 'pending');
    const { data } = await query;
    setApprovals(data as Approval[] || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      const { error } = await supabaseClient.from('approvals').update({
        status: decision,
        reviewed_at: new Date().toISOString(),
        reviewer_note: reviewNote || null,
      }).eq('id', id);
      if (error) throw error;
      toast.success(decision === 'approved' ? 'Action approved' : 'Action rejected');
      setReviewNote('');
      load();
    } catch {
      toast.error('Failed to update approval');
    }
  };

  const filtered = filter === 'pending' ? approvals.filter((a) => a.status === 'pending') : approvals;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">Review actions ORBIT wants to take</p>
        </div>
        <div className="flex gap-2">
          {(['pending', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                filter === f ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              {f === 'pending' ? 'Pending' : 'All'}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5" />
            Three permission levels: Safe (auto-allowed), Approval (you confirm), Explicit (strong confirmation for destructive actions).
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={ShieldCheck}
              title="No approvals needed"
              description="When ORBIT wants to perform an action that requires your permission, it will appear here for review."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const level = levelConfig[a.permission_level];
            const LevelIcon = level.icon;
            return (
              <Card key={a.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0', level.color)}>
                      <LevelIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{a.action_description}</p>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', statusConfig[a.status])}>
                          {a.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{a.tool_name}</p>
                      {a.reason && <p className="text-xs text-muted-foreground">{a.reason}</p>}
                      {a.changes && Object.keys(a.changes).length > 0 && (
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Changes</p>
                          <pre className="text-xs overflow-x-auto">{JSON.stringify(a.changes, null, 2)}</pre>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', level.color)}>
                          {level.label}
                        </span>
                      </div>
                      {a.status === 'pending' && (
                        <>
                          <Textarea
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            placeholder="Add a note (optional)..."
                            rows={2}
                            className="mt-2"
                          />
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" onClick={() => handleReview(a.id, 'approved')}>
                              <Check className="h-4 w-4 mr-1.5" />Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleReview(a.id, 'rejected')}>
                              <X className="h-4 w-4 mr-1.5" />Reject
                            </Button>
                          </div>
                        </>
                      )}
                      {a.reviewed_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Reviewed {new Date(a.reviewed_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
