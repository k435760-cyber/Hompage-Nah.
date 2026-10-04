(function () {
  'use strict';

  const { isAdmin, confirmDialog, alertDialog } = window.App;
  const { mountLayout, loginRequired, showError, getUser, getProfile, displayName, sb, fetchNotices, fetchNotice, fetchAdjacentNotices, escapeHtml, formatDate, isRecent, textToHtml, safeImageUrl } = window.App;

  mountLayout('notice');

  const PAGE_SIZE = 10;
  const root = document.querySelector('[data-notice-root]');
  const params = new URLSearchParams(window.location.search);

  const isImportant = (p) => p && p !== 'general';

  function link(next) {
    const q = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => v && q.set(k, v));
    const s = q.toString();
    return `notice.html${s ? `?${s}` : ''}`;
  }

  async function renderList(profile) {
    const page = Math.max(1, parseInt(params.get('page'), 10) || 1);
    const query = (params.get('q') || '').trim();
    const { rows, total } = await fetchNotices({ page, size: PAGE_SIZE, query });
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const body = rows.length
      ? rows
          .map(
            (n, i) => `<tr${isImportant(n.priority) ? ' class="is-important"' : ''}>
            <td class="col-no">${isImportant(n.priority) ? '<span class="tag tag--red">중요</span>' : total - (page - 1) * PAGE_SIZE - i}</td>
            <td class="col-title"><a href="${link({ id: n.id })}">${escapeHtml(n.title)}</a>${isRecent(n.created_at) ? ' <span class="new" aria-label="새 글">N</span>' : ''}</td>
            <td class="col-author">${escapeHtml(n.author || '')}</td>
            <td class="col-date">${formatDate(n.created_at)}</td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="4" class="empty">${query ? '검색 결과가 없습니다.' : '등록된 공지가 없습니다.'}</td></tr>`;

    const pages = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(lastPage, start + 4);
    for (let p = start; p <= end; p += 1) {
      pages.push(p === page
        ? `<strong aria-current="page">${p}</strong>`
        : `<a href="${link({ page: p, q: query })}">${p}</a>`);
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
        <caption class="sr-only">공지사항 목록</caption>
        <thead><tr><th scope="col" class="col-no">번호</th><th scope="col">제목</th><th scope="col" class="col-author">작성자</th><th scope="col" class="col-date">등록일</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <nav class="paging" aria-label="페이지">
        ${page > 1 ? `<a href="${link({ page: page - 1, q: query })}">이전</a>` : ''}
        ${pages.join('')}
        ${page < lastPage ? `<a href="${link({ page: page + 1, q: query })}">다음</a>` : ''}
      </nav>
      ${isAdmin(profile) ? `<div class="actions"><a class="btn" href="${link({ write: '1' })}">글쓰기</a></div>` : ''}`;
  }

  async function renderDetail(id, profile) {
    const n = await fetchNotice(id);
    if (!n) {
      root.innerHTML = `<p class="empty">삭제되었거나 없는 글입니다.</p><div class="actions"><a class="btn btn--ghost" href="notice.html">목록</a></div>`;
      return;
    }
    document.title = `${n.title} | ${document.title}`;
    const { prev, next } = await fetchAdjacentNotices(n.created_at);
    const img = safeImageUrl(n.image_url);

    root.innerHTML = `
      <article class="view">
        <header class="view__head">
          <h2>${isImportant(n.priority) ? '<span class="tag tag--red">중요</span> ' : ''}${escapeHtml(n.title)}</h2>
          <dl class="view__meta">
            <div><dt>작성자</dt><dd>${escapeHtml(n.author || '')}</dd></div>
            <div><dt>등록일</dt><dd>${formatDate(n.created_at)}</dd></div>
          </dl>
        </header>
        <div class="view__body">
          ${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy">` : ''}
          ${textToHtml(n.content || '')}
        </div>
      </article>
      <ul class="prevnext">
        <li><span>다음글</span>${next ? `<a href="${link({ id: next.id })}">${escapeHtml(next.title)}</a>` : '<em>다음 글이 없습니다.</em>'}</li>
        <li><span>이전글</span>${prev ? `<a href="${link({ id: prev.id })}">${escapeHtml(prev.title)}</a>` : '<em>이전 글이 없습니다.</em>'}</li>
      </ul>
      <div class="actions">
        ${isAdmin(profile) ? '<button type="button" class="btn btn--danger" data-delete>삭제</button>' : ''}
        <a class="btn btn--ghost" href="notice.html">목록</a>
      </div>`;

    root.querySelector('[data-delete]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '공지 삭제',
        message: '이 공지를 삭제할까요? 삭제한 글은 되돌릴 수 없습니다.',
        confirmText: '삭제',
        danger: true,
      });
      if (!ok) return;
      const { error } = await sb.from('notices').delete().eq('id', n.id);
      if (error) return alertDialog({ title: '삭제 실패', message: '삭제하지 못했습니다. 권한을 확인해 주세요.' });
      window.location.replace('notice.html');
    });
  }

  function renderWrite(user, profile) {
    if (!isAdmin(profile)) {
      root.innerHTML = '<p class="empty">글쓰기 권한이 없습니다.</p>';
      return;
    }
    root.innerHTML = `
      <form class="write" novalidate>
        <div class="field">
          <label for="w-title">제목</label>
          <input id="w-title" name="title" maxlength="200" required>
        </div>
        <div class="field field--inline">
          <label><input type="checkbox" name="important"> 중요 공지로 표시</label>
        </div>
        <div class="field">
          <label for="w-content">내용</label>
          <textarea id="w-content" name="content" rows="14" required></textarea>
        </div>
        <p class="alert" role="alert" hidden></p>
        <div class="actions">
          <a class="btn btn--ghost" href="notice.html">취소</a>
          <button class="btn" type="submit">등록</button>
        </div>
      </form>`;

    const form = root.querySelector('form');
    const alert = form.querySelector('.alert');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = form.title.value.trim();
      const content = form.content.value.trim();
      if (!title || !content) {
        alert.hidden = false;
        alert.textContent = '제목과 내용을 모두 입력해 주세요.';
        return;
      }
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      const { data, error } = await sb
        .from('notices')
        .insert({
          title,
          content,
          priority: form.important.checked ? 'important' : 'general',
          author: displayName(user, profile),
          role: profile.role || '관리자',
          user_id: user.id,
        })
        .select('id')
        .single();
      if (error) {
        submit.disabled = false;
        alert.hidden = false;
        alert.textContent = '등록하지 못했습니다. 잠시 후 다시 시도해 주세요.';
        return;
      }
      window.location.replace(link({ id: data.id }));
    });
  }

  async function init() {
    const user = await getUser();
    if (!user) return loginRequired(root);
    const profile = await getProfile(user);
    try {
      const id = params.get('id');
      if (params.get('write')) renderWrite(user, profile);
      else if (id && /^\d+$/.test(id)) await renderDetail(id, profile);
      else await renderList(profile);
    } catch {
      showError(root);
    }
  }

  init();
})();
