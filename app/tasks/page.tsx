'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import type { Task, Project, TaskStatus, TaskPriority } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/orbit/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { CheckSquare, Plus, Circle, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusOptions: { value: TaskStatus; label: string; icon: typeof Circle }[] = [
  { value: 'todo', label: 'To Do', icon: Circle },
  { value: 'in_progress', label: 'In Progress', icon: Clock },
  { value: 'waiting', label: 'Waiting', icon: AlertCircle },
  { value: 'completed', label: 'Completed', icon: CheckCircle2 },
];

const priorityColors: Record<TaskPriority, string> = {
  urgent: 'border-l-destructive',
  high: 'border-l-warning',
  medium: 'border-l-primary',
  low: 'border-l-muted',
};

const priorityBadge: Record<TaskPriority, string> = {
  urgent: 'bg-destructive/10 text-destructive',
  high: 'bg-warning/10 text-warning',
  medium: 'bg-primary/10 text-primary',
  low: 'bg-muted text-muted-foreground',
};

export default function TasksPage() {
  return (
      <TasksContent />
  );
}

function TasksContent() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newProject, setNewProject] = useState('none');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const [tasksRes, projRes] = await Promise.all([
      supabaseClient.from('tasks').select('*, project:projects(*)').order('sort_order'),
      supabaseClient.from('projects').select('*').order('name'),
    ]);
    setTasks(tasksRes.data as Task[] || []);
    setProjects(projRes.data as Project[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabaseClient.from('tasks').insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        priority: newPriority,
        project_id: newProject === 'none' ? null : newProject,
      });
      if (error) throw error;
      toast.success('Task created');
      setNewTitle(''); setNewDesc(''); setNewPriority('medium'); setNewProject('none');
      setDialogOpen(false);
      load();
    } catch { toast.error('Failed to create task'); }
    finally { setCreating(false); }
  };

  const toggleStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    await supabaseClient.from('tasks').update({ status: newStatus }).eq('id', task.id);
    load();
  };

  const cycleStatus = async (task: Task) => {
    const order: TaskStatus[] = ['todo', 'in_progress', 'waiting', 'completed'];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    await supabaseClient.from('tasks').update({ status: next }).eq('id', task.id);
    load();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">Everything you need to do</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="What needs to be done?" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={newPriority} onValueChange={(v) => setNewPriority(v as TaskPriority)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select value={newProject} onValueChange={setNewProject}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newTitle.trim() || creating}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        <button
          onClick={() => setFilter('all')}
          className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap', filter === 'all' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}
        >
          All ({tasks.length})
        </button>
        {statusOptions.map((opt) => {
          const count = tasks.filter((t) => t.status === opt.value).length;
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap', filter === opt.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState icon={CheckSquare} title="No tasks here" description="Create a task or ask ORBIT to help plan your work." actionLabel="New Task" onAction={() => setDialogOpen(true)} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <Card key={task.id} className={cn('border-l-2', priorityColors[task.priority])}>
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleStatus(task)} className="shrink-0">
                    {task.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', task.status === 'completed' && 'line-through text-muted-foreground')}>{task.title}</p>
                    {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium uppercase', priorityBadge[task.priority])}>{task.priority}</span>
                      {task.project && <span className="text-xs text-muted-foreground">{task.project.name}</span>}
                      {task.due_date && <span className="text-xs text-muted-foreground">{new Date(task.due_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <button onClick={() => cycleStatus(task)} className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent transition-colors capitalize shrink-0">
                    {task.status.replace('_', ' ')}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
