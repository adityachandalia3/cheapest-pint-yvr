'use client';

import { useState } from 'react';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim(), type: 'general' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fef9f0] text-[#1c1917]">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <div className="mb-8">
          <span className="inline-block text-xs font-black uppercase tracking-widest text-[#B34207] mb-3">
            Get in touch
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#1c1917] leading-tight mb-4">
            Contact Us
          </h1>
          <p className="text-stone-500 leading-relaxed text-base">
            Got a question, spotted a wrong price, or just want to say hi? We read every message and reply within 24 hours.
          </p>
        </div>

        <div className="bg-white border border-[#fde8c4] rounded-2xl p-6 sm:p-8">
          {done ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🍺</div>
              <h2 className="text-xl font-black text-[#1c1917] mb-2">Message sent!</h2>
              <p className="text-stone-500 text-sm">We&apos;ll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-[#1c1917] mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full bg-[#fef9f0] border border-[#fde8c4] focus:border-[#B34207]/50 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-[#1c1917] placeholder-stone-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1c1917] mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full bg-[#fef9f0] border border-[#fde8c4] focus:border-[#B34207]/50 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-[#1c1917] placeholder-stone-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1c1917] mb-1.5">Message</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  required
                  rows={5}
                  className="w-full bg-[#fef9f0] border border-[#fde8c4] focus:border-[#B34207]/50 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-[#1c1917] placeholder-stone-400 transition-colors resize-none"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading || !name.trim() || !email.trim() || !message.trim()}
                className="w-full bg-[#B34207] hover:bg-[#8f3506] disabled:opacity-40 text-white font-black text-sm py-3 rounded-xl transition-colors"
              >
                {loading ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-stone-400">
          Or email us directly at{' '}
          <a href="mailto:team@getbrewscanner.com" className="text-[#B34207] hover:underline font-semibold">
            team@getbrewscanner.com
          </a>
        </p>
      </div>
    </main>
  );
}
