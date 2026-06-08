import { getSupabaseClient } from '@/lib/supabase';
import SubmitPriceForm from '@/components/SubmitPriceForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Submit a Beer Price — Brewscanner',
  description: 'Spotted a wrong price or found a deal we missed? Submit a pint price for any Vancouver bar and help keep Brewscanner accurate.',
};


export interface BarOption {
  id: string;
  name: string;
}

export default async function SubmitPricePage() {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('bars')
    .select('id, name')
    .eq('is_permanently_closed', false)
    .order('name');

  const bars: BarOption[] = data ?? [];

  return (
    <main className="min-h-screen bg-[#fef9f0] text-[#1c1917]">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <div className="mb-8">
          <span className="inline-block text-xs font-black uppercase tracking-widest text-[#B34207] mb-3">
            🍺 Community Prices
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#1c1917] leading-tight mb-4">
            Submit a Price
          </h1>
          <p className="text-stone-500 leading-relaxed text-base">
            Spotted a cheap pint? Help keep our prices accurate and up to date. Submissions are reviewed before going live — usually within 24 hours.
          </p>
        </div>

        <div className="bg-white border border-[#fde8c4] rounded-2xl p-6 sm:p-8">
          <SubmitPriceForm bars={bars} />
        </div>
      </div>
    </main>
  );
}
