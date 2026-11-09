import { html, useData, useState, Card, Segmented, Chart, Skeleton, Empty } from './ui.js';
import { store, P } from '../lib/store.js';
import { today, addDays } from '../lib/dates.js';

const avg = (a) => { const v = a.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const fmt = (x, d = 1) => (x == null ? '—' : x.toFixed(d).replace('.', ','));

export function Trends() {
  const [days, setDays] = useState(30);
  const { loading, data } = useData(async () => {
    const [checkins, meals, injections, protocol, garmin] = await Promise.all([
      store.loadDays(P.checkins, days), store.loadDays(P.meals, days), store.readJSON(P.injections, []),
      store.readJSON(P.protocol, { active: [] }), store.readJSON(P.garmin, []),
    ]);
    return { checkins, meals, injections, protocol, garmin };
  }, [days]);

  const head = html`<div class="top"><h1>Тренды</h1><div class="sub">Пунктир — инъекции и изменения протокола</div></div>
    <${Segmented} options=${[[14, '14 дней'], [30, '30 дней'], [90, '90 дней']]} value=${days} onChange=${setDays}/>`;
  if (loading) return html`${head}<div class="card"><${Skeleton} lines=${5}/></div>`;
  if (!data) return html`${head}<${Empty} text="Не удалось загрузить данные."/>`;

  const { checkins, meals, injections, protocol, garmin } = data;
  const dates = checkins.map((c) => c.date);
  const from = dates[0];
  const get = (part, k) => checkins.map((c) => c[part]?.[k] ?? null);
  const markers = [
    ...(injections || []).filter((i) => i.at.slice(0, 10) >= from).map((i) => ({ date: i.at.slice(0, 10), label: 'инъекция' })),
    ...(protocol?.active || []).filter((p) => p.since && p.since >= from).map((p) => ({ date: p.since, label: `старт ${p.name}` })),
    ...(protocol?.stopped || []).filter((p) => p.date && p.date >= from).map((p) => ({ date: p.date, label: `стоп ${p.name}` })),
  ];

  // adherence % per day
  const intakeIds = []; for (const it of (protocol?.active || []).filter((x) => x.kind !== 'injection')) for (const _ of it.times || []) intakeIds.push(it.id);
  const uniq = [...new Set(intakeIds)];
  const adherence = checkins.map((c) => (uniq.length && (c.morning || c.evening || c.adherence) ? Math.round((uniq.filter((id) => c.adherence?.[id]).length / uniq.length) * 100) : null));

  const half = Math.floor(checkins.length / 2);
  const cmp = (arr) => [avg(arr.slice(0, half)), avg(arr.slice(half))];
  const energy = get('morning', 'energy');
  const [e1, e2] = cmp(energy);
  const weight = get('morning', 'weight_kg');
  const w = weight.filter((x) => x != null);
  const protein = meals.map((m) => m.totals?.protein_g ?? null);
  const kcal = meals.map((m) => m.totals?.kcal ?? null);

  const gRows = (garmin || []).filter((r) => r.date >= from);
  const gDates = gRows.map((r) => r.date);
  const hasGarmin = gRows.some((r) => r.hrv != null || r.sleep_h != null);

  const delta = (a, b, better = 'up') => (a == null || b == null ? '' : (() => { const d = b - a; const cls = better === 'none' || Math.abs(d) < 0.2 ? 'flat' : (better === 'up' ? d > 0 : d < 0) ? 'up' : 'down'; return html`<div class="d ${cls}">${d > 0 ? '+' : ''}${fmt(d)} к началу периода</div>`; })());

  return html`${head}
    <div class="stats" style="margin-bottom:12px">
      <div class="stat"><div class="k">Энергия утром</div><div class="v">${fmt(avg(energy))}</div>${delta(e1, e2)}</div>
      <div class="stat"><div class="k">Вес</div><div class="v">${w.length ? fmt(w[w.length - 1]) : '—'}</div>${w.length > 1 ? delta(w[0], w[w.length - 1], 'none') : ''}</div>
      <div class="stat"><div class="k">Протокол</div><div class="v">${adherence.some((x) => x != null) ? Math.round(avg(adherence)) + '%' : '—'}</div></div>
      <div class="stat"><div class="k">Белок, г/день</div><div class="v">${protein.some((x) => x != null) ? Math.round(avg(protein)) : '—'}</div></div>
    </div>

    <${Card} title="Энергия и сон"><${Chart} dates=${dates} markers=${markers} yRange=${[0, 10]} series=${[
      { label: 'Энергия утром', values: energy, color: '--c1' }, { label: 'Ощущение сна', values: get('morning', 'sleep_feel'), color: '--c2' }, { label: 'Энергия днём', values: get('evening', 'energy_day'), color: '--c3' }]}/><//>
    <${Card} title="Настроение, фокус, стресс"><${Chart} dates=${dates} markers=${markers} yRange=${[0, 10]} series=${[
      { label: 'Настроение утром', values: get('morning', 'mood'), color: '--c1' }, { label: 'Фокус', values: get('evening', 'focus'), color: '--c2' }, { label: 'Стресс', values: get('evening', 'stress'), color: '--c3' }]}/><//>
    <${Card} title="Голос"><${Chart} dates=${dates} markers=${markers} yRange=${[0, 10]} series=${[
      { label: 'Утром', values: get('morning', 'voice'), color: '--c1' }, { label: 'Вечером', values: get('evening', 'voice'), color: '--c4' }]}/><//>
    <${Card} title="Аппетит и ЖКТ"><${Chart} dates=${dates} markers=${markers} yRange=${[0, 10]} series=${[
      { label: 'Аппетит', values: get('evening', 'appetite'), color: '--c2' }, { label: 'ЖКТ', values: get('evening', 'gi'), color: '--c3' }]}/><//>
    <${Card} title="Вес, кг"><${Chart} dates=${dates} markers=${markers} series=${[{ label: 'Вес', values: weight, color: '--c1' }]}/><//>
    <${Card} title="Питание"><${Chart} dates=${dates} series=${[{ label: 'Белок, г', values: protein, color: '--c1' }, { label: 'Ккал', values: kcal, color: '--c3', scale: 'y2' }]}/><//>
    <${Card} title="Соблюдение протокола, %"><${Chart} dates=${dates} markers=${markers} yRange=${[0, 100]} series=${[{ label: 'Принято от плана', values: adherence, color: '--c2' }]}/><//>
    ${hasGarmin && html`
      <${Card} title="Garmin: HRV и пульс покоя"><${Chart} dates=${gDates} series=${[{ label: 'HRV', values: gRows.map((r) => r.hrv ?? null), color: '--c1' }, { label: 'Пульс покоя', values: gRows.map((r) => r.rhr ?? null), color: '--c3', scale: 'y2' }]}/><//>
      <${Card} title="Garmin: сон, ч"><${Chart} dates=${gDates} series=${[{ label: 'Сон', values: gRows.map((r) => r.sleep_h ?? null), color: '--c2' }]}/><//>`}
  `;
}
