import { html, useData, useState, Card, Segmented, Skeleton, Empty, Badge, Chart, Sparkline, Icon, copyText, toast, openPerplexity, metricOf, METRIC_LABELS } from './ui.js';
import { store, P } from '../lib/store.js';
import { today, shortDate, daysBetween, humanDelta, hm, wdShort, weekday, addDays } from '../lib/dates.js';
import { nextInjection } from './today.js';

const TABS = [['protocol', 'Протокол'], ['injections', 'Инъекции'], ['training', 'Тренировки'], ['labs', 'Анализы'], ['experiments', 'Эксперименты']];

export function Plan({ sub, setSub, openSheet }) {
  const tab = sub || 'protocol';
  return html`<div class="top"><h1>План</h1></div>
    <${Segmented} options=${TABS} value=${tab} onChange=${setSub}/>
    ${tab === 'protocol' && html`<${Protocol}/>`}
    ${tab === 'injections' && html`<${Injections} openSheet=${openSheet}/>`}
    ${tab === 'training' && html`<${Training} openSheet=${openSheet}/>`}
    ${tab === 'labs' && html`<${Labs}/>`}
    ${tab === 'experiments' && html`<${Experiments}/>`}`;
}

const KIND = { supplement: 'добавка', peptide: 'пептид', drug: 'препарат', injection: 'инъекция' };
const EV = { A: 'ok', B: 'acc', C: 'warn', D: 'bad' };

function Protocol() {
  const { loading, data } = useData(() => store.readJSON(P.protocol, { active: [], candidates: [], stopped: [] }));
  if (loading) return html`<div class="card"><${Skeleton} lines=${5}/></div>`;
  const p = data || {};
  return html`
    <div class="section-t">Принимаю сейчас</div>
    <${Card}><div class="list">${(p.active || []).map((x) => html`
      <div class="li"><span class="grow">
        <div class="t">${x.name} <span class="muted small">${x.dose || ''}</span></div>
        <div class="s">${[KIND[x.kind] || x.kind, (x.times || []).join(', ') || (x.schedule?.every_days ? `раз в ${x.schedule.every_days} дн` : ''), x.since ? `с ${shortDate(x.since)}` : '', x.purpose].filter(Boolean).join(' · ')}</div>
        ${x.note && html`<div class="tiny">${x.note}</div>`}
      </span></div>`)}
      ${!(p.active || []).length && html`<${Empty} text="Пусто"/>`}</div><//>
    ${(p.candidates || []).length > 0 && html`<div class="section-t">Кандидаты и вердикты</div>
      <${Card}><div class="list">${p.candidates.map((x) => html`
        <div class="li"><span class="grow"><div class="t">${x.name}</div><div class="s">${x.verdict || 'не разобран'}${x.next_step ? ` · дальше: ${x.next_step}` : ''}</div></span>${x.evidence && html`<${Badge} kind=${EV[x.evidence] || ''}>${x.evidence}<//>`}</div>`)}</div><//>`}
    ${(p.stopped || []).length > 0 && html`<div class="section-t">Отменено</div>
      <${Card}><div class="list">${p.stopped.map((x) => html`<div class="li"><span class="grow"><div class="t">${x.name}</div><div class="s">${x.date ? shortDate(x.date) : ''}${x.reason ? ` · ${x.reason}` : ''}</div></span></div>`)}</div><//>`}
    <p class="tiny">Протокол меняет Perplexity после твоего «начинаю / отменил» в Search-чате.</p>`;
}

function Injections({ openSheet }) {
  const { loading, data } = useData(async () => ({ protocol: await store.readJSON(P.protocol, { active: [] }), injections: await store.readJSON(P.injections, []) }));
  if (loading) return html`<div class="card"><${Skeleton}/></div>`;
  const next = nextInjection(data.protocol, data.injections);
  if (!next.length) return html`<${Empty} text="В протоколе нет препаратов с типом «инъекция»."/>`;
  return html`${next.map(({ item, due, last }) => html`
    <${Card} icon="syringe" title=${`${item.name} ${item.dose || ''}`}>
      <div class="big">${last ? humanDelta(due - Date.now()) : 'нет записей'}</div>
      <div class="muted small">${last ? `следующая: ${due.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}, ${hm(due)} · раз в ${item.schedule.every_days} дн` : 'отметь последнюю инъекцию, чтобы запустить таймер'}</div>
      <button class="btn primary block" style="margin-top:14px" onClick=${() => openSheet('injection', { item })}>Отметить инъекцию</button>
    <//>`)}
    <${Card} title="История"><div class="list">${[...(data.injections || [])].reverse().slice(0, 20).map((x) => html`
      <div class="li"><span class="grow"><div class="t">${shortDate(x.at.slice(0, 10))} · ${x.at.slice(11, 16)}</div><div class="s">${x.site || '—'}${x.note ? ` · ${x.note}` : ''}</div></span><span class="muted small">${x.dose_mg ?? ''} мг</span></div>`)}
      ${!(data.injections || []).length && html`<${Empty} text="Пока пусто"/>`}</div><//>`;
}

function Training({ openSheet }) {
  const { loading, data } = useData(async () => ({ tr: await store.readJSON(P.training, { plan: [], working_weights: {} }), days: await store.loadDays(P.checkins, 21) }));
  if (loading) return html`<div class="card"><${Skeleton}/></div>`;
  const plan = data.tr?.plan || []; const ww = data.tr?.working_weights || {};
  const log = data.days.filter((d) => d.training?.length).reverse();
  const wdToday = weekday(today());
  return html`
    <button class="btn primary block" style="margin-bottom:12px" onClick=${() => openSheet('training')}><${Icon} name="dumbbell"/> Записать тренировку</button>
    <${Card} title="План недели">${plan.length ? html`<div class="list">${[1, 2, 3, 4, 5, 6, 7].map((wd) => {
      const items = plan.filter((p) => p.weekday === wd);
      return html`<div class="li"><span class="time" style=${wd === wdToday ? 'color:var(--accent);font-weight:700' : ''}>${wdShort(wd)}</span><span class="grow">${items.length ? items.map((p) => html`<div class="t">${p.type === 'pool' ? 'Бассейн' : p.type === 'strength' ? 'Силовая' : 'Тренировка'}${p.focus ? ` · ${p.focus}` : ''}${p.time ? ` · ${p.time}` : ''}</div>`) : html`<span class="muted">отдых</span>`}</span></div>`;
    })}</div>` : html`<${Empty} text="План составит недельный обзор Perplexity (data/training.json)."/>`}<//>
    <${Card} title="Рабочие веса">${Object.keys(ww).length ? html`<table class="t"><tr><th>Упражнение</th><th class="num">Вес × повт</th><th class="num">Дата</th></tr>
      ${Object.entries(ww).map(([ex, w]) => html`<tr><td>${ex}</td><td class="num">${w.kg} × ${w.reps}</td><td class="num muted">${w.date ? shortDate(w.date) : ''}</td></tr>`)}</table>` : html`<${Empty} text="Появятся после первой записанной силовой."/>`}<//>
    <${Card} title="Журнал (21 день)">${log.length ? html`<div class="list">${log.map((d) => d.training.map((t) => html`
      <div class="li"><span class="time">${shortDate(d.date)}</span><span class="grow"><div class="t">${{ strength: 'Силовая', pool: 'Бассейн', cardio: 'Кардио' }[t.type] || 'Тренировка'}${t.duration_min ? ` · ${t.duration_min} мин` : ''}${t.rpe ? ` · RPE ${t.rpe}` : ''}</div>
      ${t.sets?.length ? html`<div class="s">${t.sets.map((s) => `${s.ex} ${s.kg}×${s.reps}×${s.sets}`).join(' · ')}</div>` : null}${t.note ? html`<div class="s">${t.note}</div>` : null}</span></div>`))}</div>` : html`<${Empty} text="Записей пока нет."/>`}<//>`;
}

const LAB_PROMPT = 'Вот мои анализы (PDF/фото). Перенеси все значения в health-os-data/data/labs.json (results), отметь выходы за референс и субоптимальные для моих целей, обнови plan пересдачи и дай разбор: что меняем.';

function Labs() {
  const { loading, data } = useData(() => store.readJSON(P.labs, { results: [], plan: [] }));
  const [marker, setMarker] = useState(null);
  if (loading) return html`<div class="card"><${Skeleton}/></div>`;
  const results = data?.results || []; const plan = (data?.plan || []).filter((p) => p.status !== 'done');
  const byMarker = {};
  for (const r of results) (byMarker[r.marker] = byMarker[r.marker] || []).push(r);
  Object.values(byMarker).forEach((a) => a.sort((x, y) => x.date.localeCompare(y.date)));
  const flag = (r) => (r.ref_low != null && r.value < r.ref_low ? 'low' : r.ref_high != null && r.value > r.ref_high ? 'high' : null);
  const sel = marker && byMarker[marker];
  return html`
    ${plan.map((p) => { const d = p.due ? daysBetween(today(), p.due) : null; return html`<${Card} icon="flask" title=${p.name}>
      <div class="row between"><div class="big">${d == null ? 'дата не назначена' : d > 0 ? `через ${d} дн` : d === 0 ? 'сегодня' : `просрочено на ${-d} дн`}</div>${p.due && html`<${Badge} kind=${d < 0 ? 'bad' : d < 7 ? 'warn' : ''}>${shortDate(p.due)}<//>`}</div>
      ${p.items?.length > 0 && html`<div class="muted small" style="margin-top:6px">${p.items.join(', ')}</div>`}
      <div class="tiny" style="margin-top:6px">Натощак 8–12 ч, до 10:00, без тренировки накануне вечером.</div>
    <//>`; })}
    <${Card} title="Результаты" action=${html`<button class="link" onClick=${async () => { await copyText(LAB_PROMPT); toast('Промпт скопирован — вставь в Search вместе с PDF'); setTimeout(openPerplexity, 600); }}>+ Новые анализы</button>`}>
      ${Object.keys(byMarker).length ? html`<table class="t"><tr><th>Показатель</th><th class="num">Последнее</th><th class="num">Референс</th></tr>
        ${Object.entries(byMarker).map(([m, arr]) => { const r = arr[arr.length - 1]; const f = flag(r); return html`
          <tr onClick=${() => setMarker(marker === m ? null : m)} style="cursor:pointer"><td>${m}${arr.length > 1 ? html` <span class="tiny">· ${arr.length}</span>` : ''}</td>
          <td class="num"><b class=${f ? 'down' : ''}>${r.value}</b> <span class="tiny">${r.unit || ''}</span>${f ? html` <${Badge} kind="bad">${f === 'low' ? '↓' : '↑'}<//>` : ''}</td>
          <td class="num muted small">${r.ref_low ?? ''}–${r.ref_high ?? ''}</td></tr>`; })}</table>
        <p class="tiny">Нажми на показатель — откроется график.</p>` : html`<${Empty} text="Пока пусто. Отправь PDF анализов в Search-чат — кнопка «Новые анализы»."/>`}
    <//>
    ${sel && html`<${Card} title=${marker}><${Chart} dates=${sel.map((r) => r.date)} series=${[{ label: `${marker}, ${sel[0].unit || ''}`, values: sel.map((r) => r.value), color: '--c1' }]}/>
      <div class="tiny">Референс: ${sel[sel.length - 1].ref_low ?? '—'} – ${sel[sel.length - 1].ref_high ?? '—'} ${sel[0].unit || ''}</div><//>`}`;
}

const VERDICT = { works: ['работает', 'ok'], no: ['не работает', 'bad'], unclear: ['неясно', 'warn'] };
function Experiments() {
  const { loading, data } = useData(async () => ({ ex: await store.readJSON(P.experiments, { active: [], queue: [], closed: [] }), days: await store.loadDays(P.checkins, 45) }));
  if (loading) return html`<div class="card"><${Skeleton}/></div>`;
  const { ex, days } = data;
  return html`
    <div class="section-t">Активные</div>
    ${(ex.active || []).map((e) => {
      const n = Math.min(e.days || 0, daysBetween(e.start, today()) + 1);
      const win = days.filter((d) => d.date >= addDays(e.start, -7));
      const base = win.filter((d) => d.date < e.start).map((d) => metricOf(d, e.metric)).filter((v) => v != null);
      const during = win.filter((d) => d.date >= e.start).map((d) => metricOf(d, e.metric)).filter((v) => v != null);
      const a = (x) => (x.length ? (x.reduce((s, v) => s + v, 0) / x.length).toFixed(1).replace('.', ',') : '—');
      return html`<${Card} icon="flask" title=${`${e.id} · ${e.title || ''}`}>
        <div class="row between"><div class="small muted">${METRIC_LABELS[e.metric] || e.metric}</div><${Badge} kind="acc">день ${n} из ${e.days || '?'}<//></div>
        <div class="stats" style="margin:10px 0"><div class="stat"><div class="k">До (7 дн)</div><div class="v">${a(base)}</div></div><div class="stat"><div class="k">Во время</div><div class="v">${a(during)}</div></div></div>
        <${Sparkline} values=${win.map((d) => metricOf(d, e.metric))} width=${300} height=${40}/>
        ${e.success && html`<div class="small" style="margin-top:8px"><b>Успех:</b> ${e.success}</div>`}
        ${e.stop && html`<div class="small"><b>Стоп:</b> ${e.stop}</div>`}
      <//>`;
    })}
    ${!(ex.active || []).length && html`<${Empty} text="Активных экспериментов нет."/>`}
    ${(ex.queue || []).length > 0 && html`<div class="section-t">Очередь</div><${Card}><div class="list">${ex.queue.map((e) => html`<div class="li"><span class="grow"><div class="t">${e.id} · ${e.title || ''}</div><div class="s">${METRIC_LABELS[e.metric] || e.metric || ''}</div></span></div>`)}</div><//>`}
    ${(ex.closed || []).length > 0 && html`<div class="section-t">Закрытые</div><${Card}><div class="list">${ex.closed.map((e) => html`<div class="li"><span class="grow"><div class="t">${e.id} · ${e.title || ''}</div><div class="s">${e.summary || ''}</div></span>${e.verdict && html`<${Badge} kind=${VERDICT[e.verdict]?.[1]}>${VERDICT[e.verdict]?.[0] || e.verdict}<//>`}</div>`)}</div><//>`}`;
}
