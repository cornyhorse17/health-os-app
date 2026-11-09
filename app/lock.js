import { html, useState, Icon } from './ui.js';

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hos:' + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function Lock({ pinHash, onUnlock }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState(false);
  const press = async (d) => {
    const n = (v + d).slice(0, 6); setV(n); setErr(false);
    if (n.length >= 4 && (await sha256(n)) === pinHash) onUnlock();
    else if (n.length === 6) { setErr(true); setTimeout(() => setV(''), 400); }
  };
  return html`<div class="pin"><div>
    <${Icon} name="lock" size=${34} cls="muted"/>
    <h2 style="margin:12px 0 0">Health OS</h2>
    <div class="pin-dots" style=${err ? 'animation:sh .3s' : ''}>${[0, 1, 2, 3, 4, 5].map((i) => html`<i class=${i < v.length ? 'on' : ''}></i>`)}</div>
    <div class="pin-pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => k === '' ? html`<span></span>`
      : html`<button aria-label=${k === '⌫' ? 'Стереть' : k} onClick=${() => (k === '⌫' ? setV(v.slice(0, -1)) : press(k))}>${k}</button>`)}</div>
    ${err && html`<p class="small" style="color:var(--bad)">Неверный PIN</p>`}
  </div></div>`;
}
