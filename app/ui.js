import { h, render } from '../vendor/preact.js';
import { useState, useEffect, useRef, useMemo, useCallback } from '../vendor/hooks.js';
import htm from '../vendor/htm.js';
import { store } from '../lib/store.js';
import { lineChart } from '../lib/charts.js';
import { mdToHtml } from '../lib/md.js';

export const html = htm.bind(h);
export { h, render, useState, useEffect, useRef, useMemo, useCallback };

// ---------- data hook: re-runs when store changes (local writes) ----------
export function useData(loader, deps = []) {
  const [state, setState] = useState({ loading: true, data: null });
  const [ver, setVer] = useState(store.version);
  useEffect(() => store.subscribe((s) => setVer(s.version)), []);
  useEffect(() => {
    let alive = true;
    loader().then((data) => alive && setState({ loading: false, data }))
      .catch((e) => { console.error(e); alive && setState({ loading: false, data: null, error: e }); });
    return () => { alive = false; };
  }, [ver, ...deps]);
  return state;
}

export function useStatus() {
  const [s, set] = useState(store.status);
  useEffect(() => store.subscribe((st) => set({ ...st.status })), []);
  return s;
}

// ---------- toast ----------
let toastSet = null;
export const toast = (text, kind = 'ok') => toastSet && toastSet({ text, kind, id: Date.now() });
export function Toaster() {
  const [t, set] = useState(null); toastSet = set;
  useEffect(() => { if (!t) return; const id = setTimeout(() => set(null), 2400); return () => clearTimeout(id); }, [t]);
  return t ? html`<div class="toast ${t.kind}" role="status">${t.text}</div>` : null;
}
export const haptic = () => { try { navigator.vibrate?.(10); } catch {} };

// ---------- icons (inline SVG, stroke = currentColor) ----------
const P = {
  today: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  trends: 'M3 17l6-6 4 4 8-8M21 7v5M21 7h-5',
  plus: 'M12 5v14M5 12h14',
  plan: 'M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 12h3M8 16h6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  food: 'M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4M17 3c-2 2-2 6 0 8v10',
  dumbbell: 'M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12',
  note: 'M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h5',
  syringe: 'M18 2l4 4M20 4l-9 9M15 6l3 3M9 11l4 4M7 13l-4 4 3 1 1 3 4-4',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  flask: 'M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-2.5L14 9V3',
  chevron: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6 6 18',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  sync: 'M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18 3v4h-4M6 21v-4h4',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  doc: 'M6 3h9l3 3v15H6zM9 12h6M9 16h6M9 8h3',
};
export const Icon = ({ name, size = 22, cls = '' }) => html`<svg class="ic ${cls}" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[name] || ''}/></svg>`;

// ---------- primitives ----------
export const Card = ({ title, action, children, cls = '', icon }) => html`
  <section class="card ${cls}">
    ${title && html`<header class="card-h">${icon && html`<${Icon} name=${icon} size=${18} cls="muted"/>`}<h3>${title}</h3>${action && html`<div class="card-a">${action}</div>`}</header>`}
    ${children}
  </section>`;

export const Skeleton = ({ lines = 3 }) => html`<div class="sk">${Array.from({ length: lines }, (_, i) => html`<div class="sk-l" style=${`width:${90 - i * 15}%`}></div>`)}</div>`;
export const Empty = ({ text, children }) => html`<div class="empty">${text}${children}</div>`;
export const Badge = ({ kind = '', children }) => html`<span class="badge ${kind}">${children}</span>`;

export function Segmented({ options, value, onChange }) {
  return html`<div class="seg" role="tablist">${options.map(([v, label]) => html`
    <button role="tab" aria-selected=${v === value} class=${v === value ? 'on' : ''} onClick=${() => { haptic(); onChange(v); }}>${label}</button>`)}</div>`;
}

// Big 0–10 slider with value bubble and end labels; "ghost" = yesterday's value
export function Slider({ label, value, onChange, lo = '0', hi = '10', ghost }) {
  const set = (v) => onChange(v === '' ? null : Number(v));
  const has = value != null;
  return html`<div class="slider ${has ? 'set' : ''}">
    <div class="slider-top"><span>${label}</span><b class="val">${has ? value : ghost != null ? html`<span class="ghost">${ghost}</span>` : '—'}</b></div>
    <input type="range" min="0" max="10" step="1" value=${has ? value : ghost ?? 5} onInput=${(e) => set(e.target.value)} aria-label=${label}/>
    <div class="slider-ends"><span>${lo}</span><span>${hi}</span></div>
  </div>`;
}

export function Sheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return; const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k); document.body.classList.add('noscroll');
    return () => { document.removeEventListener('keydown', k); document.body.classList.remove('noscroll'); };
  }, [open]);
  if (!open) return null;
  return html`<div class="sheet-bg" onClick=${onClose}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label=${title} onClick=${(e) => e.stopPropagation()}>
      <div class="sheet-grip"></div>
      <header class="sheet-h"><h2>${title}</h2><button class="icon-btn" aria-label="Закрыть" onClick=${onClose}><${Icon} name="close"/></button></header>
      <div class="sheet-b">${children}</div>
    </div></div>`;
}

export function Chart({ dates, series, markers, height = 180, yRange }) {
  const ref = useRef();
  const key = JSON.stringify([dates, series, markers]);
  useEffect(() => {
    if (!ref.current) return;
    if (!series.some((s) => s.values.some((v) => v != null))) return;
    return lineChart(ref.current, { dates, series, markers, height, yRange });
  }, [key]);
  const empty = !series.some((s) => s.values.some((v) => v != null));
  return html`<div>
    ${empty ? html`<${Empty} text="Пока нет данных за период"/>` : html`<div class="chart" ref=${ref} style=${`height:${height}px`}></div>`}
    ${!empty && html`<div class="legend">${series.map((s) => html`<span><i style=${`background:var(${s.color})`}></i>${s.label}</span>`)}</div>`}
  </div>`;
}

export function Sparkline({ values, width = 120, height = 32 }) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 2) return html`<span class="muted small">мало данных</span>`;
  const min = Math.min(...pts.map((p) => p[1])); const max = Math.max(...pts.map((p) => p[1]));
  const sx = (i) => (i / Math.max(1, values.length - 1)) * (width - 4) + 2;
  const sy = (v) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ');
  const [li, lv] = pts[pts.length - 1];
  return html`<svg width=${width} height=${height} class="spark" aria-hidden="true"><path d=${d} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/><circle cx=${sx(li)} cy=${sy(lv)} r="3" fill="var(--accent)"/></svg>`;
}

export const Markdown = ({ src }) => html`<div class="md" dangerouslySetInnerHTML=${{ __html: mdToHtml(src) }}></div>`;

export function Field({ label, children, hint }) {
  return html`<label class="field"><span class="field-l">${label}</span>${children}${hint && html`<span class="field-h">${hint}</span>`}</label>`;
}

export const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text }); document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
};

export const openPerplexity = () => { window.location.href = 'https://www.perplexity.ai/'; };

// metric path like "morning.energy" → value from checkin
export const metricOf = (c, path) => path.split('.').reduce((o, k) => (o == null ? null : o[k]), c) ?? null;

export const METRIC_LABELS = {
  'morning.energy': 'Энергия утром', 'morning.mood': 'Настроение утром', 'morning.sleep_feel': 'Ощущение сна', 'morning.voice': 'Голос утром', 'morning.weight_kg': 'Вес',
  'evening.energy_day': 'Энергия днём', 'evening.focus': 'Фокус', 'evening.mood': 'Настроение вечером', 'evening.voice': 'Голос вечером', 'evening.stress': 'Стресс', 'evening.appetite': 'Аппетит', 'evening.gi': 'ЖКТ',
};
