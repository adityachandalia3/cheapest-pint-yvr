import Link from 'next/link';

export const metadata = {
  title: 'About — Brewscanner',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#fef9f0] text-[#1c1917]">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <span className="text-4xl">🍺</span>
          <span className="font-black text-2xl tracking-tight text-[#B34207]">Brewscanner</span>
        </div>

        <div className="prose-like space-y-6 text-stone-600 leading-relaxed text-base">
          <div>
            <h2 className="text-xl font-black text-[#1c1917] mb-2">What is Brewscanner?</h2>
            <p>
              Brewscanner scans 100+ bars across Vancouver to find you the cheapest pint in the city. No hunting. No guessing. Just the best deal, right now.
            </p>
            <p className="mt-3">
              But we&apos;re not just a price list. We&apos;ve gone deeper. Find Your Vibe lets you describe the night you want — &quot;lively sports bar with friends&quot; or &quot;chill spot for a date&quot; — and we&apos;ll match you with bars that actually fit. Want to hop between spots? The Bar Crawl Builder plans a multi-stop night out, starting cheap and building toward wherever you want to end up. It&apos;s an immersive experience, not a database.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-[#1c1917] mb-2">The World Cup is coming</h2>
            <p>
              Vancouver is one of the host cities for the 2026 FIFA World Cup, and that means thousands of football fans from around the world are going to be looking for a good bar to watch the game. We&apos;re building Brewscanner to be their first stop — helping visitors and locals alike find the best atmosphere, the best price, and the best pint in the city.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-[#1c1917] mb-2">How the prices work</h2>
            <p>
              Prices are scraped automatically from bar menus and updated regularly. We also factor in happy hour windows so you know when a place is offering a deal right now versus their regular price. Community submissions help us catch things the scraper misses — if you spot something wrong, you can submit a correction and we&apos;ll review it.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-[#1c1917] mb-2">A note from us</h2>
            <p>
              This is a passion project built by a couple of Vancouverites who like beer and hate overpaying for it. We&apos;re not affiliated with any bar or brewery — we just want the map to be accurate and useful. If you run a bar and want to make sure your prices are right, or if you want to partner with us ahead of the World Cup, we&apos;d love to hear from you.
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row flex-wrap gap-3">
          <Link
            href="/?tab=vibe"
            className="inline-flex items-center justify-center gap-2 bg-[#B34207] hover:bg-[#8f3506] text-white font-black px-6 py-3 rounded-xl transition-all duration-200 text-sm"
          >
            ✨ Find Your Vibe
          </Link>
          <Link
            href="/crawl-builder"
            className="inline-flex items-center justify-center gap-2 bg-[#B34207] hover:bg-[#8f3506] text-white font-black px-6 py-3 rounded-xl transition-all duration-200 text-sm"
          >
            🗺️ Plan a Bar Crawl
          </Link>
          <Link
            href="/advertise"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#fef9f0] text-[#B34207] border border-[#B34207] font-black px-6 py-3 rounded-xl transition-all duration-200 text-sm"
          >
            📢 Advertise With Us
          </Link>
          <Link
            href="/submit-price"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#fef9f0] text-[#B34207] border border-[#B34207] font-black px-6 py-3 rounded-xl transition-all duration-200 text-sm"
          >
            🍺 Submit a Price
          </Link>
        </div>
      </div>
    </main>
  );
}
