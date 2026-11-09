import { html, useData, useStatus, useState, useEffect, Card, Skeleton, Empty, Icon, Badge, Sparkline, Markdown, toast, haptic, metricOf, METRIC_LABELS } from './ui.js';
import { store, P } from '../lib/store.js';
import { today, longDate, greeting, hm, humanDelta, weekday, addDays, daysBetween } from '../lib/dates.js';

export function nextInjection(protocol, injections) {
  const out = [];
  for (const it of (protocol?.active || []).filter((x) => x.kind === 'injection' && x.schedule?.every_days)) {
    const last = (injections || []).filter((x) => x.drug_id === it.id).map((x) => x.at).sort().pop();
    const time = it.schedule.time || '21:00';
    const day = last ? addDays(last.slice(0, 10), it.schedule.every_days) : today();
    const due = new Date(`${day}T${time}:00`);
    out.push({ item: it, last, due });
  }
  return out.sort((a, b) => a.due - b.due);
}

function useNow(ms = 60000) { const [n, set] = useState(Date.now()); useEffect(() => { const id = setInterval(() => set(Date.now()), ms); return () => clearInterval(id); }, []); return n; }

export function Today({ go, openSheet }) {
  const T = today();
  const now = useNow();
  const { loading, data } = useData(async () => {
    const [checkin, protocol, injections, training, experiments, alerts, brief, briefEve, garmin] = await Promise.all([
      store.checkin(T), store.readJSON(P.protocol, { active: [] }), store.readJSON(P.injections, []),
      store.readJSON(P.training, { plan: [] }), store.readJSON(P.experiments, { active: [] }), store.readJSON(P.alerts, []),
      store.readText(`${P.briefings}/${T}.md`), store.readText(`${P.briefings}/${T}-evening.md`), store.readJSON(P.garmin, []),
    ]);
    const recent = experiments?.active?.length ? await store.loadDays(P.checkins, 21) : [];
    return { checkin, protocol, injections, training, experiments, alerts, brief, briefEve, garmin, recent };
  });

  if (loading) return html`<${Header}/><div class="card"><${Skeleton} lines=${4}/></div><div class="card"><${Skeleton}/></div>`;
  if (!data) return html`<${Header}/><${Empty} text="Не удалось загрузить данные. Проверь сеть и токен в Настройках."/>`;
  const { checkin, protocol, injections, training, experiments, alerts, brief, briefEve, garmin, recent } = data;

  const activeAlerts = (alerts || []).filter((a) => !a.until || a.until >= T);
  const intakes = [];
  for (const it of (protocol?.active || []).filter((x) => x.kind !== 'injection')) for (const t of it.times || []) intakes.push({ ...it, time: t });
  intakes.sort((a, b) => a.time.localeCompare(b.time));
  const adherence = checkin?.adherence || {};
  const taken = intakes.filter((i) => adherence[i.id]).length;
  const plan = (training?.plan || []).filter((p) => p.weekday === weekday(T));
  const trainedToday = (checkin?.training || []).length > 0;
  const inj = nextInjection(protocol, injections);
  const hour = new Date().getHours();
  const showEvening = briefEve && hour >= 18;

  const toggle = async (id) => { haptic(); await store.toggleAdherence(id); };

  return html`
    <${Header} checkin=${checkin}/>

    ${activeAlerts.map((a) => html`<${Card} cls=${a.level || 'info'} icon="alert" title=${a.level === 'critical' ? 'Важно' : a.level === 'warn' ? 'Внимание' : 'Заметка'}><div>${a.text}</div><//>`)}

    <${Card} cls="accent" icon="spark" title=${showEvening ? 'Итог дня' : 'Брифинг'} action=${(brief || briefEve) && html`<button class="link" onClick=${() => openSheet('brief', { brief, briefEve })}>Полностью</button>`}>
      ${showEvening ? html`<div class="clamp"><${Markdown} src=${briefEve}/></div>`
        : brief ? html`<div class="clamp"><${Markdown} src=${brief}/></div>`
        : html`<div class="muted small">${hour < 8 ? 'Утренний брифинг придёт около 07:40.' : 'Сегодня брифинга нет — задачи Perplexity его ещё не записали.'}</div>`}
    <//>

    <div class="quick">
      <button class="qa" onClick=${() => go('checkin')}><${Icon} name="heart"/>Чек-ин</button>
      <button class="qa" onClick=${() => openSheet('food')}><${Icon} name="food"/>Еда</button>
      <button class="qa" onClick=${() => openSheet('training')}><${Icon} name="dumbbell"/>Тренировка</button>
      <button class="qa" onClick=${() => openSheet('note')}><${Icon} name="note"/>Заметка</button>
    </div>

    <${Card} icon="clock" title="План дня" action=${intakes.length ? html`<span class="muted small">${taken} из ${intakes.length}</span>` : null}>
      <div class="list">
        ${intakes.map((i) => html`
          <button class="li tap" onClick=${() => toggle(i.id)} aria-pressed=${!!adherence[i.id]}>
            <span class="time">${i.time}</span>
            <span class="grow"><div class="t">${i.name}</div><div class="s">${i.dose || ''}${adherence[i.id] ? ` · принято в ${adherence[i.id]}` : ''}</div></span>
            <span class="check ${adherence[i.id] ? 'on' : ''}">${adherence[i.id] && html`<${Icon} name="check" size=${16}/>`}</span>
          </button>`)}
        ${plan.map((p) => html`
          <button class="li tap" onClick=${() => openSheet('training')}>
            <span class="time">${p.time || '—'}</span>
            <span class="grow"><div class="t">${p.type === 'pool' ? 'Бассейн' : p.type === 'strength' ? 'Силовая' : 'Тренировка'}${p.focus ? ` · ${p.focus}` : ''}</div><div class="s">${trainedToday ? 'записано' : 'запланировано'}</div></span>
            <span class="check ${trainedToday ? 'on' : ''}">${trainedToday && html`<${Icon} name="check" size=${16}/>`}</span>
          </button>`)}
        ${inj.map(({ item, due, last }) => {
          const ms = due - now; const soon = ms < 36e5 * 24;
          return html`<button class="li tap" onClick=${() => openSheet('injection', { item })}>
            <span class="time"><${Icon} name="syringe" size=${18}/></span>
            <span class="grow"><div class="t">${item.name} ${item.dose || ''}</div><div class="s">${last ? humanDelta(ms) : 'нет записей — отметь последнюю инъекцию'}</div></span>
            ${last && html`<${Badge} kind=${ms < 0 ? 'bad' : soon ? 'warn' : ''}>${due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${hm(due)}<//>`}
          </button>`;
        })}
        ${!intakes.length && !plan.length && !inj.length && html`<${Empty} text="Протокол пуст. Он заполняется в data/protocol.json через Perplexity."/>`}
      </div>
    <//>

    ${(experiments?.active || []).map((e) => {
      const day = Math.min(e.days || 0, daysBetween(e.start, T) + 1);
      const vals = recent.filter((c) => c.date >= e.start).map((c) => metricOf(c, e.metric));
      return html`<${Card} icon="flask" title=${`${e.id} · ${e.title || ''}`} action=${html`<button class="link" onClick=${() => go('plan', 'experiments')}>Все</button>`}>
        <div class="row between"><div><div class="small muted">${METRIC_LABELS[e.metric] || e.metric}</div><div class="small">день ${day} из ${e.days || '?'}</div></div><${Sparkline} values=${vals}/></div>
        <div class="progress" style="margin-top:10px"><i style=${`width:${Math.round((day / (e.days || 1)) * 100)}%`}></i></div>
      <//>`;
    })}

    <${GarminCard} garmin=${garmin}/>
  `;
}

function Header({ checkin }) {
  const m = checkin?.morning; const e = checkin?.evening;
  return html`<div class="top">
    <h1>${greeting()}</h1>
    <div class="sub">${longDate()}</div>
    ${checkin !== undefined && html`<div class="statusbar">
      <${Badge} kind=${m ? 'ok' : ''}>${m ? '✓' : '○'} утро<//>
      <${Badge} kind=${e ? 'ok' : ''}>${e ? '✓' : '○'} вечер<//>
      <${SyncBadge}/>
    </div>`}
  </div>`;
}

export function SyncBadge() {
  const s = useStatus();
  if (store.demo) return html`<${Badge} kind="acc">демо<//>`;
  if (s.syncing) return html`<${Badge}>синхронизация…<//>`;
  if (s.pending) return html`<${Badge} kind="warn">${s.pending} ждёт отправки<//>`;
  if (s.error) return html`<${Badge} kind="bad">ошибка связи<//>`;
  return null;
}

function GarminCard({ garmin }) {
  const rows = (garmin || []).filter((r) => r && (r.sleep_h != null || r.hrv != null || r.rhr != null));
  if (!rows.length) return null; // Garmin is optional
  const last = rows[rows.length - 1];
  const med = (k) => { const v = rows.map((r) => r[k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const stat = (label, k, unit, better = 'up') => {
    const v = last[k]; const m = med(k); if (v == null) return null;
    const diff = m != null ? v - m : 0; const good = better === 'up' ? diff >= 0 : diff <= 0;
    return html`<div class="stat"><div class="k">${label}</div><div class="v">${v}${unit}</div>${m != null && html`<div class="d ${Math.abs(diff) < 0.05 * (m || 1) ? 'flat' : good ? 'up' : 'down'}">норма ${m}${unit}</div>`}</div>`;
  };
  return html`<${Card} icon="heart" title="Garmin" action=${html`<span class="tiny">${last.date === today() ? 'сегодня' : last.date}</span>`}>
    <div class="stats">${stat('Сон', 'sleep_h', ' ч')}${stat('HRV', 'hrv', '')}${stat('Пульс покоя', 'rhr', '', 'down')}${stat('Body Battery', 'bb_wake', '')}</div>
  <//>`;
}
