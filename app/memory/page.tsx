'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/orbit/app-shell';
import { supabaseClient } from '@/lib/supabase/client';
import type { Memory, MemoryCategory } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/orbit/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Brain, Plus, Star, Target, Lightbulb, CheckSquare, Settings, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const categoryConfig: Record<MemoryCategory, { label: string; icon: typeof Brain; color: string }> = {
  preference: { label: 'Preferences', icon: Settings, color: 'bg-blue-500/10 text-blue-500' },
  project: { label: 'Projects', icon: Target, color: 'bg-green-500/10 text-green-500' },
  goal: { label: 'Goals', icon: Target, color: 'bg-amber-500/10 text-amber-500' },
  decision: { label: 'Decisions', icon: CheckSquare, color: 'bg-purple-500/10 text-purple-500' },
  context: { label: 'Context', icon: FileText, color: 'bg-cyan-500/10 text-cyan-500' },
  instruction: { label: 'Instructions', icon: Lightbulb, color: 'bg-red-500/10 text-red-500' },
};

export default function MemoryPage() {
  return (
    <AppShell>
      <MemoryContent />
    </AppShell>
  );
}

function MemoryContent() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MemoryCategory | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('context');
  const [importance, setImportance] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const { data } = await supabaseClient.from('memories').select('*').order('importance', { ascending: false }).order('updated_at', { ascending: false });
    setMemories(data as Memory[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? memories : memories.filter((m) => m.category === filter);

  const handleCreate = async () => {
    if (!key.trim() || !value.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabaseClient.from('memories').insert({
        key: key.trim(),
        value: value.trim(),
        category,
        importance,
      });
      if (error) throw error;
      toast.success('Memory saved');
      setKey(''); setValue(''); setCategory('context'); setImportance('normal');
      setDialogOpen(false);
      load();
    } catch { toast.error('Failed to save memory'); }
    finally { setCreating(false); }
  };

  const importanceStars: Record<string, number> = { low: 0, normal: 1, high: 2, critical: 3 };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
          <p className="text-sm text-muted-foreground mt-1">What ORBIT remembers about you</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Memory</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Input id="key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. preferred_language" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Textarea id="value" value={value} onChange={(e) => setValue(e.target.value)} rows={3} placeholder="What should ORBIT remember?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as MemoryCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Importance</Label>
                  <Select value={importance} onValueChange={(v) => setImportance(v as 'low' | 'normal' | 'high' | 'critical')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!key.trim() || !value.trim() || creating}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        <button
          onClick={() => setFilter('all')}
          className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap', filter === 'all' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}
        >
          All ({memories.length})
        </button>
        {Object.entries(categoryConfig).map(([key, config]) => {
          const count = memories.filter((m) => m.category === key).length;
          return (
            <button
              key={key}
              onClick={() => setFilter(key as MemoryCategory)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap', filter === key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}
            >
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Brain}
              title="No memories stored"
              description="ORBIT learns from your interactions. Add memories manually, or let the agent capture context during runs."
              actionLabel="Add Memory"
              onAction={() => setDialogOpen(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((mem) => {
            const config = categoryConfig[mem.category];
            const Icon = config.icon;
            return (
              <Card key={mem.id} className="hover:bg-accent/30 transition-colors">
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0', config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{mem.key}</p>
                        {importanceStars[mem.importance] > 0 && (
                          <div className="flex gap-0.5">
                            {Array.from({ length: importanceStars[mem.importance] }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-warning text-warning" />
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{mem.value}</p>
                      <span className="text-[10px] text-muted-foreground mt-1 block">{config.label}</span>
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
