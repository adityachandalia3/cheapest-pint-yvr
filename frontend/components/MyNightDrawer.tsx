'use client';

import { useMyNightContext, type MyNightBar } from '@/lib/myNightContext';

function multiStopUrl(bars: MyNightBar[]): string {
  const valid = bars.filter(b => b.lat && b.lng);
  if (valid.length === 0) return 'https://maps.google.com';
  return `https://www.google.com/maps/dir/${valid.map(b => `${b.lat},${b.lng}`).join('/')}`;
}

export default function MyNightDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { myNight, removeBar, clearAll } = useMyNightContext();

  async function handleShare() {
    const names = myNight.map(b => b.name).join(', ');
    const text = `Here's my bar list for tonight 🍺 ${names} — built on getbrewscanner.com`;
    if (navigator.share) {
      await navigator.share({ title: 'My Picks — Brewscanner', text, url: 'https://getbrewscanner.com' });
    } else {
      await navigator.clipboard.writeText(text + '\nhttps://getbrewscanner.com');
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[400] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Desktop: slide-in from right */}
      <div
        className="hidden md:flex fixed right-0 top-0 bottom-0 z-[401] w-80 flex-col bg-[#faf5eb] border-l border-[#e8dcc8] shadow-2xl"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <DrawerContent myNight={myNight} removeBar={removeBar} clearAll={clearAll} onClose={onClose} handleShare={handleShare} />
      </div>

      {/* Mobile: slide-up sheet */}
      <div
        className="md:hidden fixed left-0 right-0 bottom-0 z-[401] max-h-[80vh] flex flex-col bg-[#faf5eb] rounded-t-2xl border-t border-[#e8dcc8] shadow-2xl"
        style={{ animation: 'slideUpSheet 0.25s ease-out', paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mt-3 mb-1 shrink-0" />
        <DrawerContent myNight={myNight} removeBar={removeBar} clearAll={clearAll} onClose={onClose} handleShare={handleShare} />
      </div>
    </>
  );
}

function DrawerContent({
  myNight,
  removeBar,
  clearAll,
  onClose,
  handleShare,
}: {
  myNight: MyNightBar[];
  removeBar: (id: string) => void;
  clearAll: () => void;
  onClose: () => void;
  handleShare: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8dcc8] shrink-0">
        <h2 className="font-black text-[#1c1917] text-base">🍺 My Picks</h2>
        <div className="flex items-center gap-3">
          {myNight.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs font-bold text-stone-400 hover:text-red-500 transition-colors"
            >
              Clear All
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-stone-400 hover:text-[#1c1917] hover:bg-stone-100 transition-all text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Bar list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {myNight.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-4xl mb-3">🍺</span>
            <p className="text-sm font-bold text-stone-500 leading-relaxed">
              No picks yet
            </p>
            <p className="text-xs text-stone-400 mt-1 leading-relaxed">
              No picks yet — use Find Your Vibe or browse the map to add bars to your night
            </p>
          </div>
        ) : (
          myNight.map(bar => (
            <div
              key={bar.id}
              className="bg-white border border-[#e8dcc8] rounded-xl p-3 flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-black text-[#1c1917] text-sm leading-tight truncate">{bar.name}</p>
                {bar.neighbourhood && (
                  <p className="text-[11px] text-stone-400 mt-0.5">{bar.neighbourhood}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {bar.price != null && (
                    <span className="text-[#B34207] font-black text-sm">${Number(bar.price).toFixed(2)}</span>
                  )}
                  {bar.isHappyHour && (
                    <span className="text-[9px] bg-[#F5A623]/10 text-[#b45309] border border-[#F5A623]/25 px-1.5 py-0.5 rounded-full font-bold">
                      🍻 HH
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeBar(bar.id)}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-stone-300 hover:text-red-400 hover:bg-red-50 transition-all text-xs mt-0.5"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer actions */}
      {myNight.length > 0 && (
        <div className="px-4 py-3 border-t border-[#e8dcc8] space-y-2 shrink-0">
          <a
            href={multiStopUrl(myNight)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#B34207] hover:bg-[#8f3506] text-white font-black text-sm rounded-xl transition-colors"
          >
            📍 Get Directions for All
          </a>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-[#e8dcc8] hover:border-[#B34207]/40 text-[#1c1917] font-black text-sm rounded-xl transition-colors"
          >
            🔗 Share My Picks
          </button>
        </div>
      )}
    </>
  );
}
