// Build an .ics calendar on the device (no server): injections, intakes, training, lab dates.
import { today, addDays, parseYmd } from './dates.js';

const pad = (n) => String(n).padStart(2, '0');
const dt = (dateStr, time) => `${dateStr.replace(/-/g, '')}T${time.replace(':', '')}00`;
const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
const BYDAY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const TZ = 'Asia/Qyzylorda';

function event({ uid, summary, start, end, rrule, alarmMin = 15, desc = '' }) {
  return [
    'BEGIN:VEVENT', `UID:${uid}@health-os`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=${TZ}:${start}`, `DTEND;TZID=${TZ}:${end}`, `SUMMARY:${esc(summary)}`,
    desc ? `DESCRIPTION:${esc(desc)}` : null, rrule ? `RRULE:${rrule}` : null,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, `TRIGGER:-PT${alarmMin}M`, 'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
}

const plus = (time, min) => { const [h, m] = time.split(':').map(Number); const t = h * 60 + m + min; return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`; };

export function buildICS({ protocol, injections, training, labs }) {
  const events = []; const T = today();
  const active = protocol?.active || [];

  // daily intakes, grouped by time
  const byTime = {};
  for (const it of active) if (it.kind !== 'injection') for (const t of it.times || []) (byTime[t] = byTime[t] || []).push(`${it.name} ${it.dose || ''}`.trim());
  for (const [t, names] of Object.entries(byTime)) {
    events.push(event({ uid: `intake-${t.replace(':', '')}`, summary: `Приём: ${names.join(', ')}`, start: dt(T, t), end: dt(T, plus(t, 10)), rrule: 'FREQ=DAILY', alarmMin: 0 }));
  }

  // injections: next due from last log, repeat every N days
  for (const it of active.filter((x) => x.kind === 'injection' && x.schedule?.every_days)) {
    const last = (injections || []).filter((x) => x.drug_id === it.id).map((x) => x.at).sort().pop();
    const time = it.schedule.time || '21:00';
    let next = last ? addDays(last.slice(0, 10), it.schedule.every_days) : T;
    while (next < T) next = addDays(next, it.schedule.every_days);
    events.push(event({ uid: `inj-${it.id}`, summary: `Инъекция: ${it.name} ${it.dose || ''}`.trim(), start: dt(next, time), end: dt(next, plus(time, 15)), rrule: `FREQ=DAILY;INTERVAL=${it.schedule.every_days}`, alarmMin: 60 }));
  }

  // training plan
  for (const p of training?.plan || []) {
    const name = p.type === 'pool' ? 'Бассейн' : p.type === 'strength' ? 'Силовая' : 'Тренировка';
    const time = p.time || '19:00';
    let d = T; while ((parseYmd(d).getDay() || 7) !== p.weekday) d = addDays(d, 1);
    events.push(event({ uid: `train-${p.weekday}-${p.type}`, summary: `${name}${p.focus ? ': ' + p.focus : ''}`, start: dt(d, time), end: dt(d, plus(time, 60)), rrule: `FREQ=WEEKLY;BYDAY=${BYDAY[p.weekday]}`, alarmMin: 60 }));
  }

  // lab plan (one-off, morning)
  for (const [i, l] of (labs?.plan || []).entries()) if (l.status !== 'done' && l.due) {
    events.push(event({ uid: `labs-${i}-${l.due}`, summary: `Анализы: ${l.name}`, desc: (l.items || []).join(', ') + '. Натощак, до 10:00.', start: dt(l.due, '08:00'), end: dt(l.due, '09:00'), alarmMin: 720 }));
  }

  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Health OS//RU', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Health OS', ...events, 'END:VCALENDAR'].join('\r\n');
}

export async function shareICS(text) {
  const file = new File([text], 'health-os.ics', { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Health OS — календарь' }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'health-os.ics' });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
