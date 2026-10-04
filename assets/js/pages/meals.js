(function () {
  'use strict';

  const { mountLayout, loginRequired, showError, getUser, fetchMeals, sameDay, splitAllergy, escapeHtml, WEEKDAYS } = window.App;

  mountLayout('meals');

  const mealsEl = document.querySelector('[data-meals]');
  const navEl = document.querySelector('[data-week-nav]');
  const today = new Date();
  let meals = [];
  let offset = 0; // 0 = 이번 주

  function mondayOf(date, weeks) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - diff + weeks * 7);
    return d;
  }

  function render() {
    const monday = mondayOf(today, offset);
    const days = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    const fri = days[4];
    navEl.innerHTML = `
      <button type="button" data-step="-1">이전 주</button>
      <p><strong>${monday.getMonth() + 1}월 ${monday.getDate()}일 ~ ${fri.getMonth() + 1}월 ${fri.getDate()}일</strong></p>
      <button type="button" data-step="1">다음 주</button>`;

    mealsEl.innerHTML = `<div class="week">${days
      .map((d) => {
        const meal = meals.find((m) => sameDay(m.date, d));
        const isToday = sameDay(d, today);
        const content = meal
          ? meal.sections
              .map(
                (s) => `${s.label ? `<p class="day__label">${escapeHtml(s.label)}</p>` : ''}
                <ul class="day__menu">${s.dishes
                  .map((dish) => {
                    const { name, allergy } = splitAllergy(dish);
                    return `<li>${escapeHtml(name)}${allergy ? ` <small>${escapeHtml(allergy)}</small>` : ''}</li>`;
                  })
                  .join('')}</ul>`
              )
              .join('')
          : '<p class="day__none">급식 없음</p>';
        return `<section class="day${isToday ? ' is-today' : ''}">
          <h2 class="day__head">${d.getMonth() + 1}.${d.getDate()} <span>${WEEKDAYS[d.getDay()]}</span>${isToday ? '<em>오늘</em>' : ''}</h2>
          ${content}
        </section>`;
      })
      .join('')}</div>`;
  }

  navEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    offset += Number(btn.dataset.step);
    render();
  });

  async function init() {
    const user = await getUser();
    if (!user) return loginRequired(mealsEl);
    try {
      meals = await fetchMeals(60);
      render();
    } catch {
      showError(mealsEl);
    }
  }

  init();
})();
