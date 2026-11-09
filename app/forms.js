import { html, useData, useState, Field, Icon, toast, haptic, copyText, openPerplexity, Markdown, Segmented } from './ui.js';
import { store, P } from '../lib/store.js';
import { today, hm, shortDate } from '../lib/dates.js';

export const SITES = ['живот слева', 'живот справа', 'бедро слева', 'бедро справа', 'плечо слева', 'плечо справа'];

// ---------- injection ----------
export function InjectionForm({ item, done }) {
  const { data } = useData(() => store.readJSON(P.injections, []));
  const hist = (data || []).filter((x) => !item || x.drug_id === item.id);
  const lastUse = (s) => hist.filter((x) => x.site === s).map((x) => x.at).sort().pop() || '';
  const suggested = [...SITES].sort((a, b) => lastUse(a).localeCompare(lastUse(b)))[0];
  const doseNum = parseFloat(String(item?.dose || '').replace(',', '.')) || null;
  const [site, setSite] = useState(null);
  const [dose, setDose] = useState(doseNum);
  const [date, setDate] = useState(today());
  const [time, setTime] = useState(hm());
  const [note, setNote] = useState('');
  const save = async () => {
    await store.addInjection({ at: `${date}T${time}:00+05:00`, drug_id: item?.id || 'unknown', dose_mg: dose, site: site || suggested, note });
    haptic(); toast('Инъекция записана'); done?.();
  };
  return html`
    <p class="muted small" style="margin-top:0">${item?.name || ''} ${item?.dose || ''} · рекомендуемое место: <b>${suggested}</b> (дольше всего не использовалось)</p>
    <${Field} label="Место"><div class="chips">${SITES.map((s) => html`<button class="chip ${(site || suggested) === s ? 'on' : ''}" onClick=${() => setSite(s)}>${s}</button>`)}</div><//>
    <${Field} label="Доза, мг"><input type="number" inputmode="decimal" step="0.1" value=${dose ?? ''} onInput=${(e) => setDose(e.target.value === '' ? null : Number(e.target.value))}/><//>
    <div class="grid2">
      <${Field} label="Дата"><input type="date" value=${date} onInput=${(e) => setDate(e.target.value)}/><//>
      <${Field} label="Время"><input type="time" value=${time} onInput=${(e) => setTime(e.target.value)}/><//>
    </div>
    <${Field} label="Заметка"><input type="text" value=${note} onInput=${(e) => setNote(e.target.value)} placeholder="самочувствие, реакция…"/><//>
    <button class="btn primary block" onClick=${save}>Записать инъекцию</button>
    ${hist.length > 0 && html`<div class="section-t">История</div><div class="list">${[...hist].reverse().slice(0, 8).map((x) => html`
      <div class="li"><span class="grow"><div class="t">${shortDate(x.at.slice(0, 10))} · ${x.at.slice(11, 16)}</div><div class="s">${x.site || '—'}${x.note ? ` · ${x.note}` : ''}</div></span><span class="muted small">${x.dose_mg ?? ''} мг</span></div>`)}</div>`}
  `;
}

// ---------- training ----------
const TYPES = [['strength', 'Силовая'], ['pool', 'Бассейн'], ['cardio', 'Кардио'], ['other', 'Другое']];
export function TrainingForm({ done }) {
  const { data: tr } = useData(() => store.readJSON(P.training, { working_weights: {} }));
  const ww = tr?.working_weights || {};
  const [type, setType] = useState('strength');
  const [duration, setDuration] = useState(60);
  const [rpe, setRpe] = useState(7);
  const [sets, setSets] = useState([{ ex: '', kg: '', reps: '', sets: 3 }]);
  const [note, setNote] = useState('');
  const upd = (i, k, v) => setSets((s) => s.map((row, j) => (j === i ? { ...row, [k]: v, ...(k === 'ex' && ww[v] && row.kg === '' ? { kg: ww[v].kg, reps: ww[v].reps } : {}) } : row)));
  const save = async () => {
    const clean = sets.filter((s) => s.ex).map((s) => ({ ex: s.ex.trim(), kg: Number(s.kg) || 0, reps: Number(s.reps) || 0, sets: Number(s.sets) || 1 }));
    await store.addTraining({ type, duration_min: Number(duration) || null, rpe: Number(rpe) || null, ...(type === 'strength' ? { sets: clean } : {}), note, time: hm() });
    haptic(); toast('Тренировка записана'); done?.();
  };
  return html`
    <${Segmented} options=${TYPES} value=${type} onChange=${setType}/>
    <div class="grid2">
      <${Field} label="Длительность, мин"><input type="number" inputmode="numeric" value=${duration} onInput=${(e) => setDuration(e.target.value)}/><//>
      <${Field} label="Тяжесть (RPE 1–10)"><input type="number" inputmode="numeric" min="1" max="10" value=${rpe} onInput=${(e) => setRpe(e.target.value)}/><//>
    </div>
    ${type === 'strength' && html`
      <datalist id="exlist">${Object.keys(ww).map((x) => html`<option value=${x}/>`)}</datalist>
      <div class="field-l" style="margin-bottom:6px">Упражнения · вес × повторы × подходы</div>
      ${sets.map((s, i) => html`<div class="card" style="background:var(--card-2);padding:10px;margin-bottom:8px">
        <input type="text" list="exlist" placeholder="Упражнение" value=${s.ex} onInput=${(e) => upd(i, 'ex', e.target.value)} style="margin-bottom:8px;background:var(--card)"/>
        <div class="grid3">
          <input type="number" inputmode="decimal" placeholder="кг" value=${s.kg} onInput=${(e) => upd(i, 'kg', e.target.value)} style="background:var(--card)"/>
          <input type="number" inputmode="numeric" placeholder="повт" value=${s.reps} onInput=${(e) => upd(i, 'reps', e.target.value)} style="background:var(--card)"/>
          <input type="number" inputmode="numeric" placeholder="подх" value=${s.sets} onInput=${(e) => upd(i, 'sets', e.target.value)} style="background:var(--card)"/>
        </div>
        ${ww[s.ex] && html`<div class="tiny" style="margin-top:6px">Рабочий: ${ww[s.ex].kg} кг × ${ww[s.ex].reps} (${shortDate(ww[s.ex].date)})</div>`}
      </div>`)}
      <button class="btn small" onClick=${() => setSets((s) => [...s, { ex: '', kg: '', reps: '', sets: 3 }])} style="margin-bottom:12px">+ упражнение</button>`}
    <${Field} label="Заметка"><input type="text" value=${note} onInput=${(e) => setNote(e.target.value)} placeholder="самочувствие, пульс, что получилось"/><//>
    <button class="btn primary block" onClick=${save}>Записать тренировку</button>
  `;
}

// ---------- food ----------
export const FOOD_PROMPT = `Оцени блюдо на фото (или по описанию): блюдо, порция, ккал, белки/жиры/углеводы, уверенность (low/medium/high) и 1–2 строки совета под мою рекомпозицию и белок. Затем запиши пункт в health-os-data/data/meals/${'{DATE}'}.json (source: "search") и обнови totals.`;

export function FoodForm({ done }) {
  const [mode, setMode] = useState('photo');
  const [f, setF] = useState({ desc: '', kcal: '', protein_g: '', fat_g: '', carbs_g: '', time: hm() });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const sendToPerplexity = async () => {
    await copyText(FOOD_PROMPT.replace('{DATE}', today()));
    toast('Промпт скопирован — вставь его в Search-чат вместе с фото');
    setTimeout(openPerplexity, 600);
  };
  const save = async () => {
    if (!f.desc) return toast('Опиши блюдо', 'err');
    await store.addMeal({ time: f.time, desc: f.desc, kcal: Number(f.kcal) || null, protein_g: Number(f.protein_g) || null, fat_g: Number(f.fat_g) || null, carbs_g: Number(f.carbs_g) || null, confidence: 'manual', source: 'manual' });
    haptic(); toast('Записано'); done?.();
  };
  return html`
    <${Segmented} options=${[['photo', 'Фото → Perplexity'], ['manual', 'Вручную']]} value=${mode} onChange=${setMode}/>
    ${mode === 'photo' ? html`
      <ol class="steps">
        <li>Нажми кнопку — промпт скопируется, откроется Perplexity.</li>
        <li>Открой Search-чат проекта Health OS, прикрепи фото тарелки, вставь промпт.</li>
        <li>Подтверди запись словом <span class="kbd">yes</span> — блюдо появится в журнале питания.</li>
      </ol>
      <button class="btn primary block" onClick=${sendToPerplexity}><${Icon} name="camera"/> Скопировать промпт и открыть Perplexity</button>
      <p class="tiny" style="margin-top:10px">Бесплатно: распознавание идёт в Search, без кредитов Computer. Распознавание прямо в приложении — в планах (BACKLOG).</p>` : html`
      <${Field} label="Что ел"><input type="text" value=${f.desc} onInput=${set('desc')} placeholder="плов с говядиной, 300 г"/><//>
      <div class="grid4">
        <${Field} label="Ккал"><input type="number" inputmode="numeric" value=${f.kcal} onInput=${set('kcal')}/><//>
        <${Field} label="Б, г"><input type="number" inputmode="numeric" value=${f.protein_g} onInput=${set('protein_g')}/><//>
        <${Field} label="Ж, г"><input type="number" inputmode="numeric" value=${f.fat_g} onInput=${set('fat_g')}/><//>
        <${Field} label="У, г"><input type="number" inputmode="numeric" value=${f.carbs_g} onInput=${set('carbs_g')}/><//>
      </div>
      <${Field} label="Время"><input type="time" value=${f.time} onInput=${set('time')}/><//>
      <button class="btn primary block" onClick=${save}>Записать</button>`}
  `;
}

// ---------- note ----------
export function NoteForm({ done }) {
  const [t, setT] = useState('');
  const save = async () => { if (!t.trim()) return; await store.addNote(t.trim()); haptic(); toast('Заметка сохранена'); done?.(); };
  return html`
    <${Field} label="Заметка к сегодняшнему дню" hint="Попадёт в чек-ин дня; вечерняя сводка её учтёт."><textarea autofocus value=${t} onInput=${(e) => setT(e.target.value)} placeholder="Симптом, событие, наблюдение…"></textarea><//>
    <button class="btn primary block" onClick=${save}>Сохранить</button>`;
}

export function BriefSheet({ brief, briefEve }) {
  return html`${brief && html`<div class="section-t" style="margin-top:0">Утро</div><${Markdown} src=${brief}/>`}
    ${briefEve && html`<div class="section-t">Вечер</div><${Markdown} src=${briefEve}/>`}`;
}
