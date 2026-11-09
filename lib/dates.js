// Date helpers. All dates are local (the phone is in Asia/Qyzylorda).
const pad = (n) => String(n).padStart(2, '0');

export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const today = () => ymd(new Date());
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
export const range = (from, to) => { const out = []; for (let s = from; s <= to; s = addDays(s, 1)) out.push(s); return out; };
export const weekday = (s = today()) => { const w = parseYmd(s).getDay(); return w === 0 ? 7 : w; }; // 1=Mon..7=Sun

// ISO week label, e.g. 2026-W46
export const isoWeek = (s = today()) => {
  const d = parseYmd(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const y = d.getFullYear(); const jan4 = new Date(y, 0, 4);
  const w = 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${y}-W${pad(w)}`;
};

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WD_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const longDate = (s = today()) => { const d = parseYmd(s); return `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const shortDate = (s) => { const d = parseYmd(s); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };
export const wdShort = (n) => WD_SHORT[n];

// "через 2 д 4 ч" / "через 35 мин" / "просрочено на 3 ч"
export const humanDelta = (ms) => {
  const late = ms < 0; let m = Math.round(Math.abs(ms) / 60000);
  const d = Math.floor(m / 1440); m -= d * 1440; const h = Math.floor(m / 60); m -= h * 60;
  const parts = d ? [`${d} д`, h ? `${h} ч` : ''] : h ? [`${h} ч`, m ? `${m} мин` : ''] : [`${m} мин`];
  const txt = parts.filter(Boolean).join(' ');
  return late ? `просрочено на ${txt}` : `через ${txt}`;
};

export const greeting = (d = new Date()) => {
  const h = d.getHours();
  return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
};
