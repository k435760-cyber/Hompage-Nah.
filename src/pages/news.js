import { mountLayout, loginRequired, showError } from '../layout.js';
import { getUser } from '../lib/auth.js';
import { fetchNews } from '../lib/data.js';
import { escapeHtml, formatDate, textToHtml, safeImageUrl } from '../lib/format.js';

mountLayout('news');

const listEl = document.querySelector('[data-news-list]');
const filterEl = document.querySelector('[data-news-filter]');
let all = [];
let active = new URLSearchParams(window.location.search).get('category') || '';

function renderFilter() {
  const cats = [...new Set(all.map((n) => n.category).filter(Boolean))];
  if (active && !cats.includes(active)) cats.push(active);
  filterEl.innerHTML = ['', ...cats]
    .map(
      (c) => `<button type="button" role="tab" aria-selected="${c === active}" data-cat="${escapeHtml(c)}">${c ? escapeHtml(c) : '전체'}</button>`
    )
    .join('');
}

function renderList() {
  const rows = active ? all.filter((n) => n.category === active) : all;
  if (!rows.length) {
    listEl.innerHTML = '<p class="empty">등록된 소식이 없습니다.</p>';
    return;
  }
  listEl.innerHTML = `<ul class="news">${rows
    .map((n) => {
      const img = safeImageUrl(n.image_url);
      return `<li class="news__item" id="news-${n.id}">
        ${img ? `<img class="news__img" src="${escapeHtml(img)}" alt="" loading="lazy">` : ''}
        <div class="news__body">
          <p class="news__meta">
            ${n.pinned ? '<span class="tag tag--red">고정</span>' : ''}
            ${n.category ? `<span class="tag">${escapeHtml(n.category)}</span>` : ''}
            <time>${formatDate(n.event_date || n.created_at)}</time>
          </p>
          <h2 class="news__title">${escapeHtml(n.title)}</h2>
          <div class="news__text">${textToHtml(n.content || '')}</div>
        </div>
      </li>`;
    })
    .join('')}</ul>`;
}

filterEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cat]');
  if (!btn) return;
  active = btn.dataset.cat;
  const url = new URL(window.location.href);
  if (active) url.searchParams.set('category', active);
  else url.searchParams.delete('category');
  history.replaceState(null, '', url);
  renderFilter();
  renderList();
});

async function init() {
  const user = await getUser();
  if (!user) {
    filterEl.hidden = true;
    return loginRequired(listEl);
  }
  try {
    all = await fetchNews({ limit: 100 });
    renderFilter();
    renderList();
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  } catch {
    showError(listEl);
  }
}

init();
