'use client';

import { useState } from 'react';

type Field = { name: string; email: string; company: string; message: string };
const EMPTY: Field = { name: '', email: '', company: '', message: '' };

export default function AdvertiseForm() {
  const [form, setForm] = useState<Field>(EMPTY);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const set = (k: keyof Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setStatus('sent');
      setForm(EMPTY);
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🍺</div>
        <h3 className="font-black text-xl text-[#1c1917] mb-2">Message sent!</h3>
        <p className="text-stone-500 text-sm">We&apos;ll get back to you within a day or two. Cheers!</p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-6 text-sm text-[#B34207] font-semibold hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5">
            Name <span className="text-[#B34207]">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={set('name')}
            placeholder="Your name"
            className="w-full bg-[#faf5eb] border border-[#e8dcc8] focus:border-[#B34207]/60 focus:shadow-[0_0_0_3px_rgba(179,66,7,0.08)] rounded-lg px-3.5 py-2.5 text-sm text-[#1c1917] placeholder-stone-400 outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5">
            Email <span className="text-[#B34207]">*</span>
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
            className="w-full bg-[#faf5eb] border border-[#e8dcc8] focus:border-[#B34207]/60 focus:shadow-[0_0_0_3px_rgba(179,66,7,0.08)] rounded-lg px-3.5 py-2.5 text-sm text-[#1c1917] placeholder-stone-400 outline-none transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5">
          Company or Bar Name
        </label>
        <input
          type="text"
          value={form.company}
          onChange={set('company')}
          placeholder="Optional"
          className="w-full bg-[#faf5eb] border border-[#e8dcc8] focus:border-[#B34207]/60 focus:shadow-[0_0_0_3px_rgba(179,66,7,0.08)] rounded-lg px-3.5 py-2.5 text-sm text-[#1c1917] placeholder-stone-400 outline-none transition-all"
        />
      </div>

      <div>
        <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5">
          Message <span className="text-[#B34207]">*</span>
        </label>
        <textarea
          required
          value={form.message}
          onChange={set('message')}
          placeholder="Tell us what you're looking for..."
          rows={5}
          className="w-full bg-[#faf5eb] border border-[#e8dcc8] focus:border-[#B34207]/60 focus:shadow-[0_0_0_3px_rgba(179,66,7,0.08)] rounded-lg px-3.5 py-2.5 text-sm text-[#1c1917] placeholder-stone-400 outline-none transition-all resize-none"
        />
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-500">Something went wrong — please try again or email us directly.</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-[#B34207] hover:bg-[#8f3506] disabled:opacity-60 disabled:cursor-not-allowed text-white font-black py-3 px-6 rounded-xl transition-all duration-200 text-sm"
      >
        {status === 'sending' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Sending...
          </span>
        ) : 'Send Message'}
      </button>
    </form>
  );
}
