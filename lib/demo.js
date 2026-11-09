// Fictional demo data (no real personal data — this file is public).
import { today, addDays, ymd, weekday, isoWeek } from './dates.js';

const rnd = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

export function buildDemo() {
  const r = rnd(42);
  const clamp = (v) => Math.max(0, Math.min(10, Math.round(v)));
  const T = today(); const files = {};
  const put = (p, obj) => { files[p] = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1); };

  const protocol = {
    updated: T,
    active: [
      { id: 'omega3', name: 'Омега-3', kind: 'supplement', dose: '2 г', times: ['09:00'], days: 'daily', purpose: 'липиды, воспаление', since: addDays(T, -40) },
      { id: 'vitc', name: 'Витамин C', kind: 'supplement', dose: '500 мг', times: ['09:00'], days: 'daily', purpose: 'демо', since: addDays(T, -20) },
      { id: 'mg', name: 'Магний (демо)', kind: 'supplement', dose: '200 мг', times: ['22:00'], days: 'daily', purpose: 'сон', since: addDays(T, -10) },
      { id: 'drugx', name: 'Препарат X (демо)', kind: 'injection', dose: '1 мг', times: [], days: 'weekly', schedule: { every_days: 7, time: '21:00' }, since: addDays(T, -60) },
    ],
    candidates: [
      { id: 'creatine', name: 'Креатин', verdict: 'брать после анализов', evidence: 'A', next_step: 'креатинин/рСКФ' },
      { id: 'carnitine', name: 'Карнитин', verdict: 'не брать', evidence: 'B' },
    ],
    stopped: [{ id: 'old', name: 'Старый БАД (демо)', date: addDays(T, -30), reason: 'нет эффекта' }],
  };
  put('data/protocol.json', protocol);

  const inj = []; for (let i = 8; i >= 1; i--) inj.push({ at: `${addDays(T, -i * 7 + 2)}T21:00:00+05:00`, drug_id: 'drugx', dose_mg: 1, site: ['живот слева', 'живот справа', 'бедро слева', 'бедро справа'][i % 4] });
  put('data/injections.json', inj);

  put('data/training.json', {
    plan: [{ weekday: 1, type: 'strength', focus: 'верх' }, { weekday: 3, type: 'strength', focus: 'низ' }, { weekday: 4, type: 'pool', focus: 'техника' }, { weekday: 6, type: 'strength', focus: 'всё тело' }],
    working_weights: { 'Жим лёжа': { kg: 60, reps: 8, date: addDays(T, -2) }, 'Присед': { kg: 80, reps: 6, date: addDays(T, -4) }, 'Тяга штанги': { kg: 70, reps: 8, date: addDays(T, -2) } },
    pool: { per_week: 1 },
  });

  put('data/experiments.json', {
    active: [{ id: 'E-001', title: 'Магний вечером → сон', start: addDays(T, -5), days: 14, metric: 'morning.sleep_feel', success: '+2 балла к ощущению сна', stop: 'ЖКТ-симптомы' }],
    queue: [{ id: 'E-002', title: 'Без кофе после 13:00', metric: 'morning.energy' }],
    closed: [{ id: 'E-000', title: 'Утренняя прогулка 20 мин', verdict: 'works', summary: '+1,5 к энергии утром за 2 недели' }],
  });

  put('data/labs.json', {
    results: [
      { date: addDays(T, -180), marker: 'Ферритин', value: 38, unit: 'нг/мл', ref_low: 30, ref_high: 400 },
      { date: addDays(T, -60), marker: 'Ферритин', value: 52, unit: 'нг/мл', ref_low: 30, ref_high: 400 },
      { date: addDays(T, -60), marker: '25-OH витамин D', value: 18, unit: 'нг/мл', ref_low: 30, ref_high: 100 },
      { date: addDays(T, -60), marker: 'ТТГ', value: 2.1, unit: 'мМЕ/л', ref_low: 0.4, ref_high: 4.0 },
      { date: addDays(T, -60), marker: 'Тестостерон общий', value: 14.2, unit: 'нмоль/л', ref_low: 8.6, ref_high: 29 },
    ],
    plan: [{ name: 'Контроль D и ферритина (демо)', due: addDays(T, 12), items: ['25-OH D', 'Ферритин', 'ОАК'], status: 'planned' }],
  });

  put('data/alerts.json', [{ date: T, level: 'warn', text: 'Демо: 2 дня подряд энергия утром ниже твоей нормы — сегодня лёгкая тренировка.', until: addDays(T, 2) }]);
  put('data/feedback.json', []);

  let e = 6, s = 6, v = 7, w = 80.5;
  for (let i = 29; i >= 0; i--) {
    const d = addDays(T, -i);
    e += (r() - 0.5) * 2.4; s += (r() - 0.5) * 2; v += (r() - 0.5) * 2; w -= 0.05 + (r() - 0.5) * 0.3;
    const c = {
      date: d,
      morning: { time: '07:50', energy: clamp(e), mood: clamp(e + r() * 2 - 1), sleep_feel: clamp(s), voice: clamp(v + 1), weight_kg: Math.round(w * 10) / 10, note: '' },
      adherence: { omega3: '09:05', ...(r() > 0.15 ? { vitc: '09:05' } : {}), ...(r() > 0.2 ? { mg: '22:10' } : {}) },
    };
    if (i > 0) c.evening = { time: '22:15', energy_day: clamp(e - 1 + r() * 2), focus: clamp(e + r() * 2 - 1), mood: clamp(e), voice: clamp(v - 2), stress: clamp(5 + (r() - 0.5) * 4), appetite: clamp(4 + (r() - 0.5) * 4), gi: clamp(2 + (r() - 0.5) * 3), caffeine: ['08:30'] };
    const wd = weekday(d);
    if ([1, 3, 6].includes(wd)) c.training = [{ type: 'strength', duration_min: 60, rpe: 8, sets: [{ ex: 'Жим лёжа', kg: 57.5 + (29 - i) / 12, reps: 8, sets: 3 }] }];
    if (wd === 4) c.training = [{ type: 'pool', duration_min: 40, rpe: 6 }];
    put(`data/checkins/${d}.json`, c);
    const p = 110 + Math.round(r() * 60);
    put(`data/meals/${d}.json`, { date: d, items: [], totals: { kcal: 1900 + Math.round(r() * 600), protein_g: p, fat_g: 70, carbs_g: 200 } });
  }
  const g = []; for (let i = 13; i >= 0; i--) g.push({ date: addDays(T, -i), sleep_h: +(6.3 + r() * 1.8).toFixed(1), hrv: Math.round(55 + (r() - 0.5) * 20), rhr: Math.round(54 + (r() - 0.5) * 8), bb_wake: Math.round(55 + r() * 35), stress: Math.round(25 + r() * 15), steps: Math.round(6000 + r() * 6000) });
  put('garmin/daily.json', g);

  put(`data/meals/${T}.json`, { date: T, items: [{ time: '08:30', desc: 'Омлет из 3 яиц, хлеб', kcal: 420, protein_g: 24, fat_g: 26, carbs_g: 22, confidence: 'medium', advice: 'Белка мало для завтрака — добавь творог.', source: 'manual' }], totals: { kcal: 420, protein_g: 24, fat_g: 26, carbs_g: 22 } });

  put(`data/briefings/${T}.md`, `**Восстановление в норме**, сон чуть короче обычного (6 ч 40 мин).\n\n- Тренировка: **по плану** (верх), рабочие веса без повышения.\n- Главное на день: 140 г белка — вчера было 110.\n- Эксперимент E-001: день 6 из 14, отметь ощущение сна утром.`);
  put(`data/reviews/${isoWeek(addDays(T, -7))}.md`, `# Неделя ${isoWeek(addDays(T, -7))} (демо)\n\n## Тренды\n- Энергия утром: 6,2 (неделей раньше 5,4)\n- Вес: −0,4 кг\n\n## Эксперименты\n- E-000 закрыт: **работает**.\n\n## Топ-3 на неделю\n1. Белок ≥ 140 г\n2. Сон до 23:30\n3. Силовые 3 раза`);
  return files;
}
