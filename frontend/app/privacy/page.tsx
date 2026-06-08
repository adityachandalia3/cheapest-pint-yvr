export const metadata = {
  title: 'Privacy Policy — Brewscanner',
  description: "Brewscanner's privacy policy — what data we collect, how we use it, and how to contact us.",
};

const sections = [
  {
    title: 'Introduction',
    body: 'Brewscanner respects your privacy. This policy explains what data we collect and how we use it.',
  },
  {
    title: 'Data We Collect',
    body: 'We do not require users to create an account. We collect: price submissions voluntarily submitted through our form (name is optional), contact form submissions from the Advertise With Us page, and anonymous usage analytics to understand how the site is used.',
  },
  {
    title: 'Data We Do Not Collect',
    body: 'We do not collect personal information without your consent. We do not sell your data to third parties. We do not track your location without permission.',
  },
  {
    title: 'Google Services',
    body: "We use Google Maps and Google Places API to display maps and bar information. Google may collect data as part of these services, subject to Google's own privacy policy.",
  },
  {
    title: 'Cookies',
    body: 'We may use cookies for basic analytics. We do not use cookies for advertising or tracking purposes.',
  },
  {
    title: 'Your Rights',
    body: 'Under Canadian privacy law (PIPEDA) you have the right to access, correct, or request deletion of any personal information you have submitted to us. Contact us to exercise these rights.',
  },
  {
    title: 'Contact',
    body: 'For privacy-related questions, contact us via the Advertise With Us page.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fef9f0]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-[#1c1917] mb-2">Privacy Policy</h1>
          <p className="text-sm text-stone-400">Last updated June 2026</p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#fde8c4] p-6">
              <h2 className="font-black text-[#1c1917] text-base mb-2">
                {i + 1}. {s.title}
              </h2>
              <p className="text-sm text-stone-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
