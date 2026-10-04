(function () {
  'use strict';

  const { mountLayout, showError, fetchSchedule, groupEvents, gradeLabel, sameDay, escapeHtml, WEEKDAYS } = window.App;

  mountLayout('schedule');

  const navEl = document.querySelector('[data-month-nav]');
  const calEl = document.querySelector('[data-calendar]');
  const listEl = document.querySelector('[data-schedule-list]');
  const filterEl = document.querySelector('[data-grade-filter]');

  const today = new Date();
  const cache = new Map(); // 'YYYY-M' → 일정
  let year = today.getFullYear();
  let month = today.getMonth(); // 0~11
  let grade = 0; // 0 = 전체

  const visible = (events) => (grade ? events.filter((e) => !e.grades.length || e.grades.includes(grade)) : events);
  const md = (d) => `${d.getMonth() + 1}.${d.getDate()}`;

  function eventTag(e) {
    const g = gradeLabel(e.grades);
    // 이름에 이미 학년이 들어 있으면("3학년 기말고사") 다시 붙이지 않습니다.
    if (!g || grade || e.name.includes(g)) return '';
    return ` <span class="ev__grade">${g}</span>`;
  }

  function calendarHtml(events) {
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i += 1) cells.push('<td class="cal__blank"></td>');
    for (let d = 1; d <= days; d += 1) {
      const date = new Date(year, month, d);
      const dayEvents = events.filter((e) => sameDay(e.date, date));
      const holiday = date.getDay() === 0 || dayEvents.some((e) => e.holiday);
      const cls = [
        holiday ? 'is-holiday' : '',
        date.getDay() === 6 ? 'is-sat' : '',
        sameDay(date, today) ? 'is-today' : '',
        dayEvents.length ? 'has-event' : '',
      ].filter(Boolean).join(' ');
      cells.push(`<td class="${cls}">
        <span class="cal__day">${d}</span>
        ${dayEvents.map((e) => `<span class="cal__ev${e.holiday ? ' is-holiday' : ''}">${escapeHtml(e.name)}</span>`).join('')}
      </td>`);
    }
    while (cells.length % 7) cells.push('<td class="cal__blank"></td>');
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
    return `<table class="cal">
      <caption class="sr-only">${year}년 ${month + 1}월 학사일정 달력</caption>
      <thead><tr>${WEEKDAYS.map((w) => `<th scope="col">${w}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;
  }

  function listHtml(events) {
    const groups = groupEvents(events);
    if (!groups.length) return '<p class="empty">이 달에는 등록된 일정이 없습니다.</p>';
    return `<ul class="ev-list">${groups
      .map((e) => {
        const range = sameDay(e.start, e.end) ? md(e.start) : `${md(e.start)} ~ ${md(e.end)}`;
        const wd = sameDay(e.start, e.end) ? `(${WEEKDAYS[e.start.getDay()]})` : '';
        return `<li class="${e.holiday ? 'is-holiday' : ''}">
          <span class="ev__date">${range} <small>${wd}</small></span>
          <span class="ev__name">${escapeHtml(e.name)}${eventTag(e)}</span>
        </li>`;
      })
      .join('')}</ul>`;
  }

  function renderNav() {
    const isHome = year === today.getFullYear() && month === today.getMonth();
    navEl.innerHTML = `
      <button type="button" data-step="-1">이전 달</button>
      <p><span class="week-nav__year">${year}년</span><strong>${month + 1}월</strong></p>
      <button type="button" data-step="1">다음 달</button>
      ${isHome ? '' : '<button type="button" class="week-nav__home" data-home>이번 달로</button>'}`;
  }

  async function render() {
    renderNav();
    const key = `${year}-${month}`;
    if (!cache.has(key)) {
      calEl.innerHTML = '<p class="loading">불러오는 중</p>';
      listEl.innerHTML = '';
      try {
        cache.set(key, await fetchSchedule(new Date(year, month, 1), new Date(year, month + 1, 0)));
      } catch {
        return showError(calEl, '학사일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
    if (key !== `${year}-${month}`) return; // 기다리는 동안 다른 달로 넘어감
    const events = visible(cache.get(key));
    calEl.innerHTML = calendarHtml(events);
    listEl.innerHTML = listHtml(events);
  }

  navEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-home]')) {
      year = today.getFullYear();
      month = today.getMonth();
    } else {
      const btn = e.target.closest('[data-step]');
      if (!btn) return;
      const d = new Date(year, month + Number(btn.dataset.step), 1);
      year = d.getFullYear();
      month = d.getMonth();
    }
    render();
  });

  filterEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-grade]');
    if (!btn) return;
    grade = Number(btn.dataset.grade) || 0;
    filterEl.querySelectorAll('[data-grade]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    render();
  });

  render();
})();
