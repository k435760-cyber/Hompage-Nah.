import { mountLayout, loginRequired, showError } from '../layout.js';
import { getUser } from '../lib/auth.js';
import { fetchNotices, fetchNews, fetchMeals, sameDay, splitAllergy } from '../lib/data.js';
import { escapeHtml, formatDate, isRecent, WEEKDAYS } from '../lib/format.js';

mountLayout('home');

const now = new Date();
document.querySelector('[data-today]').textContent =
  `${now.getMonth() + 1}월 ${now.getDate()}일 (${WEEKDAYS[now.getDay()]})`;

const noticeEl = document.querySelector('[data-home-notices]');
const newsEl = document.querySelector('[data-home-news]');
const mealEl = document.querySelector('[data-today-meal]');

async function load() {
  const user = await getUser();
  if (!user) {
    loginRequired(noticeEl);
    loginRequired(newsEl);
    mealEl.innerHTML = '<p class="today__empty">로그인하면 오늘 식단을 볼 수 있습니다.</p>';
    return;
  }

  fetchNotices({ size: 5 })
    .then(({ rows }) => {
      if (!rows.length) return (noticeEl.innerHTML = '<p class="empty">등록된 공지가 없습니다.</p>');
      noticeEl.innerHTML = `<ul class="list">${rows
        .map(
          (n) => `<li>
            <a href="/notice.html?id=${n.id}">
              ${n.priority && n.priority !== 'general' ? '<span class="tag tag--red">중요</span>' : ''}
              <span class="list__title">${escapeHtml(n.title)}</span>
              ${isRecent(n.created_at) ? '<span class="new" aria-label="새 글">N</span>' : ''}
            </a>
            <time datetime="${n.created_at}">${formatDate(n.created_at)}</time>
          </li>`
        )
        .join('')}</ul>`;
    })
    .catch(() => showError(noticeEl));

  fetchNews({ limit: 5 })
    .then((rows) => {
      if (!rows.length) return (newsEl.innerHTML = '<p class="empty">등록된 소식이 없습니다.</p>');
      newsEl.innerHTML = `<ul class="list">${rows
        .map(
          (n) => `<li>
            <a href="/news.html#news-${n.id}">
              ${n.category ? `<span class="tag">${escapeHtml(n.category)}</span>` : ''}
              <span class="list__title">${escapeHtml(n.title)}</span>
            </a>
            <time>${formatDate(n.event_date || n.created_at)}</time>
          </li>`
        )
        .join('')}</ul>`;
    })
    .catch(() => showError(newsEl));

  fetchMeals(10)
    .then((meals) => {
      const today = meals.find((m) => sameDay(m.date, now));
      if (!today) return (mealEl.innerHTML = '<p class="today__empty">오늘은 급식이 없습니다.</p>');
      mealEl.innerHTML = today.sections
        .map(
          (s) => `${s.label ? `<p class="today__label">${escapeHtml(s.label)}</p>` : ''}
          <ul class="today__menu">${s.dishes.map((d) => `<li>${escapeHtml(splitAllergy(d).name)}</li>`).join('')}</ul>`
        )
        .join('');
    })
    .catch(() => (mealEl.innerHTML = '<p class="today__empty">식단을 불러오지 못했습니다.</p>'));
}

load();
