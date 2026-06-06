import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { name, email, company, message, type } = await req.json();

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const to = process.env.CONTACT_EMAIL;
  if (!to) {
    return NextResponse.json({ error: 'Contact email not configured' }, { status: 500 });
  }

  const isAdvertising = type === 'advertising';
  const subjectLine = isAdvertising
    ? `Advertising Inquiry from ${name}${company ? ` · ${company}` : ''}`
    : `Message from ${name} via Brewscanner`;
  const headingText = isAdvertising ? 'New Advertising Inquiry' : 'New Contact Message';

  try {
    await resend.emails.send({
      from: 'Brewscanner <onboarding@resend.dev>',
      to,
      replyTo: email,
      subject: subjectLine,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; padding: 24px;">
          <h2 style="color: #B34207; margin-bottom: 4px;">${headingText}</h2>
          <p style="color: #888; font-size: 13px; margin-bottom: 24px;">Submitted via Brewscanner</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #555; font-size: 13px; width: 120px;">Name</td><td style="padding: 8px 0; font-weight: 600;">${name}</td></tr>
            <tr><td style="padding: 8px 0; color: #555; font-size: 13px;">Email</td><td style="padding: 8px 0; font-weight: 600;">${email}</td></tr>
            ${company ? `<tr><td style="padding: 8px 0; color: #555; font-size: 13px;">Company / Bar</td><td style="padding: 8px 0; font-weight: 600;">${company}</td></tr>` : ''}
          </table>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #555; font-size: 13px; margin-bottom: 6px;">Message</p>
          <p style="background: #faf5eb; padding: 16px; border-radius: 8px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Resend error:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
