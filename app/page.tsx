'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/orbit/app-shell';
import { supabaseClient } from '@/lib/supabase/client';
import type { Task, Project, AgentRun, Approval, Notification } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CommandInput } from '@/components/orbit/command-input';
import { AgentTimeline } from '@/components/orbit/agent-timeline';
import { EmptyState } from '@/components/orbit/empty-state';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bot,
  ShieldCheck,
  Plus,
  FolderKanban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function HomePage() {
  return (
    <AppShell>
      <HomeContent />
    </AppShell>
  );
}

function HomeContent() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRun, setActiveRun] = useState<AgentRun | null>(null);
  const router = useRouter();

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const [tasksRes, projectsRes, runsRes, approvalsRes, notifsRes] = await Promise.all([
      supabaseClient.from('tasks').select('*, project:projects(*)').eq('status', 'todo').order('priority', { ascending: false }).limit(5),
      supabaseClient.from('projects').select('*').eq('status', 'active').order('updated_at', { ascending: false }).limit(4),
      supabaseClient.from('agent_runs').select('*').order('created_at', { ascending: false }).limit(3),
      supabaseClient.from('approvals').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
      supabaseClient.from('notifications').select('*').eq('read', false).order('created_at', { ascending: false }).limit(5),
    ]);

    setTasks(tasksRes.data as Task[] || []);
    setProjects(projectsRes.data as Project[] || []);
    setAgentRuns(runsRes.data as AgentRun[] || []);
    setApprovals(approvalsRes.data as Approval[] || []);
    setNotifications(notifsRes.data as Notification[] || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const priorityColors: Record<string, string> = {
    urgent: 'bg-destructive/10 text-destructive border-destructive/20',
    high: 'bg-warning/10 text-warning border-warning/20',
    medium: 'bg-primary/10 text-primary border-primary/20',
    low: 'bg-muted text-muted-foreground border-border',
  };

  const statusLabels: Record<string, string> = {
    understanding: 'Understanding',
    planning: 'Planning',
    researching: 'Researching',
    awaiting_approval: 'Awaiting Approval',
    executing: 'Executing',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell ORBIT what you want to do.
        </p>
      </div>

      {/* Command Input */}
      <CommandInput onRunStart={loadData} />

      {/* Active Agent Run */}
      {activeRun && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Active Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AgentTimeline run={activeRun} />
          </CardContent>
        </Card>
      )}

      {/* Pending Approvals */}
      {approvals.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-warning" />
              Pending Approvals
              <Badge variant="secondary" className="ml-auto">{approvals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {approvals.map((a) => (
              <Link
                key={a.id}
                href="/approvals"
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.action_description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.tool_name}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'New Task', icon: Plus, href: '/tasks' },
          { label: 'New Project', icon: FolderKanban, href: '/projects' },
          { label: 'Capture Idea', icon: ArrowRight, href: '/ideas' },
          { label: 'View Agent', icon: Bot, href: '/agent' },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-center"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          );
        })}
      </div>

      {/* Two column layout */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Priority Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Priority Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No pending tasks"
                description="Everything is done. Ask ORBIT to create a task."
                actionLabel="Go to Tasks"
                onAction={() => router.push('/tasks')}
              />
            ) : (
              <div className="space-y-1.5">
                {tasks.map((task) => (
                  <Link
                    key={task.id}
                    href="/tasks"
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors group"
                  >
                    <span className={cn('w-2 h-2 rounded-full shrink-0', priorityColors[task.priority].split(' ')[0])} />
                    <span className="text-sm flex-1 truncate">{task.title}</span>
                    {task.project && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">{task.project.name}</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Projects */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description="Create your first project to get organized."
                actionLabel="New Project"
                onAction={() => router.push('/projects')}
              />
            ) : (
              <div className="space-y-1.5">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">{project.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{project.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Agent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            Recent Agent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : agentRuns.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No agent runs yet"
              description="Submit a command above to see ORBIT in action."
            />
          ) : (
            <div className="space-y-2">
              {agentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/agent/${run.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  <div className={cn(
                    'mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                    run.status === 'completed' ? 'bg-success/10 text-success' :
                    run.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                    'bg-primary/10 text-primary'
                  )}>
                    {run.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                     run.status === 'failed' ? <AlertCircle className="h-3.5 w-3.5" /> :
                     <Clock className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{run.request}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{statusLabels[run.status]}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
