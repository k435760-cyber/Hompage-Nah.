import school from './school.json';

// 학교 기본 정보는 src/school.json 한 곳에서 관리합니다.
export { school };

// publishable 키는 브라우저에 노출되어도 되는 키입니다. 데이터 보호는 Supabase RLS가 담당합니다.
export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || 'https://dbneonomwrqwlbitwdtr.supabase.co',
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Smg0o4U5qYTkrLygwhVUSA_YM7HwKjM',
};
