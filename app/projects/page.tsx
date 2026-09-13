'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/orbit/app-shell';
import { supabaseClient } from '@/lib/supabase/client';
import type { Project } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/orbit/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { FolderKanban, Plus, Calendar, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const projectColors = ['blue', 'green', 'amber', 'red', 'purple', 'cyan'];
const colorMap: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  cyan: 'bg-cyan-500',
};

export default function ProjectsPage() {
  return (
    <AppShell>
      <ProjectsContent />
    </AppShell>
  );
}

function ProjectsContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const { data } = await supabaseClient.from('projects').select('*').order('updated_at', { ascending: false });
    setProjects(data as Project[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabaseClient.from('projects').insert({
        name: name.trim(),
        description: description.trim() || null,
        color,
      });
      if (error) throw error;
      toast.success('Project created');
      setName(''); setDescription(''); setColor('blue'); setDialogOpen(false);
      load();
    } catch {
      toast.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">Your goals and initiatives</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DELT, ORBIT" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {projectColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={cn('w-8 h-8 rounded-full transition-transform', colorMap[c], color === c && 'ring-2 ring-offset-2 ring-ring scale-110')}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!name.trim() || creating}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Create your first project to organize tasks, research, and ideas around a goal."
              actionLabel="Create Project"
              onAction={() => setDialogOpen(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-3 h-3 rounded-full mt-1.5 shrink-0', colorMap[p.color] || 'bg-blue-500')} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-base truncate">{p.name}</h3>
                        <span className="text-xs text-muted-foreground capitalize shrink-0">{p.status}</span>
                      </div>
                      {p.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                      )}
                      {p.deadline && (
                        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(p.deadline).toLocaleDateString()}
                        </div>
                      )}
                      {p.goals && p.goals.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {p.goals.slice(0, 3).map((g, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{g}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
