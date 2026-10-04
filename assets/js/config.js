// 학교 기본 정보. 이 파일만 고치면 모든 페이지에 반영됩니다.
window.SCHOOL = {
  name: '새솔고등학교',
  nameEn: 'Saesol High School',
  motto: '스스로 묻고, 함께 답하는 사람',
  address: '(00000) 서울특별시 ○○구 ○○로 123',
  tel: '02-000-0000',
  fax: '02-000-0001',
  founded: '1987',
  principal: '김○○',
  mapQuery: '서울특별시청',
};

// publishable 키는 브라우저에 노출되어도 되는 키입니다. 데이터 보호는 Supabase RLS가 담당합니다.
window.SUPABASE_CONFIG = {
  url: 'https://dbneonomwrqwlbitwdtr.supabase.co',
  key: 'sb_publishable_Smg0o4U5qYTkrLygwhVUSA_YM7HwKjM',
};
