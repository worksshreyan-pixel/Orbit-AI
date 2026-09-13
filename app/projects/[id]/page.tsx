'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/orbit/app-shell';
import { supabaseClient } from '@/lib/supabase/client';
import type { Project, Task } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/orbit/empty-state';
import { ArrowLeft, Calendar, CheckCircle2, Circle, Plus, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <ProjectDetail id={params.id} />
    </AppShell>
  );
}

function ProjectDetail({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGoal, setNewGoal] = useState('');
  const [newTask, setNewTask] = useState('');
  const router = useRouter();

  const load = useCallback(async () => {
    const [projRes, tasksRes] = await Promise.all([
      supabaseClient.from('projects').select('*').eq('id', id).single(),
      supabaseClient.from('tasks').select('*, subtasks(*)').eq('project_id', id).order('sort_order'),
    ]);
    setProject(projRes.data as Project);
    setTasks(tasksRes.data as Task[] || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const addGoal = async () => {
    if (!newGoal.trim() || !project) return;
    try {
      const { error } = await supabaseClient.from('projects').update({
        goals: [...(project.goals || []), newGoal.trim()],
      }).eq('id', id);
      if (error) throw error;
      setNewGoal('');
      load();
    } catch { toast.error('Failed to add goal'); }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    try {
      const { error } = await supabaseClient.from('tasks').insert({
        title: newTask.trim(),
        project_id: id,
      });
      if (error) throw error;
      setNewTask('');
      load();
      toast.success('Task added');
    } catch { toast.error('Failed to add task'); }
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'todo' : 'completed';
    await supabaseClient.from('tasks').update({ status: newStatus }).eq('id', taskId);
    load();
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><div className="h-40 rounded-xl bg-muted animate-pulse" /></div>;

  if (!project) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => router.push('/projects')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      <p className="text-sm text-muted-foreground mt-4">Project not found.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/projects')}>
        <ArrowLeft className="h-4 w-4 mr-2" />Back to Projects
      </Button>

      <div>
        <div className="flex items-center gap-3">
          <div className={cn('w-3 h-3 rounded-full')} style={{ background: 'var(--primary)' }} />
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <Badge variant="secondary" className="capitalize">{project.status}</Badge>
        </div>
        {project.description && <p className="text-sm text-muted-foreground mt-2">{project.description}</p>}
        {project.deadline && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Deadline: {new Date(project.deadline).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-muted-foreground" />Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(project.goals || []).map((g, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">{i + 1}</span>
                <span className="text-sm">{g}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Add a goal..." onKeyDown={(e) => e.key === 'Enter' && addGoal()} />
              <Button size="icon" onClick={addGoal}><Plus className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-muted-foreground" />Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No tasks" description="Add tasks to this project to track progress." />
            ) : (
              tasks.map((t) => (
                <button key={t.id} onClick={() => toggleTask(t.id, t.status)} className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-accent transition-colors text-left">
                  {t.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <span className={cn('text-sm flex-1', t.status === 'completed' && 'line-through text-muted-foreground')}>{t.title}</span>
                </button>
              ))
            )}
            <div className="flex gap-2 pt-2">
              <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a task..." onKeyDown={(e) => e.key === 'Enter' && addTask()} />
              <Button size="icon" onClick={addTask}><Plus className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
