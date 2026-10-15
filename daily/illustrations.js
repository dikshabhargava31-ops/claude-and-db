// Original kawaii-style cover illustrations, drawn as inline SVG.
// Each scene sits in a 200 x 120 box on a transparent background, so the
// pastel cover colour shows through behind it.
(() => {
  'use strict';
  const L = '#6b4a3f';
  const o = `stroke="${L}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  const thin = `stroke="${L}" stroke-width="1.8" stroke-linecap="round" fill="none"`;
  const C = { cream: '#fff8f0', peach: '#f6b89a', rose: '#f3a3b5', pink: '#f8c8d4', sage: '#a8c99a', mint: '#cfe6c4', butter: '#f7dc8f', lav: '#c9b8ea', lilac: '#ece4ff', sky: '#b9dcef', tan: '#d9a27e', blush: '#f59fb0', clay: '#e98a50', burnt: '#d9692b' };

  const face = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="-6" cy="0" r="2" fill="${L}"/><circle cx="6" cy="0" r="2" fill="${L}"/>
    <circle cx="-5.4" cy="-.7" r=".6" fill="#fff"/><circle cx="6.6" cy="-.7" r=".6" fill="#fff"/>
    <path d="M-2.6 3.4q2.6 2.6 5.2 0" ${thin} stroke-width="1.6"/>
    <ellipse cx="-10.5" cy="4.5" rx="3.2" ry="1.9" fill="${C.blush}" opacity=".75"/><ellipse cx="10.5" cy="4.5" rx="3.2" ry="1.9" fill="${C.blush}" opacity=".75"/></g>`;
  const shadow = (cx = 100, w = 74) => `<ellipse cx="${cx}" cy="108" rx="${w}" ry="5" fill="${L}" opacity=".09"/>`;
  const steam = (x, y) => `<path d="M${x} ${y}q-4-5 0-10t0-10M${x + 8} ${y - 2}q-4-5 0-10t0-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".95"/>`;
  const sparkle = (x, y, s = 1, c = '#fff') => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-7 1.8-1.8 7 0 1.8 1.8 0 7-1.8 1.8-7 0-1.8-1.8Z" fill="${c}"/>`;
  const heart = (x, y, s = 1, c = '#f48aa5') => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 5C-7 .5-10-3-10-6.8A5 5 0 0 1 0-9a5 5 0 0 1 10 2.2C10-3 7 .5 0 5Z" fill="${c}" stroke="${L}" stroke-width="${2.2 / s}" stroke-linejoin="round"/></g>`;
  const mug = (x, y, c = C.pink, s = 1, flip = false) => `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <path d="M14 7h5a7 7 0 0 1 0 14h-5" fill="none" stroke="${L}" stroke-width="${2.4 / s}" stroke-linecap="round"/>
    <rect x="-15" y="0" width="30" height="32" rx="8" fill="${c}" stroke="${L}" stroke-width="${2.4 / s}"/>
    <path d="M-10 5h20" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>${face(0, 16, 0.8)}</g>`;
  const plant = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 0c-14-6-19-20-13-29 8 4 13 16 13 29zM0 0c12-8 19-21 13-31-9 6-13 18-13 31z" fill="${C.sage}" stroke="${L}" stroke-width="${2.4 / s}" stroke-linejoin="round"/>
    <path d="M0 0c-3-10-2-23 3-35 5 12 4 25-3 35z" fill="${C.mint}" stroke="${L}" stroke-width="${2.4 / s}" stroke-linejoin="round"/>
    <path d="M-13 0h26l-3.5 19h-19z" fill="${C.clay}" stroke="${L}" stroke-width="${2.4 / s}" stroke-linejoin="round"/>
    <path d="M-12 5h24" stroke="#fff" stroke-width="2" opacity=".5"/></g>`;
  const cupcake = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-13 0h26l-4 17h-18z" fill="${C.peach}" stroke="${L}" stroke-width="${2.4 / s}" stroke-linejoin="round"/>
    <path d="M-6 2l1 13M0 2v13M6 2l-1 13" stroke="${L}" stroke-width="${1.4 / s}" opacity=".45"/>
    <path d="M-15 1c-3-8 4-13 8-11 1-6 13-6 14 0 5-2 11 3 8 11z" fill="#fff0f4" stroke="${L}" stroke-width="${2.4 / s}" stroke-linejoin="round"/>
    <circle cx="0" cy="-14" r="4.5" fill="#f2737f" stroke="${L}" stroke-width="${2.2 / s}"/>
    <path d="M-7-3l2-1M3-5l2 1M8-1l1-2" stroke="${C.lav}" stroke-width="${2.4 / s}" stroke-linecap="round"/></g>`;

  const S = {};

  S.personal = shadow() + plant(44, 88, 0.85) +
    `<ellipse cx="84" cy="40" rx="8.5" ry="8.5" fill="${C.tan}" ${o}/><circle cx="84" cy="40" r="4" fill="#f3c6a8"/>
     <ellipse cx="116" cy="40" rx="8.5" ry="8.5" fill="${C.tan}" ${o}/><circle cx="116" cy="40" r="4" fill="#f3c6a8"/>
     <ellipse cx="100" cy="88" rx="23" ry="19" fill="${C.tan}" ${o}/><ellipse cx="100" cy="92" rx="12" ry="10" fill="#f3d2b8"/>
     <ellipse cx="78" cy="84" rx="6.5" ry="10" transform="rotate(25 78 84)" fill="${C.tan}" ${o}/><ellipse cx="122" cy="84" rx="6.5" ry="10" transform="rotate(-25 122 84)" fill="${C.tan}" ${o}/>
     <ellipse cx="88" cy="104" rx="8" ry="5" fill="${C.tan}" ${o}/><ellipse cx="112" cy="104" rx="8" ry="5" fill="${C.tan}" ${o}/>
     <circle cx="100" cy="57" r="21" fill="${C.tan}" ${o}/><ellipse cx="100" cy="65" rx="9.5" ry="7" fill="#f6dcc6"/>
     <ellipse cx="100" cy="62" rx="3.2" ry="2.3" fill="${L}"/><path d="M100 64.5v2.5M97 68q3 2 6 0" ${thin} stroke-width="1.5"/>
     <circle cx="92" cy="54" r="2.2" fill="${L}"/><circle cx="108" cy="54" r="2.2" fill="${L}"/>
     <ellipse cx="86" cy="62" rx="3.4" ry="2" fill="${C.blush}" opacity=".8"/><ellipse cx="114" cy="62" rx="3.4" ry="2" fill="${C.blush}" opacity=".8"/>
     <path d="M100 77l-9-5v10zM100 77l9-5v10z" fill="${C.rose}" ${o} stroke-width="1.8"/><circle cx="100" cy="77" r="2.6" fill="${C.rose}" ${o} stroke-width="1.6"/>` +
    mug(152, 74, C.pink, 0.9) + steam(148, 70) + sparkle(64, 28, 1) + heart(170, 40, 0.6);

  S.health = shadow() +
    `<rect x="34" y="40" width="16" height="12" rx="3" fill="${C.lav}" ${o}/><rect x="30" y="50" width="24" height="56" rx="9" fill="${C.sky}" ${o}/>
     <rect x="30" y="68" width="24" height="15" fill="#fff" opacity=".6"/><path d="M36 58v4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
     <circle cx="80" cy="70" r="13" fill="${C.sage}" ${o}/><circle cx="98" cy="62" r="14" fill="${C.mint}" ${o}/><circle cx="118" cy="68" r="13" fill="${C.sage}" ${o}/>
     <circle cx="108" cy="72" r="7" fill="#f48a8a" ${o}/><ellipse cx="88" cy="74" rx="8" ry="6" fill="#fff" ${o}/><circle cx="88" cy="74" r="3.2" fill="${C.butter}"/>
     <path d="M64 76h72a36 30 0 0 1-72 0z" fill="${C.cream}" ${o}/><path d="M70 82h60" stroke="${C.rose}" stroke-width="3" stroke-linecap="round" opacity=".6"/>` +
    face(100, 92, 0.9) +
    `<rect x="142" y="96" width="34" height="6" rx="3" fill="#c08a6a" ${o} stroke-width="1.8"/>
     <rect x="138" y="86" width="10" height="26" rx="4" fill="${C.lav}" ${o}/><rect x="170" y="86" width="10" height="26" rx="4" fill="${C.lav}" ${o}/>` +
    sparkle(150, 40, 1.1) + sparkle(66, 34, 0.7);

  S.finance = shadow() +
    [0, 1, 2, 3].map((i) => `<ellipse cx="46" cy="${103 - i * 7}" rx="15" ry="5.5" fill="${C.butter}" ${o}/>`).join('') +
    `<text x="46" y="85" text-anchor="middle" font-family="Outfit,sans-serif" font-weight="700" font-size="8" fill="${L}">$</text>
     <rect x="82" y="94" width="9" height="12" rx="3" fill="${C.rose}" ${o}/><rect x="110" y="94" width="9" height="12" rx="3" fill="${C.rose}" ${o}/>
     <path d="M66 74q-8-2-6 6q2 5 6 0" ${thin}/>
     <path d="M86 54l6-12l8 11z" fill="${C.rose}" ${o}/>
     <ellipse cx="100" cy="76" rx="35" ry="26" fill="${C.pink}" ${o}/>
     <ellipse cx="134" cy="78" rx="9" ry="8.5" fill="${C.rose}" ${o}/><circle cx="131.5" cy="78" r="1.6" fill="${L}"/><circle cx="136.5" cy="78" r="1.6" fill="${L}"/>
     <rect x="91" y="51" width="18" height="4.5" rx="2.2" fill="${L}"/>
     <circle cx="100" cy="32" r="9" fill="${C.butter}" ${o}/><circle cx="100" cy="32" r="4.5" fill="none" stroke="${L}" stroke-width="1.5" opacity=".6"/>` +
    face(110, 72, 0.85) + plant(164, 88, 0.7) + sparkle(124, 30, 0.9);

  S.work = shadow() +
    `<g transform="rotate(-8 46 66)"><rect x="30" y="50" width="32" height="32" rx="3" fill="${C.butter}" ${o}/><path d="M36 60h20M36 66h20M36 72h12" ${thin} opacity=".6"/></g>
     <rect x="64" y="32" width="72" height="52" rx="7" fill="${C.lav}" ${o}/><rect x="70" y="38" width="60" height="40" rx="4" fill="${C.lilac}"/>
     <path d="M52 86h96l-7 14H59z" fill="#e6dff5" ${o}/><path d="M92 92h16" ${thin}/>` +
    face(100, 57, 1.05) + heart(124, 46, 0.4) + mug(160, 72, C.sky, 0.85) + steam(156, 68) + sparkle(62, 28, 0.8);

  S.love = shadow() + mug(80, 66, C.pink, 1.05, true) + mug(122, 66, C.lav, 1.05) +
    heart(101, 40, 1.15) + heart(74, 30, 0.55, C.rose) + heart(130, 26, 0.5, C.pink) + sparkle(152, 46, 1) + sparkle(50, 50, 0.7) +
    cupcake(170, 88, 0.75);

  const folder = (x, y, c) => `<path d="M${x} ${y + 4}v-8h22l5 6h43v4z" fill="${c}" ${o}/><rect x="${x}" y="${y}" width="70" height="44" rx="5" fill="${c}" ${o}/>`;
  S.folders = shadow() +
    folder(48, 50, C.lav) + `<rect x="58" y="44" width="50" height="16" rx="2" fill="#fff" ${o} stroke-width="1.8"/>` + folder(56, 58, C.peach) + folder(64, 66, C.sage) +
    `<path d="M74 80h30" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>` + face(99, 92, 0.9) +
    mug(158, 74, C.pink, 0.85) + steam(154, 70) + sparkle(60, 30, 0.9);

  S.pencil = shadow() +
    `<g transform="rotate(-6 82 70)"><rect x="50" y="34" width="64" height="72" rx="7" fill="${C.cream}" ${o}/>
     <path d="M60 52h44M60 62h44M60 72h30" stroke="${C.sky}" stroke-width="2.4" stroke-linecap="round"/><circle cx="82" cy="34" r="5" fill="${C.rose}" ${o} stroke-width="1.8"/></g>` +
    face(84, 88, 0.85) +
    `<g transform="translate(128 34) rotate(32)"><rect x="0" y="0" width="14" height="52" fill="${C.butter}" ${o}/><path d="M0 52l7 14l7-14z" fill="#f6dcc6" ${o}/><path d="M5 62l2 4l2-4z" fill="${L}"/>
     <rect x="0" y="-8" width="14" height="8" fill="#d8d0e6" ${o} stroke-width="1.8"/><rect x="0" y="-16" width="14" height="9" rx="3" fill="${C.rose}" ${o}/></g>
     <ellipse cx="166" cy="104" rx="20" ry="4.5" fill="#fff" ${o}/><path d="M152 86h28q-1 16-14 16t-14-16z" fill="${C.mint}" ${o}/><path d="M180 90q7 0 5 6q-2 4-6 2" ${thin}/>` +
    steam(162, 82) + sparkle(152, 34, 0.8);

  S.books = shadow() +
    `<rect x="54" y="88" width="84" height="17" rx="4" fill="${C.rose}" ${o}/><path d="M64 88v17M128 88v17" stroke="#fff" stroke-width="2.4" opacity=".6"/>
     <rect x="62" y="71" width="72" height="17" rx="4" fill="${C.sage}" ${o}/><path d="M72 71v17M124 71v17" stroke="#fff" stroke-width="2.4" opacity=".6"/>
     <rect x="52" y="54" width="78" height="17" rx="4" fill="${C.lav}" ${o}/><path d="M62 54v17M120 54v17" stroke="#fff" stroke-width="2.4" opacity=".6"/>` +
    face(98, 80, 0.75) + cupcake(92, 37, 0.85) +
    `<circle cx="164" cy="58" r="14" fill="${C.butter}" ${o}/><rect x="157" y="71" width="14" height="10" rx="3" fill="#d8d0e6" ${o}/><path d="M160 86h8" ${thin}/>
     <path d="M164 36v-6M182 44l5-4M146 44l-5-4M186 60h6M142 60h-6" ${thin} stroke="${C.peach}" stroke-width="2.4"/>` + face(164, 58, 0.55);

  S.letter = shadow() +
    `<rect x="50" y="44" width="100" height="62" rx="7" fill="${C.cream}" ${o}/><path d="M52 48l48 34l48-34" fill="none" ${o}/><path d="M52 104l34-26M148 104l-34-26" ${thin} opacity=".5"/>` +
    heart(100, 78, 1.1) + face(100, 96, 0.7) +
    `<path d="M166 106c0-14 2-28-2-40" ${thin} stroke="#7fae73" stroke-width="2.6"/><path d="M165 88c-8-2-12-8-10-12 6 0 10 6 10 12z" fill="${C.sage}" ${o} stroke-width="1.8"/>` +
    [0, 72, 144, 216, 288].map((a) => `<circle cx="${164 + 9 * Math.cos((a * Math.PI) / 180)}" cy="${58 + 9 * Math.sin((a * Math.PI) / 180)}" r="7" fill="${C.pink}" ${o} stroke-width="1.8"/>`).join('') +
    `<circle cx="164" cy="58" r="5" fill="${C.butter}" ${o} stroke-width="1.8"/>` + sparkle(58, 28, 0.9) + sparkle(132, 30, 0.6);

  S.para = shadow() + plant(40, 88, 0.72) +
    `<rect x="64" y="22" width="72" height="84" rx="7" fill="#f6dcc6" ${o}/>` +
    [['P', C.peach], ['A', C.rose], ['R', C.sage], ['A', C.lav]].map(([t, c], i) => `<rect x="70" y="${28 + i * 19}" width="60" height="15" rx="3.5" fill="${c}" ${o} stroke-width="2"/>
      <text x="84" y="${39.5 + i * 19}" text-anchor="middle" font-family="DM Mono,monospace" font-weight="500" font-size="10" fill="${L}">${t}</text><rect x="104" y="${33.5 + i * 19}" width="16" height="4" rx="2" fill="#fff" ${o} stroke-width="1.4"/>`).join('') +
    cupcake(164, 90, 0.8) + sparkle(152, 34, 1) + heart(56, 34, 0.5);

  S.gtd = shadow() +
    `<g transform="rotate(-5 90 66)"><rect x="58" y="44" width="62" height="40" rx="3" fill="#fff" ${o} stroke-width="2"/><path d="M66 54h40M66 62h46M66 70h28" stroke="${C.sky}" stroke-width="2.2" stroke-linecap="round"/></g>
     <rect x="64" y="52" width="58" height="34" rx="3" fill="${C.cream}" ${o} stroke-width="2"/>
     <path d="M42 78h96l-9 28H51z" fill="${C.clay}" ${o}/><path d="M42 78h96" ${o}/>
     <path d="M92 18v18m-8-8l8 8l8-8" fill="none" stroke="${C.rose}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
    face(90, 92, 0.85) + mug(160, 74, C.sage, 0.82) + steam(156, 70) +
    `<circle cx="152" cy="34" r="12" fill="${C.sage}" ${o}/><path d="M146 34l4 4l8-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

  S.matrix = shadow() +
    `<path d="M74 88l-10 18M126 88l10 18M100 90v16" ${o}/>
     <rect x="56" y="20" width="88" height="70" rx="7" fill="${C.cream}" ${o}/>
     <rect x="62" y="26" width="37" height="28" rx="4" fill="#fbd5d5"/><rect x="101" y="26" width="37" height="28" rx="4" fill="#d9ecd0"/>
     <rect x="62" y="56" width="37" height="28" rx="4" fill="#faecc0"/><rect x="101" y="56" width="37" height="28" rx="4" fill="#e4dcf4"/>
     <path d="M100 26v58M62 55h76" stroke="${L}" stroke-width="1.6" stroke-dasharray="3 3" opacity=".5"/>
     <path d="M74 40l4 4l8-8" ${thin} stroke-width="2.2"/><path d="M112 36h16M112 42h10" ${thin}/><path d="M74 66h14M74 72h8" ${thin}/><path d="M114 64l10 10M124 64l-10 10" ${thin}/>
     <circle cx="166" cy="90" r="17" fill="#f3c08f" ${o}/><path d="M152 86c2-10 26-10 28 0c-2 8-6 4-8 8c-3-4-6 2-9-1c-3 4-8-2-11-7z" fill="${C.pink}" ${o} stroke-width="1.8"/>
     <circle cx="166" cy="90" r="5" fill="${C.cream}" ${o} stroke-width="1.8"/>
     <path d="M158 84l2-2M172 82l2 2M164 80l1-3M176 89l2 1" stroke="${C.lav}" stroke-width="2.4" stroke-linecap="round"/>` +
    sparkle(44, 40, 1) + heart(40, 74, 0.5);

  const NAMES = {
    personal: 'Teddy & cocoa', health: 'Salad & water', finance: 'Piggy bank', work: 'Laptop & coffee', love: 'Two mugs',
    folders: 'Folders & coffee', pencil: 'Note & pencil', books: 'Books & cupcake', letter: 'Love letter',
    para: 'Filing cabinet', gtd: 'Inbox tray', matrix: 'Matrix board',
  };
  const svg = (key) => (S[key] ? `<svg viewBox="0 0 200 120" role="img" aria-label="${NAMES[key]} illustration">${S[key]}</svg>` : '');

  // Wide banner for the dashboard: a shelf of scenes under a little bunting.
  function hero() {
    const items = ['books', 'personal', 'work', 'love', 'health', 'letter'];
    const flags = Array.from({ length: 22 }, (_, i) => {
      const x = 20 + i * 56, c = [C.clay, C.rose, C.sage, C.lav, C.butter, C.peach][i % 6];
      return `<path d="M${x} ${14 + Math.sin(i / 3) * 3}l14 24l14-24" fill="${c}" ${o} stroke-width="1.8"/>`;
    }).join('');
    return `<svg viewBox="0 0 1240 170" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A cozy shelf of illustrations">
      <path d="M0 14q620 26 1240 0" fill="none" stroke="${L}" stroke-width="1.6" opacity=".5"/>${flags}
      ${items.map((k, i) => `<g transform="translate(${30 + i * 200} 34) scale(1.02)">${S[k]}</g>`).join('')}
      <rect x="0" y="146" width="1240" height="9" fill="#e8c9b4" opacity=".7"/></svg>`;
  }

  window.ILLO = { svg, hero, names: NAMES, keys: Object.keys(S) };
})();
