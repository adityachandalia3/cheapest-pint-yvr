// Module-level store so the deferred install prompt survives navigation
let _prompt: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;

export const installPrompt = {
  set: (e: Event) => {
    _prompt = e as typeof _prompt;
  },
  get: () => _prompt,
  clear: () => { _prompt = null; },
};
