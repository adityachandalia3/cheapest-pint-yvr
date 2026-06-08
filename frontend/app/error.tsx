'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#fef9f0] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-4xl mb-4">🍺</p>
        <h2 className="text-xl font-black text-[#1c1917] mb-2">Something went wrong</h2>
        <p className="text-stone-500 mb-6">We hit a snag. Give it another shot.</p>
        <button
          onClick={reset}
          className="bg-[#B34207] hover:bg-[#8f3506] text-white font-black px-6 py-3 rounded-xl text-sm transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
