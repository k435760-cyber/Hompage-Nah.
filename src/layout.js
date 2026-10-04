import './styles/main.css';
import { school } from './config.js';
import { supabase } from './lib/supabase.js';
import { getUser, getProfile, displayName, signInWithGoogle, signOut } from './lib/auth.js';
import { escapeHtml } from './lib/format.js';

const NAV = [
  { id: 'about', href: '/about.html', label: '학교소개' },
  { id: 'notice', href: '/notice.html', label: '공지사항' },
  { id: 'news', href: '/news.html', label: '학교소식' },
  { id: 'meals', href: '/meals.html', label: '급식안내' },
];

const currentPath = () => window.location.pathname + window.location.search;

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
        <a class="brand" href="/">
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
  const s = school;
  return `
    <div class="wrap footer__inner">
      <ul class="footer__links">
        <li><a href="/about.html#greeting">학교장 인사말</a></li>
        <li><a href="/about.html#location">오시는 길</a></li>
        <li><a href="/notice.html">공지사항</a></li>
      </ul>
      <p class="footer__name">${escapeHtml(s.name)}</p>
      <address>
        ${escapeHtml(s.address)}<br>
        교무실 ${escapeHtml(s.tel)} &nbsp;·&nbsp; 팩스 ${escapeHtml(s.fax)}
      </address>
      <p class="footer__copy">© ${new Date().getFullYear()} ${escapeHtml(s.name)}. All rights reserved.</p>
    </div>`;
}

async function renderAuth(slot) {
  const user = await getUser();
  if (!user) {
    if (document.body.dataset.page === 'login') return (slot.innerHTML = '');
    slot.innerHTML = `<a href="/login.html?next=${encodeURIComponent(currentPath())}">로그인</a>`;
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

// 받침 유무에 따라 조사를 고릅니다. pair: '은는', '이가', '을를'
function josa(word, pair) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return pair[1];
  return code % 28 ? pair[0] : pair[1];
}

function bindMenu(header) {
  const btn = header.querySelector('.menu-btn');
  const nav = header.querySelector('.gnb');
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
}

export function mountLayout(page) {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  header.innerHTML = headerHtml(page);
  footer.innerHTML = footerHtml();
  bindMenu(header);
  document.querySelectorAll('[data-school]').forEach((el) => {
    const value = school[el.dataset.school] ?? '';
    el.textContent = el.dataset.josa ? value + josa(value, el.dataset.josa) : value;
  });
  const slot = header.querySelector('[data-auth]');
  renderAuth(slot);
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') renderAuth(slot);
  });
}

// 비로그인 상태에서 게시판 영역에 보여줄 안내
export function loginRequired(el, message = '로그인한 구성원만 볼 수 있습니다.') {
  el.innerHTML = `
    <div class="locked">
      <p>${escapeHtml(message)}</p>
      <button type="button" class="btn-google" data-google>${googleIcon()}Google 계정으로 로그인</button>
    </div>`;
  el.querySelector('[data-google]').addEventListener('click', () => signInWithGoogle(currentPath()));
}

export function showError(el, text = '내용을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.') {
  el.innerHTML = `<p class="empty">${escapeHtml(text)}</p>`;
}

export function googleIcon() {
  return `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
}
