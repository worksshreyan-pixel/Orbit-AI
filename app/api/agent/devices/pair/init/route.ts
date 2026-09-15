import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

function generateCode(): string {
  // 6 digit random number
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: session, error } = await supabase.from('pairing_sessions').insert({
      user_id: user.id,
      code,
      expires_at: expiresAt,
      status: 'pending'
    }).select().single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Failed to generate unique code, try again' }, { status: 500 });
      }
      throw error;
    }

    return NextResponse.json({ sessionId: session.id, code, expiresAt });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
