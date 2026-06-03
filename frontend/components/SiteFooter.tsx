import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="text-center py-8 border-t border-[#fde8c4] mt-4 bg-white">
      <p className="text-stone-400 text-xs mb-3">🍺 Pint Map YVR · Vancouver, BC</p>
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
        <Link href="/terms" className="text-[11px] text-stone-400 hover:text-[#B34207] transition-colors">
          Terms &amp; Conditions
        </Link>
        <span className="text-stone-300 text-[11px]">·</span>
        <Link href="/privacy" className="text-[11px] text-stone-400 hover:text-[#B34207] transition-colors">
          Privacy Policy
        </Link>
        <span className="text-stone-300 text-[11px]">·</span>
        <Link href="/advertise" className="text-[11px] text-stone-400 hover:text-[#B34207] transition-colors">
          Advertise With Us
        </Link>
        <span className="text-stone-300 text-[11px]">·</span>
        <Link href="/submit-price" className="text-[11px] text-stone-400 hover:text-[#B34207] transition-colors">
          Submit a Price
        </Link>
      </nav>
    </footer>
  );
}
