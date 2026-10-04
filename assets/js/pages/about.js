(function () {
  'use strict';

  const { mountLayout, school } = window.App;

  mountLayout('about');

  const map = document.querySelector('[data-map]');
  const iframe = document.createElement('iframe');
  iframe.title = `${school.name} 위치 지도`;
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(school.mapQuery || school.address)}&z=16&output=embed`;
  map.append(iframe);
})();
