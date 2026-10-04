(function () {
  'use strict';

  const { mountLayout, showError, fetchMeals, sameDay, splitAllergy, escapeHtml, WEEKDAYS } = window.App;

  mountLayout('meals');

  const mealsEl = document.querySelector('[data-meals]');
  const navEl = document.querySelector('[data-week-nav]');
  const today = new Date();
  const cache = new Map(); // 주 시작일 → 식단
  // 주말에는 다가오는 주를 먼저 보여 줍니다.
  const homeOffset = today.getDay() === 0 || today.getDay() === 6 ? 1 : 0;
  let offset = homeOffset;

  function weekDays(weeks) {
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weeks * 7);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }

  function dishHtml(dish) {
    const { name, allergy } = splitAllergy(dish);
    return `<li>${escapeHtml(name)}${allergy ? ` <small>${escapeHtml(allergy)}</small>` : ''}</li>`;
  }

  function dayHtml(d, meal) {
    const isToday = sameDay(d, today);
    const content = meal
      ? meal.sections
          .map(
            (s) => `<p class="day__label">${escapeHtml(s.label)}${s.cal ? `<span>${escapeHtml(s.cal)}</span>` : ''}</p>
            <ul class="day__menu">${s.dishes.map(dishHtml).join('')}</ul>`
          )
          .join('')
      : '<p class="day__none">급식 없음</p>';
    return `<section class="day${isToday ? ' is-today' : ''}">
      <h2 class="day__head">${d.getMonth() + 1}.${d.getDate()} <span>${WEEKDAYS[d.getDay()]}</span>${isToday ? '<em>오늘</em>' : ''}</h2>
      ${content}
    </section>`;
  }

  async function render() {
    const days = weekDays(offset);
    const [mon, fri] = [days[0], days[4]];
    // 연도가 바뀌는 주(12월 말~1월 초)는 끝 날짜에도 연도를 붙입니다.
    const sameYear = mon.getFullYear() === fri.getFullYear();
    const end = `${sameYear ? '' : `${fri.getFullYear()}년 `}${fri.getMonth() + 1}월 ${fri.getDate()}일`;
    navEl.innerHTML = `
      <button type="button" data-step="-1">이전 주</button>
      <p>
        <span class="week-nav__year">${mon.getFullYear()}년</span>
        <strong>${mon.getMonth() + 1}월 ${mon.getDate()}일 ~ ${end}</strong>
      </p>
      <button type="button" data-step="1">다음 주</button>
      ${offset !== homeOffset ? '<button type="button" class="week-nav__home" data-home>이번 주로</button>' : ''}`;

    const key = mon.toDateString();
    if (!cache.has(key)) {
      mealsEl.innerHTML = '<p class="loading">불러오는 중</p>';
      try {
        cache.set(key, await fetchMeals(mon, fri));
      } catch {
        return showError(mealsEl, '식단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
    // 응답을 기다리는 동안 다른 주로 넘어갔으면 그리지 않습니다.
    if (weekDays(offset)[0].toDateString() !== key) return;

    const meals = cache.get(key);
    mealsEl.innerHTML = `<div class="week">${days
      .map((d) => dayHtml(d, meals.find((m) => sameDay(m.date, d))))
      .join('')}</div>`;
  }

  navEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-home]')) {
      offset = homeOffset;
      render();
      return;
    }
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    offset += Number(btn.dataset.step);
    render();
  });

  render();
})();
