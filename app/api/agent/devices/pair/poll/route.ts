import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: session, error } = await supabase
      .from('pairing_sessions')
      .select('status, device_id')
      .eq('id', sessionId)
      .single();

    if (error) throw error;

    return NextResponse.json({ status: session.status, deviceId: session.device_id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
