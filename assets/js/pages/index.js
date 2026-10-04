(function () {
  'use strict';

  const { fetchSchedule, groupEvents } = window.App;
  const { mountLayout, loginRequired, showError, getUser, fetchNotices, fetchNews, fetchMeals, sameDay, splitAllergy, escapeHtml, formatDate, isRecent, WEEKDAYS } = window.App;

  mountLayout('home');

  const now = new Date();
  document.querySelector('[data-today]').textContent =
    `${now.getMonth() + 1}월 ${now.getDate()}일 (${WEEKDAYS[now.getDay()]})`;

  const noticeEl = document.querySelector('[data-home-notices]');
  const newsEl = document.querySelector('[data-home-news]');
  const mealEl = document.querySelector('[data-today-meal]');

  // 급식은 공개 정보라 로그인 없이 보여 줍니다.
  function loadMeal() {
    fetchMeals(now, now)
      .then((meals) => {
        const today = meals.find((m) => sameDay(m.date, now));
        if (!today) return (mealEl.innerHTML = '<p class="today__empty">오늘은 급식이 없습니다.</p>');
        mealEl.innerHTML = today.sections
          .map(
            (s) => `${today.sections.length > 1 ? `<p class="today__label">${escapeHtml(s.label)}</p>` : ''}
            <ul class="today__menu">${s.dishes.map((d) => `<li>${escapeHtml(splitAllergy(d).name)}</li>`).join('')}</ul>`
          )
          .join('');
      })
      .catch(() => (mealEl.innerHTML = '<p class="today__empty">식단을 불러오지 못했습니다.</p>'));
  }

  // 오늘부터 60일 안의 일정 중 앞의 4개
  function loadUpcoming() {
    const el = document.querySelector('[data-upcoming]');
    const until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 60);
    fetchSchedule(new Date(now.getFullYear(), now.getMonth(), now.getDate()), until)
      .then((events) => {
        const next = groupEvents(events, { ignoreGrades: true }).slice(0, 4);
        if (!next.length) return (el.innerHTML = '<li class="empty">예정된 일정이 없습니다.</li>');
        const md = (d) => `${d.getMonth() + 1}.${d.getDate()}`;
        el.innerHTML = next
          .map(
            (e) => `<li class="${e.holiday ? 'is-holiday' : ''}">
              <b>${sameDay(e.start, e.end) ? `${md(e.start)}(${WEEKDAYS[e.start.getDay()]})` : `${md(e.start)}~${md(e.end)}`}</b>
              <span>${escapeHtml(e.name)}</span>
            </li>`
          )
          .join('');
      })
      .catch(() => (el.innerHTML = '<li class="empty">일정을 불러오지 못했습니다.</li>'));
  }

  async function load() {
    const user = await getUser();
    if (!user) {
      loginRequired(noticeEl);
      loginRequired(newsEl);
      return;
    }

    fetchNotices({ size: 5 })
      .then(({ rows }) => {
        if (!rows.length) return (noticeEl.innerHTML = '<p class="empty">등록된 공지가 없습니다.</p>');
        noticeEl.innerHTML = `<ul class="list">${rows
          .map(
            (n) => `<li>
              <a href="notice.html?id=${n.id}">
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
              <a href="news.html#news-${n.id}">
                ${n.category ? `<span class="tag">${escapeHtml(n.category)}</span>` : ''}
                <span class="list__title">${escapeHtml(n.title)}</span>
              </a>
              <time>${formatDate(n.event_date || n.created_at)}</time>
            </li>`
          )
          .join('')}</ul>`;
      })
      .catch(() => showError(newsEl));


  }

  loadMeal();
  loadUpcoming();
  load();
})();
