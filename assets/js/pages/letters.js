(function () {
  'use strict';

  const {
    mountLayout, showError, getUser, getProfile, displayName, isAdmin, sb,
    LETTER_BUCKET, fetchLetters, fetchLetter, letterFileUrl, formatSize,
    escapeHtml, formatDate, isRecent, textToHtml,
  } = window.App;

  mountLayout('letters');

  const PAGE_SIZE = 10;
  const MAX_FILES = 5;
  const MAX_SIZE = 20 * 1024 * 1024;
  const ALLOWED_EXT = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'gif', 'webp'];
  const TARGETS = ['전체', '1학년', '2학년', '3학년'];

  const root = document.querySelector('[data-letters-root]');
  const params = new URLSearchParams(window.location.search);

  const ext = (name) => (name.split('.').pop() || '').toLowerCase();

  function link(next) {
    const q = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => v && q.set(k, v));
    const s = q.toString();
    return `letters.html${s ? `?${s}` : ''}`;
  }

  const clipIcon = '<svg class="clip" viewBox="0 0 24 24" width="16" height="16" aria-label="첨부파일 있음" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/></svg>';

  // 제목에 이미 대상이 들어 있으면("3학년 진학설명회") 표시하지 않습니다.
  function targetTag(t, title = '') {
    return t && t !== '전체' && !title.includes(t) ? `<span class="tag">${escapeHtml(t)}</span> ` : '';
  }

  async function renderList(admin) {
    const page = Math.max(1, parseInt(params.get('page'), 10) || 1);
    const query = (params.get('q') || '').trim();
    const { rows, total } = await fetchLetters({ page, size: PAGE_SIZE, query });
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const body = rows.length
      ? rows
          .map(
            (n, i) => `<tr>
            <td class="col-no">${total - (page - 1) * PAGE_SIZE - i}</td>
            <td class="col-title">${targetTag(n.target, n.title)}<a href="${link({ id: n.id })}">${escapeHtml(n.title)}</a>${n.attachments?.length ? ` ${clipIcon}` : ''}${isRecent(n.created_at) ? ' <span class="new" aria-label="새 글">N</span>' : ''}</td>
            <td class="col-author">${escapeHtml(n.author || '')}</td>
            <td class="col-date">${formatDate(n.created_at)}</td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="4" class="empty">${query ? '검색 결과가 없습니다.' : '등록된 가정통신문이 없습니다.'}</td></tr>`;

    const pages = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(lastPage, start + 4);
    for (let p = start; p <= end; p += 1) {
      pages.push(p === page ? `<strong aria-current="page">${p}</strong>` : `<a href="${link({ page: p, q: query })}">${p}</a>`);
    }

    root.innerHTML = `
      <div class="board-top">
        <p class="board-top__count">전체 <strong>${total}</strong>건</p>
        <form class="search" role="search">
          <label class="sr-only" for="q">제목 검색</label>
          <input id="q" name="q" type="search" value="${escapeHtml(query)}" placeholder="제목 검색">
          <button type="submit">검색</button>
        </form>
      </div>
      <table class="tbl">
        <caption class="sr-only">가정통신문 목록</caption>
        <thead><tr><th scope="col" class="col-no">번호</th><th scope="col">제목</th><th scope="col" class="col-author">작성자</th><th scope="col" class="col-date">등록일</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <nav class="paging" aria-label="페이지">
        ${page > 1 ? `<a href="${link({ page: page - 1, q: query })}">이전</a>` : ''}
        ${pages.join('')}
        ${page < lastPage ? `<a href="${link({ page: page + 1, q: query })}">다음</a>` : ''}
      </nav>
      ${admin ? `<div class="actions"><a class="btn" href="${link({ write: '1' })}">글쓰기</a></div>` : ''}`;
  }

  async function renderDetail(id, admin) {
    const n = await fetchLetter(id);
    if (!n) {
      root.innerHTML = '<p class="empty">삭제되었거나 없는 글입니다.</p><div class="actions"><a class="btn btn--ghost" href="letters.html">목록</a></div>';
      return;
    }
    document.title = `${n.title} | ${document.title}`;
    const files = Array.isArray(n.attachments) ? n.attachments : [];

    root.innerHTML = `
      <article class="view">
        <header class="view__head">
          <h2>${targetTag(n.target, n.title)}${escapeHtml(n.title)}</h2>
          <dl class="view__meta">
            <div><dt>작성자</dt><dd>${escapeHtml(n.author || '')}</dd></div>
            <div><dt>등록일</dt><dd>${formatDate(n.created_at)}</dd></div>
          </dl>
        </header>
        ${files.length ? `<ul class="files" aria-label="첨부파일">${files
          .map((f) => `<li><a href="${escapeHtml(letterFileUrl(f))}" rel="noopener">${clipIcon}<span>${escapeHtml(f.name)}</span></a> <small>${formatSize(f.size)}</small></li>`)
          .join('')}</ul>` : ''}
        <div class="view__body">${textToHtml(n.content || '')}</div>
      </article>
      <div class="actions">
        ${admin ? '<button type="button" class="btn btn--danger" data-delete>삭제</button>' : ''}
        <a class="btn btn--ghost" href="letters.html">목록</a>
      </div>`;

    root.querySelector('[data-delete]')?.addEventListener('click', async () => {
      if (!window.confirm('이 가정통신문을 삭제할까요? 첨부파일도 함께 지워지며 되돌릴 수 없습니다.')) return;
      const { error } = await sb.from('home_letters').delete().eq('id', n.id);
      if (error) return window.alert('삭제하지 못했습니다. 권한을 확인해 주세요.');
      if (files.length) await sb.storage.from(LETTER_BUCKET).remove(files.map((f) => f.path));
      window.location.replace('letters.html');
    });
  }

  function renderWrite(user, profile) {
    root.innerHTML = `
      <form class="write" novalidate>
        <div class="field">
          <label for="w-title">제목</label>
          <input id="w-title" name="title" maxlength="200" required>
        </div>
        <div class="field">
          <label for="w-target">대상</label>
          <select id="w-target" name="target">${TARGETS.map((t) => `<option>${t}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label for="w-content">내용</label>
          <textarea id="w-content" name="content" rows="10"></textarea>
        </div>
        <div class="field">
          <label for="w-files">첨부파일</label>
          <input id="w-files" name="files" type="file" multiple accept="${ALLOWED_EXT.map((e) => `.${e}`).join(',')}">
          <p class="field__help">PDF, 한글(HWP·HWPX), 워드, 이미지 · 파일당 20MB, 최대 ${MAX_FILES}개</p>
        </div>
        <p class="alert" role="alert" hidden></p>
        <div class="actions">
          <a class="btn btn--ghost" href="letters.html">취소</a>
          <button class="btn" type="submit">등록</button>
        </div>
      </form>`;

    const form = root.querySelector('form');
    const alertEl = form.querySelector('.alert');
    const fail = (msg) => {
      alertEl.hidden = false;
      alertEl.textContent = msg;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertEl.hidden = true;
      const title = form.title.value.trim();
      const content = form.content.value.trim();
      const files = [...form.files.files];
      if (!title) return fail('제목을 입력해 주세요.');
      if (!content && !files.length) return fail('내용을 입력하거나 파일을 첨부해 주세요.');
      if (files.length > MAX_FILES) return fail(`첨부파일은 ${MAX_FILES}개까지 올릴 수 있습니다.`);
      const bad = files.find((f) => !ALLOWED_EXT.includes(ext(f.name)) || f.size > MAX_SIZE);
      if (bad) return fail(`"${bad.name}" 파일은 올릴 수 없습니다. 형식과 크기(20MB 이하)를 확인해 주세요.`);

      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = '올리는 중';

      // 저장소 경로에는 한글 파일명을 쓰지 않고, 원래 이름은 DB에 보관합니다.
      const uploaded = [];
      try {
        for (const f of files) {
          const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext(f.name)}`;
          const { error } = await sb.storage
            .from(LETTER_BUCKET)
            .upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
          if (error) throw error;
          uploaded.push({ name: f.name, path, size: f.size });
        }
        const { data, error } = await sb
          .from('home_letters')
          .insert({
            title,
            content,
            target: form.target.value,
            attachments: uploaded,
            author: displayName(user, profile),
            user_id: user.id,
          })
          .select('id')
          .single();
        if (error) throw error;
        window.location.replace(link({ id: data.id }));
      } catch {
        if (uploaded.length) await sb.storage.from(LETTER_BUCKET).remove(uploaded.map((u) => u.path));
        submit.disabled = false;
        submit.textContent = '등록';
        fail('등록하지 못했습니다. 관리자 권한과 파일을 확인한 뒤 다시 시도해 주세요.');
      }
    });
  }

  // 가정통신문은 학부모도 볼 수 있도록 로그인 없이 공개합니다.
  async function init() {
    const user = await getUser();
    const profile = user ? await getProfile(user) : null;
    const admin = isAdmin(profile);
    try {
      const id = params.get('id');
      if (params.get('write')) {
        if (!admin) {
          root.innerHTML = '<p class="empty">글쓰기 권한이 없습니다.</p>';
          return;
        }
        renderWrite(user, profile);
      } else if (id && /^\d+$/.test(id)) await renderDetail(id, admin);
      else await renderList(admin);
    } catch {
      showError(root);
    }
  }

  init();
})();
