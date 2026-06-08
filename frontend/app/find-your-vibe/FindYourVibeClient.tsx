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

const LOCATION_CHIPS: Chip[] = [
  { emoji: '🏙️', label: 'Downtown', value: 'Downtown' },
  { emoji: '🪨', label: 'Gastown & Chinatown', value: 'Gastown & Chinatown' },
  { emoji: '🍸', label: 'Yaletown', value: 'Yaletown' },
  { emoji: '🌊', label: 'Kitsilano & West Side', value: 'Kitsilano & West Side' },
  { emoji: '🎸', label: 'East Vancouver', value: 'East Vancouver' },
  { emoji: '🗺️', label: 'Anywhere', value: '' },
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

function formatTag(tag: string) { return tag.replace(/_/g, ' '); }

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
  const [timeOfDay, setTimeOfDay] = useState<string | null>(null);
  const [results, setResults] = useState<VibeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const resultsTopRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
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

  // Kick off conversation when initialQuery provided
  useEffect(() => {
    if (!initialQuery || started.current) return;
    started.current = true;
    const detected = detectNeighbourhood(initialQuery);
    setNeighbourhood(detected);
    setMessages([makeMsg('user', initialQuery)]);
    setTimeout(() => {
      addBot('What are you drinking tonight?', DRINK_CHIPS);
      setStep('drink_type');
    }, 400);
  }, [initialQuery, addBot]);

  // Focus input on mount if no initial query
  useEffect(() => {
    if (!initialQuery) setTimeout(() => inputRef.current?.focus(), 100);
  }, [initialQuery]);

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

  // Handle initial text submission (when no initialQuery)
  const handleInputSubmit = useCallback(() => {
    const q = inputText.trim();
    if (!q) return;
    setQuery(q);
    const detected = detectNeighbourhood(q);
    setNeighbourhood(detected);
    setMessages([makeMsg('user', q)]);
    setInputText('');
    setTimeout(() => {
      addBot('What are you drinking tonight?', DRINK_CHIPS);
      setStep('drink_type');
    }, 400);
  }, [inputText, addBot]);

  // Handle chip selection
  const handleChip = useCallback((chip: Chip) => {
    markLastChipsAnswered();

    if (step === 'drink_type') {
      const drink = chip.value as DrinkType;
      setDrinkType(drink);
      addUser(`${chip.emoji} ${chip.label}`);
      setTimeout(() => {
        if (neighbourhood !== null) {
          // Location already known
          if (drink === 'cocktail') {
            addBot('What time are you heading out?', TIME_CHIPS);
            setStep('time_of_day');
          } else {
            addBot('What\'s your budget per pint?', PRICE_CHIPS);
            setStep('price');
          }
        } else {
          addBot('Where in the city tonight?', LOCATION_CHIPS);
          setStep('location');
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
      const time = chip.value || null;
      setTimeOfDay(time);
      addUser(`${chip.emoji} ${chip.label}`);
      setTimeout(() => {
        addBot('On it — finding your perfect cocktail spot... 🍹');
        setTimeout(() => runSearch(query, 'cocktail', neighbourhood, time, null), 600);
      }, 400);
    }

    else if (step === 'price') {
      const max = chip.value ? parseInt(chip.value) : null;
      addUser(`${chip.emoji} ${chip.label}`);
      setTimeout(() => {
        addBot('Finding your perfect spot...');
        setTimeout(() => runSearch(query, drinkType ?? 'any', neighbourhood, null, max), 600);
      }, 400);
    }
  }, [step, neighbourhood, drinkType, timeOfDay, query, addUser, addBot, markLastChipsAnswered, runSearch]);

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
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">

        {/* Empty state */}
        {messages.length === 0 && step === 'input' && (
          <div className="text-center pt-8 pb-4">
            <div className="w-16 h-16 rounded-2xl bg-[#B34207] flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-3xl">✨</span>
            </div>
            <h2 className="font-black text-[#1c1917] text-xl mb-1">Find Your Vibe</h2>
            <p className="text-stone-500 text-sm">Describe your night and we'll match you with the perfect bar.</p>
          </div>
        )}

        {/* Messages */}
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
                {results.map((r, i) => (
                  <ResultCard
                    key={r.bar_id}
                    result={r}
                    rank={i + 1}
                    drinkType={drinkType ?? 'any'}
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
                <div className="pt-2 pb-4 text-center">
                  <button
                    onClick={() => {
                      setMessages([]);
                      setStep('input');
                      setQuery('');
                      setDrinkType(null);
                      setNeighbourhood(null);
                      setTimeOfDay(null);
                      setResults(null);
                      setError(null);
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

      {/* Input bar — only shown before conversation starts */}
      {step === 'input' && (
        <div className="sticky bottom-0 bg-[#fef9f0] border-t border-[#e8dcc8] px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-2 bg-white border border-[#fde8c4] focus-within:border-[#B34207]/50 rounded-2xl px-4 py-3 shadow-sm transition-all">
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
          <div className="flex flex-wrap gap-2 mt-2 max-w-2xl mx-auto">
            {[
              { emoji: '🍺', label: 'Cheap pregame before Granville' },
              { emoji: '💫', label: 'Cozy first date, not too loud' },
              { emoji: '💎', label: 'Hidden local gem, no tourists' },
            ].map(chip => (
              <button
                key={chip.label}
                onClick={() => {
                  setInputText(`${chip.emoji} ${chip.label}`);
                  inputRef.current?.focus();
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-[#e8dcc8] text-stone-500 hover:border-[#B34207]/40 transition-colors"
              >
                {chip.emoji} {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------
function ResultCard({ result: r, rank, drinkType, isAdded, onAddToMyNight }: {
  result: VibeResult;
  rank: number;
  drinkType: DrinkType;
  isAdded: boolean;
  onAddToMyNight: () => void;
}) {
  return (
    <div className="bg-white border border-[#fde8c4] rounded-2xl p-4 shadow-sm ml-11">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-[#1c1917] text-sm">{r.bar_name}</h3>
            {r.tags[0] && (
              <span className="text-[10px] bg-[#F5A623]/10 text-[#b45309] border border-[#F5A623]/25 px-1.5 py-0.5 rounded-full font-semibold capitalize">
                {formatTag(r.tags[0])}
              </span>
            )}
          </div>
          {r.neighbourhood && <p className="text-xs text-stone-400 mt-0.5">{r.neighbourhood}</p>}
        </div>
        <span className="shrink-0 w-6 h-6 rounded-full bg-[#B34207]/10 flex items-center justify-center text-xs font-black text-[#B34207]">
          {rank}
        </span>
      </div>

      <p className="text-xs text-stone-500 leading-relaxed mb-3">{r.match_reason}</p>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        {drinkType === 'cocktail' ? (
          r.tags.slice(1).length > 0
            ? r.tags.slice(1).map(tag => (
                <span key={tag} className="text-[11px] bg-[#fef9f0] text-[#b45309] border border-[#fde8c4] px-2 py-0.5 rounded-full font-semibold capitalize">
                  {formatTag(tag)}
                </span>
              ))
            : <span className="text-[11px] text-stone-400 italic">No tags available</span>
        ) : (
          <>
            {r.cheapest_price != null ? (
              <>
                <span className="text-[#B34207] font-black text-lg leading-none">${Number(r.cheapest_price).toFixed(2)}</span>
                <span className="text-[10px] text-stone-400">cheapest pint</span>
              </>
            ) : (
              <span className="text-[11px] text-stone-400 italic">Price info unavailable</span>
            )}
            {r.is_happy_hour && (
              <span className="text-[10px] bg-[#F5A623]/10 text-[#b45309] border border-[#F5A623]/25 px-1.5 py-0.5 rounded-full font-semibold">
                🍻 Happy Hour
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2.5 border-t border-[#fde8c4]">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.bar_name + ' Vancouver BC')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg bg-[#B34207] hover:bg-[#8f3506] text-white transition-colors"
        >
          📍 Directions
        </a>
        <button
          onClick={onAddToMyNight}
          disabled={isAdded}
          className={`inline-flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg border transition-all ${
            isAdded
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-[#fef9f0] border-[#e8dcc8] text-[#1c1917] hover:border-[#B34207]/40'
          }`}
        >
          {isAdded ? '✓ Added' : '+ My Night'}
        </button>
      </div>
    </div>
  );
}
