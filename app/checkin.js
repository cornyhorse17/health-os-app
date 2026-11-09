import { html, useData, useState, useEffect, Card, Segmented, Slider, Field, Icon, toast, haptic, Skeleton } from './ui.js';
import { store } from '../lib/store.js';
import { today, addDays, hm, longDate } from '../lib/dates.js';

const MORNING = [
  ['energy', 'Энергия', 'нет сил', 'полон сил'],
  ['mood', 'Настроение', 'плохое', 'отличное'],
  ['sleep_feel', 'Ощущение сна', 'разбит', 'выспался'],
  ['voice', 'Голос', 'сел', 'как обычно'],
];
const EVENING = [
  ['energy_day', 'Энергия днём', 'провал', 'ровно высокая'],
  ['focus', 'Фокус', 'рассеян', 'собран'],
  ['mood', 'Настроение', 'плохое', 'отличное'],
  ['voice', 'Голос', 'сел', 'как утром'],
  ['stress', 'Стресс', 'спокойно', 'на пределе'],
  ['appetite', 'Аппетит', 'нет аппетита', 'сильный голод'],
  ['gi', 'ЖКТ / тошнота', 'нет симптомов', 'сильные'],
];

export function CheckIn({ done }) {
  const T = today();
  const [part, setPart] = useState(new Date().getHours() < 15 ? 'morning' : 'evening');
  const { loading, data } = useData(async () => {
    const [cur, prev] = await Promise.all([store.checkin(T), store.checkin(addDays(T, -1))]);
    return { cur, prev };
  });
  const [vals, setVals] = useState({});
  const [saving, setSaving] = useState(false);
  const [newCoffee, setNewCoffee] = useState('');

  useEffect(() => { if (data) setVals({ ...(data.cur?.[part] || {}) }); }, [data, part]);

  if (loading) return html`<div class="top"><h1>Чек-ин</h1></div><div class="card"><${Skeleton} lines=${6}/></div>`;
  const prev = data?.prev?.[part] || {};
  const fields = part === 'morning' ? MORNING : EVENING;
  const set = (k) => (v) => setVals((s) => ({ ...s, [k]: v }));
  const already = !!data?.cur?.[part];

  const save = async () => {
    setSaving(true);
    const out = { ...vals };
    if (out.weight_kg === '' || out.weight_kg == null || Number.isNaN(out.weight_kg)) delete out.weight_kg;
    await store.saveCheckinPart(part, out);
    haptic(); toast(already ? 'Чек-ин обновлён' : 'Чек-ин сохранён');
    setSaving(false);
    done?.();
  };

  const coffee = vals.caffeine || [];
  return html`
    <div class="top"><h1>Чек-ин</h1><div class="sub">${longDate()}${already ? ' · уже заполнен, можно поправить' : ''}</div></div>
    <${Segmented} options=${[['morning', 'Утро'], ['evening', 'Вечер']]} value=${part} onChange=${setPart}/>
    <${Card}>
      ${fields.map(([k, label, lo, hi]) => html`<${Slider} key=${part + k} label=${label} lo=${lo} hi=${hi} value=${vals[k] ?? null} ghost=${prev[k]} onChange=${set(k)}/>`)}
    <//>
    <${Card}>
      ${part === 'morning' ? html`
        <${Field} label="Вес, кг" hint=${prev.weight_kg ? `вчера ${prev.weight_kg}` : 'с весов утром, натощак'}>
          <input type="number" inputmode="decimal" step="0.1" placeholder=${prev.weight_kg || '79.0'} value=${vals.weight_kg ?? ''} onInput=${(e) => set('weight_kg')(e.target.value === '' ? null : Number(e.target.value.replace(',', '.')))}/>
        <//>` : html`
        <div class="field"><span class="field-l">Кофе / кофеин (время)</span>
          <div class="chips">
            ${coffee.map((t) => html`<button class="chip on" onClick=${() => set('caffeine')(coffee.filter((x) => x !== t))}>${t} <${Icon} name="close" size=${14}/></button>`)}
            <span class="row"><input type="time" style="width:120px" value=${newCoffee} onInput=${(e) => setNewCoffee(e.target.value)}/>
            <button class="btn small" onClick=${() => { const t = newCoffee || hm(); if (!coffee.includes(t)) set('caffeine')([...coffee, t].sort()); setNewCoffee(''); }}>+ добавить</button></span>
          </div>
        </div>`}
      <${Field} label="Заметка" hint="Можно надиктовать с клавиатуры. Подробности и голосовые — в Search-чат недели.">
        <textarea placeholder=${part === 'morning' ? 'Как спал, что беспокоит…' : 'Что было за день, что повлияло…'} value=${vals.note || ''} onInput=${(e) => set('note')(e.target.value)}></textarea>
      <//>
    <//>
    <button class="btn primary block" disabled=${saving} onClick=${save}>${saving ? 'Сохраняю…' : already ? 'Обновить' : 'Сохранить'}</button>
    <p class="tiny" style="text-align:center;margin-top:10px">Незаполненные шкалы не сохраняются. Серым — вчерашнее значение.</p>
  `;
}
