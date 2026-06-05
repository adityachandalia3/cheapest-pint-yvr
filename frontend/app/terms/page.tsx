export const metadata = {
  title: 'Terms & Conditions — Brewscanner',
};

const sections = [
  {
    title: 'Introduction',
    body: 'Brewscanner is a free service that helps users find beer prices across Vancouver bars. By using this site you agree to these terms and conditions.',
  },
  {
    title: 'Price Accuracy Disclaimer',
    body: 'All prices displayed on Brewscanner are sourced automatically via web scraping and community submissions. Prices may be out of date, inaccurate, or no longer available. Brewscanner makes no guarantee that prices displayed reflect current bar pricing. Always verify prices directly with the bar before making decisions based on information shown on this site. We are not liable for any discrepancy between prices shown and prices charged.',
  },
  {
    title: 'User Submitted Content',
    body: 'Users may submit prices and information via our submission form. Brewscanner does not verify user-submitted content before it is reviewed by our team. We reserve the right to remove any submission at our discretion. By submitting content you confirm it is accurate to the best of your knowledge.',
  },
  {
    title: 'Third Party Data',
    body: "Bar information, photos, and location data may be sourced from Google Places API. This data is provided under Google's terms of service. All Google-sourced content is attributed accordingly. Bar photos remain the property of their respective owners.",
  },
  {
    title: 'Website Scraping',
    body: "Brewscanner collects publicly available pricing information from bar websites for the purpose of helping consumers find affordable options. We respect robots.txt files and do not collect personal data from third-party websites.",
  },
  {
    title: 'Limitation of Liability',
    body: 'Brewscanner is provided as-is with no warranties. We are not responsible for any loss or inconvenience arising from use of this site, including but not limited to incorrect pricing, bar closures, or changes in business operations.',
  },
  {
    title: 'Changes to Terms',
    body: 'We may update these terms at any time. Continued use of the site constitutes acceptance of the updated terms.',
  },
  {
    title: 'Contact',
    body: 'For any questions about these terms, contact us at the email address listed on our Advertise With Us page.',
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fef9f0]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-[#1c1917] mb-2">Terms &amp; Conditions</h1>
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
