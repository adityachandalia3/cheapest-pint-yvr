'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

export default function PwaTracker() {
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      posthog.capture('pwa_launched_standalone');
    }
  }, []);

  return null;
}
