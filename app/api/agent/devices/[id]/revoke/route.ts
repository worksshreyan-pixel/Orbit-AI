import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getLocalAgentConnection } from '@/lib/agent/providers/local-agent-connection';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const deviceId = params.id;
    
    // Verify ownership
    const { data: device, error: fetchError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Mark as revoked
    const { error: updateError } = await supabase
      .from('devices')
      .update({ status: 'revoked' })
      .eq('id', deviceId);

    if (updateError) throw updateError;

    // Try to terminate connection if it's currently running on this process
    try {
      const globalForConnection = global as any;
      if (globalForConnection.localAgentManager) {
        globalForConnection.localAgentManager.disconnect?.();
        globalForConnection.localAgentManager = undefined;
      }
    } catch (e) {
      // Ignore errors terminating connection
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
