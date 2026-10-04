(function () {
  'use strict';

  const { mountLayout, showError, fetchClasses, fetchTimetable, fetchSchedule, schoolYear, ymd, sameDay, escapeHtml, WEEKDAYS } = window.App;

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
  const cache = new Map(); // 반+주 → 시간표
  const eventCache = new Map(); // 주 → 학사일정

  // 이런 일정이 있는 날은 수업 대신 일정을 보여 줍니다. (시험, 공휴일·휴업일, 방학 등)
  const REPLACES_CLASSES = /고사|시험|평가|방학|휴업|재량|개교기념|졸업식|입학식|수학여행|수련|현장체험/;

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

  // 선택한 학년에 해당하는 그날의 일정
  function eventsOn(events, d) {
    const g = Number(gradeEl.value);
    return events.filter((e) => sameDay(e.date, d) && (!e.grades.length || e.grades.includes(g)));
  }

  function tableHtml(days, data, events) {
    const dayInfo = days.map((d) => {
      const evs = eventsOn(events, d);
      const main = evs.find((e) => e.holiday || REPLACES_CLASSES.test(e.name));
      return { d, evs, main, others: evs.filter((e) => e !== main) };
    });
    const hasAny = Object.keys(data).length > 0 || dayInfo.some((x) => x.main);
    if (!hasAny) return '<p class="empty">이 주의 시간표가 아직 등록되지 않았거나 수업이 없는 주입니다.</p>';

    const maxPeriod = Math.min(
      PERIODS + 1,
      Math.max(6, ...Object.values(data).flatMap((d) => Object.keys(d).map(Number)))
    );
    const head = dayInfo
      .map(({ d, others }) => `<th scope="col" class="${sameDay(d, today) ? 'is-today' : ''}">${WEEKDAYS[d.getDay()]}<small>${d.getMonth() + 1}.${d.getDate()}</small>${others
        .map((e) => `<span class="tt__note">${escapeHtml(e.name)}</span>`)
        .join('')}</th>`)
      .join('');

    const rows = [];
    for (let p = 1; p <= maxPeriod; p += 1) {
      const cells = dayInfo.map(({ d, main }) => {
        const todayCls = sameDay(d, today) ? ' is-today' : '';
        if (main) {
          // 일정이 있는 날은 한 칸으로 합쳐 일정 이름만 보여 줍니다.
          if (p > 1) return '';
          // 시험일처럼 수업이 줄어든 날은 나이스에 등록된 교시 수를 함께 적습니다.
          const periods = main.holiday ? 0 : Object.keys(data[ymd(d)] || {}).length;
          const span = periods && periods < maxPeriod ? `<small>1~${periods}교시</small>` : '';
          return `<td class="tt__event${main.holiday ? ' is-holiday' : ''}${todayCls}" rowspan="${maxPeriod}">${escapeHtml(main.name)}${span}</td>`;
        }
        const day = data[ymd(d)];
        const cls = [todayCls.trim(), !day ? 'is-off' : ''].filter(Boolean).join(' ');
        return `<td class="${cls}">${escapeHtml(day?.[p] || '')}</td>`;
      });
      rows.push(`<tr><th scope="row">${p}교시</th>${cells.join('')}</tr>`);
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
    const week = ymd(days[0]);
    const key = `${grade}-${cls}-${week}`;
    if (!cache.has(key) || !eventCache.has(week)) {
      ttEl.innerHTML = '<p class="loading">불러오는 중</p>';
      try {
        const [tt, events] = await Promise.all([
          cache.has(key) ? cache.get(key) : fetchTimetable(grade, cls, days[0], days[4]),
          // 학사일정을 못 불러와도 시간표는 보여 줍니다.
          eventCache.has(week) ? eventCache.get(week) : fetchSchedule(days[0], days[4]).catch(() => null),
        ]);
        cache.set(key, tt);
        if (events) eventCache.set(week, events);
      } catch {
        return showError(ttEl, '시간표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
    if (key !== `${gradeEl.value}-${classEl.value}-${ymd(weekDays(offset)[0])}`) return;
    ttEl.innerHTML = tableHtml(days, cache.get(key), eventCache.get(week) || []);
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
