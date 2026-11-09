import { marked } from '../vendor/marked.js';

marked.setOptions({ gfm: true, breaks: true });

// Content comes from the user's own repo; still strip active content defensively.
export function mdToHtml(src) {
  const html = marked.parse(src || '');
  return html
    .replace(/<\s*(script|iframe|object|embed|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}
