import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { ToolDefinition } from '@/lib/types/agent';
import { prioritizeTasks, generateStudyPlan, normalizeTask } from '../providers/prioritization';
import { parseTimetable, getFreeSlots, totalFreeMinutes, summariseDay } from '../providers/timetable';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Try to extract and parse a timetable from the user's memories */
async function loadTimetable(userId: string) {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('memories')
      .select('content')
      .eq('user_id', userId)
      .eq('category', 'context')
      .ilike('content', '%"monday"%')
      .limit(1)
      .maybeSingle();
    if (data?.content) return parseTimetable(data.content);
  } catch { /* No timetable stored — return empty */ }
  return parseTimetable('{}');
}

// ─── Level 1 Tools (read) ─────────────────────────────────────────────────────

export const get_planning_context: ToolDefinition = {
  name: 'get_planning_context',
  description: 'Retrieve a comprehensive planning context: active projects, incomplete tasks (with overdue flag), upcoming deadlines, recent memories, and today\'s timetable.',
  permissionLevel: 'L1',
  parameters: {
    limitTasks: { type: 'number', description: 'Max tasks to return (default 30)', required: false },
  },
  execute: async (params, context) => {
    const schema = z.object({ limitTasks: z.number().min(1).max(100).optional().default(30) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const now = new Date();

    const [tasksRes, projectsRes, memoriesRes] = await Promise.all([
      supabase.from('tasks')
        .select('id, title, status, priority, due_at, project_id, metadata, created_at')
        .eq('user_id', context.userId)
        .neq('status', 'completed')
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(parsed.data.limitTasks),
      supabase.from('projects')
        .select('id, name, status, description')
        .eq('user_id', context.userId)
        .neq('status', 'completed')
        .limit(20),
      supabase.from('memories')
        .select('content, category')
        .eq('user_id', context.userId)
        .in('category', ['context', 'preference', 'goal'])
        .limit(10),
    ]);

    const { normalizeTask } = await import('../providers/prioritization');
    const tasks = (tasksRes.data || []).map(normalizeTask);

    const timetable = await loadTimetable(context.userId);
    const freeToday = totalFreeMinutes(timetable, now);
    const timetableSummary = summariseDay(timetable, now);

    return {
      success: true,
      data: {
        tasks,
        projects: projectsRes.data || [],
        memories: memoriesRes.data || [],
        timetable: {
          todaySummary: timetableSummary,
          freeMinutesToday: freeToday,
          freeSlots: getFreeSlots(timetable, now),
        },
        meta: {
          taskCount: tasks.length,
          overdueCount: tasks.filter((t: Record<string, any>) => t.isOverdue).length,
          now: now.toISOString(),
        },
      },
    };
  },
};

export const prioritize_tasks: ToolDefinition = {
  name: 'prioritize_tasks',
  description: 'Run the deterministic prioritization engine on the user\'s incomplete tasks. Returns a ranked list with a score and plain-language reason for each task.',
  permissionLevel: 'L1',
  parameters: {
    includeWaiting: { type: 'boolean', description: 'Include waiting tasks in prioritization (default: true)', required: false },
  },
  execute: async (params, context) => {
    const schema = z.object({ includeWaiting: z.boolean().optional().default(true) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    let query = supabase.from('tasks')
      .select('id, title, status, priority, due_at, metadata')
      .eq('user_id', context.userId)
      .neq('status', 'completed');

    if (!parsed.data.includeWaiting) {
      query = query.neq('status', 'waiting');
    }

    const { data, error } = await query.limit(100);
    if (error) return { success: false, error: error.message };

    const result = prioritizeTasks((data || []).map(normalizeTask));

    return {
      success: true,
      data: {
        ranked: result.ranked.map((t, i) => ({
          rank: i + 1,
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
          due_date: t.due_date,
          score: t.priorityScore,
          reason: t.reason,
          isOverdue: t.isOverdue,
          dependsOn: t.dependsOn,
        })),
        warnings: result.warnings,
        circularDependencies: result.circularDependencies,
      },
    };
  },
};

export const get_today_plan: ToolDefinition = {
  name: 'get_today_plan',
  description: 'Get a focused plan for today: top-ranked tasks that fit in available free time, ordered by priority score.',
  permissionLevel: 'L1',
  parameters: {},
  execute: async (_params, context) => {
    const supabase = createServerClient();
    const now = new Date();

    const { data, error } = await supabase.from('tasks')
      .select('id, title, status, priority, due_at, metadata')
      .eq('user_id', context.userId)
      .neq('status', 'completed')
      .limit(100);

    if (error) return { success: false, error: error.message };

    const result = prioritizeTasks((data || []).map(normalizeTask));

    const timetable = await loadTimetable(context.userId);
    const freeSlots = getFreeSlots(timetable, now);
    const totalFree = freeSlots.reduce((s, sl) => s + sl.durationMinutes, 0);

    // Select tasks that fit in today's free time
    let remainingMinutes = totalFree;
    const todayTasks = [];
    for (const t of result.ranked) {
      const estimated = typeof t.metadata.estimatedMinutes === 'number' ? t.metadata.estimatedMinutes : 60;
      if (remainingMinutes <= 0) break;
      todayTasks.push({ ...t, estimatedMinutes: estimated });
      remainingMinutes -= estimated;
    }

    return {
      success: true,
      data: {
        date: now.toISOString().split('T')[0],
        freeMinutes: totalFree,
        freeSlots,
        tasks: todayTasks.map((t, i) => ({
          rank: i + 1,
          id: t.id,
          title: t.title,
          priority: t.priority,
          isOverdue: t.isOverdue,
          estimatedMinutes: t.estimatedMinutes,
          reason: t.reason,
        })),
        warnings: result.warnings,
      },
    };
  },
};

export const get_upcoming_plan: ToolDefinition = {
  name: 'get_upcoming_plan',
  description: 'Get tasks due in the next 7 days, sorted by deadline then priority score.',
  permissionLevel: 'L1',
  parameters: {
    days: { type: 'number', description: 'Number of days to look ahead (1-14, default 7)', required: false },
  },
  execute: async (params, context) => {
    const schema = z.object({ days: z.number().min(1).max(14).optional().default(7) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const now = new Date();
    const future = new Date(now.getTime() + parsed.data.days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase.from('tasks')
      .select('id, title, status, priority, due_at, metadata')
      .eq('user_id', context.userId)
      .neq('status', 'completed')
      .not('due_at', 'is', null)
      .lte('due_at', future.toISOString())
      .order('due_at', { ascending: true })
      .limit(50);

    if (error) return { success: false, error: error.message };

    const result = prioritizeTasks((data || []).map(normalizeTask));

    return {
      success: true,
      data: {
        lookaheadDays: parsed.data.days,
        tasks: result.ranked.map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          due_date: t.due_date,
          score: t.priorityScore,
          isOverdue: t.isOverdue,
          reason: t.reason,
          estimatedMinutes: typeof t.metadata.estimatedMinutes === 'number' ? t.metadata.estimatedMinutes : null,
        })),
        warnings: result.warnings,
      },
    };
  },
};

// ─── Level 2 Tools (approval required) ───────────────────────────────────────

export const create_plan: ToolDefinition = {
  name: 'create_plan',
  description: 'Create a structured plan by generating multiple tasks at once. Requires user approval before tasks are created.',
  permissionLevel: 'L2',
  parameters: {
    title: { type: 'string', description: 'Plan title', required: true },
    objective: { type: 'string', description: 'What this plan aims to achieve', required: true },
    tasks: {
      type: 'array',
      description: 'Array of task definitions. Each: { title, description?, priority?, dueAt?, estimatedMinutes?, metadata? }',
      required: true,
    },
    reason: { type: 'string', description: 'Why this plan is being created', required: true },
  },
  execute: async (params, context) => {
    const taskSchema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
      dueAt: z.string().optional(),
      projectId: z.string().optional(),
      estimatedMinutes: z.number().optional(),
      metadata: z.record(z.unknown()).optional().default({}),
    });

    const schema = z.object({
      title: z.string().min(1),
      objective: z.string().min(1),
      tasks: z.array(taskSchema).min(1).max(30),
      reason: z.string().min(1),
    });

    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const created = [];
    const errors = [];

    for (const t of parsed.data.tasks) {
      const meta: Record<string, unknown> = { ...t.metadata };
      if (t.estimatedMinutes) meta.estimatedMinutes = t.estimatedMinutes;
      meta.planTitle = parsed.data.title;

      const { data, error } = await supabase.from('tasks').insert({
        user_id: context.userId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        due_at: t.dueAt,
        project_id: t.projectId,
        status: 'todo',
        metadata: meta,
      }).select('id, title').single();

      if (error) errors.push(`${t.title}: ${error.message}`);
      else created.push(data);
    }

    return {
      success: errors.length === 0,
      data: {
        planTitle: parsed.data.title,
        objective: parsed.data.objective,
        created,
        errors: errors.length > 0 ? errors : undefined,
        totalCreated: created.length,
      },
    };
  },
};

export const schedule_task: ToolDefinition = {
  name: 'schedule_task',
  description: 'Set scheduling metadata on an existing task: scheduled time and estimated duration. Requires approval.',
  permissionLevel: 'L2',
  parameters: {
    taskId: { type: 'string', description: 'Task ID to schedule', required: true },
    scheduledAt: { type: 'string', description: 'ISO datetime string for when to do this task', required: true },
    estimatedMinutes: { type: 'number', description: 'Estimated duration in minutes', required: true },
    reason: { type: 'string', description: 'Reason for scheduling', required: true },
  },
  execute: async (params, context) => {
    const schema = z.object({
      taskId: z.string().min(1),
      scheduledAt: z.string().min(1),
      estimatedMinutes: z.number().min(5).max(480),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    // Validate datetime
    const scheduledDate = new Date(parsed.data.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return { success: false, error: 'Invalid scheduledAt datetime.' };
    }

    const supabase = createServerClient();

    // Load existing task to merge metadata
    const { data: existing, error: fetchErr } = await supabase
      .from('tasks')
      .select('metadata')
      .eq('id', parsed.data.taskId)
      .eq('user_id', context.userId)
      .single();

    if (fetchErr) return { success: false, error: `Task not found: ${fetchErr.message}` };

    const mergedMeta = {
      ...((existing?.metadata as Record<string, unknown>) || {}),
      scheduledAt: parsed.data.scheduledAt,
      estimatedMinutes: parsed.data.estimatedMinutes,
    };

    const { data, error } = await supabase.from('tasks')
      .update({ metadata: mergedMeta })
      .eq('id', parsed.data.taskId)
      .eq('user_id', context.userId)
      .select('id, title, metadata')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: { taskId: data.id, title: data.title, scheduledAt: parsed.data.scheduledAt, estimatedMinutes: parsed.data.estimatedMinutes } };
  },
};

export const reschedule_task: ToolDefinition = {
  name: 'reschedule_task',
  description: 'Move a task to a new scheduled time. Preserves original schedule in metadata. Requires approval.',
  permissionLevel: 'L2',
  parameters: {
    taskId: { type: 'string', description: 'Task ID to reschedule', required: true },
    newScheduledAt: { type: 'string', description: 'New ISO datetime', required: true },
    newEstimatedMinutes: { type: 'number', description: 'Updated duration estimate (optional)', required: false },
    reason: { type: 'string', description: 'Reason for rescheduling', required: true },
  },
  execute: async (params, context) => {
    const schema = z.object({
      taskId: z.string().min(1),
      newScheduledAt: z.string().min(1),
      newEstimatedMinutes: z.number().min(5).max(480).optional(),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const newDate = new Date(parsed.data.newScheduledAt);
    if (isNaN(newDate.getTime())) {
      return { success: false, error: 'Invalid newScheduledAt datetime.' };
    }

    const supabase = createServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('tasks')
      .select('metadata, title')
      .eq('id', parsed.data.taskId)
      .eq('user_id', context.userId)
      .single();

    if (fetchErr) return { success: false, error: `Task not found: ${fetchErr.message}` };

    const currentMeta = (existing?.metadata as Record<string, unknown>) || {};

    // Preserve the original scheduled time
    const mergedMeta: Record<string, unknown> = {
      ...currentMeta,
      scheduledAt: parsed.data.newScheduledAt,
      previousScheduledAt: currentMeta.scheduledAt || null,
    };
    if (parsed.data.newEstimatedMinutes !== undefined) {
      mergedMeta.estimatedMinutes = parsed.data.newEstimatedMinutes;
    }

    const { data, error } = await supabase.from('tasks')
      .update({ metadata: mergedMeta })
      .eq('id', parsed.data.taskId)
      .eq('user_id', context.userId)
      .select('id, title, metadata')
      .single();

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: {
        taskId: data.id,
        title: data.title,
        newScheduledAt: parsed.data.newScheduledAt,
        previousScheduledAt: currentMeta.scheduledAt || null,
        reason: parsed.data.reason,
      },
    };
  },
};

