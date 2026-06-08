// SVG icon strings for the printable deployment poster.
// All icons use currentColor so they inherit colour from their container.

export const ICON_SCAN = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="5" y="5" width="15" height="15" rx="1.5" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <rect x="9" y="9" width="7" height="7" fill="currentColor"/>
  <rect x="28" y="5" width="15" height="15" rx="1.5" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <rect x="32" y="9" width="7" height="7" fill="currentColor"/>
  <rect x="5" y="28" width="15" height="15" rx="1.5" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <rect x="9" y="32" width="7" height="7" fill="currentColor"/>
  <rect x="28" y="28" width="4" height="4" fill="currentColor"/>
  <rect x="35" y="28" width="4" height="4" fill="currentColor"/>
  <rect x="28" y="35" width="4" height="4" fill="currentColor"/>
  <rect x="35" y="35" width="4" height="4" fill="currentColor"/>
  <rect x="42" y="28" width="1.5" height="1.5" fill="currentColor"/>
  <rect x="42" y="33" width="1.5" height="1.5" fill="currentColor"/>
  <rect x="42" y="38" width="1.5" height="1.5" fill="currentColor"/>
  <rect x="42" y="43" width="1.5" height="1.5" fill="currentColor"/>
</svg>`;

export const ICON_CAMERA = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="16" width="40" height="27" rx="4" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <path d="M16 16 L19 9 H29 L32 16" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
  <circle cx="24" cy="29" r="8" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <circle cx="24" cy="29" r="3.5" fill="currentColor"/>
  <circle cx="36" cy="22" r="2" fill="currentColor"/>
</svg>`;

export const ICON_SUBMIT = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <line x1="24" y1="33" x2="24" y2="17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  <polyline points="15,24 24,15 33,24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

// Crisis-type icons. Designed at 24×24 viewBox, minimal stroke style.
const crisisIconMap: Record<string, string> = {
  Earthquake: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 14 L6 9 L10 17 L14 7 L18 15 L22 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="2" y1="19" x2="22" y2="19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
  </svg>`,

  Flood: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 10 Q5.5 7 9 10 Q12.5 13 16 10 Q19.5 7 22 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M2 16 Q5.5 13 9 16 Q12.5 19 16 16 Q19.5 13 22 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M7 4 L9 7 M12 3 L12 6 M17 4 L15 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
  </svg>`,

  Tsunami: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 17 Q5 14 8 14 Q11 14 12 11 Q13 7 10 5 Q15 5 17 10 Q19 14 16 17 H22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M2 21 Q7 19 12 21 Q17 23 22 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
  </svg>`,

  "Hurricane/Cyclone": `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 8 C20 8 22 11 20 14 C18 17 14 18 12 16 C10 14 11 11 13 10 C15 9 17 10 16 12 C15 14 12 14 12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M4 16 C4 16 2 13 4 10 C6 7 10 6 12 8 C14 10 13 13 11 14 C9 15 7 14 8 12 C9 10 12 10 12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
  </svg>`,

  Wildfire: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 21 C8 21 5 18 5 14 C5 11 7 9 8 8 C8 10 10 11 10 11 C9 9 10 6 12 4 C12 7 14 8 15 10 C16 9 16 7 15 5 C18 8 19 12 19 14 C19 18 16 21 12 21 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>
    <path d="M12 21 C10 21 9 19 9 17 C9 15 10.5 14 11 14 C11 15 12 15.5 12 15.5 C12 15.5 13 15 13 14 C14 15 15 16 15 17 C15 19 14 21 12 21 Z" fill="currentColor" opacity="0.3"/>
  </svg>`,

  Explosion: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3.5" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="2" x2="12" y2="6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="17.5" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="2" y1="12" x2="6.5" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="17.5" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="4.9" y1="4.9" x2="8.1" y2="8.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="15.9" y1="15.9" x2="19.1" y2="19.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="19.1" y1="4.9" x2="15.9" y2="8.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="8.1" y1="15.9" x2="4.9" y2="19.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  "Chemical incident": `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 3 H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M10 3 L7 9 C5 12 5 17 8 20 C9 21 10.5 22 12 22 C13.5 22 15 21 16 20 C19 17 19 12 17 9 L14 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="10" cy="16" r="1.5" fill="currentColor"/>
    <circle cx="14.5" cy="13" r="1" fill="currentColor"/>
    <circle cx="11" cy="12" r="0.75" fill="currentColor"/>
  </svg>`,

  Conflict: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3 L21.5 20 H2.5 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>
    <line x1="12" y1="10" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="18.5" r="1.25" fill="currentColor"/>
  </svg>`,

  "Civil unrest": `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3 L21.5 20 H2.5 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>
    <line x1="12" y1="10" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="18.5" r="1.25" fill="currentColor"/>
  </svg>`,
};

const FALLBACK_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
  <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="16.5" r="1.25" fill="currentColor"/>
</svg>`;

export function getCrisisIcon(crisisType: string): string {
  return crisisIconMap[crisisType] ?? FALLBACK_ICON;
}
