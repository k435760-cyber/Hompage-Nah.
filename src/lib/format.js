const pad = (n) => String(n).padStart(2, '0');

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function isRecent(value, days = 3) {
  const d = new Date(value);
  return Date.now() - d.getTime() < days * 86400000;
}

export function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// 본문은 줄바꿈만 살리고 나머지는 모두 이스케이프합니다.
export function textToHtml(str = '') {
  return escapeHtml(str)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replaceAll('\n', '<br>')}</p>`)
    .join('');
}

export function safeImageUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
