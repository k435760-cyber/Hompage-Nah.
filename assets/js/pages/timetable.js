(function () {
  'use strict';

  const { openDialog } = window.App;
  const { mountLayout, showError, fetchClasses, fetchTimetable, fetchSchedule, schoolYear, ymd, sameDay, escapeHtml, WEEKDAYS } = window.App;

  mountLayout('timetable');

  const STORE_KEY = 'yd.timetable.class';
  const PERIODS = 7;
  const pickBtn = document.querySelector('[data-class-pick]');
  const pickLabel = document.querySelector('[data-class-label]');
  const navEl = document.querySelector('[data-week-nav]');
  const ttEl = document.querySelector('[data-timetable]');

  const today = new Date();
  const homeOffset = today.getDay() === 0 || today.getDay() === 6 ? 1 : 0;
  let offset = homeOffset;
  let classes = {};
  let sel = { grade: '', cls: '' }; // 지금 보고 있는 학년·반
  const cache = new Map(); // 반+주 → 시간표
  const eventCache = new Map(); // 주 → 학사일정

  // 이런 일정이 있는 날은 수업 대신 일정을 보여 줍니다. (시험, 공휴일·휴업일, 방학 등)
  // 일정 종류 (이름으로 판단)
  //  - 고사: 교시별 시험 과목을 그대로 보여 주고 시험일로 표시
  //  - 행사: 수업 대신 하루(또는 해당 학년) 전체가 행사 → 칸을 합쳐 행사 이름 표시
  //  - 공휴일·휴업일: 칸을 합쳐 빨간색으로 표시
  //  - 그 밖(백일장, 설명회 등): 날짜 아래 작은 메모
  const EXAM = /고사|시험|평가/;
  const SCHOOL_EVENT = /방학식|종업식|졸업식|입학식|개교기념|재량휴업|수학여행|수련|현장체험|체험학습|진로의\s?날|학예|축제|체육대회|운동회|교육$/;

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

  function setSelection(grade, cls) {
    sel = { grade, cls };
    pickLabel.textContent = `${grade}학년 ${cls}반`;
    store.set(sel);
  }

  // 학년을 고르고 반을 누르면 바로 닫히는 선택 창
  function openClassPicker() {
    const grades = Object.keys(classes).sort();
    let grade = sel.grade;
    const classGrid = (g) => (classes[g] || [])
      .map((c) => {
        const on = g === sel.grade && c === sel.cls;
        return `<button type="button" class="pick__opt" data-cls="${escapeHtml(c)}" aria-selected="${on}"${on ? ' autofocus' : ''}>${escapeHtml(c)}반</button>`;
      })
      .join('');

    return openDialog({
      title: '학년·반 선택',
      body: `
        <div class="seg" role="tablist" aria-label="학년">${grades
          .map((g) => `<button type="button" role="tab" data-grade="${escapeHtml(g)}" aria-selected="${g === grade}">${escapeHtml(g)}학년</button>`)
          .join('')}</div>
        <div class="pick pick--grid" role="listbox" aria-label="반" data-classes>${classGrid(grade)}</div>`,
      onMount: (dlg, close) => {
        const list = dlg.querySelector('[data-classes]');
        dlg.querySelector('.seg').addEventListener('click', (e) => {
          const b = e.target.closest('[data-grade]');
          if (!b) return;
          grade = b.dataset.grade;
          dlg.querySelectorAll('[data-grade]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
          list.innerHTML = classGrid(grade);
        });
        list.addEventListener('click', (e) => {
          const b = e.target.closest('[data-cls]');
          if (b) close({ grade, cls: b.dataset.cls });
        });
      },
    });
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
  // 이 일정이 선택한 학년에 해당하는지
  //  - 이름에 학년이 있으면("3학년 기말고사") 그 학년만
  //  - 공휴일·휴업일은 학교 전체
  //  - 고사는 나이스 학년 표시가 실제와 다를 때가 있어서, 표시가 없어도
  //    그날 이 반 시간표가 4교시 이하로 짧으면 시험일로 봅니다.
  function appliesTo(e, g, day) {
    const named = e.name.match(/([1-3])학년/);
    if (named) return Number(named[1]) === g;
    if (e.holiday) return true;
    if (!e.grades.length || e.grades.includes(g)) return true;
    const periods = day ? Object.keys(day).length : 0;
    return EXAM.test(e.name) && periods > 0 && periods <= 4;
  }

  function classify(evs, hasClasses) {
    const holiday = evs.find((e) => e.holiday);
    if (holiday) return { kind: 'holiday', main: holiday };
    const event = evs.find((e) => SCHOOL_EVENT.test(e.name));
    if (event) return { kind: 'event', main: event };
    const exam = evs.find((e) => EXAM.test(e.name));
    // 시간표가 없는 시험일은 칸을 합쳐 시험 이름만 보여 줍니다.
    if (exam) return { kind: hasClasses ? 'exam' : 'event', main: exam };
    return { kind: 'normal', main: null };
  }

  function tableHtml(days, data, events) {
    const g = Number(sel.grade);
    const dayInfo = days.map((d) => {
      const day = data[ymd(d)];
      const evs = events.filter((e) => sameDay(e.date, d) && appliesTo(e, g, day));
      const { kind, main } = classify(evs, Boolean(day && Object.keys(day).length));
      return { d, day, kind, main, others: evs.filter((e) => e !== main) };
    });
    const hasAny = Object.keys(data).length > 0 || dayInfo.some((x) => x.main);
    if (!hasAny) return '<p class="empty">이 주의 시간표가 아직 등록되지 않았거나 수업이 없는 주입니다.</p>';

    const maxPeriod = Math.min(
      PERIODS + 1,
      Math.max(6, ...Object.values(data).flatMap((x) => Object.keys(x).map(Number)))
    );
    const head = dayInfo
      .map(({ d, kind, main, others }) => {
        const badge = kind === 'exam' ? `<span class="tt__badge">${escapeHtml(main.name)}</span>` : '';
        const notes = others.map((e) => `<span class="tt__note">${escapeHtml(e.name)}</span>`).join('');
        const cls = [sameDay(d, today) ? 'is-today' : '', kind === 'exam' ? 'is-exam' : ''].filter(Boolean).join(' ');
        return `<th scope="col" class="${cls}">${WEEKDAYS[d.getDay()]}<small>${d.getMonth() + 1}.${d.getDate()}</small>${badge}${notes}</th>`;
      })
      .join('');

    const rows = [];
    for (let p = 1; p <= maxPeriod; p += 1) {
      const cells = dayInfo.map(({ d, day, kind, main }) => {
        const todayCls = sameDay(d, today) ? 'is-today' : '';
        if (kind === 'holiday' || kind === 'event') {
          if (p > 1) return '';
          const cls = ['tt__event', kind === 'holiday' ? 'is-holiday' : '', todayCls].filter(Boolean).join(' ');
          return `<td class="${cls}" rowspan="${maxPeriod}">${escapeHtml(main.name)}</td>`;
        }
        const subject = day?.[p] || '';
        if (kind === 'exam') {
          // 시험일: 교시마다 나이스에 등록된 시험 과목, 시험이 끝난 교시는 비워 둡니다.
          const cls = ['tt__exam', !subject ? 'is-done' : '', todayCls].filter(Boolean).join(' ');
          return `<td class="${cls}">${escapeHtml(subject)}</td>`;
        }
        const cls = [todayCls, !day ? 'is-off' : ''].filter(Boolean).join(' ');
        return `<td class="${cls}">${escapeHtml(subject)}</td>`;
      });
      rows.push(`<tr><th scope="row">${p}교시</th>${cells.join('')}</tr>`);
    }
    return `<div class="tt-wrap"><table class="tt">
      <caption class="sr-only">${sel.grade}학년 ${sel.cls}반 시간표</caption>
      <thead><tr><th scope="col"><span class="sr-only">교시</span></th>${head}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
  }

  async function render() {
    const days = weekDays(offset);
    renderNav(days);
    const { grade, cls } = sel;
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
    if (key !== `${sel.grade}-${sel.cls}-${ymd(weekDays(offset)[0])}`) return;
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

  pickBtn.addEventListener('click', async () => {
    const picked = await openClassPicker();
    if (!picked) return;
    setSelection(picked.grade, picked.cls);
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
    const saved = store.get();
    const grade = saved && grades.includes(saved.grade) ? saved.grade : grades[0];
    const list = classes[grade];
    const cls = saved && saved.grade === grade && list.includes(saved.cls) ? saved.cls : list[0];
    setSelection(grade, cls);
    pickBtn.disabled = false;
    render();
  }

  init();
})();
