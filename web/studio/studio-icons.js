// Line icons for the Studio chrome (24px grid, currentColor). Decorative: every button carries its own accessible name.
const svg = (body) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICON = {
  sound: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a8 8 0 0 1 0 11"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  chevron: svg('<path d="M9 6l6 6-6 6"/>'),
  compass: svg('<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  explore: svg('<path d="M5 4l5.5 15 2.3-6.2L19 10.5z"/>'),
  area: svg('<rect x="4.5" y="6" width="15" height="12" rx="1.5" stroke-dasharray="3 2.5"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="19.5" cy="18" r="1.2"/>'),
  path: svg('<path d="M5 18c4 0 3-8 7-8s3 6 7 6"/><circle cx="5" cy="18" r="1.4"/><circle cx="19" cy="16" r="1.4"/>'),
  compare: svg('<rect x="3.5" y="5" width="7" height="14" rx="1.5"/><rect x="13.5" y="5" width="7" height="14" rx="1.5"/><path d="M12 3v18" stroke-dasharray="2 2"/>'),
  hunter: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/><path d="M11 8v6M8 11h6"/>'),
  echo: svg('<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>'),
  help: svg('<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7"/><path d="M12 16.8v.01"/>'),
  play: svg('<path d="M8 5.5v13l10-6.5z"/>'),
  pause: svg('<path d="M8.5 5.5v13M15.5 5.5v13"/>'),
  calendar: svg('<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
  voice: svg('<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>'),
  waves: svg('<path d="M3 12h2.5l2-6 3.5 12 3-9 2 3h5"/>'),
};
