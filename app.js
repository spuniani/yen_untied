const LEGS = [
  { id: 'tokyo', file: 'data/tokyo_itinerary.json' },
  { id: 'hakone', file: 'data/hakone_itinerary.json' },
  { id: 'kyoto', file: 'data/kyoto_itinerary.json' },
  { id: 'hiroshima', file: 'data/hiroshima_itinerary.json' },
];

const dataCache = {};

const state = {
  legId: null,
  dayIdx: 0,
  slotIdx: 0,
  view: 'loading',   // 'loading' | 'home' | 'day-overview' | 'slot' | 'practical'
  jumpOpen: false,
  jumpDay: 0,
  rainOpen: false,
};

// ─── Data ──────────────────────────────────────────────

async function loadLeg(id) {
  if (dataCache[id]) return dataCache[id];
  const leg = LEGS.find(l => l.id === id);
  const res = await fetch(leg.file);
  const data = await res.json();
  dataCache[id] = data;
  return data;
}

// ─── Utilities ─────────────────────────────────────────

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const lower = url.toLowerCase().trim();
  return (lower.startsWith('https://') || lower.startsWith('http://')) ? url : null;
}

// Kyoto days don't have a numeric .day field — fall back to 1-based index
function dayNum(day, idx) {
  return day.day ?? (idx + 1);
}

function firstSentence(text, max = 90) {
  if (!text) return '';
  const m = text.match(/^[^.!?]+[.!?]?/);
  const s = (m ? m[0] : text).trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ─── Shared HTML pieces ────────────────────────────────

function tagsHtml(tags, cls = 'slot-tags') {
  if (!tags?.length) return '';
  const rendered = tags
    .filter(t => t && /^[a-z]+$/.test(t))
    .map(t => `<span class="tag tag-${t}">${t}</span>`)
    .join('');
  return rendered ? `<div class="${cls}">${rendered}</div>` : '';
}

function navSectionHtml(slot) {
  const mapsUrl = safeUrl(slot.location?.maps_url);
  const mapBtn = mapsUrl
    ? `<a href="${esc(mapsUrl)}" target="_blank" rel="noopener noreferrer" class="map-btn">📍 Open in Maps</a>`
    : '';
  if (!slot.nav && !mapsUrl) return '';
  return `
    <div class="nav-section">
      ${slot.nav ? `<div class="nav-label">How to get there</div><div class="nav-text">${esc(slot.nav)}</div>` : ''}
      ${mapBtn}
    </div>`;
}

function tipsHtml(tips) {
  if (!tips?.length) return '';
  const lines = tips.map(t =>
    `<div class="tip-line"><span class="tip-icon">💡</span><span>${esc(t)}</span></div>`
  ).join('');
  return `<div class="tips-box">${lines}</div>`;
}

function dayTabStripHtml(data, activeDayIdx) {
  const dayTabs = data.days.map((d, i) => `
    <button class="day-tab ${i === activeDayIdx ? 'active' : ''}" onclick="switchDay(${i})">
      Day ${dayNum(d, i)}
    </button>`).join('');
  const practicalTab = `
    <button class="day-tab ${state.view === 'practical' ? 'active' : ''}" onclick="goToPractical()">
      Tips
    </button>`;
  return `<div class="day-tab-strip">${dayTabs}${practicalTab}</div>`;
}

// ─── Home screen ─────────────────────────────────────────

function renderHomeView() {
  const legsHtml = LEGS.map(l => {
    const d = dataCache[l.id];
    const hotel = d?.hotel?.name ? `<div class="leg-hotel">${esc(d.hotel.name)}</div>` : '';
    return `
      <div class="leg-card" onclick="selectLeg('${esc(l.id)}')">
        <div class="leg-name">${d ? esc(d.trip) : esc(l.id)}</div>
        ${d ? `<div class="leg-dates">${esc(d.dates)}</div>` : ''}
        ${hotel}
        <span class="leg-arrow">${d ? d.days.length + ' days' : ''} →</span>
      </div>`;
  }).join('');

  return `
    <div class="header home-header">
      <div class="header-left">
        <div class="header-eyebrow">Your trip</div>
        <div class="header-title">Japan 2026</div>
      </div>
    </div>
    <div class="home-screen">
      ${legsHtml}
    </div>`;
}

// ─── Day overview (the "date page") ──────────────────────

function renderDayOverview(data) {
  const day = data.days[state.dayIdx];

  const rowsHtml = day.slots.map((s, i) => {
    const desc = firstSentence(s.description);
    return `
      <div class="ov-row" onclick="jumpTo(${state.dayIdx}, ${i})">
        <div class="ov-time">${esc(s.time)}</div>
        <div class="ov-content">
          <div class="ov-title">${esc(s.title)}</div>
          ${desc ? `<div class="ov-desc">${esc(desc)}</div>` : ''}
          ${tagsHtml(s.tags, 'ov-tags')}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="header">
      <button class="header-back" onclick="goHome()">
        <div class="header-eyebrow">← ${esc(data.trip)}</div>
        <div class="header-title">${esc(day.date)}</div>
      </button>
      <button class="menu-btn" onclick="openJump()" aria-label="Menu">☰</button>
    </div>
    ${dayTabStripHtml(data, state.dayIdx)}
    <div class="slot-area">
      ${day.theme ? `<div class="ov-theme">${esc(day.theme)}</div>` : ''}
      <div class="ov-list">${rowsHtml}</div>
    </div>
    <div class="slot-nav just-rain">
      <button class="rain-pill" onclick="openRain()">🌧 Rain plan</button>
    </div>`;
}

// ─── Slot (walking mode) ─────────────────────────────────

function renderSlotView(data) {
  const day = data.days[state.dayIdx];
  const slot = day.slots[state.slotIdx];
  const isFirst = state.dayIdx === 0 && state.slotIdx === 0;
  const isLast = state.dayIdx === data.days.length - 1 && state.slotIdx === day.slots.length - 1;
  const locationName = slot.location?.name;

  return `
    <div class="header">
      <button class="header-back" onclick="backToOverview()">
        <div class="header-eyebrow">← Day ${dayNum(day, state.dayIdx)} · ${esc(day.date)}</div>
        <div class="header-title">${esc(slot.title)}</div>
        ${locationName ? `<div class="header-sub">${esc(locationName)}</div>` : ''}
      </button>
      <button class="menu-btn" onclick="openJump(); event.stopPropagation()" aria-label="Menu">☰</button>
    </div>
    <div class="slot-area" id="slot-area">
      <div class="slot-card">
        <div class="slot-time">${esc(slot.time)}</div>
        <div class="slot-title">${esc(slot.title)}</div>
        ${tagsHtml(slot.tags)}
        <div class="slot-divider"></div>
        <div class="slot-description">${esc(slot.description)}</div>
        ${navSectionHtml(slot)}
        ${tipsHtml(slot.tips)}
      </div>
    </div>
    <div class="slot-nav">
      <button class="nav-arrow" onclick="prevSlot()" ${isFirst ? 'disabled' : ''} aria-label="Previous">◀</button>
      <button class="rain-pill" onclick="openRain()">🌧 Rain plan</button>
      <button class="nav-arrow" onclick="nextSlot()" ${isLast ? 'disabled' : ''} aria-label="Next">▶</button>
    </div>`;
}

// ─── Practical view ─────────────────────────────────────

const PRACTICAL_LABELS = {
  hotel: 'Hotel',
  transport: 'Getting around',
  food_vegetarians: 'Vegetarians',
  food_konbini: 'Konbini picks',
  food_picky_eaters: 'Picky eaters',
  cash: 'Cash',
  weather: 'Weather & rainy season',
  festival: 'Festival (Sanno Matsuri)',
  fushimi_inari: 'Fushimi Inari',
  kurama_kibune: 'Kurama & Kibune',
  nijo_castle: 'Nijo Castle',
  hiroshima: 'Hiroshima info',
  takuhaibin: 'Luggage forwarding',
};

function renderPracticalView(data) {
  const day = data.days[state.dayIdx];
  const p = data.practical || {};

  const cardsHtml = Object.entries(PRACTICAL_LABELS)
    .filter(([k]) => p[k])
    .map(([k, label]) => `
      <div class="practical-card">
        <div class="practical-label">${label}</div>
        <div class="practical-text">${esc(p[k])}</div>
      </div>`).join('');

  return `
    <div class="header">
      <button class="header-back" onclick="backFromPractical()">
        <div class="header-eyebrow">← ${esc(data.trip)}</div>
        <div class="header-title">Practical tips</div>
      </button>
      <button class="menu-btn" onclick="openJump()" aria-label="Menu">☰</button>
    </div>
    ${dayTabStripHtml(data, state.dayIdx)}
    <div class="slot-area">
      <div class="practical-list">${cardsHtml}</div>
    </div>
    <div class="slot-nav just-rain">
      <button class="rain-pill" onclick="openRain()">🌧 Rain plan · Day ${dayNum(day, state.dayIdx)}</button>
    </div>`;
}

// ─── Jump sheet ──────────────────────────────────────────

function renderJumpSheet(data) {
  const dayTabsHtml = data.days.map((d, i) => `
    <button class="day-tab ${i === state.jumpDay ? 'active' : ''}" onclick="setJumpDay(${i})">
      Day ${dayNum(d, i)}
    </button>`).join('') +
    `<button class="day-tab ${state.view === 'practical' ? 'active' : ''}" onclick="goToPractical()">Tips</button>`;

  const day = data.days[state.jumpDay];
  const slotsHtml = day.slots.map((s, i) => `
    <div class="jump-slot" onclick="jumpTo(${state.jumpDay}, ${i})">
      <span class="jump-time">${esc(s.time)}</span>
      <span class="jump-title">${esc(s.title)}</span>
    </div>`).join('');

  return `
    <div class="sheet-overlay" onclick="closeJump(event)">
      <div class="sheet" onclick="event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <span class="sheet-title">${esc(data.trip)}</span>
          <button class="sheet-close" onclick="closeJump()">✕</button>
        </div>
        <div class="day-tabs">${dayTabsHtml}</div>
        <div class="sheet-body">${slotsHtml}</div>
      </div>
    </div>`;
}

// ─── Rain sheet ──────────────────────────────────────────

function renderRainSheet(data) {
  const day = data.days[state.dayIdx];
  return `
    <div class="sheet-overlay" onclick="closeRain(event)">
      <div class="sheet" onclick="event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <span class="sheet-title">🌧 Rain plan · Day ${dayNum(day, state.dayIdx)}</span>
          <button class="sheet-close" onclick="closeRain()">✕</button>
        </div>
        <div class="sheet-body">
          <div class="rain-body">${esc(day.rain_plan)}</div>
        </div>
      </div>
    </div>`;
}

// ─── Main render ─────────────────────────────────────────

function render() {
  const app = document.getElementById('app');

  if (state.view === 'loading') {
    app.innerHTML = `<div class="loading">Loading…</div>`;
    return;
  }

  if (state.view === 'home') {
    app.innerHTML = renderHomeView();
    return;
  }

  const data = dataCache[state.legId];
  if (!data) return;

  let html;
  switch (state.view) {
    case 'day-overview': html = renderDayOverview(data); break;
    case 'practical':    html = renderPracticalView(data); break;
    default:             html = renderSlotView(data);
  }

  if (state.jumpOpen) html += renderJumpSheet(data);
  if (state.rainOpen) html += renderRainSheet(data);

  app.innerHTML = html;

  if (state.view === 'slot') initSwipe();
}

// ─── Actions ─────────────────────────────────────────────

function prevSlot() {
  const data = dataCache[state.legId];
  if (state.slotIdx > 0) {
    state.slotIdx--;
  } else if (state.dayIdx > 0) {
    state.dayIdx--;
    state.slotIdx = data.days[state.dayIdx].slots.length - 1;
  }
  render();
  document.getElementById('slot-area')?.scrollTo(0, 0);
}

function nextSlot() {
  const data = dataCache[state.legId];
  const day = data.days[state.dayIdx];
  if (state.slotIdx < day.slots.length - 1) {
    state.slotIdx++;
  } else if (state.dayIdx < data.days.length - 1) {
    state.dayIdx++;
    state.slotIdx = 0;
  }
  render();
  document.getElementById('slot-area')?.scrollTo(0, 0);
}

function switchDay(i) {
  state.dayIdx = i;
  state.slotIdx = 0;
  state.view = 'day-overview';
  render();
}

function goHome() {
  state.view = 'home';
  state.jumpOpen = false;
  state.rainOpen = false;
  render();
}

function backToOverview() {
  state.view = 'day-overview';
  render();
}

function backFromPractical() {
  state.view = 'day-overview';
  render();
}

function openJump() {
  state.jumpDay = state.dayIdx;
  state.jumpOpen = true;
  render();
}

function closeJump(e) {
  if (e && e.target !== e.currentTarget) return;
  state.jumpOpen = false;
  render();
}

function setJumpDay(i) {
  state.jumpDay = i;
  render();
}

function jumpTo(dayIdx, slotIdx) {
  state.dayIdx = dayIdx;
  state.slotIdx = slotIdx;
  state.view = 'slot';
  state.jumpOpen = false;
  render();
  document.getElementById('slot-area')?.scrollTo(0, 0);
}

function goToPractical() {
  state.view = 'practical';
  state.jumpOpen = false;
  render();
}

function openRain() {
  state.rainOpen = true;
  render();
}

function closeRain(e) {
  if (e && e.target !== e.currentTarget) return;
  state.rainOpen = false;
  render();
}

async function selectLeg(id) {
  await loadLeg(id);
  state.legId = id;
  state.dayIdx = 0;
  state.slotIdx = 0;
  state.view = 'day-overview';
  render();
}

// ─── Swipe (slot view only) ───────────────────────────────

function initSwipe() {
  const el = document.getElementById('slot-area');
  if (!el) return;
  let startX = 0, startY = 0;

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 55) {
      if (dx < 0) nextSlot();
      else prevSlot();
    }
  }, { passive: true });
}

// ─── Boot ────────────────────────────────────────────────

async function init() {
  render();
  await Promise.all(LEGS.map(l => loadLeg(l.id)));
  state.view = 'home';
  render();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

init();
