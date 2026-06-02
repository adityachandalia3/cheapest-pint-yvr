'use client';

import { useState, useRef, useEffect } from 'react';
import type { BarOption } from '@/app/submit-price/page';

const CATEGORIES = [
  { value: 'cheapest_beer', label: 'Cheapest Beer' },
  { value: 'cheapest_lager', label: 'Cheapest Lager' },
  { value: 'cheapest_ipa', label: 'Cheapest IPA' },
];

type FormState = {
  bar_id: string;
  bar_name: string;
  beer_name: string;
  category: string;
  price: string;
  submitter_name: string;
};

const EMPTY: FormState = {
  bar_id: '',
  bar_name: '',
  beer_name: '',
  category: 'cheapest_beer',
  price: '',
  submitter_name: '',
};

export default function SubmitPriceForm({ bars }: { bars: BarOption[] }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [barQuery, setBarQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const barInputRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  const suggestions = barQuery.trim().length >= 1
    ? bars.filter(b => b.name.toLowerCase().includes(barQuery.toLowerCase())).slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestRef.current && !suggestRef.current.contains(e.target as Node) &&
        barInputRef.current && !barInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectBar = (bar: BarOption) => {
    setForm(f => ({ ...f, bar_id: bar.id, bar_name: bar.name }));
    setBarQuery(bar.name);
    setShowSuggestions(false);
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/submit-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🍻</div>
        <h3 className="font-black text-xl text-[#1c1917] mb-2">Thanks for the tip!</h3>
        <p className="text-stone-500 text-sm">We&apos;ll review your submission and update the map within 24 hours.</p>
        <button
          onClick={() => { setForm(EMPTY); setBarQuery(''); setStatus('idle'); }}
          className="mt-6 text-sm text-[#B34207] font-semibold hover:underline"
        >
          Submit another price
        </button>
      </div>
    );
  }

  const inputCls = "w-full bg-[#faf5eb] border border-[#e8dcc8] focus:border-[#B34207]/60 focus:shadow-[0_0_0_3px_rgba(179,66,7,0.08)] rounded-lg px-3.5 py-2.5 text-sm text-[#1c1917] placeholder-stone-400 outline-none transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Bar Name with autocomplete */}
      <div>
        <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5">
          Bar Name <span className="text-[#B34207]">*</span>
        </label>
        <div className="relative">
          <input
            ref={barInputRef}
            type="text"
            required
            value={barQuery}
            onChange={e => {
              setBarQuery(e.target.value);
              setForm(f => ({ ...f, bar_id: '', bar_name: e.target.value }));
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Start typing a bar name..."
            className={inputCls}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestRef}
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e8dcc8] rounded-xl shadow-lg z-20 overflow-hidden"
            >
              {suggestions.map(bar => (
                <button
                  key={bar.id}
                  type="button"
                  onMouseDown={() => selectBar(bar)}
                  className="w-full text-left px-4 py-2.5 text-sm text-[#1c1917] hover:bg-[#fef9f0] hover:text-[#B34207] transition-colors border-b border-[#fde8c4]/50 last:border-0"
                >
                  {bar.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5">
            Beer Name
          </label>
          <input
            type="text"
            value={form.beer_name}
            onChange={set('beer_name')}
            placeholder="e.g. Kokanee, Stella..."
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5">
            Category <span className="text-[#B34207]">*</span>
          </label>
          <select
            required
            value={form.category}
            onChange={set('category')}
            className={inputCls}
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5">
            Price (CAD) <span className="text-[#B34207]">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-bold">$</span>
            <input
              type="number"
              required
              min="0.50"
              max="30"
              step="0.25"
              value={form.price}
              onChange={set('price')}
              placeholder="0.00"
              className={`${inputCls} pl-7`}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5">
            Your Name <span className="text-stone-300">(optional)</span>
          </label>
          <input
            type="text"
            value={form.submitter_name}
            onChange={set('submitter_name')}
            placeholder="Anonymous"
            className={inputCls}
          />
        </div>
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-500">Something went wrong — please try again.</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-[#B34207] hover:bg-[#8f3506] disabled:opacity-60 disabled:cursor-not-allowed text-white font-black py-3 px-6 rounded-xl transition-all duration-200 text-sm"
      >
        {status === 'sending' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Submitting...
          </span>
        ) : 'Submit Price'}
      </button>
    </form>
  );
}
