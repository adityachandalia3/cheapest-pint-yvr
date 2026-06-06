import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('community_signups').insert({ email });

  if (error) {
    if (error.code === '23505') {
      // Already signed up — treat as success so we don't leak whether email exists
      return NextResponse.json({ ok: true });
    }
    console.error('Signup error code:', error.code, 'message:', error.message, 'details:', error.details, 'hint:', error.hint);
    return NextResponse.json({ error: 'Failed to sign up' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
