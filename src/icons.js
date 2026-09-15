const svg = (inner) =>
  `<svg viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`

export const ICONS = {
  chakra: svg(`<circle cx="32" cy="32" r="26" fill="none" stroke="#000080" stroke-width="3"/>
    <circle cx="32" cy="32" r="6" fill="#000080"/>
    ${Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2
      return `<line x1="32" y1="32" x2="${32 + Math.cos(a) * 24}" y2="${32 + Math.sin(a) * 24}" stroke="#000080" stroke-width="1.4"/>`
    }).join('')}`),
  millet: svg(`<ellipse cx="32" cy="42" rx="14" ry="8" fill="#8B5A2B"/>
    <path d="M32 46 V14" stroke="#138808" stroke-width="3"/>
    <path d="M32 18 c8-6 14-4 16 2 c-8 2-14 8-16 14 c-2-6-8-12-16-14 c2-6 8-8 16-2z" fill="#C9A227"/>
    <circle cx="26" cy="22" r="2" fill="#FF9933"/><circle cx="38" cy="20" r="2" fill="#FF9933"/><circle cx="32" cy="16" r="2.2" fill="#E07812"/>`),
  nut: svg(`<ellipse cx="32" cy="36" rx="16" ry="12" fill="#C9A227"/>
    <ellipse cx="32" cy="34" rx="10" ry="7" fill="#8B5A2B"/>
    <path d="M20 28 C24 16 40 16 44 28" fill="#138808"/>
    <path d="M28 18 Q32 8 36 18" fill="none" stroke="#0B5E05" stroke-width="2"/>`),
  cotton: svg(`<circle cx="32" cy="28" r="10" fill="#FFF8F0" stroke="#C9A227" stroke-width="1.5"/>
    <circle cx="22" cy="34" r="8" fill="#FFF8F0" stroke="#C9A227" stroke-width="1.5"/>
    <circle cx="42" cy="34" r="8" fill="#FFF8F0" stroke="#C9A227" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="8" fill="#FFF8F0" stroke="#C9A227" stroke-width="1.5"/>
    <circle cx="32" cy="32" r="4" fill="#C9A227"/>
    <path d="M32 44 V56" stroke="#138808" stroke-width="3"/>`),
  cane: svg(`<rect x="18" y="10" width="8" height="44" rx="3" fill="#138808"/>
    <rect x="28" y="14" width="8" height="40" rx="3" fill="#0B5E05"/>
    <rect x="38" y="8" width="8" height="46" rx="3" fill="#2E7D32"/>
    <line x1="18" y1="22" x2="26" y2="22" stroke="#C9A227" stroke-width="2"/>
    <line x1="28" y1="28" x2="36" y2="28" stroke="#C9A227" stroke-width="2"/>
    <line x1="38" y1="20" x2="46" y2="20" stroke="#C9A227" stroke-width="2"/>`),
  rice: svg(`<path d="M32 54 C18 44 16 24 32 10 C48 24 46 44 32 54z" fill="#7CB342"/>
    <path d="M32 50 C24 40 24 24 32 14 C40 24 40 40 32 50z" fill="#C9A227"/>
    <path d="M32 54 V12" stroke="#5C3A1E" stroke-width="2"/>`),
  fiber: svg(`<path d="M16 50 C20 20 28 12 32 8 C36 12 44 20 48 50" fill="none" stroke="#138808" stroke-width="4"/>
    <path d="M22 48 C24 28 30 18 32 14 C34 18 40 28 42 48" fill="none" stroke="#C9A227" stroke-width="3"/>
    <rect x="14" y="48" width="36" height="8" rx="3" fill="#8B5A2B"/>`),
  wheat: svg(`<path d="M32 56 V12" stroke="#8B5A2B" stroke-width="3"/>
    ${[12, 18, 24, 30, 36].map((y, i) =>
      `<ellipse cx="${24 - i}" cy="${y}" rx="8" ry="4" fill="#C9A227" transform="rotate(-25 ${24 - i} ${y})"/>
       <ellipse cx="${40 + i}" cy="${y}" rx="8" ry="4" fill="#FF9933" transform="rotate(25 ${40 + i} ${y})"/>`
    ).join('')}`),
  oilseed: svg(`<circle cx="32" cy="32" r="18" fill="#FF9933"/>
    <circle cx="32" cy="32" r="8" fill="#C9A227"/>
    <path d="M32 14 C36 8 48 12 46 22" fill="#138808"/>
    <circle cx="22" cy="28" r="3" fill="#E07812"/><circle cx="40" cy="36" r="3" fill="#E07812"/>`),
  apple: svg(`<circle cx="32" cy="36" r="16" fill="#138808"/>
    <path d="M32 22 C28 10 40 10 38 20" fill="none" stroke="#5C3A1E" stroke-width="3"/>
    <ellipse cx="40" cy="20" rx="8" ry="4" fill="#7CB342" transform="rotate(20 40 20)"/>
    <path d="M24 34 Q32 30 32 40" fill="none" stroke="#0B5E05" stroke-width="2"/>`),
  spice: svg(`<circle cx="22" cy="28" r="8" fill="#E07812"/>
    <circle cx="42" cy="26" r="7" fill="#C9A227"/>
    <circle cx="32" cy="42" r="9" fill="#8B5A2B"/>
    <circle cx="34" cy="24" r="5" fill="#FF9933"/>
    <path d="M18 18 C22 10 30 12 28 20" fill="#138808"/>`),
  coffee: svg(`<ellipse cx="32" cy="36" rx="16" ry="14" fill="#5C3A1E"/>
    <ellipse cx="32" cy="34" rx="10" ry="8" fill="#8B5A2B"/>
    <path d="M48 32 C56 32 56 44 46 44" fill="none" stroke="#5C3A1E" stroke-width="3"/>
    <path d="M26 16 C30 8 40 10 38 18" fill="#138808"/>`),
  tea: svg(`<path d="M16 28 C16 16 48 16 48 28 C48 44 16 44 16 28z" fill="#138808"/>
    <path d="M20 26 C28 22 36 22 44 28" fill="none" stroke="#C9A227" stroke-width="2"/>
    <rect x="28" y="44" width="8" height="10" fill="#5C3A1E"/>
    <ellipse cx="22" cy="20" rx="8" ry="4" fill="#2E7D32"/>`),
  mango: svg(`<path d="M20 40 C16 24 28 10 40 16 C52 22 50 42 38 48 C26 54 24 48 20 40z" fill="#FF9933"/>
    <path d="M38 18 C42 8 52 12 48 22" fill="#138808"/>
    <ellipse cx="34" cy="32" rx="6" ry="10" fill="#E07812" opacity=".35"/>`),
  grape: svg(`<circle cx="32" cy="22" r="6" fill="#000080"/>
    <circle cx="24" cy="30" r="6" fill="#1A237E"/>
    <circle cx="40" cy="30" r="6" fill="#000080"/>
    <circle cx="28" cy="38" r="6" fill="#3949AB"/>
    <circle cx="36" cy="38" r="6" fill="#000080"/>
    <circle cx="32" cy="46" r="6" fill="#1A237E"/>
    <path d="M32 16 C28 8 40 6 38 16" fill="#138808"/>`),
  saffron: svg(`<circle cx="32" cy="34" r="16" fill="#FF9933"/>
    <path d="M32 18 L34 34 L30 34 Z" fill="#E07812"/>
    <path d="M18 38 L32 32 L22 42" fill="#C9A227"/>
    <path d="M46 38 L32 32 L42 42" fill="#C9A227"/>
    <circle cx="32" cy="34" r="4" fill="#8B5A2B"/>`),
  pulse: svg(`<ellipse cx="24" cy="34" rx="10" ry="14" fill="#138808"/>
    <ellipse cx="40" cy="34" rx="10" ry="14" fill="#7CB342"/>
    <path d="M24 22 C24 14 32 12 32 20" fill="none" stroke="#5C3A1E" stroke-width="2"/>`),
  organic: svg(`<circle cx="32" cy="32" r="20" fill="none" stroke="#138808" stroke-width="3"/>
    <path d="M20 36 C24 20 40 18 44 32 C36 28 28 34 32 44 C24 40 20 40 20 36z" fill="#138808"/>
    <circle cx="38" cy="24" r="4" fill="#FF9933"/>`),
  card: svg(`<rect x="14" y="12" width="36" height="40" rx="4" fill="#FFF8F0" stroke="#000080" stroke-width="2"/>
    <rect x="18" y="18" width="28" height="8" fill="#FF9933"/>
    <rect x="18" y="30" width="20" height="4" fill="#138808"/>
    <rect x="18" y="38" width="16" height="4" fill="#000080"/>`),
  tax: svg(`<rect x="16" y="14" width="32" height="36" rx="3" fill="#FFF8F0" stroke="#000080" stroke-width="2"/>
    <text x="32" y="38" text-anchor="middle" font-size="18" font-weight="700" fill="#000080">Rs</text>`),
  tractor: svg(`<rect x="18" y="24" width="28" height="14" rx="3" fill="#FF9933"/>
    <rect x="34" y="16" width="14" height="12" rx="2" fill="#138808"/>
    <circle cx="22" cy="44" r="8" fill="#1A237E"/><circle cx="22" cy="44" r="3" fill="#FFF8F0"/>
    <circle cx="44" cy="42" r="6" fill="#1A237E"/><circle cx="44" cy="42" r="2.5" fill="#FFF8F0"/>`),
  mandi: svg(`<path d="M8 28 L32 12 L56 28" fill="#FF9933"/>
    <rect x="14" y="28" width="36" height="22" fill="#FFF8F0" stroke="#000080"/>
    <rect x="22" y="34" width="8" height="16" fill="#138808"/>
    <rect x="34" y="34" width="8" height="16" fill="#000080"/>`),
  mela: svg(`<path d="M32 8 L36 22 L52 22 L40 32 L44 48 L32 38 L20 48 L24 32 L12 22 L28 22 Z" fill="#FF9933" stroke="#000080"/>
    <circle cx="32" cy="30" r="6" fill="#138808"/>`),
  canal: svg(`<rect x="8" y="26" width="48" height="14" rx="7" fill="#000080"/>
    <path d="M12 30 Q20 36 28 30 T44 30 T56 30" fill="none" stroke="#7EC8E3" stroke-width="3"/>
    <rect x="10" y="18" width="8" height="10" fill="#C9A227"/>
    <rect x="46" y="18" width="8" height="10" fill="#C9A227"/>`),
  cold: svg(`<rect x="12" y="16" width="40" height="36" rx="4" fill="#E8ECFF" stroke="#000080" stroke-width="2"/>
    <path d="M32 24 L28 34 H34 L30 44" fill="none" stroke="#000080" stroke-width="3"/>
    <rect x="18" y="20" width="8" height="6" fill="#138808"/>`),
  godown: svg(`<path d="M8 30 L32 12 L56 30" fill="#C9A227"/>
    <rect x="12" y="30" width="40" height="22" fill="#FF9933"/>
    <rect x="28" y="36" width="8" height="16" fill="#000080"/>
    <rect x="16" y="36" width="8" height="8" fill="#FFF8F0"/>`),
  seed: svg(`<ellipse cx="32" cy="36" rx="14" ry="16" fill="#8B5A2B"/>
    <path d="M32 20 C36 8 48 12 42 24" fill="#138808"/>
    <circle cx="28" cy="34" r="3" fill="#C9A227"/>
    <circle cx="36" cy="40" r="3" fill="#FF9933"/>`),
  well: svg(`<circle cx="32" cy="34" r="16" fill="#000080"/>
    <circle cx="32" cy="34" r="10" fill="#1A237E"/>
    <circle cx="32" cy="34" r="4" fill="#7EC8E3"/>
    <rect x="30" y="8" width="4" height="12" fill="#C9A227"/>`),
  bank: svg(`<rect x="10" y="24" width="44" height="28" fill="#FFF8F0" stroke="#000080"/>
    <path d="M8 24 L32 10 L56 24" fill="#138808"/>
    <rect x="18" y="32" width="8" height="20" fill="#000080"/>
    <rect x="28" y="32" width="8" height="20" fill="#FF9933"/>
    <rect x="38" y="32" width="8" height="20" fill="#000080"/>`),
  yard: svg(`<rect x="10" y="20" width="44" height="28" fill="#FFF8F0" stroke="#000080"/>
    <path d="M10 20 H54 L48 12 H16 Z" fill="#FF9933"/>
    <circle cx="24" cy="36" r="6" fill="#138808"/>
    <circle cx="40" cy="36" r="6" fill="#C9A227"/>`)
}

export function iconHtml(name) {
  return ICONS[name] || ICONS.organic
}
