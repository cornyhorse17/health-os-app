import { html, useData, useState, Card, Skeleton, Empty, Icon, Badge, Markdown, Field, toast, haptic } from './ui.js';
import { store, P, loadConfig, saveConfig } from '../lib/store.js';
import { today, shortDate, addDays } from '../lib/dates.js';
import { buildICS, shareICS } from '../lib/ics.js';
import { sha256 } from './lock.js';

export const APP_VERSION = '1.0.0';

const MENU = [
  ['nutrition', 'food', 'Питание', 'журнал и КБЖУ'],
  ['reviews', 'doc', 'Обзоры', 'недельные отчёты'],
  ['calendar', 'calendar', 'Напоминания', 'экспорт в Календарь iPhone'],
  ['feedback', 'spark', 'Улучшить приложение', 'пожелания для доработки'],
  ['settings', 'lock', 'Настройки', 'токен, PIN, данные'],
];

export function More({ sub, setSub, openSheet, onLogout }) {
  const view = sub || null;
  if (!view) return html`<div class="top"><h1>Ещё</h1></div>
    <${Card}><div class="list">${MENU.map(([k, ic, t, s]) => html`
      <button class="li tap" onClick=${() => setSub(k)}><${Icon} name=${ic} cls="muted"/><span class="grow"><div class="t">${t}</div><div class="s">${s}</div></span><${Icon} name="chevron" size=${18} cls="muted"/></button>`)}</div><//>
    <p class="tiny" style="text-align:center">Health OS · v${APP_VERSION}</p>`;
  const title = MENU.find((m) => m[0] === view)?.[2] || '';
  return html`<div class="top"><button class="link" onClick=${() => setSub(null)}>‹ Ещё</button><h1 style="margin-top:6px">${title}</h1></div>
    ${view === 'nutrition' && html`<${Nutrition} openSheet=${openSheet}/>`}
    ${view === 'reviews' && html`<${Reviews}/>`}
    ${view === 'calendar' && html`<${CalendarExport}/>`}
    ${view === 'feedback' && html`<${Feedback}/>`}
    ${view === 'settings' && html`<${Settings} onLogout=${onLogout}/>`}`;
}

function Nutrition({ openSheet }) {
  const cfg = loadConfig();
  const { loading, data } = useData(() => store.loadDays(P.meals, 14));
  if (loading) return html`<div class="card"><${Skeleton}/></div>`;
  const days = [...(data || [])].reverse();
  const t = days[0];
  const goal = cfg.proteinGoal;
  const p = t?.totals?.protein_g || 0;
  return html`
    <${Card} cls="accent" title="Сегодня">
      <div class="stats">
        <div class="stat"><div class="k">Белок</div><div class="v">${p} г</div><div class="d ${goal ? (p >= goal ? 'up' : 'flat') : 'flat'}">${goal ? `цель ${goal} г` : 'цель не задана'}</div></div>
        <div class="stat"><div class="k">Ккал</div><div class="v">${t?.totals?.kcal ?? 0}</div></div>
        <div class="stat"><div class="k">Ж / У</div><div class="v" style="font-size:18px">${t?.totals?.fat_g ?? 0} / ${t?.totals?.carbs_g ?? 0}</div></div>
      </div>
      ${goal && html`<div class="progress" style="margin-top:12px"><i style=${`width:${Math.min(100, Math.round((p / goal) * 100))}%`}></i></div>`}
      <button class="btn primary block" style="margin-top:14px" onClick=${() => openSheet('food')}><${Icon} name="camera"/> Добавить еду</button>
    <//>
    ${days.map((d) => (d.items?.length || d.totals) && html`<${Card} title=${d.date === today() ? 'Сегодня' : shortDate(d.date)} action=${d.totals && html`<span class="muted small">${d.totals.kcal ?? '—'} ккал · Б ${d.totals.protein_g ?? '—'}</span>`}>
      ${(d.items || []).length ? html`<div class="list">${d.items.map((it) => html`<div class="li"><span class="time">${it.time || ''}</span><span class="grow"><div class="t">${it.desc}</div>
        <div class="s">${it.kcal ?? '—'} ккал · Б ${it.protein_g ?? '—'} · Ж ${it.fat_g ?? '—'} · У ${it.carbs_g ?? '—'}${it.confidence && it.confidence !== 'manual' ? ` · точность: ${{ low: 'низкая', medium: 'средняя', high: 'высокая' }[it.confidence] || it.confidence}` : ''}</div>
        ${it.advice && html`<div class="s" style="color:var(--accent)">${it.advice}</div>`}</span></div>`)}</div>` : html`<div class="tiny">только итоги</div>`}
    <//>`)}
    ${!days.some((d) => d.items?.length || d.totals) && html`<${Empty} text="Записей о еде пока нет."/>`}`;
}

function Reviews() {
  const [open, setOpen] = useState(null);
  const { loading, data } = useData(async () => (await store.list(P.reviews)).filter((x) => x.name.endsWith('.md')).sort((a, b) => b.name.localeCompare(a.name)));
  const { data: text } = useData(async () => (open ? store.readText(open) : null), [open]);
  if (loading) return html`<div class="card"><${Skeleton}/></div>`;
  if (open) return html`<button class="link" onClick=${() => setOpen(null)}>‹ Все обзоры</button><${Card}>${text ? html`<${Markdown} src=${text}/>` : html`<${Skeleton} lines=${6}/>`}<//>`;
  return html`<${Card}>${(data || []).length ? html`<div class="list">${data.map((r) => html`
    <button class="li tap" onClick=${() => setOpen(r.path)}><${Icon} name="doc" cls="muted"/><span class="grow"><div class="t">Неделя ${r.name.replace('.md', '').replace('-W', ' · W')}</div></span><${Icon} name="chevron" size=${18} cls="muted"/></button>`)}</div>`
    : html`<${Empty} text="Обзоры появятся после первого воскресенья (задача в 19:30)."/>`}<//>`;
}

function CalendarExport() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const [protocol, injections, training, labs] = await Promise.all([store.readJSON(P.protocol, {}), store.readJSON(P.injections, []), store.readJSON(P.training, {}), store.readJSON(P.labs, {})]);
      const r = await shareICS(buildICS({ protocol, injections, training, labs }));
      if (r !== 'cancel') { localStorage.setItem('hos.icsAt', String(Date.now())); toast(r === 'shared' ? 'Выбери «Календарь» в меню' : 'Файл календаря скачан'); }
    } finally { setBusy(false); }
  };
  return html`<${Card}>
    <p style="margin-top:0">Приложение не может присылать пуши без сервера, поэтому напоминания идут через Календарь iPhone:</p>
    <ul class="steps"><li>приёмы по времени из протокола — каждый день;</li><li>инъекции — по расписанию от последней записи, напоминание за 1 час;</li><li>тренировки — по плану недели;</li><li>анализы — в день сдачи, напоминание накануне.</li></ul>
    <button class="btn primary block" disabled=${busy} onClick=${run}><${Icon} name="calendar"/> ${busy ? 'Готовлю…' : 'Экспорт в Календарь'}</button>
    <p class="tiny" style="margin-top:10px">Если из иконки на главном экране файл не открывается — открой адрес приложения в Safari и нажми кнопку там. После изменения протокола экспортируй заново (старые события удали в Календаре: поиск «Health OS»).</p>
  <//>`;
}

function Feedback() {
  const [t, setT] = useState('');
  const { data } = useData(() => store.readJSON(P.feedback, []));
  const send = async () => { if (!t.trim()) return; await store.addFeedback(t.trim()); setT(''); haptic(); toast('Записано — войдёт в следующий пакет доработок'); };
  const ST = { new: ['новое', ''], planned: ['в плане', 'acc'], done: ['сделано', 'ok'] };
  return html`<${Card}>
    <${Field} label="Что улучшить или добавить" hint="Пожелания копятся в data/feedback.json. Ежемесячный пересмотр группирует их, а Computer реализует пакетом."><textarea value=${t} onInput=${(e) => setT(e.target.value)} placeholder="Например: график веса за 7 дней на главном экране"></textarea><//>
    <button class="btn primary block" onClick=${send}>Отправить</button>
  <//>
  ${(data || []).length > 0 && html`<${Card} title="Пожелания"><div class="list">${[...data].reverse().map((f) => html`<div class="li"><span class="grow"><div class="t">${f.text}</div><div class="s">${shortDate(f.date)}</div></span><${Badge} kind=${ST[f.status]?.[1]}>${ST[f.status]?.[0] || f.status}<//></div>`)}</div><//>`}`;
}

function Settings({ onLogout }) {
  const [cfg, setCfg] = useState(loadConfig());
  const [pin, setPin] = useState('');
  const save = (patch) => { const c = { ...cfg, ...patch }; setCfg(c); saveConfig(c); };
  const s = store.status;
  const last = s.lastSync ? new Date(s.lastSync).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  const { data: health } = useData(async () => ({
    brief: (await store.list(P.briefings)).map((x) => x.name).sort().pop(),
    garmin: ((await store.readJSON(P.garmin, [])) || []).filter((r) => r.hrv != null || r.sleep_h != null).length,
  }));
  return html`
    <${Card} title="Данные">
      <div class="list">
        <div class="li"><span class="grow">Режим</span><span>${cfg.demo ? html`<${Badge} kind="acc">демо<//>` : html`<span class="muted small">${cfg.repo}</span>`}</span></div>
        <div class="li"><span class="grow">Последняя синхронизация</span><span class="muted small">${last}</span></div>
        <div class="li"><span class="grow">Ждут отправки</span><span class="muted small">${s.pending}</span></div>
        <div class="li"><span class="grow">Последний брифинг</span><span class="muted small">${health?.brief?.replace('.md', '') || '—'}</span></div>
        <div class="li"><span class="grow">Garmin</span><span class="muted small">${health?.garmin ? `${health.garmin} дн с данными` : 'нет данных (необязательно)'}</span></div>
      </div>
      <div class="row" style="margin-top:10px"><button class="btn small" onClick=${() => { store.flush(); toast('Синхронизирую'); }}>Синхронизировать</button><button class="btn small" onClick=${() => { store.clearCache(); toast('Кэш очищен'); }}>Очистить кэш</button></div>
    <//>
    <${Card} title="Питание">
      <${Field} label="Цель по белку, г/день" hint="Пусто — цель не показывается. Обычно задаётся по разбору в Perplexity."><input type="number" inputmode="numeric" value=${cfg.proteinGoal ?? ''} onInput=${(e) => save({ proteinGoal: e.target.value ? Number(e.target.value) : null })}/><//>
    <//>
    <${Card} title="PIN на вход">
      ${cfg.pinHash ? html`<p class="small muted" style="margin-top:0">PIN включён.</p><button class="btn small danger" onClick=${() => { save({ pinHash: null }); toast('PIN отключён'); }}>Отключить PIN</button>`
        : html`<${Field} label="Новый PIN (4–6 цифр)"><input type="password" inputmode="numeric" maxlength="6" value=${pin} onInput=${(e) => setPin(e.target.value.replace(/\D/g, ''))}/><//>
          <button class="btn small" disabled=${pin.length < 4} onClick=${async () => { save({ pinHash: await sha256(pin) }); setPin(''); toast('PIN установлен'); }}>Установить PIN</button>`}
    <//>
    <${Card} title="Доступ">
      <p class="small muted" style="margin-top:0">${cfg.demo ? 'Сейчас демо-режим с вымышленными данными.' : 'GitHub-токен хранится только на этом устройстве.'}</p>
      ${cfg.demo && html`<button class="btn small" style="margin-right:8px" onClick=${() => { store.resetDemo(); toast('Демо-данные сброшены'); }}>Сбросить демо</button>`}
      <button class="btn small danger" onClick=${() => { if (confirm(cfg.demo ? 'Выйти из демо-режима?' : 'Удалить токен с этого устройства?')) onLogout(); }}>${cfg.demo ? 'Выйти из демо' : 'Удалить токен с устройства'}</button>
    <//>
    <p class="tiny" style="text-align:center">Health OS v${APP_VERSION}</p>`;
}
