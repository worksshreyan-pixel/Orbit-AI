'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import type { Idea } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/orbit/empty-state';
import { Lightbulb, Plus, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  new: 'bg-primary/10 text-primary',
  reviewed: 'bg-warning/10 text-warning',
  converted_task: 'bg-success/10 text-success',
  converted_project: 'bg-success/10 text-success',
  converted_research: 'bg-purple-500/10 text-purple-500',
  archived: 'bg-muted text-muted-foreground',
};

export default function IdeasPage() {
  return (
      <IdeasContent />
  );
}

function IdeasContent() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const { data } = await supabaseClient.from('ideas').select('*, project:projects(*)').order('created_at', { ascending: false });
    setIdeas(data as Idea[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean);
      const { error } = await supabaseClient.from('ideas').insert({
        title: title.trim(),
        description: description.trim() || null,
        tags: tagArray,
      });
      if (error) throw error;
      toast.success('Idea captured');
      setTitle(''); setDescription(''); setTags('');
      setShowForm(false);
      load();
    } catch { toast.error('Failed to capture idea'); }
    finally { setCreating(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabaseClient.from('ideas').update({ status }).eq('id', id);
    load();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ideas</h1>
          <p className="text-sm text-muted-foreground mt-1">Capture first, decide later</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />Capture
        </Button>
      </div>

      {showForm && (
        <Card className="animate-slide-up">
          <CardContent className="py-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="idea-title">Title</Label>
              <Input id="idea-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the idea?" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idea-desc">Description (optional)</Label>
              <Textarea id="idea-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Add more context..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idea-tags">Tags (comma separated)</Label>
              <Input id="idea-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="feature, research, design" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={!title.trim() || creating}>Save Idea</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : ideas.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Lightbulb}
              title="No ideas yet"
              description="Capture an idea the moment it strikes. You can decide what to do with it later."
              actionLabel="Capture Idea"
              onAction={() => setShowForm(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <Card key={idea.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Lightbulb className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{idea.title}</p>
                    {idea.description && <p className="text-xs text-muted-foreground mt-1">{idea.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium capitalize', statusColors[idea.status])}>
                        {idea.status.replace('_', ' ')}
                      </span>
                      {idea.tags && idea.tags.map((t, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </div>
                  {idea.status === 'new' && (
                    <Button variant="ghost" size="sm" onClick={() => updateStatus(idea.id, 'reviewed')}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
