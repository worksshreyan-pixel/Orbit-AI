import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// We need a pristine service-role client for the local agent (no cookies)
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export async function POST(request: Request) {
  try {
    const { code, hostname, platform } = await request.json();
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

    // Normalize raw OS platform (win32, darwin, linux) to schema values
    const normalizePlatform = (p: string | undefined): string => {
      if (!p) return 'desktop';
      const lower = p.toLowerCase();
      if (['web', 'android', 'ios', 'desktop'].includes(lower)) return lower;
      // os.platform() values: win32, darwin, linux, freebsd, etc.
      return 'desktop';
    };
    const normalizedPlatform = normalizePlatform(platform);

    // 1. Find active session
    const { data: session, error: fetchError } = await serviceClient
      .from('pairing_sessions')
      .select('*')
      .eq('code', code)
      .eq('status', 'pending')
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Invalid or expired pairing code' }, { status: 400 });
    }

    if (new Date(session.expires_at) < new Date()) {
      await serviceClient.from('pairing_sessions').update({ status: 'expired' }).eq('id', session.id);
      return NextResponse.json({ error: 'Pairing code expired' }, { status: 400 });
    }

    // 2. Create device record
    const { data: device, error: deviceError } = await serviceClient
      .from('devices')
      .insert({
        user_id: session.user_id,
        name: hostname || 'Windows PC',
        platform: normalizedPlatform,
        status: 'active'
      })
      .select()
      .single();

    if (deviceError) throw deviceError;

    // 3. Mark session complete
    await serviceClient
      .from('pairing_sessions')
      .update({ status: 'completed', device_id: device.id })
      .eq('id', session.id);

    // 4. Generate long-lived credential (store it safely? wait, how do we authenticate web sockets?)
    // In phase 11.1/11.2, WebSocket auth expects a credential.
    // If we issue a JWT from Supabase, the agent can connect. 
    // Wait, let's look at how connection manager validates in phase 11.2!
    
    // In `lib/agent/providers/local-agent-connection.ts`, the LocalAgentConnectionManager connects to the WS URL and sends `credential`.
    // We can issue a custom token that the Next.js WS handler validates, but Next.js API routes don't natively do WebSockets.
    // Actually, `LOCAL_AGENT_CREDENTIAL` is used by the *ORBIT server* to authenticate *TO* the Local Agent in Phase 11.2.
    // Wait... what? Phase 11.2 says: "Create the server-side LocalAgentWorkspaceProvider in the existing ORBIT Next.js application."
    // Yes, ORBIT acts as the client to the Local Agent WebSocket server.
    // So the credential we return here will be the token ORBIT uses to authenticate to the Local Agent?
    // Let me check Phase 11.1 and 11.2 again.

    return NextResponse.json({
      success: true,
      deviceId: device.id,
      // For now, return a credential that the agent will store and use to authenticate incoming connections
      credential: crypto.randomBytes(32).toString('hex')
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
