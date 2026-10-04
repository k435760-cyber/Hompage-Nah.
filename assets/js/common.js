(function () {
  'use strict';

  const school = window.SCHOOL;
  const cfg = window.SUPABASE_CONFIG;

  const sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });

  // ---------- 서식 ----------
  const pad = (n) => String(n).padStart(2, '0');
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  }

  function isRecent(value, days = 3) {
    return Date.now() - new Date(value).getTime() < days * 86400000;
  }

  function escapeHtml(str = '') {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // 본문은 줄바꿈만 살리고 나머지는 모두 이스케이프합니다.
  function textToHtml(str = '') {
    return escapeHtml(str)
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replaceAll('\n', '<br>')}</p>`)
      .join('');
  }

  function safeImageUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' ? u.toString() : null;
    } catch {
      return null;
    }
  }

  // 받침 유무에 따라 조사를 고릅니다. pair: '은는', '이가', '을를'
  function josa(word, pair) {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    if (code < 0 || code > 11171) return pair[1];
    return code % 28 ? pair[0] : pair[1];
  }

  // ---------- 인증 ----------
  let profileCache = null;

  async function getUser() {
    const { data } = await sb.auth.getSession();
    return data.session?.user ?? null;
  }

  async function getProfile(user) {
    if (!user) return null;
    if (profileCache?.id === user.id) return profileCache;
    const { data } = await sb
      .from('profiles')
      .select('id, name, email, role, is_admin, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    profileCache = data;
    return data;
  }

  function displayName(user, profile) {
    return profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  }

  // 현재 페이지 기준 상대 주소 (파일명 + 쿼리)
  function currentPage() {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    return file + window.location.search;
  }

  // 로그인 후 돌아갈 곳은 같은 사이트 안의 페이지만 허용합니다.
  function safeNext(raw) {
    if (!raw || /^[a-z][\w+.-]*:|^\/\/|\\/i.test(raw)) return 'index.html';
    try {
      const u = new URL(raw, window.location.href);
      return u.origin === window.location.origin ? raw : 'index.html';
    } catch {
      return 'index.html';
    }
  }

  async function signInWithGoogle(next) {
    const redirectTo = new URL('login.html', window.location.href);
    redirectTo.search = '';
    redirectTo.searchParams.set('next', safeNext(next || currentPage()));
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
  }

  async function signOut() {
    profileCache = null;
    await sb.auth.signOut();
  }

  // ---------- 데이터 ----------
  async function fetchNotices({ page = 1, size = 10, query = '' } = {}) {
    const from = (page - 1) * size;
    let req = sb
      .from('notices')
      .select('id, title, author, priority, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + size - 1);
    if (query) req = req.ilike('title', `%${query.replace(/[%_\\]/g, '\\$&')}%`);
    const { data, error, count } = await req;
    if (error) throw error;
    return { rows: data, total: count ?? 0 };
  }

  async function fetchNotice(id) {
    const { data, error } = await sb.from('notices').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function fetchAdjacentNotices(createdAt) {
    const [prev, next] = await Promise.all([
      sb.from('notices').select('id, title').lt('created_at', createdAt)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('notices').select('id, title').gt('created_at', createdAt)
        .order('created_at', { ascending: true }).limit(1).maybeSingle(),
    ]);
    return { prev: prev.data, next: next.data };
  }

  async function fetchNews({ category, limit = 50 } = {}) {
    let req = sb
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

  function parseMealDate(title, createdAt) {
    const base = new Date(createdAt);
    let m = title.match(/(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = title.match(/(\d{1,2})\s*[월/.]\s*(\d{1,2})/);
    if (m) return new Date(base.getFullYear(), +m[1] - 1, +m[2]);
    return new Date(base.getFullYear(), base.getMonth(), base.getDate());
  }

  // "닭갈비(5.6.13.)" → 이름과 알레르기 번호를 분리
  function splitAllergy(dish) {
    const m = dish.match(/^(.*?)\s*\(?([\d.]+)\)?\s*$/);
    if (m && /\d\./.test(m[2])) return { name: m[1].trim(), allergy: m[2].replace(/\.$/, '') };
    return { name: dish, allergy: '' };
  }

  async function fetchMeals(limit = 30) {
    const { data, error } = await sb
      .from('meals')
      .select('id, title, items, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data
      .map((row) => ({
        id: row.id,
        title: row.title || '',
        date: parseMealDate(row.title || '', row.created_at),
        sections: toSections(row.items),
      }))
      .sort((a, b) => b.date - a.date);
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // ---------- 레이아웃 ----------
  const NAV = [
    { id: 'about', href: 'about.html', label: '학교소개' },
    { id: 'notice', href: 'notice.html', label: '공지사항' },
    { id: 'news', href: 'news.html', label: '학교소식' },
    { id: 'meals', href: 'meals.html', label: '급식안내' },
  ];

  function googleIcon() {
    return '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  }

  function headerHtml(page) {
    const links = NAV.map(
      (n) => `<li><a href="${n.href}"${n.id === page ? ' aria-current="page"' : ''}>${n.label}</a></li>`
    ).join('');
    return `
      <a class="skip" href="#main">본문 바로가기</a>
      <div class="util">
        <div class="wrap util__inner">
          <span class="util__en">${escapeHtml(school.nameEn)}</span>
          <div class="util__auth" data-auth></div>
        </div>
      </div>
      <div class="masthead">
        <div class="wrap masthead__inner">
          <a class="brand" href="index.html">
            <span class="brand__mark" aria-hidden="true">${escapeHtml(school.name.slice(0, 1))}</span>
            <span class="brand__name">${escapeHtml(school.name)}</span>
          </a>
          <button class="menu-btn" type="button" aria-expanded="false" aria-controls="gnb">
            <span class="sr-only">메뉴 열기</span><span></span><span></span><span></span>
          </button>
          <nav id="gnb" class="gnb" aria-label="주 메뉴"><ul>${links}</ul></nav>
        </div>
      </div>`;
  }

  function footerHtml() {
    return `
      <div class="wrap footer__inner">
        <ul class="footer__links">
          <li><a href="about.html#motto">교훈</a></li>
          <li><a href="about.html#location">오시는 길</a></li>
          <li><a href="notice.html">공지사항</a></li>
        </ul>
        <p class="footer__name">${escapeHtml(school.name)}</p>
        <address>
          ${escapeHtml(school.address)}<br>
          교무실 ${escapeHtml(school.tel)} &nbsp;·&nbsp; 팩스 ${escapeHtml(school.fax)}
        </address>
        <p class="footer__copy">© ${new Date().getFullYear()} ${escapeHtml(school.name)}. All rights reserved.</p>
      </div>`;
  }

  // 로고 파일이 있으면 글자 표시 대신 로고를 씁니다.
  function applyLogo(header) {
    if (!school.logo) return;
    const img = new Image();
    img.className = 'brand__logo';
    img.alt = '';
    img.addEventListener('load', () => {
      header.querySelector('.brand__mark')?.replaceWith(img);
      const icon = document.querySelector('link[rel="icon"]');
      if (icon) {
        icon.href = school.logo;
        icon.removeAttribute('type');
      }
    });
    img.src = school.logo;
  }

  function transitHtml() {
    if (!school.transit?.length) return '';
    return `<ul class="transit">${school.transit
      .map(
        (t) => `<li>
          <p class="transit__buses"><span class="transit__kind">버스</span>${t.buses
            .map((b) => `<b>${escapeHtml(b)}</b>`)
            .join('')}</p>
          <p class="transit__stop"><strong>${escapeHtml(t.direction)}</strong> · ${t.stops
            .map((s) => escapeHtml(s))
            .join(' 또는 ')} 정류장 하차</p>
        </li>`
      )
      .join('')}</ul>`;
  }

  async function renderAuth(slot) {
    const user = await getUser();
    if (!user) {
      slot.innerHTML = document.body.dataset.page === 'login'
        ? ''
        : `<a href="login.html?next=${encodeURIComponent(currentPage())}">로그인</a>`;
      return;
    }
    const profile = await getProfile(user);
    slot.innerHTML = `
      <span class="util__user">${escapeHtml(displayName(user, profile))}님${profile?.is_admin ? ' <em>관리자</em>' : ''}</span>
      <button type="button" data-logout>로그아웃</button>`;
    slot.querySelector('[data-logout]').addEventListener('click', async () => {
      await signOut();
      window.location.reload();
    });
  }

  function mountLayout(page) {
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    header.innerHTML = headerHtml(page);
    footer.innerHTML = footerHtml();

    const btn = header.querySelector('.menu-btn');
    const nav = header.querySelector('.gnb');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    });

    applyLogo(header);
    document.querySelectorAll('[data-transit]').forEach((el) => {
      el.innerHTML = transitHtml();
    });

    document.querySelectorAll('[data-school]').forEach((el) => {
      const value = school[el.dataset.school] ?? '';
      el.textContent = el.dataset.josa ? value + josa(value, el.dataset.josa) : value;
    });

    // 제목의 학교명도 설정값으로 맞춥니다.
    document.title = document.title.replace('영도제일중학교', school.name);

    const slot = header.querySelector('[data-auth]');
    renderAuth(slot);
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => renderAuth(slot), 0);
    });
  }

  // 비로그인 상태에서 게시판 영역에 보여줄 안내
  function loginRequired(el, message = '로그인한 구성원만 볼 수 있습니다.') {
    el.innerHTML = `
      <div class="locked">
        <p>${escapeHtml(message)}</p>
        <button type="button" class="btn-google" data-google>${googleIcon()}Google 계정으로 로그인</button>
      </div>`;
    el.querySelector('[data-google]').addEventListener('click', () => signInWithGoogle());
  }

  function showError(el, text = '내용을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.') {
    el.innerHTML = `<p class="empty">${escapeHtml(text)}</p>`;
  }

  window.App = {
    school, sb, WEEKDAYS,
    formatDate, isRecent, escapeHtml, textToHtml, safeImageUrl,
    getUser, getProfile, displayName, safeNext, signInWithGoogle, signOut,
    fetchNotices, fetchNotice, fetchAdjacentNotices, fetchNews, fetchMeals, splitAllergy, sameDay,
    mountLayout, loginRequired, showError, googleIcon,
  };
})();
