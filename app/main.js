import { html, render, useState, useEffect, Icon, Toaster, Sheet, toast, useStatus } from './ui.js';
import { store, loadConfig, saveConfig } from '../lib/store.js';
import { Today } from './today.js';
import { CheckIn } from './checkin.js';
import { Trends } from './trends.js';
import { Plan } from './plan.js';
import { More } from './more.js';
import { Setup } from './setup.js';
import { Lock } from './lock.js';
import { InjectionForm, TrainingForm, FoodForm, NoteForm, BriefSheet } from './forms.js';

const TABS = [['today', 'today', 'Сегодня'], ['trends', 'trends', 'Тренды'], ['checkin', 'plus', ''], ['plan', 'plan', 'План'], ['more', 'more', 'Ещё']];
const SHEETS = { food: 'Еда', training: 'Тренировка', note: 'Заметка', injection: 'Инъекция', brief: 'Брифинг' };

function readHash() { const [tab, sub] = location.hash.replace('#', '').split('/'); return { tab: TABS.some((t) => t[0] === tab) ? tab : 'today', sub: sub || null }; }

function App() {
  const [cfg, setCfg] = useState(loadConfig());
  const [locked, setLocked] = useState(!!cfg.pinHash);
  const [route, setRoute] = useState(readHash());
  const [sheet, setSheet] = useState(null);
  const status = useStatus();

  const ready = cfg.demo || cfg.token;
  // init synchronously before children mount (child effects run before parent effects)
  const initKey = `${cfg.demo}|${cfg.repo}|${cfg.token}`;
  if (ready && store.initKey !== initKey) { store.initKey = initKey; store.init(cfg); }
  useEffect(() => { const f = () => setRoute(readHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (status.error) toast(status.error, 'err'); }, [status.error]);

  const go = (tab, sub = null) => { location.hash = sub ? `${tab}/${sub}` : tab; window.scrollTo(0, 0); };
  const setSub = (sub) => go(route.tab, sub);
  const openSheet = (name, props = {}) => setSheet({ name, props });
  const closeSheet = () => setSheet(null);

  if (!ready) return html`<${Setup} onDone=${(c) => { const n = { ...loadConfig(), ...c }; saveConfig(n); setCfg(n); }}/><${Toaster}/>`;
  if (locked) return html`<${Lock} pinHash=${cfg.pinHash} onUnlock=${() => setLocked(false)}/>`;

  const logout = () => { const n = { ...loadConfig(), token: '', demo: false }; saveConfig(n); localStorage.removeItem('hos.demo'); setCfg(n); location.hash = ''; };
  const { tab, sub } = route;

  return html`
    <main class="app">
      ${tab === 'today' && html`<${Today} go=${go} openSheet=${openSheet}/>`}
      ${tab === 'trends' && html`<${Trends}/>`}
      ${tab === 'checkin' && html`<${CheckIn} done=${() => go('today')}/>`}
      ${tab === 'plan' && html`<${Plan} sub=${sub} setSub=${setSub} openSheet=${openSheet}/>`}
      ${tab === 'more' && html`<${More} sub=${sub} setSub=${setSub} openSheet=${openSheet} onLogout=${logout}/>`}
    </main>
    <nav class="tabbar" aria-label="Разделы">
      ${TABS.map(([k, ic, label]) => k === 'checkin'
        ? html`<button class="tab" aria-label="Чек-ин" onClick=${() => go('checkin')}><span class="tab-plus"><${Icon} name="plus" size=${26}/></span></button>`
        : html`<button class="tab ${tab === k ? 'on' : ''}" aria-current=${tab === k ? 'page' : null} onClick=${() => go(k)}><${Icon} name=${ic}/><span>${label}</span></button>`)}
    </nav>
    <${Sheet} open=${!!sheet} title=${sheet ? SHEETS[sheet.name] : ''} onClose=${closeSheet}>
      ${sheet?.name === 'food' && html`<${FoodForm} done=${closeSheet}/>`}
      ${sheet?.name === 'training' && html`<${TrainingForm} done=${closeSheet}/>`}
      ${sheet?.name === 'note' && html`<${NoteForm} done=${closeSheet}/>`}
      ${sheet?.name === 'injection' && html`<${InjectionForm} item=${sheet.props.item} done=${closeSheet}/>`}
      ${sheet?.name === 'brief' && html`<${BriefSheet} ...${sheet.props}/>`}
    <//>
    <${Toaster}/>`;
}

render(html`<${App}/>`, document.getElementById('root'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW', e));
}
