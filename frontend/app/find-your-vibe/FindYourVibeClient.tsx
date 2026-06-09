'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { useMyNightContext } from '@/lib/myNightContext';
import type { MyNightBar } from '@/lib/myNightContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DrinkType = 'beer' | 'cocktail' | 'any';
type ChatStep = 'input' | 'drink_type' | 'location' | 'time_of_day' | 'price' | 'searching' | 'results';

interface Chip { label: string; value: string; emoji: string; }

interface Message {
  id: number;
  from: 'bot' | 'user';
  text: string;
  chips?: Chip[];
  chipsAnswered?: boolean;
}

interface VibeResult {
  bar_id: string;
  bar_name: string;
  neighbourhood: string | null;
  match_reason: string;
  cheapest_price: number | null;
  is_happy_hour: boolean;
  happy_hour_end: string | null;
  happy_hour_start: string | null;
  happy_hour_days: string[] | null;
  tags: string[];
  expense_rating: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DRINK_CHIPS: Chip[] = [
  { emoji: '🍺', label: 'Beers & Pints', value: 'beer' },
  { emoji: '🍹', label: 'Cocktails', value: 'cocktail' },
  { emoji: '🥃', label: 'Whatever\'s good', value: 'any' },
];


const TIME_CHIPS: Chip[] = [
  { emoji: '🌤️', label: 'Afternoon', value: 'afternoon' },
  { emoji: '🌆', label: 'Evening', value: 'evening' },
  { emoji: '🌙', label: 'Late Night', value: 'late night' },
];

const PRICE_CHIPS: Chip[] = [
  { emoji: '💸', label: 'Under $8', value: '8' },
  { emoji: '🍺', label: '$8–10', value: '10' },
  { emoji: '🤷', label: 'Don\'t care', value: '' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let msgId = 0;
function makeMsg(from: Message['from'], text: string, chips?: Chip[]): Message {
  return { id: ++msgId, from, text, chips, chipsAnswered: false };
}

const NEIGHBOURHOOD_PATTERNS: [RegExp, string][] = [
  [/downtown|granville st|robson|nelson st|burrard|georgia st|seymour|hornby/i, 'Downtown'],
  [/gastown|water st|carrall|chinatown|keefer|strathcona|e hastings/i, 'Gastown & Chinatown'],
  [/yaletown|mainland st|hamilton st|false creek/i, 'Yaletown'],
  [/kitsilano|kits|west 4th|ubc|point grey|west broadway/i, 'Kitsilano & West Side'],
  [/east van|east vancouver|commercial drive|main st|mount pleasant|grandview/i, 'East Vancouver'],
];

function detectNeighbourhood(query: string): string | null {
  for (const [pattern, zone] of NEIGHBOURHOOD_PATTERNS) {
    if (pattern.test(query)) return zone;
  }
  return null;
}

function detectDrinkType(query: string): DrinkType | null {
  if (/cocktail|mojito|martini|margarita|negroni|old fashioned|espresso|spritz|\bgin\b|whisky|whiskey|\brum\b|tequila|\bvodka\b|mixed drink/i.test(query)) return 'cocktail';
  if (/\bpint\b|draught|draft|\bbeer\b|lager|\bipa\b|\bale\b|craft beer|\bbrew\b|pale ale|stout|hazy/i.test(query)) return 'beer';
  return null;
}

function detectTimeOfDay(query: string): string | undefined {
  if (/late.?night|after midnight|last call|after.?hours|nightcap/i.test(query)) return 'late night';
  if (/afternoon|after.?work|day.?drink|daytime|\bearly\b|pregame|pre.?game/i.test(query)) return 'afternoon';
  if (/\bevening\b|dinner|tonight|night out/i.test(query)) return 'evening';
  return undefined;
}

// Returns: a number (cap), null (no limit), or undefined (unknown — ask)
function detectMaxPrice(query: string): number | null | undefined {
  if (/cheap(est)?|budget|affordable|\bdeal\b|\bvalue\b|under \$8|bargain/i.test(query)) return 8;
  if (/\$8.{0,4}10|around \$10|mid.?range/i.test(query)) return 10;
  if (/no budget|don.?t care|whatever|not (worried|fussed).*price/i.test(query)) return null;
  return undefined;
}

function formatTag(tag: string) { return tag.replace(/_/g, ' '); }

function formatHHTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`;
}


function formatHHDays(days: string[]): string {
  const ORDER = ['sun','mon','tue','wed','thu','fri','sat'];
  const DISPLAY: Record<string,string> = { sun:'Sun', mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat' };
  const sorted = [...days].map(d => d.toLowerCase()).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const key = sorted.join(',');
  if (key === 'mon,tue,wed,thu,fri') return 'Weekdays';
  if (key === 'mon,tue,wed,thu,fri,sat') return 'Mon–Sat';
  if (sorted.length === 7) return 'Daily';
  if (sorted.length === 1) return DISPLAY[sorted[0]] ?? sorted[0];
  const indices = sorted.map(d => ORDER.indexOf(d));
  const consecutive = indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
  if (consecutive && sorted.length >= 3) return `${DISPLAY[sorted[0]]}–${DISPLAY[sorted[sorted.length - 1]]}`;
  return sorted.map(d => DISPLAY[d] ?? d).join(', ');
}

function getInfoLine(r: VibeResult): { text: string; className: string } {
  if (r.is_happy_hour && r.happy_hour_end) {
    return {
      text: `🟢 HH active · ends ${formatHHTime(r.happy_hour_end)}`,
      className: 'text-emerald-700 font-semibold',
    };
  }
  if (r.happy_hour_start && r.happy_hour_end) {
    return {
      text: `🕐 HH ${formatHHTime(r.happy_hour_start)}–${formatHHTime(r.happy_hour_end)}`,
      className: 'text-stone-500',
    };
  }
  if (r.neighbourhood) {
    return { text: `📍 ${r.neighbourhood}`, className: 'text-stone-400' };
  }
  return { text: '', className: '' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function FindYourVibeClient({ initialQuery }: { initialQuery: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<ChatStep>(initialQuery ? 'drink_type' : 'input');
  const [inputText, setInputText] = useState('');
  const [query, setQuery] = useState(initialQuery);
  const [drinkType, setDrinkType] = useState<DrinkType | null>(null);
  const [neighbourhood, setNeighbourhood] = useState<string | null>(null);
  const [results, setResults] = useState<VibeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const resultsTopRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const [timeOfDay, setTimeOfDay] = useState<string | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | null | undefined>(undefined);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { addBar } = useMyNightContext();

  const addBot = useCallback((text: string, chips?: Chip[]) => {
    setMessages(prev => [...prev, makeMsg('bot', text, chips)]);
  }, []);

  const addUser = useCallback((text: string) => {
    setMessages(prev => [...prev, makeMsg('user', text)]);
  }, []);

  const markLastChipsAnswered = useCallback(() => {
    setMessages(prev => prev.map((m, i) =>
      i === prev.length - 1 && m.from === 'bot' ? { ...m, chipsAnswered: true } : m
    ));
  }, []);

  // Follow conversation; snap to "here are your picks" when results land
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    if (step === 'results' && resultsTopRef.current) {
      setTimeout(() => {
        const containerRect = container.getBoundingClientRect();
        const elRect = resultsTopRef.current!.getBoundingClientRect();
        container.scrollTop += elRect.top - containerRect.top - 12;
      }, 60);
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, step]);

  const runSearch = useCallback(async (q: string, drink: DrinkType, hood: string | null, time: string | null, max: number | null) => {
    setStep('searching');
    setError(null);
    posthog.capture('vibe_search_chat', { query: q, drinkType: drink, neighbourhood: hood, timeOfDay: time, maxPrice: max });

    try {
      const res = await fetch('/api/vibe-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, drinkType: drink, neighbourhood: hood, timeOfDay: time, maxPrice: max }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.recommendations);
      setStep('results');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Try again.';
      setError(msg);
      setStep('results');
    }
  }, []);

  // Kick off conversation when initialQuery provided
  useEffect(() => {
    if (!initialQuery || started.current) return;
    started.current = true;
    const detectedHood  = detectNeighbourhood(initialQuery);
    const detectedDrink = detectDrinkType(initialQuery);
    const detectedTime  = detectTimeOfDay(initialQuery);
    const detectedBudget = detectMaxPrice(initialQuery);
    setNeighbourhood(detectedHood);
    if (detectedDrink) setDrinkType(detectedDrink);
    if (detectedTime !== undefined) setTimeOfDay(detectedTime);
    if (detectedBudget !== undefined) setMaxPrice(detectedBudget);
    setMessages([makeMsg('user', initialQuery)]);
    setTimeout(() => {
      if (!detectedDrink) {
        addBot('What are you drinking tonight?', DRINK_CHIPS);
        setStep('drink_type');
      } else if (detectedDrink === 'cocktail') {
        if (detectedTime === undefined) {
          addBot('What time are you heading out?', TIME_CHIPS);
          setStep('time_of_day');
        } else {
          addBot('On it — finding your perfect cocktail spot... 🍹');
          setTimeout(() => runSearch(initialQuery, detectedDrink, detectedHood, detectedTime, null), 600);
        }
      } else {
        if (detectedBudget === undefined) {
          addBot("What's your budget per pint?", PRICE_CHIPS);
          setStep('price');
        } else {
          addBot('Finding your perfect spot...');
          setTimeout(() => runSearch(initialQuery, detectedDrink, detectedHood, null, detectedBudget), 600);
        }
      }
    }, 400);
  }, [initialQuery, addBot, runSearch]);

  // Focus input on mount if no initial query
  useEffect(() => {
    if (!initialQuery) setTimeout(() => inputRef.current?.focus(), 100);
  }, [initialQuery]);

  // Handle initial text submission (when no initialQuery)
  const handleInputSubmit = useCallback(() => {
    const q = inputText.trim();
    if (!q) return;
    setQuery(q);
    const detectedHood   = detectNeighbourhood(q);
    const detectedDrink  = detectDrinkType(q);
    const detectedTime   = detectTimeOfDay(q);
    const detectedBudget = detectMaxPrice(q);
    setNeighbourhood(detectedHood);
    if (detectedDrink) setDrinkType(detectedDrink);
    if (detectedTime !== undefined) setTimeOfDay(detectedTime);
    if (detectedBudget !== undefined) setMaxPrice(detectedBudget);
    setMessages([makeMsg('user', q)]);
    setInputText('');
    setTimeout(() => {
      if (!detectedDrink) {
        addBot('What are you drinking tonight?', DRINK_CHIPS);
        setStep('drink_type');
      } else if (detectedDrink === 'cocktail') {
        if (detectedTime === undefined) {
          addBot('What time are you heading out?', TIME_CHIPS);
          setStep('time_of_day');
        } else {
          addBot('On it — finding your perfect cocktail spot... 🍹');
          setTimeout(() => runSearch(q, detectedDrink, detectedHood, detectedTime, null), 600);
        }
      } else {
        if (detectedBudget === undefined) {
          addBot("What's your budget per pint?", PRICE_CHIPS);
          setStep('price');
        } else {
          addBot('Finding your perfect spot...');
          setTimeout(() => runSearch(q, detectedDrink, detectedHood, null, detectedBudget), 600);
        }
      }
    }, 400);
  }, [inputText, addBot, runSearch]);

  // Handle chip selection
  const handleChip = useCallback((chip: Chip) => {
    markLastChipsAnswered();

    if (step === 'drink_type') {
      const drink = chip.value as DrinkType;
      setDrinkType(drink);
      addUser(`${chip.emoji} ${chip.label}`);
      setTimeout(() => {
        if (drink === 'cocktail') {
          if (timeOfDay !== undefined) {
            addBot('On it — finding your perfect cocktail spot... 🍹');
            setTimeout(() => runSearch(query, drink, neighbourhood, timeOfDay, null), 600);
          } else {
            addBot('What time are you heading out?', TIME_CHIPS);
            setStep('time_of_day');
          }
        } else {
          if (maxPrice !== undefined) {
            addBot('Finding your perfect spot...');
            setTimeout(() => runSearch(query, drink, neighbourhood, null, maxPrice), 600);
          } else {
            addBot("What's your budget per pint?", PRICE_CHIPS);
            setStep('price');
          }
        }
      }, 400);
    }

    else if (step === 'location') {
      const hood = chip.value || null;
      setNeighbourhood(hood);
      addUser(`${chip.emoji} ${chip.label}`);
      setTimeout(() => {
        if (drinkType === 'cocktail') {
          addBot('What time are you heading out?', TIME_CHIPS);
          setStep('time_of_day');
        } else {
          addBot('What\'s your budget per pint?', PRICE_CHIPS);
          setStep('price');
        }
      }, 400);
    }

    else if (step === 'time_of_day') {
      const time = chip.value || undefined;
      setTimeOfDay(time);
      addUser(`${chip.emoji} ${chip.label}`);
      setTimeout(() => {
        addBot('On it — finding your perfect cocktail spot... 🍹');
        setTimeout(() => runSearch(query, 'cocktail', neighbourhood, time ?? null, null), 600);
      }, 400);
    }

    else if (step === 'price') {
      const max = chip.value ? parseInt(chip.value) : null;
      setMaxPrice(max);
      addUser(`${chip.emoji} ${chip.label}`);
      setTimeout(() => {
        addBot('Finding your perfect spot...');
        setTimeout(() => runSearch(query, drinkType ?? 'any', neighbourhood, null, max), 600);
      }, 400);
    }
  }, [step, neighbourhood, drinkType, query, timeOfDay, maxPrice, addUser, addBot, markLastChipsAnswered, runSearch]);

  return (
    <main className="h-screen bg-[#fef9f0] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#fef9f0] border-b border-[#e8dcc8] px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-stone-400 hover:text-[#1c1917] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h1 className="font-black text-[#1c1917] text-base tracking-tight">Find Your Vibe</h1>
        </div>
      </div>

      {/* Chat thread */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 max-w-2xl mx-auto w-full">

        {/* Empty state — icon + search box + chips all together, vertically centred */}
        {messages.length === 0 && step === 'input' && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#B34207] flex items-center justify-center mx-auto mb-3 shadow-lg">
                <span className="text-2xl">✨</span>
              </div>
              <h2 className="font-black text-[#1c1917] text-xl mb-1">Find Your Vibe</h2>
              <p className="text-stone-500 text-sm">Describe your night and we&apos;ll match you with the perfect bar.</p>
            </div>

            <div className="w-full">
              <div className="flex items-center gap-2 bg-white border border-[#fde8c4] focus-within:border-[#B34207]/50 rounded-2xl px-4 py-3 shadow-sm transition-all">
                <input
                  ref={inputRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInputSubmit()}
                  placeholder="e.g. lively sports bar with friends..."
                  className="flex-1 bg-transparent outline-none text-sm text-[#1c1917] placeholder-stone-400 min-w-0"
                />
                <button
                  onClick={handleInputSubmit}
                  disabled={!inputText.trim()}
                  className="shrink-0 bg-[#B34207] hover:bg-[#8f3506] disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-sm px-4 py-2 rounded-xl transition-colors"
                >
                  Go
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { emoji: '🍺', label: 'Cheap pregame before Granville' },
                  { emoji: '💫', label: 'Cozy first date, not too loud' },
                  { emoji: '💎', label: 'Hidden local gem, no tourists' },
                ].map(chip => (
                  <button
                    key={chip.label}
                    onClick={() => { setInputText(`${chip.emoji} ${chip.label}`); inputRef.current?.focus(); }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-[#e8dcc8] text-stone-500 hover:border-[#B34207]/40 transition-colors"
                  >
                    {chip.emoji} {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className={messages.length > 0 ? 'py-6 space-y-4' : ''}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.from === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
            {msg.from === 'bot' && (
              <div className="w-8 h-8 rounded-full bg-[#B34207] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <span className="text-sm">🍺</span>
              </div>
            )}
            <div className={`max-w-[80%] ${msg.from === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.from === 'user'
                  ? 'bg-[#B34207] text-white rounded-tr-sm font-semibold'
                  : 'bg-white border border-[#fde8c4] text-[#1c1917] rounded-tl-sm shadow-sm'
              }`}>
                {msg.text}
              </div>
              {/* Chips */}
              {msg.chips && !msg.chipsAnswered && (
                <div className="flex flex-wrap gap-2">
                  {msg.chips.map(chip => (
                    <button
                      key={chip.value}
                      onClick={() => handleChip(chip)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full bg-white border border-[#e8dcc8] text-[#1c1917] hover:border-[#B34207] hover:bg-[#fef9f0] transition-all duration-150 shadow-sm"
                    >
                      <span>{chip.emoji}</span>
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Searching indicator */}
        {step === 'searching' && (
          <div className="flex gap-3 justify-start animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-[#B34207] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <span className="text-sm">🍺</span>
            </div>
            <div className="bg-white border border-[#fde8c4] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center h-5">
                <span className="w-2 h-2 rounded-full bg-[#B34207]/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#B34207]/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#B34207]/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {step === 'results' && (
          <div ref={resultsTopRef} className="animate-fadeIn">
            {error ? (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-[#B34207] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm">🍺</span>
                </div>
                <div className="bg-white border border-red-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-red-500">
                  {error}
                </div>
              </div>
            ) : results && results.length > 0 ? (
              <div className="space-y-3">
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-[#B34207] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <span className="text-sm">🍺</span>
                  </div>
                  <div className="bg-white border border-[#fde8c4] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-[#1c1917] shadow-sm">
                    Here are your top picks for tonight 🎯
                  </div>
                </div>
                <div className="bg-white border border-[#fde8c4] rounded-2xl shadow-sm overflow-hidden ml-11 divide-y divide-[#fde8c4]">
                  {(showAll ? results : results.slice(0, 3)).map((r, i) => (
                    <ResultCard
                      key={r.bar_id}
                      result={r}
                      rank={i + 1}
                      drinkType={drinkType ?? 'any'}
                      isExpanded={expandedId === r.bar_id}
                      onToggle={() => setExpandedId(id => id === r.bar_id ? null : r.bar_id)}
                      isAdded={addedIds.has(r.bar_id)}
                      onAddToMyNight={() => {
                        const res = addBar({
                          id: r.bar_id,
                          name: r.bar_name,
                          neighbourhood: r.neighbourhood,
                          price: r.cheapest_price,
                          lat: null,
                          lng: null,
                          isHappyHour: r.is_happy_hour,
                        } as MyNightBar);
                        if (res === 'added') setAddedIds(prev => new Set(prev).add(r.bar_id));
                      }}
                    />
                  ))}
                </div>
                {!showAll && results.length > 3 && (
                  <div className="flex justify-center mt-2">
                    <button
                      onClick={() => setShowAll(true)}
                      className="text-sm text-[#B34207] font-semibold hover:underline"
                    >
                      Show me more options →
                    </button>
                  </div>
                )}
                <div className="pt-2 pb-4 text-center">
                  <button
                    onClick={() => {
                      setMessages([]);
                      setStep('input');
                      setQuery('');
                      setDrinkType(null);
                      setNeighbourhood(null);

                      setResults(null);
                      setError(null);
                      setShowAll(false);
                      setTimeOfDay(undefined);
                      setMaxPrice(undefined);
                      started.current = false;
                      setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                    className="text-xs text-stone-400 hover:text-[#B34207] transition-colors font-semibold"
                  >
                    ↩ Start over
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
        </div>

      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Result card — compact scan row, tap to expand (one at a time)
// ---------------------------------------------------------------------------
function ResultCard({ result: r, drinkType, isExpanded, onToggle, isAdded, onAddToMyNight }: {
  result: VibeResult;
  rank?: number;
  drinkType: DrinkType;
  isExpanded: boolean;
  onToggle: () => void;
  isAdded: boolean;
  onAddToMyNight: () => void;
}) {
  const info = getInfoLine(r);

  return (
    <div>
      {/* ── Compact row (always visible, ~64px tap target) ── */}
      <button onClick={onToggle} className="relative w-full flex items-center gap-3 pl-5 pr-4 py-3 text-left min-h-[64px]">
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#B34207]" />

        {/* Name + info line */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-[#1c1917] text-sm leading-tight">{r.bar_name}</p>
          {info.text && (
            <p className={`text-[11px] mt-0.5 leading-none ${info.className}`}>{info.text}</p>
          )}
        </div>

        {/* Price + chevron */}
        <div className="flex items-center gap-1.5 shrink-0">
          {drinkType !== 'cocktail' && r.cheapest_price != null && (
            <span className="text-[#B34207] font-black text-sm">${Number(r.cheapest_price).toFixed(2)}</span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`text-stone-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* ── Expanded detail ── */}
      {isExpanded && (
        <div className="px-5 pb-4 border-t border-[#fde8c4] animate-expandDown">
          <p className="text-xs text-stone-500 leading-relaxed mt-3 mb-3">{r.match_reason}</p>

          {/* HH window */}
          {r.happy_hour_start && r.happy_hour_end && (
            <div className="mb-2.5">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${
                r.is_happy_hour
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-[#fef9f0] text-stone-500 border border-[#e8dcc8]'
              }`}>
                {r.is_happy_hour ? '🍻' : '🕐'} Happy Hour {formatHHTime(r.happy_hour_start)}–{formatHHTime(r.happy_hour_end)}
                {r.happy_hour_days && ` · ${formatHHDays(r.happy_hour_days)}`}
              </span>
            </div>
          )}

          {/* Tags */}
          {r.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {r.tags.slice(0, 4).map(t => (
                <span key={t} className="text-[10px] bg-[#fef9f0] text-stone-500 border border-[#e8dcc8] px-1.5 py-0.5 rounded-full capitalize">
                  {formatTag(t)}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-[#fde8c4]">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.bar_name + ' Vancouver BC')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg bg-[#B34207] hover:bg-[#8f3506] text-white transition-colors"
            >
              📍 Directions
            </a>
            <button
              onClick={e => { e.stopPropagation(); onAddToMyNight(); }}
              disabled={isAdded}
              className={`inline-flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg border transition-all ${
                isAdded
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-[#fef9f0] border-[#e8dcc8] text-[#1c1917] hover:border-[#B34207]/40'
              }`}
            >
              {isAdded ? '✓ Added' : '+ My Picks'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
