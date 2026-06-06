'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import posthog from 'posthog-js';

export interface MyNightBar {
  id: string;
  name: string;
  neighbourhood: string | null;
  price: number | null;
  lat: number | null;
  lng: number | null;
  isHappyHour?: boolean;
}

interface MyNightContextType {
  myNight: MyNightBar[];
  addBar: (bar: MyNightBar) => 'added' | 'duplicate';
  removeBar: (id: string) => void;
  clearAll: () => void;
}

const MyNightContext = createContext<MyNightContextType | null>(null);
const STORAGE_KEY = 'myPicks';

export function MyNightProvider({ children }: { children: ReactNode }) {
  const [myNight, setMyNight] = useState<MyNightBar[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMyNight(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  function save(bars: MyNightBar[]) {
    setMyNight(bars);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bars));
  }

  function addBar(bar: MyNightBar): 'added' | 'duplicate' {
    if (myNight.some(b => b.id === bar.id)) {
      setToast('Already in My Picks');
      setTimeout(() => setToast(null), 2000);
      return 'duplicate';
    }
    save([...myNight, bar]);
    posthog.capture('mypicks_added', { bar_name: bar.name });
    return 'added';
  }

  function removeBar(id: string) {
    save(myNight.filter(b => b.id !== id));
  }

  function clearAll() {
    setMyNight([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <MyNightContext.Provider value={{ myNight, addBar, removeBar, clearAll }}>
      {children}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[600] bg-[#1c1917] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}
    </MyNightContext.Provider>
  );
}

export function useMyNightContext() {
  const ctx = useContext(MyNightContext);
  if (!ctx) throw new Error('useMyNightContext must be used within MyNightProvider');
  return ctx;
}
