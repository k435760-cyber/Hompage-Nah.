import { mountLayout, googleIcon } from '../layout.js';
import { supabase } from '../lib/supabase.js';
import { signInWithGoogle, safeNext } from '../lib/auth.js';
import { escapeHtml } from '../lib/format.js';

mountLayout('login');

const params = new URLSearchParams(window.location.search);
const next = safeNext(params.get('next'));
const box = document.querySelector('[data-login]');

function renderButton(error) {
  box.innerHTML = `
    ${error ? `<p class="alert" role="alert">${escapeHtml(error)}</p>` : ''}
    <button type="button" class="btn-google btn-google--wide">${googleIcon()}Google 계정으로 로그인</button>`;
  const btn = box.querySelector('button');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await signInWithGoogle(next);
    } catch {
      btn.disabled = false;
      renderButton('로그인 창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  });
}

const oauthError = params.get('error_description') || params.get('error');
if (oauthError) {
  renderButton('로그인이 취소되었거나 실패했습니다. 다시 시도해 주세요.');
} else {
  box.innerHTML = '<p class="loading">확인 중</p>';
  // OAuth 콜백(?code=...)은 클라이언트 초기화 시 자동으로 세션으로 교환됩니다.
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) window.location.replace(next);
    else renderButton();
  });
}
