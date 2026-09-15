/**
 * Deterministic task prioritization engine.
 *
 * Scores each task using a numeric formula — the LLM does NOT decide ordering.
 * Returns a ranked list with a human-readable reason string for each task.
 */

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'completed';

export interface ScoredTask {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  metadata: Record<string, unknown>;
  // Scoring output
  priorityScore: number;
  reason: string;
  isOverdue: boolean;
  dependsOn: string[];
}

export interface PrioritizationResult {
  ranked: ScoredTask[];
  circularDependencies: string[][];
  warnings: string[];
}

// ─── Score Weights ────────────────────────────────────────────────────────────

const URGENCY_SCORES: Record<TaskPriority, number> = {
  urgent: 40,
  high: 20,
  medium: 10,
  low: 5,
};

function deadlineScore(dueDateStr: string | null, now: Date): { score: number; overdue: boolean; daysOverdue: number } {
  if (!dueDateStr) return { score: 0, overdue: false, daysOverdue: 0 };

  const due = new Date(dueDateStr);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    // Overdue
    const daysOverdue = Math.abs(diffDays);
    const overdueBonus = Math.min(30, Math.round(daysOverdue * 5));
    return { score: 50 + overdueBonus, overdue: true, daysOverdue: Math.round(daysOverdue) };
  } else if (diffHours < 24) {
    return { score: 30, overdue: false, daysOverdue: 0 };
  } else if (diffDays < 3) {
    return { score: 20, overdue: false, daysOverdue: 0 };
  } else if (diffDays < 7) {
    return { score: 10, overdue: false, daysOverdue: 0 };
  }
  return { score: 0, overdue: false, daysOverdue: 0 };
}

function effortPenalty(metadata: Record<string, unknown>): number {
  const estimatedMinutes = typeof metadata.estimatedMinutes === 'number' ? metadata.estimatedMinutes : 0;
  if (estimatedMinutes <= 0) return 0;
  return Math.min(10, Math.round((estimatedMinutes / 60) * 2));
}

function buildReason(
  task: { title: string; priority: TaskPriority; due_date: string | null },
  urgency: number,
  dl: { score: number; overdue: boolean; daysOverdue: number },
  effort: number,
  now: Date,
): string {
  const parts: string[] = [];

  if (dl.overdue) {
    parts.push(`overdue by ${dl.daysOverdue} day${dl.daysOverdue !== 1 ? 's' : ''}`);
  } else if (dl.score >= 30) {
    parts.push(`due within 24 hours`);
  } else if (dl.score >= 20) {
    parts.push(`due within 3 days`);
  } else if (dl.score >= 10) {
    parts.push(`due within 7 days`);
  }

  if (task.priority === 'urgent') parts.push('marked urgent');
  else if (task.priority === 'high') parts.push('high priority');

  if (effort > 5) parts.push(`large task (effort penalty applied)`);

  if (parts.length === 0) return 'Standard priority, no immediate deadline.';
  return parts.join(', ').replace(/^./, c => c.toUpperCase()) + '.';
}

// ─── Circular Dependency Detection (Kahn's Algorithm) ────────────────────────

function detectCircularDependencies(tasks: { id: string; dependsOn: string[] }[]): string[][] {
  const taskIds = new Set(tasks.map(t => t.id));
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const t of tasks) {
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0);
    if (!graph.has(t.id)) graph.set(t.id, []);
    for (const dep of t.dependsOn) {
      if (!taskIds.has(dep)) continue; // external dep, skip
      graph.get(dep)!.push(t.id);
      inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
    }
  }

  const queue: string[] = [];
  Array.from(inDegree.entries()).forEach(([id, degree]) => {
    if (degree === 0) queue.push(id);
  });

  const visited = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    visited.add(node);
    for (const neighbor of (graph.get(node) || [])) {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }

  // Tasks not visited = part of a cycle
  const cycleNodes = tasks.filter(t => !visited.has(t.id));

  // Group cycles simply (all cycle nodes in one group for now)
  if (cycleNodes.length === 0) return [];
  return [cycleNodes.map(t => t.id)];
}

// ─── Main Prioritization Function ────────────────────────────────────────────

export type PrioritizableTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt?: string | null;
  estimatedMinutes?: number | null;
  metadata?: Record<string, unknown> | null;
};

export function normalizeTask(rawRow: any): PrioritizableTask {
  return {
    id: rawRow.id,
    title: rawRow.title,
    status: rawRow.status || 'todo',
    priority: rawRow.priority || 'medium',
    dueAt: rawRow.due_at ?? rawRow.due_date ?? rawRow.dueAt ?? null,
    estimatedMinutes: typeof rawRow.metadata?.estimatedMinutes === 'number' ? rawRow.metadata.estimatedMinutes : null,
    metadata: rawRow.metadata || {},
  };
}

export function prioritizeTasks(
  rawTasks: PrioritizableTask[],
  now: Date = new Date(),
): PrioritizationResult {
  const warnings: string[] = [];

  // Filter to actionable tasks only
  const actionable = rawTasks.filter(t => t.status !== 'completed');

  // Build dependency info
  const withDeps = actionable.map(t => {
    const metadata = t.metadata || {};
    return {
      ...t,
      metadata,
      due_date: t.dueAt || null,
      priority: (t.priority as TaskPriority) || 'medium',
      status: (t.status as TaskStatus) || 'todo',
      dependsOn: Array.isArray(metadata.dependsOn)
        ? (metadata.dependsOn as string[]).filter(d => typeof d === 'string')
        : [],
    };
  });

  // Detect circular dependencies
  const circularDependencies = detectCircularDependencies(withDeps);
  if (circularDependencies.length > 0) {
    warnings.push(
      `Circular dependency detected among tasks: ${circularDependencies.flat().join(', ')}. These tasks cannot be reliably ordered.`,
    );
  }

  const circularIds = new Set(circularDependencies.flat());

  // Score each task
  const scored: ScoredTask[] = withDeps.map(task => {
    const urgency = URGENCY_SCORES[task.priority] ?? 10;
    const dl = deadlineScore(task.due_date, now);
    const effort = effortPenalty(task.metadata);
    const score = urgency + dl.score - effort;

    return {
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      due_date: task.due_date,
      metadata: task.metadata,
      priorityScore: score,
      reason: circularIds.has(task.id)
        ? 'Part of a circular dependency — manual resolution required.'
        : buildReason(task, urgency, dl, effort, now),
      isOverdue: dl.overdue,
      dependsOn: task.dependsOn,
    };
  });

  // Topological sort respecting dependencies
  const taskMap = new Map(scored.map(t => [t.id, t]));
  const sorted = topologicalSort(scored, taskMap);

  return { ranked: sorted, circularDependencies, warnings };
}

/**
 * Topological sort: ensures dependencies appear before their dependents.
 * Within the same "level", tasks are ordered by priorityScore descending.
 */
function topologicalSort(tasks: ScoredTask[], taskMap: Map<string, ScoredTask>): ScoredTask[] {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>(); // dep → dependents

  for (const t of tasks) {
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0);
    if (!graph.has(t.id)) graph.set(t.id, []);
    for (const dep of t.dependsOn) {
      if (!taskMap.has(dep)) continue;
      if (!graph.has(dep)) graph.set(dep, []);
      graph.get(dep)!.push(t.id);
      inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
    }
  }

  // Start with tasks that have no dependencies, sorted by score
  let queue = tasks
    .filter(t => (inDegree.get(t.id) || 0) === 0)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const result: ScoredTask[] = [];
  while (queue.length > 0) {
    const task = queue.shift()!;
    result.push(task);
    const neighbors = (graph.get(task.id) || [])
      .map(id => taskMap.get(id)!)
      .filter(Boolean);

    for (const neighbor of neighbors) {
      inDegree.set(neighbor.id, (inDegree.get(neighbor.id) || 0) - 1);
      if ((inDegree.get(neighbor.id) || 0) === 0) {
        queue.push(neighbor);
        queue.sort((a, b) => b.priorityScore - a.priorityScore);
      }
    }
  }

  // Append any remaining (cyclic) tasks by score
  const resultIds = new Set(result.map(t => t.id));
  const remaining = tasks.filter(t => !resultIds.has(t.id)).sort((a, b) => b.priorityScore - a.priorityScore);
  return [...result, ...remaining];
}

// ─── Study Session Generator ──────────────────────────────────────────────────

export interface StudySession {
  title: string;
  subject: string;
  topic: string;
  sessionType: 'learning' | 'revision' | 'practice' | 'mock_test' | 'review';
  estimatedMinutes: number;
  suggestedDay?: string;
  suggestedTime?: string;
  metadata: Record<string, unknown>;
}

export interface StudyPlan {
  title: string;
  subject: string;
  deadline: string;
  totalMinutes: number;
  sessions: StudySession[];
  warnings: string[];
}

/**
 * Generate a structured study plan.
 * @param subject       Subject name
 * @param topics        List of topics to cover
 * @param deadlineDate  Exam/submission date
 * @param availableMinutesPerDay  Array of available minutes per upcoming day
 * @param minutesPerTopic  Default minutes per topic (default 60)
 */
export function generateStudyPlan(
  subject: string,
  topics: string[],
  deadlineDate: Date,
  availableMinutesPerDay: number[],
  minutesPerTopic = 60,
): StudyPlan {
  const warnings: string[] = [];
  const now = new Date();
  const daysUntilDeadline = Math.max(1, Math.round((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const totalTopicMinutes = topics.length * minutesPerTopic;
  const revisionMinutes = Math.min(totalTopicMinutes * 0.3, 120); // 30% for revision, max 2h
  const practiceMinutes = Math.min(totalTopicMinutes * 0.2, 90);   // 20% for practice, max 1.5h
  const totalRequired = totalTopicMinutes + revisionMinutes + practiceMinutes;

  const totalAvailable = availableMinutesPerDay.slice(0, daysUntilDeadline).reduce((a, b) => a + b, 0);

  if (totalRequired > totalAvailable) {
    warnings.push(
      `Tight schedule: ${topics.length} topics require ~${Math.round(totalRequired / 60)}h ` +
      `but only ~${Math.round(totalAvailable / 60)}h available before the deadline. ` +
      `Consider focusing on the most important topics first.`,
    );
  }

  const sessions: StudySession[] = [];

  // Learning sessions — one per topic
  for (const topic of topics) {
    sessions.push({
      title: `Learn: ${topic}`,
      subject,
      topic,
      sessionType: 'learning',
      estimatedMinutes: minutesPerTopic,
      metadata: { type: 'study', subject, topic, sessionType: 'learning', estimatedMinutes: minutesPerTopic },
    });
  }

  // Revision session — covers all topics
  if (topics.length > 0) {
    sessions.push({
      title: `Revision: ${subject} — All Topics`,
      subject,
      topic: 'All Topics',
      sessionType: 'revision',
      estimatedMinutes: Math.max(30, Math.round(revisionMinutes)),
      metadata: { type: 'study', subject, topic: 'All Topics', sessionType: 'revision', estimatedMinutes: Math.round(revisionMinutes) },
    });
  }

  // Practice session
  sessions.push({
    title: `Practice: ${subject}`,
    subject,
    topic: 'Past Questions / Exercises',
    sessionType: 'practice',
    estimatedMinutes: Math.max(30, Math.round(practiceMinutes)),
    metadata: { type: 'study', subject, topic: 'Practice', sessionType: 'practice', estimatedMinutes: Math.round(practiceMinutes) },
  });

  // Final review (day before exam if time allows)
  if (daysUntilDeadline >= 2) {
    sessions.push({
      title: `Final Review: ${subject}`,
      subject,
      topic: 'Key Concepts',
      sessionType: 'review',
      estimatedMinutes: 45,
      metadata: { type: 'study', subject, topic: 'Key Concepts', sessionType: 'review', estimatedMinutes: 45 },
    });
  }

  return {
    title: `Study Plan: ${subject}`,
    subject,
    deadline: deadlineDate.toISOString(),
    totalMinutes: sessions.reduce((sum, s) => sum + s.estimatedMinutes, 0),
    sessions,
    warnings,
  };
}
