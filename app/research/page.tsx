'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import type { Research, Project } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/orbit/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Search, Plus, FileText, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
};

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
};

export default function ResearchPage() {
  return (
      <ResearchContent />
  );
}

function ResearchContent() {
  const [items, setItems] = useState<Research[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState('none');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const [resRes, projRes] = await Promise.all([
      supabaseClient.from('research').select('*, project:projects(*)').order('created_at', { ascending: false }),
      supabaseClient.from('projects').select('*').order('name'),
    ]);
    setItems(resRes.data as Research[] || []);
    setProjects(projRes.data as Project[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!topic.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabaseClient.from('research').insert({
        topic: topic.trim(),
        query: query.trim() || null,
        project_id: projectId === 'none' ? null : projectId,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Research topic created');
      setTopic(''); setQuery(''); setProjectId('none');
      setDialogOpen(false);
      load();
    } catch { toast.error('Failed to create research'); }
    finally { setCreating(false); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
          <p className="text-sm text-muted-foreground mt-1">Topics, sources, and findings</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Research Topic</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What do you want to research?" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="query">Research question (optional)</Label>
                <Textarea id="query" value={query} onChange={(e) => setQuery(e.target.value)} rows={2} placeholder="Specific question to investigate" />
              </div>
              <div className="space-y-2">
                <Label>Associated project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!topic.trim() || creating}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            Web research tools will be connected here. You can create research topics now — ORBIT will process them once a search API integration is configured.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Search}
              title="No research topics"
              description="Create a research topic for ORBIT to investigate. Findings will be stored and can be associated with projects."
              actionLabel="New Research"
              onAction={() => setDialogOpen(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {item.status === 'in_progress' ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> :
                     <FileText className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.topic}</p>
                    {item.query && <p className="text-xs text-muted-foreground mt-1">{item.query}</p>}
                    {item.summary && <p className="text-sm mt-2 p-2 rounded-lg bg-muted/50">{item.summary}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', statusColors[item.status])}>
                        {statusLabels[item.status]}
                      </span>
                      {item.project && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Link2 className="h-3 w-3" />{item.project.name}
                        </span>
                      )}
                      {item.sources && item.sources.length > 0 && (
                        <span className="text-xs text-muted-foreground">{item.sources.length} sources</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
