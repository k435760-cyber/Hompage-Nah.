import { supabase } from './supabase.js';

let profileCache = null;

export async function getUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export async function getProfile(user) {
  if (!user) return null;
  if (profileCache?.id === user.id) return profileCache;
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, role, is_admin, avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  profileCache = data;
  return data;
}

export function displayName(user, profile) {
  return profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
}

// 로그인 후 돌아올 주소는 같은 사이트 안의 경로만 허용합니다.
export function safeNext(raw) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export async function signInWithGoogle(next = '/') {
  const redirectTo = new URL('/login.html', window.location.origin);
  redirectTo.searchParams.set('next', safeNext(next));
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo.toString(),
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  profileCache = null;
  await supabase.auth.signOut();
}
