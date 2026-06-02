import AdvertiseForm from '@/components/AdvertiseForm';

export const metadata = {
  title: 'Advertise With Us — Pint Map YVR',
};

export default function AdvertisePage() {
  return (
    <main className="min-h-screen bg-[#fef9f0] text-[#1c1917]">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        {/* Header */}
        <div className="mb-8">
          <span className="inline-block text-xs font-black uppercase tracking-widest text-[#B34207] mb-3">
            📢 Partner With Us
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#1c1917] leading-tight mb-4">
            Advertise With Pint Map YVR
          </h1>
          <p className="text-stone-500 leading-relaxed text-base">
            Pint Map YVR is the go-to spot for Vancouver bar-goers hunting the best pint deal in the city — and with the World Cup coming to town, that audience is only getting bigger. Whether you run a bar, a brewery, or a brand that wants to reach thirsty Vancouverites, we can help you get in front of them.
          </p>
          <p className="text-stone-500 leading-relaxed text-base mt-3">
            We offer featured bar listings, sponsored promotions, and custom partnership packages. Drop us a line below and we&apos;ll get back to you within a day or two.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white border border-[#fde8c4] rounded-2xl p-6 sm:p-8">
          <AdvertiseForm />
        </div>
      </div>
    </main>
  );
}
