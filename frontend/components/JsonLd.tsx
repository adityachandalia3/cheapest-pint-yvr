export default function JsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Brewscanner',
        url: 'https://www.getbrewscanner.com',
        description: 'Real-time beer prices across 100+ Vancouver bars. Find the cheapest pint near you, discover happy hour deals, and build the perfect pub crawl.',
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web, iOS, Android',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'CAD' },
        areaServed: { '@type': 'City', name: 'Vancouver', addressCountry: 'CA' },
      },
      {
        '@type': 'Organization',
        name: 'Brewscanner',
        url: 'https://www.getbrewscanner.com',
        logo: 'https://www.getbrewscanner.com/logo.png',
        sameAs: ['https://www.instagram.com/getbrewscanner/'],
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'team@getbrewscanner.com',
          contactType: 'customer support',
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
