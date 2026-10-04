// 학교 기본 정보. 이 파일만 고치면 모든 페이지에 반영됩니다.
window.SCHOOL = {
  name: '영도제일중학교',
  nameEn: 'Yeongdo Jeil Middle School',
  motto: '건강하게, 참되게, 슬기롭게',
  address: '(49106) 부산광역시 영도구 중리로 64',
  tel: '051-404-5493',
  fax: '051-404-0408',
  type: '공립',
  founded: '1994년 3월 1일',
  mapQuery: '부산광역시 영도구 중리로 64',

  // 학교 로고 파일. assets/img/logo.png 를 넣으면 머리말과 브라우저 탭 아이콘에 표시됩니다.
  // 파일이 없으면 학교 이름 첫 글자로 대신 표시합니다.
  logo: 'assets/img/logo.png',

  // 대중교통 안내. kind 를 생략하면 '버스', direction 은 생략할 수 있습니다.
  // color: 'green' 이면 번호를 초록색으로 표시합니다 (기본은 남색).
  transit: [
    {
      buses: ['6', '7', '70', '71', '508'],
      direction: '고신대 방면',
      stops: ['동삼1동 행정복지센터', '절영아파트'],
    },
    {
      buses: ['8', '30', '113', '190', '101'],
      direction: '태종대 방면',
      stops: ['동삼시장', '영도제일중학교'],
    },
    {
      kind: '마을버스',
      color: 'green',
      buses: ['영도5'],
      stops: ['동삼시장', '동삼1동 행정복지센터'],
    },
  ],
};

// publishable 키는 브라우저에 노출되어도 되는 키입니다. 데이터 보호는 Supabase RLS가 담당합니다.
window.SUPABASE_CONFIG = {
  url: 'https://dbneonomwrqwlbitwdtr.supabase.co',
  key: 'sb_publishable_Smg0o4U5qYTkrLygwhVUSA_YM7HwKjM',
};
