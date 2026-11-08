const stroke =
  'fill="none" stroke="#1c1915" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"';

const palm =
  '<ellipse cx="84" cy="154" rx="38" ry="46" fill="#fbf6ec" stroke="#1c1915" stroke-width="3"/>';

const CUSTOM = {
  C: `<svg viewBox="0 0 200 240" role="img" aria-label="Hand sign for the letter C">
    <path d="M128 86 C 150 28 28 18 34 108" ${stroke}/>
    <path d="M124 168 C 146 214 24 214 40 132" ${stroke}/>
    <rect x="108" y="78" width="48" height="96" rx="24" fill="#fbf6ec" stroke="#1c1915" stroke-width="3"/>
  </svg>`,
};

const HANDS = {
  A: {
    fingers: `
      <path d="M58 124 C54 102 70 98 66 122" ${stroke}/>
      <path d="M76 120 C74 96 90 94 86 120" ${stroke}/>
      <path d="M94 120 C98 96 112 98 106 122" ${stroke}/>
      <path d="M112 124 C120 104 130 108 122 126" ${stroke}/>
    `,
    thumb: `<path d="M56 158 L20 140" ${stroke}/>`,
  },
  B: {
    fingers: `
      <path d="M60 122 L60 36" ${stroke}/>
      <path d="M76 118 L76 30" ${stroke}/>
      <path d="M92 118 L92 30" ${stroke}/>
      <path d="M108 122 L108 36" ${stroke}/>
    `,
    thumb: `<path d="M58 150 Q86 126 116 146" ${stroke}/>`,
  },
  D: {
    fingers: `
      <path d="M78 118 L78 28" ${stroke}/>
      <path d="M96 122 C98 100 112 102 106 124" ${stroke}/>
      <path d="M110 126 C118 108 128 112 120 128" ${stroke}/>
      <path d="M60 124 C56 106 68 104 66 124" ${stroke}/>
    `,
    thumb: `<path d="M62 150 Q78 132 96 128" ${stroke}/>`,
  },
  F: {
    fingers: `
      <path d="M78 116 L78 32" ${stroke}/>
      <path d="M94 116 L94 30" ${stroke}/>
      <path d="M110 120 L110 38" ${stroke}/>
    `,
    thumb: `
      <path d="M58 150 C42 132 42 112 60 108" ${stroke}/>
      <circle cx="62" cy="100" r="14" fill="none" stroke="#1c1915" stroke-width="6"/>
    `,
  },
  I: {
    fingers: `
      <path d="M58 124 C54 104 66 102 64 124" ${stroke}/>
      <path d="M76 122 C74 100 88 98 84 122" ${stroke}/>
      <path d="M94 122 C96 102 110 104 104 124" ${stroke}/>
      <path d="M116 120 L124 34" ${stroke}/>
    `,
    thumb: `<path d="M60 156 Q74 142 88 148" ${stroke}/>`,
  },
  L: {
    fingers: `
      <path d="M78 120 L78 28" ${stroke}/>
      <path d="M96 124 C100 104 114 106 108 126" ${stroke}/>
      <path d="M112 128 C120 110 130 114 122 130" ${stroke}/>
      <path d="M60 126 C54 108 66 106 66 128" ${stroke}/>
    `,
    thumb: `<path d="M58 156 L16 156" ${stroke}/>`,
  },
  V: {
    fingers: `
      <path d="M78 118 L48 30" ${stroke}/>
      <path d="M90 118 L112 28" ${stroke}/>
      <path d="M112 126 C120 108 132 112 122 128" ${stroke}/>
      <path d="M58 126 C50 108 62 106 64 128" ${stroke}/>
    `,
    thumb: `<path d="M58 156 Q70 144 84 150" ${stroke}/>`,
  },
  W: {
    fingers: `
      <path d="M70 118 L40 32" ${stroke}/>
      <path d="M86 116 L86 26" ${stroke}/>
      <path d="M102 118 L132 32" ${stroke}/>
      <path d="M120 128 C128 112 138 116 128 132" ${stroke}/>
    `,
    thumb: `<path d="M56 158 Q70 146 84 152" ${stroke}/>`,
  },
  Y: {
    fingers: `
      <path d="M70 122 C66 102 80 100 76 122" ${stroke}/>
      <path d="M88 120 C86 98 100 96 96 120" ${stroke}/>
      <path d="M104 122 C108 102 120 104 114 124" ${stroke}/>
      <path d="M120 124 L136 36" ${stroke}/>
    `,
    thumb: `<path d="M56 158 L18 132" ${stroke}/>`,
  },
};

export function handSvg(letter) {
  if (CUSTOM[letter]) return CUSTOM[letter];
  const hand = HANDS[letter];
  if (!hand) return "";
  return `<svg viewBox="0 0 160 210" role="img" aria-label="Hand sign for the letter ${letter}">
    ${hand.fingers}
    ${palm}
    ${hand.thumb}
  </svg>`;
}
