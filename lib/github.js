// Minimal GitHub Contents API client (browser). Token = fine-grained PAT, health-os-data only.
const API = 'https://api.github.com';

const b64encode = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64decode = (b64) => {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export class GitHubError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export class GitHub {
  constructor({ token, repo, branch = 'main' }) {
    this.token = token; this.repo = repo; this.branch = branch;
  }

  async req(method, path, body, extraHeaders = {}) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (res.status === 304) return { notModified: true };
    if (res.status === 404) return { notFound: true };
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch {}
      throw new GitHubError(res.status, msg);
    }
    return { data: await res.json(), etag: res.headers.get('ETag') };
  }

  // Returns {text, sha, etag} | {notModified} | null (404)
  async getFile(path, etag) {
    const r = await this.req('GET', `/repos/${this.repo}/contents/${encodeURI(path)}?ref=${this.branch}`, null,
      etag ? { 'If-None-Match': etag } : {});
    if (r.notModified) return { notModified: true };
    if (r.notFound) return null;
    if (Array.isArray(r.data)) throw new GitHubError(400, `${path} is a directory`);
    let text;
    if (r.data.content) text = b64decode(r.data.content);
    else if (r.data.download_url || r.data.git_url) { // files > 1 MB come without content
      const blob = await this.req('GET', `/repos/${this.repo}/git/blobs/${r.data.sha}`);
      text = b64decode(blob.data.content);
    } else text = '';
    return { text, sha: r.data.sha, etag: r.etag };
  }

  // Returns [{name, path, sha, type}] | {notModified} | [] (404)
  async listDir(path, etag) {
    const r = await this.req('GET', `/repos/${this.repo}/contents/${encodeURI(path)}?ref=${this.branch}`, null,
      etag ? { 'If-None-Match': etag } : {});
    if (r.notModified) return { notModified: true };
    if (r.notFound) return { items: [], etag: null };
    return { items: r.data.map(({ name, path, sha, type }) => ({ name, path, sha, type })), etag: r.etag };
  }

  async putFile(path, text, sha, message) {
    const r = await this.req('PUT', `/repos/${this.repo}/contents/${encodeURI(path)}`, {
      message, content: b64encode(text), branch: this.branch, ...(sha ? { sha } : {}),
    });
    return { sha: r.data.content.sha };
  }

  async check() {
    const r = await this.req('GET', `/repos/${this.repo}`);
    if (r.notFound) throw new GitHubError(404, 'Репозиторий не найден или у токена нет к нему доступа');
    if (!r.data.permissions?.push && r.data.permissions !== undefined) throw new GitHubError(403, 'У токена нет права записи');
    return r.data;
  }
}
