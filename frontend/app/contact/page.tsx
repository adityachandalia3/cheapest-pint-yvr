import type { Metadata } from 'next';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us — Brewscanner',
  description: 'Get in touch with the Brewscanner team. Spotted a wrong price, have a question, or want to partner with us? We reply within 24 hours.',
  openGraph: {
    title: 'Contact Us — Brewscanner',
    description: 'Get in touch with the Brewscanner team. We reply within 24 hours.',
    url: 'https://www.getbrewscanner.com/contact',
  },
};

export default function ContactPage() {
  return <ContactForm />;
}
