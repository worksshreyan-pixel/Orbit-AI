import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Check if user already has projects
    const { data: existing } = await supabase.from('projects').select('id').eq('user_id', userId).limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ message: 'Demo data already exists', skipped: true });
    }

    // Create projects
    const { data: projects } = await supabase.from('projects').insert([
      {
        user_id: userId,
        name: 'DELT',
        description: 'A decentralized lending protocol. Core focus on smart contract security and user experience.',
        status: 'active',
        color: 'blue',
        goals: ['Audit smart contracts', 'Ship MVP to testnet', 'Complete whitepaper', 'Build community'],
      },
      {
        user_id: userId,
        name: 'ORBIT',
        description: 'Personal AI operating system. Manage projects, tasks, ideas, research, and productivity.',
        status: 'active',
        color: 'purple',
        goals: ['Build PWA foundation', 'Implement agent architecture', 'Connect AI provider', 'Design approval system'],
      },
      {
        user_id: userId,
        name: 'College',
        description: 'Academic projects and coursework tracking.',
        status: 'active',
        color: 'green',
        goals: ['Complete semester project', 'Prepare for finals'],
      },
    ]).select();

    if (!projects) return NextResponse.json({ error: 'Failed to create projects' }, { status: 500 });

    const deltId = projects[0]?.id;
    const orbitId = projects[1]?.id;
    const collegeId = projects[2]?.id;

    // Create tasks
    await supabase.from('tasks').insert([
      { user_id: userId, project_id: orbitId, title: 'Research ORBIT architecture', description: 'Investigate agent orchestration patterns and tool registry design', status: 'completed', priority: 'high' },
      { user_id: userId, project_id: orbitId, title: 'Build authentication', description: 'Set up Supabase auth with email/password', status: 'completed', priority: 'high' },
      { user_id: userId, project_id: orbitId, title: 'Design agent tool system', description: 'Create tool registry with permission levels', status: 'in_progress', priority: 'urgent' },
      { user_id: userId, project_id: orbitId, title: 'Implement PWA manifest and service worker', status: 'in_progress', priority: 'medium' },
      { user_id: userId, project_id: orbitId, title: 'Connect AI provider', description: 'Wire up Gemini API through server-side route', status: 'todo', priority: 'high' },
      { user_id: userId, project_id: deltId, title: 'Review smart contract audit findings', status: 'waiting', priority: 'urgent', due_date: new Date(Date.now() + 86400000).toISOString() },
      { user_id: userId, project_id: deltId, title: 'Write whitepaper section 3', description: 'Tokenomics and governance model', status: 'todo', priority: 'high' },
      { user_id: userId, project_id: deltId, title: 'Deploy to testnet', status: 'todo', priority: 'medium' },
      { user_id: userId, project_id: collegeId, title: 'Submit semester project proposal', status: 'todo', priority: 'high', due_date: new Date(Date.now() + 172800000).toISOString() },
      { user_id: userId, project_id: collegeId, title: 'Study for algorithms exam', status: 'todo', priority: 'medium' },
    ]);

    // Create subtasks
    const { data: toolTask } = await supabase.from('tasks').select('id').eq('title', 'Design agent tool system').single();
    if (toolTask) {
      await supabase.from('subtasks').insert([
        { task_id: toolTask.id, user_id: userId, title: 'Define tool interface types' },
        { task_id: toolTask.id, user_id: userId, title: 'Register placeholder tools' },
        { task_id: toolTask.id, user_id: userId, title: 'Implement permission checking' },
      ]);
    }

    // Create ideas
    await supabase.from('ideas').insert([
      { user_id: userId, title: 'Voice command support for ORBIT', description: 'Allow speaking commands instead of typing. Use Web Speech API.', tags: ['feature', 'orbit', 'ux'], status: 'new' },
      { user_id: userId, title: 'Notion integration for task sync', description: 'Two-way sync between ORBIT tasks and Notion database', tags: ['integration', 'notion'], status: 'new' },
      { user_id: userId, title: 'Weekly planning agent', description: 'ORBIT reviews all projects and suggests a weekly plan every Monday morning', tags: ['feature', 'agent', 'productivity'], status: 'reviewed' },
      { user_id: userId, title: 'GitHub PR review assistant', description: 'Agent reads PR diffs and provides code review comments', tags: ['feature', 'github', 'agent'], status: 'new' },
    ]);

    // Create memories
    await supabase.from('memories').insert([
      { user_id: userId, category: 'preference', key: 'work_style', value: 'Prefers concise summaries over lengthy explanations. Values actionable suggestions.', importance: 'high' },
      { user_id: userId, category: 'preference', key: 'work_hours', value: 'Most productive in the morning, 9am-12pm. Avoid scheduling deep work after 6pm.', importance: 'normal' },
      { user_id: userId, category: 'project', key: 'delt_priority', value: 'DELT smart contract audit is the highest priority this week.', importance: 'high', project_id: deltId },
      { user_id: userId, category: 'goal', key: 'q3_goal', value: 'Ship ORBIT MVP and DELT testnet deployment by end of quarter.', importance: 'critical' },
      { user_id: userId, category: 'decision', key: 'tech_stack', value: 'Chose Next.js + Supabase + Tailwind for ORBIT. AI provider is Gemini with abstraction layer for future swaps.', importance: 'normal' },
      { user_id: userId, category: 'instruction', key: 'task_creation', value: 'Always associate tasks with a project when possible. Default priority is medium unless stated otherwise.', importance: 'normal' },
    ]);

    // Create research
    await supabase.from('research').insert([
      { user_id: userId, project_id: orbitId, topic: 'Agent orchestration patterns', query: 'What are the best patterns for multi-step AI agent execution with tool use?', status: 'pending' },
      { user_id: userId, project_id: deltId, topic: 'DeFi lending protocol security', query: 'Common vulnerabilities in DeFi lending protocols and how to prevent them', status: 'pending' },
    ]);

    // Create a sample agent run
    const { data: run } = await supabase.from('agent_runs').insert({
      user_id: userId,
      project_id: orbitId,
      request: 'Research ORBIT architecture and suggest improvements',
      status: 'completed',
      result: 'I reviewed the ORBIT architecture. The current foundation is solid with a modular tool registry, three-tier permission system, and AI provider abstraction. Key areas for improvement: 1) Add real-time step streaming for better UX during long runs, 2) Implement tool retry logic with exponential backoff, 3) Add a context window manager to optimize memory retrieval. The agent architecture is ready for real tool implementations once integrations are connected.',
      tools_used: ['get_project', 'research_web'],
    }).select().single();

    if (run) {
      await supabase.from('agent_steps').insert([
        { agent_run_id: run.id, user_id: userId, step_number: 0, step_type: 'understanding', title: 'Understanding your request', description: 'Analyzing: "Research ORBIT architecture and suggest improvements"', status: 'completed' },
        { agent_run_id: run.id, user_id: userId, step_number: 1, step_type: 'planning', title: 'Planning approach', description: 'Reviewing project context and identifying key areas', status: 'completed' },
        { agent_run_id: run.id, user_id: userId, step_number: 2, step_type: 'tool_call', title: 'Retrieving project details', tool_name: 'get_project', status: 'completed' },
        { agent_run_id: run.id, user_id: userId, step_number: 3, step_type: 'result', title: 'Generating response', description: 'Formulating architecture recommendations', status: 'completed' },
      ]);
    }

    // Create a sample notification
    await supabase.from('notifications').insert([
      { user_id: userId, type: 'agent_completed', title: 'Agent run completed', body: 'Research ORBIT architecture and suggest improvements', data: { run_id: run?.id } },
      { user_id: userId, type: 'task_due', title: 'Task due tomorrow', body: 'Review smart contract audit findings', data: {} },
    ]);

    return NextResponse.json({ success: true, message: 'Demo data seeded successfully' });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to seed demo data' }, { status: 500 });
  }
}
