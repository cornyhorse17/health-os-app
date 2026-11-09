import { html, useState, Field, Icon } from './ui.js';
import { GitHub } from '../lib/github.js';
import { DEFAULT_REPO } from '../lib/store.js';

export function Setup({ onDone }) {
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState(DEFAULT_REPO);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const connect = async () => {
    setBusy(true); setErr('');
    try {
      await new GitHub({ token: token.trim(), repo: repo.trim() }).check();
      onDone({ token: token.trim(), repo: repo.trim(), demo: false });
    } catch (e) {
      setErr(e.status === 401 ? 'Токен не принят. Проверь, что скопирован целиком.' : e.status === 404 ? 'Репозиторий не найден или токену не дан доступ к нему.' : e.message || 'Нет связи');
    } finally { setBusy(false); }
  };
  return html`<div class="setup">
    <${Icon} name="heart" size=${40} cls="muted"/>
    <h1>Health OS</h1>
    <p class="muted" style="margin-top:0">Подключи свой приватный репозиторий с данными. Токен хранится только на этом телефоне.</p>
    <div class="card">
      <ol class="steps">
        <li>На github.com: <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</b>.</li>
        <li>Repository access: <b>Only select repositories → health-os-data</b>.</li>
        <li>Permissions → Repository → <b>Contents: Read and write</b>. Срок — 1 год.</li>
        <li>Скопируй токен (начинается с <span class="kbd">github_pat_</span>) и вставь ниже.</li>
      </ol>
      <${Field} label="GitHub-токен"><input type="password" autocomplete="off" value=${token} onInput=${(e) => setToken(e.target.value)} placeholder="github_pat_…"/><//>
      <${Field} label="Репозиторий данных"><input type="text" autocapitalize="off" autocorrect="off" value=${repo} onInput=${(e) => setRepo(e.target.value)}/><//>
      ${err && html`<p class="small" style="color:var(--bad)">${err}</p>`}
      <button class="btn primary block" disabled=${busy || !token} onClick=${connect}>${busy ? 'Проверяю…' : 'Подключить'}</button>
    </div>
    <button class="btn block" onClick=${() => onDone({ demo: true, token: '', repo: DEFAULT_REPO })}>Демо-режим</button>
    <p class="tiny" style="margin-top:16px">Совет: установи приложение на главный экран — в Safari «Поделиться» → «На экран „Домой“».</p>
  </div>`;
}
