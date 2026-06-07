import InstallClient from './InstallClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Install Brewscanner — Add to Home Screen',
};

export default function InstallPage() {
  return <InstallClient />;
}
