// 原創向量插畫：南投走訪冒險地圖（無外部圖片、無版權疑慮）
const C = {
  sky1: '#cfeaf2', sky2: '#f3faf4', sun: '#f6c544', far: '#b9d8d0', far2: '#9cc7bb', snow: '#ffffff',
  mid: '#5fa36f', mid2: '#3f8a58', forest: '#1d4a36', tea: '#2e7d4f', tea2: '#4f9a5e', lake: '#3b8db5', lake2: '#6fb3d3',
  paddy: '#a9cf6a', paddy2: '#c4de86', path: '#f7efd6', red: '#d6493a', green: '#2e8b57', ink: '#1d3b2f', soil: '#d9c48f'
};

const STATIONS = [
  {x: 300, y: 560, n: 1, label: '計步器'},
  {x: 560, y: 488, n: 2, label: '進度網頁'},
  {x: 840, y: 520, n: 3, label: '雙隊競跑'},
  {x: 1080, y: 450, n: 4, label: '鄉鎮資料卡'},
  {x: 1300, y: 392, n: 5, label: '領地戰'}
];
const PATH = 'M150,640 C230,600 250,575 300,560 S470,500 560,488 S760,545 840,520 S1000,455 1080,450 S1240,410 1300,392';

function footprints() {
  // 沿著小路放置交錯的腳印
  const pts = [[190,617],[226,598],[262,578],[340,545],[385,528],[430,512],[475,500],[520,492],[605,492],[650,502],[695,516],[740,527],[790,527],[885,507],[930,490],[975,470],[1020,456],[1125,440],[1170,428],[1215,414],[1258,402]];
  return pts.map(([x, y], i) => `<g class="fp" style="--i:${i}" transform="translate(${x} ${y + (i % 2 ? 6 : -6)}) rotate(${-18 + (i % 2) * 6})"><ellipse rx="5.5" ry="8" fill="${C.ink}" opacity=".55"/><circle cx="-3.5" cy="-11" r="1.8" fill="${C.ink}" opacity=".55"/><circle cx="0" cy="-12.5" r="1.8" fill="${C.ink}" opacity=".55"/><circle cx="3.5" cy="-11" r="1.8" fill="${C.ink}" opacity=".55"/></g>`).join('');
}

function flag({x, y, n, label}) {
  const color = n === 3 ? C.red : n === 5 ? C.red : C.green;
  return `<g class="station" transform="translate(${x} ${y})"><ellipse cx="0" cy="4" rx="22" ry="6" fill="${C.forest}" opacity=".18"/><line x1="0" y1="2" x2="0" y2="-62" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/><path d="M0,-62 L40,-52 L0,-40 Z" fill="${n === 3 ? C.green : color}"/>${n === 3 ? `<path d="M0,-40 L34,-31 L0,-22 Z" fill="${C.red}"/>` : ''}<circle cx="0" cy="-70" r="13" fill="#fff" stroke="${C.ink}" stroke-width="2.5"/><text x="0" y="-65" text-anchor="middle" font-size="15" font-weight="700" fill="${C.ink}" font-family="inherit">${n}</text><g transform="translate(0 26)"><rect x="${-(14 + (label.length + 3) * 7.5)}" y="-14" width="${28 + (label.length + 3) * 15}" height="26" rx="13" fill="#fffdf4" stroke="${C.ink}" stroke-width="1.5"/><text x="0" y="5" text-anchor="middle" font-size="14" fill="${C.ink}" font-family="inherit">第${n}週 ${label}</text></g></g>`;
}

function microbitBuddy() {
  // micro:bit 大使：LED 笑臉、A/B 按鈕、金手指當腳，手拿茶葉
  const led = (x, y) => `<rect x="${x}" y="${y}" width="9" height="9" rx="2" fill="#ff7a59"/>`;
  const off = (x, y) => `<rect x="${x}" y="${y}" width="9" height="9" rx="2" fill="#3c4d47"/>`;
  const face = [[0,1,0,1,0],[0,1,0,1,0],[0,0,0,0,0],[1,0,0,0,1],[0,1,1,1,0]];
  let grid = '';
  face.forEach((row, r) => row.forEach((on, c) => { grid += (on ? led : off)(-30 + c * 13, -40 + r * 13); }));
  return `<g class="buddy" transform="translate(140 572)"><ellipse cx="0" cy="92" rx="58" ry="10" fill="${C.forest}" opacity=".2"/><g class="buddy-body"><path d="M-62,50 Q-86,30 -78,6" stroke="${C.ink}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M62,46 Q88,26 92,-4" stroke="${C.ink}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M92,-4 C108,-30 128,-26 124,-6 C120,10 100,10 92,-4 Z" fill="${C.tea2}" stroke="${C.forest}" stroke-width="2"/><path d="M93,-4 L118,-14" stroke="${C.forest}" stroke-width="1.5"/><rect x="-62" y="-62" width="124" height="134" rx="22" fill="#24302c"/><rect x="-62" y="58" width="124" height="22" rx="4" fill="#d8b552"/>${[-48,-30,-12,6,24,42].map(x => `<rect x="${x}" y="60" width="9" height="18" rx="2" fill="#24302c" opacity=".45"/>`).join('')}<circle cx="-46" cy="6" r="9" fill="#9aa6a1" stroke="#101816" stroke-width="3"/><circle cx="46" cy="6" r="9" fill="#9aa6a1" stroke="#101816" stroke-width="3"/><text x="-46" y="-8" text-anchor="middle" font-size="10" fill="#cfd8d4" font-family="inherit">A</text><text x="46" y="-8" text-anchor="middle" font-size="10" fill="#cfd8d4" font-family="inherit">B</text>${grid}</g><g transform="translate(40 -92)"><rect x="-70" y="-26" width="150" height="40" rx="20" fill="#fff" stroke="${C.ink}" stroke-width="2"/><path d="M-6,14 L4,26 L12,14" fill="#fff" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/><rect x="-6" y="10" width="20" height="6" fill="#fff"/><text x="5" y="0" text-anchor="middle" font-size="16" fill="${C.ink}" font-family="inherit">出發走訪南投！</text></g></g>`;
}

export function heroScene() {
  const teaRows = Array.from({length: 7}, (_, i) => `<path d="M${-20 + i * 6},${500 + i * 18} Q${200},${478 + i * 19} ${430 - i * 10},${520 + i * 16}" stroke="${i % 2 ? C.tea : C.tea2}" stroke-width="9" fill="none" stroke-linecap="round" opacity=".9"/>`).join('');
  const paddyRows = Array.from({length: 6}, (_, i) => `<path d="M${600 + i * 10},${590 + i * 9} L1440,${545 + i * 14}" stroke="${i % 2 ? C.paddy : C.paddy2}" stroke-width="7" opacity=".85"/>`).join('');
  return `<svg class="hero-scene" viewBox="0 0 1440 700" preserveAspectRatio="xMidYMax slice" role="img" aria-label="插畫：南投風景地圖，有玉山、日月潭、茶園與稻田；一條足跡小路從 micro:bit 大使出發，經過第 1 到第 5 週的旗子">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sky1}"/><stop offset=".7" stop-color="${C.sky2}"/></linearGradient>
  <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.lake2}"/><stop offset="1" stop-color="${C.lake}"/></linearGradient></defs>
  <rect width="1440" height="700" fill="url(#sky)"/>
  <g class="sun"><circle cx="1250" cy="120" r="70" fill="${C.sun}" opacity=".25"/><circle cx="1250" cy="120" r="46" fill="${C.sun}"/></g>
  <g fill="#fff" opacity=".9"><path d="M880,110 q20,-30 50,-12 q22,-22 48,0 q28,-4 26,22 l-128,0 q-14,-4 4,-10z"/><path d="M1040,215 q16,-22 40,-8 q18,-16 38,0 q22,-2 20,18 l-102,0 q-10,-4 4,-10z" opacity=".8"/></g>
  <path d="M560,420 L700,300 L760,340 L860,230 L905,262 L960,205 L1050,290 L1120,250 L1220,330 L1320,280 L1440,350 L1440,520 L560,520Z" fill="${C.far}"/>
  <path d="M905,262 L960,205 L1012,252 L992,246 L975,262 L955,244 L935,262Z" fill="${C.snow}"/>
  <path d="M700,300 L730,325 L718,322 L705,335 L690,318 L680,318Z" fill="${C.snow}" opacity=".85"/>
  <path d="M480,470 L620,360 L700,410 L790,330 L880,400 L980,340 L1080,410 L1180,360 L1300,420 L1440,380 L1440,560 L480,560Z" fill="${C.far2}"/>
  <path d="M0,530 C120,470 260,445 400,455 C520,465 600,490 700,505 L700,700 L0,700Z" fill="${C.mid}"/>
  ${teaRows}
  <path d="M660,520 C780,470 960,470 1120,500 C1240,520 1340,500 1440,470 L1440,700 L660,700Z" fill="${C.mid2}"/>
  <ellipse cx="1020" cy="520" rx="190" ry="34" fill="url(#lake)"/>
  <ellipse cx="1000" cy="516" rx="18" ry="6" fill="${C.tea2}"/><path d="M1000,510 l0,-14 l10,8z" fill="${C.forest}"/>
  <path d="M930,528 q40,6 80,0 M1050,530 q40,6 80,0" stroke="#fff" stroke-width="2" opacity=".6" fill="none"/>
  <g transform="translate(1110 525)"><path d="M-16,0 L16,0 L10,7 L-10,7Z" fill="#8a5a3b"/><line x1="0" y1="0" x2="0" y2="-18" stroke="#8a5a3b" stroke-width="2"/><path d="M0,-18 L12,-4 L0,-4Z" fill="#fff"/></g>
  <path d="M0,600 C200,560 420,580 640,610 C860,640 1100,600 1440,560 L1440,700 L0,700Z" fill="${C.tea}"/>
  ${paddyRows}
  <g fill="${C.forest}">${[[40,560],[70,575],[1380,520],[1410,535],[640,590],[1180,575]].map(([x,y]) => `<path d="M${x},${y} l-14,26 l28,0z"/><path d="M${x},${y + 12} l-17,30 l34,0z"/><rect x="${x - 2}" y="${y + 42}" width="4" height="8"/>`).join('')}</g>
  <path d="${PATH}" stroke="${C.path}" stroke-width="30" fill="none" stroke-linecap="round" opacity=".95"/>
  <path d="${PATH}" stroke="${C.soil}" stroke-width="2" stroke-dasharray="2 12" fill="none" stroke-linecap="round"/>
  ${footprints()}
  ${STATIONS.map(flag).join('')}
  ${microbitBuddy()}
  </svg>`;
}

export function ridge(color = '#123829', opacity = 1) {
  return `<svg class="ridge" viewBox="0 0 1200 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0,90 L0,60 L90,30 L160,52 L260,8 L330,40 L420,22 L520,58 L600,26 L700,48 L790,12 L880,46 L980,24 L1080,52 L1200,30 L1200,90Z" fill="${color}" opacity="${opacity}"/></svg>`;
}

// 五週課程卡插圖
const ART = {
  w1: `<rect width="240" height="110" fill="#e6f3df"/><path d="M0,80 Q120,50 240,78 L240,110 L0,110Z" fill="#9fcf7d"/>${[[40,88],[70,80],[100,84],[130,76]].map(([x,y],i)=>`<ellipse cx="${x}" cy="${y + (i%2?4:-4)}" rx="5" ry="8" fill="#1d3b2f" opacity=".45" transform="rotate(-20 ${x} ${y})"/>`).join('')}<g transform="translate(160 18)"><rect width="62" height="62" rx="10" fill="#24302c"/>${[[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,1,0,1,0],[0,1,1,1,0]].map((r,y)=>r.map((on,x)=>`<rect x="${7 + x*10}" y="${7 + y*10}" width="7" height="7" rx="1.5" fill="${on?'#ff7a59':'#3c4d47'}"/>`).join('')).join('')}</g>`,
  w2: `<rect width="240" height="110" fill="#e3f0f7"/><g transform="translate(110 20)"><rect width="110" height="66" rx="6" fill="#fff" stroke="#24507c" stroke-width="3"/><rect x="12" y="30" width="86" height="12" rx="6" fill="#d7e6f2"/><rect x="12" y="30" width="58" height="12" rx="6" fill="#2e8b57"/><text x="55" y="22" text-anchor="middle" font-size="11" fill="#24507c">STEP,7</text><rect x="-8" y="66" width="126" height="8" rx="3" fill="#24507c"/></g><rect x="20" y="40" width="46" height="46" rx="8" fill="#24302c"/><circle cx="31" cy="63" r="4" fill="#9aa6a1"/><circle cx="55" cy="63" r="4" fill="#9aa6a1"/><path d="M43,40 C43,10 100,10 108,48" stroke="#555" stroke-width="3" fill="none"/>`,
  w3: `<rect width="240" height="110" fill="#fbeee6"/><rect x="0" y="40" width="240" height="22" fill="#f6d9c9"/><rect x="0" y="68" width="240" height="22" fill="#d9ecd4"/><path d="M0,65 L240,65" stroke="#fff" stroke-width="3" stroke-dasharray="10 8"/><g transform="translate(150 48)"><line x1="0" y1="0" x2="0" y2="-36" stroke="#1d3b2f" stroke-width="3"/><path d="M0,-36 L26,-29 L0,-22Z" fill="#d6493a"/></g><g transform="translate(110 78)"><line x1="0" y1="0" x2="0" y2="-36" stroke="#1d3b2f" stroke-width="3"/><path d="M0,-36 L26,-29 L0,-22Z" fill="#2e8b57"/></g><path d="M200,30 L200,96" stroke="#1d3b2f" stroke-width="3" stroke-dasharray="6 4"/>`,
  w4: `<rect width="240" height="110" fill="#f6f1dc"/><path d="M0,90 Q60,40 120,70 T240,60 L240,110 L0,110Z" fill="#8cc28a"/>${Array.from({length:5},(_,i)=>`<path d="M${10+i*8},${100-i*7} Q60,${80-i*8} ${110-i*6},${98-i*6}" stroke="#2e7d4f" stroke-width="4" fill="none" opacity=".8"/>`).join('')}${Array.from({length:13},(_,i)=>`<circle cx="${130 + (i%5)*20}" cy="${30 + Math.floor(i/5)*18}" r="5" fill="${i===6?'#d6493a':'#fff'}" stroke="#1d3b2f" stroke-width="1.5"/>`).join('')}<path d="M190,10 c-12,0 -16,14 0,30 c16,-16 12,-30 0,-30z" fill="#d6493a"/><circle cx="190" cy="21" r="4" fill="#fff"/>`,
  w5: `<rect width="240" height="110" fill="#e9f1e2"/><path d="M0,100 L60,40 L100,70 L150,25 L240,100Z" fill="#5fa36f"/><path d="M150,25 L240,100 L120,100 L130,56Z" fill="#ec9a8c"/><path d="M60,40 L100,70 L80,100 L0,100Z" fill="#2e8b57" opacity=".45"/><g transform="translate(150 25)"><line x1="0" y1="0" x2="0" y2="-22" stroke="#1d3b2f" stroke-width="3"/><path d="M0,-22 L22,-16 L0,-10Z" fill="#d6493a"/></g><g transform="translate(60 40)"><line x1="0" y1="0" x2="0" y2="-22" stroke="#1d3b2f" stroke-width="3"/><path d="M0,-22 L22,-16 L0,-10Z" fill="#2e8b57"/></g><circle cx="205" cy="22" r="12" fill="#f6c544"/>`
};
export function weekArt(id) {
  return `<svg class="week-art" viewBox="0 0 240 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${ART[id] || ''}</svg>`;
}
