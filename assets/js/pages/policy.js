(function () {
  'use strict';

  const { mountLayout, school } = window.App;

  mountLayout(document.body.dataset.page);

  // 값이 비어 있는 항목은 숨깁니다.
  document.querySelectorAll('[data-optional]').forEach((el) => {
    if (!school[el.dataset.optional]) el.hidden = true;
  });
})();
