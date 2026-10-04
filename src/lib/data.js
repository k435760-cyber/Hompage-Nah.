import { supabase } from './supabase.js';

export async function fetchNotices({ page = 1, size = 10, query = '' } = {}) {
  const from = (page - 1) * size;
  let req = supabase
    .from('notices')
    .select('id, title, author, priority, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + size - 1);
  if (query) req = req.ilike('title', `%${query.replace(/[%_\\]/g, '\\$&')}%`);
  const { data, error, count } = await req;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function fetchNotice(id) {
  const { data, error } = await supabase.from('notices').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAdjacentNotices(createdAt) {
  const [prev, next] = await Promise.all([
    supabase.from('notices').select('id, title').lt('created_at', createdAt)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('notices').select('id, title').gt('created_at', createdAt)
      .order('created_at', { ascending: true }).limit(1).maybeSingle(),
  ]);
  return { prev: prev.data, next: next.data };
}

export async function fetchNews({ category, limit = 50 } = {}) {
  let req = supabase
    .from('school_news')
    .select('id, category, title, content, event_date, image_url, pinned, created_at')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (category) req = req.eq('category', category);
  const { data, error } = await req;
  if (error) throw error;
  return data;
}

export async function fetchMeals(limit = 30) {
  const { data, error } = await supabase
    .from('meals')
    .select('id, title, items, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(normalizeMeal).sort((a, b) => b.date - a.date);
}

// ---- 급식 데이터 정리 ----
// items 컬럼은 형식이 정해져 있지 않아 배열/객체/문자열을 모두 받아줍니다.

function toDishes(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((v) => (typeof v === 'string' ? [v] : v?.name ? [String(v.name)] : toDishes(v)));
  }
  if (typeof value === 'string') return value.split(/\n|,|<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'object') return Object.values(value).flatMap(toDishes);
  return [String(value)];
}

function toSections(items) {
  if (items && typeof items === 'object' && !Array.isArray(items)) {
    const sections = Object.entries(items)
      .map(([label, v]) => ({ label, dishes: toDishes(v) }))
      .filter((s) => s.dishes.length);
    if (sections.length) return sections;
  }
  return [{ label: '', dishes: toDishes(items) }];
}

function parseMealDate(title = '', createdAt) {
  const base = new Date(createdAt);
  let m = title.match(/(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = title.match(/(\d{1,2})\s*[월/.]\s*(\d{1,2})/);
  if (m) return new Date(base.getFullYear(), +m[1] - 1, +m[2]);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

// "닭갈비(5.6.13.)" → 이름과 알레르기 번호를 분리
export function splitAllergy(dish) {
  const m = dish.match(/^(.*?)\s*\(?([\d.]+)\)?\s*$/);
  if (m && /\d\./.test(m[2])) return { name: m[1].trim(), allergy: m[2].replace(/\.$/, '') };
  return { name: dish, allergy: '' };
}

function normalizeMeal(row) {
  return {
    id: row.id,
    title: row.title || '',
    date: parseMealDate(row.title || '', row.created_at),
    sections: toSections(row.items),
  };
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
