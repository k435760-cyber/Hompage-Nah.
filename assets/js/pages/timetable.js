(function () {
  'use strict';

  const { mountLayout, showError, fetchClasses, fetchTimetable, schoolYear, ymd, sameDay, escapeHtml, WEEKDAYS } = window.App;

  mountLayout('timetable');

  const STORE_KEY = 'yd.timetable.class';
  const PERIODS = 7;
  const gradeEl = document.querySelector('[data-grade]');
  const classEl = document.querySelector('[data-class]');
  const navEl = document.querySelector('[data-week-nav]');
  const ttEl = document.querySelector('[data-timetable]');

  const today = new Date();
  const homeOffset = today.getDay() === 0 || today.getDay() === 6 ? 1 : 0;
  let offset = homeOffset;
  let classes = {};
  const cache = new Map();

  // 마지막으로 본 반은 이 브라우저에만 기억합니다.
  const store = {
    get() {
      try {
        return JSON.parse(localStorage.getItem(STORE_KEY)) || null;
      } catch {
        return null;
      }
    },
    set(v) {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(v));
      } catch {
        /* 저장할 수 없어도 동작에는 문제없음 */
      }
    },
  };

  function weekDays(weeks) {
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weeks * 7);
    return Array.from({ length: 5 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  }

  function fillClassOptions(selected) {
    const list = classes[gradeEl.value] || [];
    classEl.innerHTML = list.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}반</option>`).join('');
    if (selected && list.includes(selected)) classEl.value = selected;
  }

  function renderNav(days) {
    const [mon, fri] = [days[0], days[4]];
    const end = `${mon.getFullYear() === fri.getFullYear() ? '' : `${fri.getFullYear()}년 `}${fri.getMonth() + 1}월 ${fri.getDate()}일`;
    navEl.innerHTML = `
      <button type="button" data-step="-1">이전 주</button>
      <p><span class="week-nav__year">${mon.getFullYear()}년</span><strong>${mon.getMonth() + 1}월 ${mon.getDate()}일 ~ ${end}</strong></p>
      <button type="button" data-step="1">다음 주</button>
      ${offset !== homeOffset ? '<button type="button" class="week-nav__home" data-home>이번 주로</button>' : ''}`;
  }

  function tableHtml(days, data) {
    const hasAny = Object.keys(data).length > 0;
    if (!hasAny) return '<p class="empty">이 주의 시간표가 아직 등록되지 않았거나 수업이 없는 주입니다.</p>';
    const maxPeriod = Math.max(
      6,
      ...Object.values(data).flatMap((d) => Object.keys(d).map(Number))
    );
    const head = days
      .map((d) => `<th scope="col" class="${sameDay(d, today) ? 'is-today' : ''}">${WEEKDAYS[d.getDay()]}<small>${d.getMonth() + 1}.${d.getDate()}</small></th>`)
      .join('');
    const rows = [];
    for (let p = 1; p <= Math.min(maxPeriod, PERIODS + 1); p += 1) {
      rows.push(`<tr><th scope="row">${p}교시</th>${days
        .map((d) => {
          const day = data[ymd(d)];
          const subject = day?.[p] || '';
          const cls = [sameDay(d, today) ? 'is-today' : '', !day ? 'is-off' : ''].filter(Boolean).join(' ');
          return `<td class="${cls}">${escapeHtml(subject)}</td>`;
        })
        .join('')}</tr>`);
    }
    return `<div class="tt-wrap"><table class="tt">
      <caption class="sr-only">${gradeEl.value}학년 ${classEl.value}반 시간표</caption>
      <thead><tr><th scope="col"><span class="sr-only">교시</span></th>${head}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
  }

  async function render() {
    const days = weekDays(offset);
    renderNav(days);
    const grade = gradeEl.value;
    const cls = classEl.value;
    if (!grade || !cls) return;
    const key = `${grade}-${cls}-${ymd(days[0])}`;
    if (!cache.has(key)) {
      ttEl.innerHTML = '<p class="loading">불러오는 중</p>';
      try {
        cache.set(key, await fetchTimetable(grade, cls, days[0], days[4]));
      } catch {
        return showError(ttEl, '시간표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
    if (key !== `${gradeEl.value}-${classEl.value}-${ymd(weekDays(offset)[0])}`) return;
    ttEl.innerHTML = tableHtml(days, cache.get(key));
  }

  navEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-home]')) offset = homeOffset;
    else {
      const btn = e.target.closest('[data-step]');
      if (!btn) return;
      offset += Number(btn.dataset.step);
    }
    render();
  });

  gradeEl.addEventListener('change', () => {
    fillClassOptions();
    store.set({ grade: gradeEl.value, cls: classEl.value });
    render();
  });
  classEl.addEventListener('change', () => {
    store.set({ grade: gradeEl.value, cls: classEl.value });
    render();
  });

  async function init() {
    try {
      classes = await fetchClasses(schoolYear(weekDays(offset)[0]));
    } catch {
      return showError(ttEl, '학급 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    const grades = Object.keys(classes).sort();
    if (!grades.length) {
      ttEl.innerHTML = '<p class="empty">학급 정보가 없습니다.</p>';
      return;
    }
    gradeEl.innerHTML = grades.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}학년</option>`).join('');
    const saved = store.get();
    if (saved && grades.includes(saved.grade)) gradeEl.value = saved.grade;
    fillClassOptions(saved?.cls);
    render();
  }

  init();
})();
