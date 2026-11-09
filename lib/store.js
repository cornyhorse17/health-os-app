// Data layer: GitHub-backed, local cache, offline write queue, demo mode.
import { GitHub, GitHubError } from './github.js';
import { buildDemo } from './demo.js';
import { today, hm, addDays, range } from './dates.js';

const LS = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('storage full?', e); } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
  keys(prefix) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(prefix)) out.push(k); } } catch {} return out; },
};

export const DEFAULT_REPO = 'cornyhorse17/health-os-data';
export const P = {
  protocol: 'data/protocol.json', injections: 'data/injections.json', experiments: 'data/experiments.json',
  labs: 'data/labs.json', training: 'data/training.json', alerts: 'data/alerts.json', feedback: 'data/feedback.json',
  checkins: 'data/checkins', meals: 'data/meals', briefings: 'data/briefings', reviews: 'data/reviews',
  garmin: 'garmin/daily.json',
  checkin: (d) => `data/checkins/${d}.json`, meal: (d) => `data/meals/${d}.json`,
};

export const loadConfig = () => LS.get('hos.cfg', { token: '', repo: DEFAULT_REPO, demo: false, proteinGoal: null, pinHash: null });
export const saveConfig = (cfg) => LS.set('hos.cfg', cfg);

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// ours wins on scalars; objects merge; arrays = union (theirs first)
export function deepMerge(theirs, ours) {
  if (isObj(theirs) && isObj(ours)) {
    const out = { ...theirs };
    for (const k of Object.keys(ours)) out[k] = k in theirs ? deepMerge(theirs[k], ours[k]) : ours[k];
    return out;
  }
  if (Array.isArray(theirs) && Array.isArray(ours)) {
    const seen = new Set(theirs.map((x) => JSON.stringify(x)));
    return [...theirs, ...ours.filter((x) => !seen.has(JSON.stringify(x)))];
  }
  return ours === undefined ? theirs : ours;
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

class Store {
  constructor() {
    this.listeners = new Set();
    this.status = { online: navigator.onLine, syncing: false, pending: 0, lastSync: LS.get('hos.lastSync'), error: null };
    this.pending = LS.get('hos.pending', {});
    this.version = 0; // bumps on every local change → screens re-read
    window.addEventListener('online', () => { this.setStatus({ online: true }); this.flush(); });
    window.addEventListener('offline', () => this.setStatus({ online: false }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.flush(); });
  }

  init(cfg) {
    this.cfg = cfg;
    this.demo = !!cfg.demo;
    this.gh = this.demo ? null : new GitHub({ token: cfg.token, repo: cfg.repo || DEFAULT_REPO });
    if (this.demo) { this.demoData = LS.get('hos.demo') || buildDemo(); LS.set('hos.demo', this.demoData); this.pending = {}; }
    this.setStatus({ pending: Object.keys(this.pending).length });
    this.flush();
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((fn) => fn(this)); }
  setStatus(p) { this.status = { ...this.status, ...p }; this.emit(); }
  touch() { this.version++; this.emit(); }

  // ---------- reading ----------
  cacheKey(path) { return `hos.f:${this.cfg?.repo}:${path}`; }

  async readText(path) {
    if (this.pending[path]) return this.pending[path].text;
    if (this.demo) return this.demoData[path] ?? null;
    const key = this.cacheKey(path); const cached = LS.get(key);
    if (!navigator.onLine) return cached?.text ?? null;
    try {
      const r = await this.gh.getFile(path, cached?.etag);
      if (r?.notModified) return cached.text;
      if (r === null) { LS.del(key); return null; }
      LS.set(key, { text: r.text, sha: r.sha, etag: r.etag, t: Date.now() });
      this.markSynced();
      return r.text;
    } catch (e) {
      this.handleError(e);
      return cached?.text ?? null;
    }
  }

  async readJSON(path, fallback = null) {
    const t = await this.readText(path);
    if (t == null || t.trim() === '') return clone(fallback);
    try { return JSON.parse(t); } catch { console.warn('bad json', path); return clone(fallback); }
  }

  // list a directory → [{name, path, sha}]
  async list(dir) {
    if (this.demo) {
      const names = Object.keys(this.demoData).filter((p) => p.startsWith(dir + '/')).map((p) => ({ name: p.slice(dir.length + 1), path: p, sha: p }));
      return names;
    }
    const key = `hos.d:${this.cfg.repo}:${dir}`; const cached = LS.get(key);
    let items = cached?.items || [];
    if (navigator.onLine) {
      try {
        const r = await this.gh.listDir(dir, cached?.etag);
        if (!r.notModified) { items = r.items.filter((x) => x.type === 'file'); LS.set(key, { items, etag: r.etag }); }
      } catch (e) { this.handleError(e); }
    }
    // pending new files in this dir
    for (const p of Object.keys(this.pending)) if (p.startsWith(dir + '/') && !items.some((i) => i.path === p)) items = [...items, { name: p.slice(dir.length + 1), path: p, sha: 'pending' }];
    return items;
  }

  // Read many JSON files of a dir by name filter, using sha cache to avoid refetching
  async readDirJSON(dir, filter = () => true) {
    const items = (await this.list(dir)).filter((i) => i.name.endsWith('.json') && filter(i.name));
    const out = {};
    await pool(items, 6, async (it) => {
      if (this.pending[it.path]) { out[it.name] = JSON.parse(this.pending[it.path].text); return; }
      if (this.demo) { out[it.name] = JSON.parse(this.demoData[it.path]); return; }
      const key = this.cacheKey(it.path); const cached = LS.get(key);
      if (cached && cached.sha === it.sha) { try { out[it.name] = JSON.parse(cached.text); } catch {} return; }
      const t = await this.readText(it.path);
      if (t) { try { out[it.name] = JSON.parse(t); } catch {} }
    });
    return out;
  }

  // ---------- writing ----------
  async update(path, mutator, message) {
    const cur = await this.readJSON(path, null);
    const next = mutator(clone(cur));
    if (next === undefined) return cur;
    return this.writeJSON(path, next, message);
  }

  async writeJSON(path, obj, message) {
    const text = JSON.stringify(obj, null, 1) + '\n';
    if (this.demo) { this.demoData[path] = text; LS.set('hos.demo', this.demoData); this.touch(); return obj; }
    const baseSha = this.pending[path]?.baseSha ?? LS.get(this.cacheKey(path))?.sha ?? null;
    this.pending[path] = { text, message: message || `app: update ${path}`, baseSha, t: Date.now() };
    LS.set('hos.pending', this.pending);
    this.setStatus({ pending: Object.keys(this.pending).length });
    this.touch();
    this.flush();
    return obj;
  }

  async flush() {
    if (this.demo || !this.gh || this.flushing || !navigator.onLine) return;
    const paths = Object.keys(this.pending); if (!paths.length) return;
    this.flushing = true; this.setStatus({ syncing: true });
    try {
      for (const path of paths) {
        const p = this.pending[path];
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const latest = await this.gh.getFile(path);
            let text = p.text;
            if (latest && latest.sha !== p.baseSha && path.endsWith('.json')) {
              try { text = JSON.stringify(deepMerge(JSON.parse(latest.text), JSON.parse(p.text)), null, 1) + '\n'; } catch {}
            }
            const r = await this.gh.putFile(path, text, latest?.sha, p.message);
            LS.set(this.cacheKey(path), { text, sha: r.sha, etag: null, t: Date.now() });
            delete this.pending[path];
            break;
          } catch (e) {
            if (e instanceof GitHubError && (e.status === 409 || e.status === 422) && attempt === 0) continue;
            throw e;
          }
        }
        LS.set('hos.pending', this.pending);
      }
      this.markSynced();
      this.setStatus({ error: null });
    } catch (e) {
      this.handleError(e);
    } finally {
      this.flushing = false;
      this.setStatus({ syncing: false, pending: Object.keys(this.pending).length });
    }
  }

  markSynced() { const t = Date.now(); LS.set('hos.lastSync', t); this.status.lastSync = t; }

  handleError(e) {
    console.warn(e);
    const msg = e instanceof GitHubError
      ? (e.status === 401 ? 'Токен недействителен — обнови в Настройках' : e.status === 403 ? 'Нет доступа (токен или лимит GitHub)' : `GitHub: ${e.message}`)
      : 'Нет связи — данные сохранены и уйдут позже';
    this.setStatus({ error: msg });
  }

  clearCache() { LS.keys('hos.f:').concat(LS.keys('hos.d:')).forEach((k) => LS.del(k)); this.touch(); }
  resetDemo() { this.demoData = buildDemo(); LS.set('hos.demo', this.demoData); this.touch(); }

  // ---------- domain helpers ----------
  checkin(date = today()) { return this.readJSON(P.checkin(date), { date }); }

  saveCheckinPart(part, values, date = today()) {
    return this.update(P.checkin(date), (c) => {
      c = c || { date };
      c[part] = { ...(c[part] || {}), ...values, time: values.time || hm() };
      c.updated_at = new Date().toISOString();
      return c;
    }, `checkin ${date} ${part}`);
  }

  toggleAdherence(id, date = today()) {
    return this.update(P.checkin(date), (c) => {
      c = c || { date }; c.adherence = c.adherence || {};
      if (c.adherence[id]) delete c.adherence[id]; else c.adherence[id] = hm();
      c.updated_at = new Date().toISOString();
      return c;
    }, `adherence ${date} ${id}`);
  }

  addNote(text, date = today()) {
    return this.update(P.checkin(date), (c) => {
      c = c || { date }; c.notes = [...(c.notes || []), { time: hm(), text }];
      c.updated_at = new Date().toISOString(); return c;
    }, `note ${date}`);
  }

  async addTraining(entry, date = today()) {
    await this.update(P.checkin(date), (c) => {
      c = c || { date }; c.training = [...(c.training || []), entry];
      c.updated_at = new Date().toISOString(); return c;
    }, `training ${date}`);
    const strength = (entry.sets || []).filter((s) => s.ex && s.kg);
    if (strength.length) {
      await this.update(P.training, (t) => {
        t = t || { plan: [], working_weights: {} }; t.working_weights = t.working_weights || {};
        for (const s of strength) {
          const prev = t.working_weights[s.ex];
          if (!prev || s.kg > prev.kg || (s.kg === prev.kg && s.reps >= prev.reps)) t.working_weights[s.ex] = { kg: s.kg, reps: s.reps, date };
        }
        return t;
      }, `working weights ${date}`);
    }
  }

  addInjection(entry) {
    return this.update(P.injections, (list) => [...(list || []), entry], `injection ${entry.at.slice(0, 10)}`);
  }

  addMeal(item, date = today()) {
    return this.update(P.meal(date), (m) => {
      m = m || { date, items: [] }; m.items = [...(m.items || []), item];
      const sum = (k) => Math.round(m.items.reduce((a, x) => a + (Number(x[k]) || 0), 0));
      m.totals = { kcal: sum('kcal'), protein_g: sum('protein_g'), fat_g: sum('fat_g'), carbs_g: sum('carbs_g') };
      return m;
    }, `meal ${date} ${item.time}`);
  }

  addFeedback(text) {
    return this.update(P.feedback, (list) => [...(list || []), { date: today(), text, status: 'new' }], 'app feedback');
  }

  async loadDays(dir, days) {
    const from = addDays(today(), -(days - 1));
    const files = await this.readDirJSON(dir, (n) => n.slice(0, 10) >= from);
    return range(from, today()).map((d) => ({ date: d, ...(files[`${d}.json`] || {}) }));
  }
}

export const store = new Store();
