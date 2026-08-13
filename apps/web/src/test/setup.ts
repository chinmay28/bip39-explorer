import '@testing-library/jest-dom/vitest';

/* jsdom has no matchMedia, and the layout asks it whether the viewport is
   narrow. Default to the wide layout; tests that care override this. */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
