# 학교 홈페이지

공지사항, 학교소식, 급식안내를 제공하는 학교 홈페이지입니다. Supabase를 백엔드로 쓰고, 구성원은 Google 계정으로 로그인합니다.

## 페이지

| 경로 | 내용 |
| --- | --- |
| `/` | 메인 (오늘의 급식, 공지사항·학교소식 최신글, 바로가기) |
| `/about.html` | 학교장 인사말, 교육목표, 연혁, 오시는 길 |
| `/notice.html` | 공지사항 목록·검색·상세. 관리자는 글쓰기/삭제 가능 |
| `/news.html` | 학교소식 (분류별 필터) |
| `/meals.html` | 주간 식단표 |
| `/login.html` | Google 로그인 및 OAuth 콜백 처리 |

게시판 데이터는 Supabase RLS 정책상 로그인한 사용자만 읽을 수 있습니다. 비로그인 방문자에게는 로그인 안내가 표시됩니다. 글쓰기·삭제는 `profiles.is_admin = true`인 계정만 가능합니다.

## 사용하는 Supabase 테이블

기존 프로젝트(`dbneonomwrqwlbitwdtr`)의 테이블을 그대로 사용하며, 스키마를 바꾸지 않습니다.

- `notices` — 공지사항 (`priority`가 `general`이 아니면 "중요" 표시)
- `school_news` — 학교소식 (`category`, `pinned`, `event_date`)
- `meals` — 급식. `title`에 날짜(`2026-10-05` 또는 `10월 5일`)를 넣고, `items`에 메뉴 배열 또는 `{ "중식": [...], "석식": [...] }` 형태로 넣으면 됩니다. `"닭갈비(5.6.13.)"`처럼 쓰면 알레르기 번호가 작게 표시됩니다.
- `profiles` — 이름, 관리자 여부

## 학교 정보 바꾸기

`src/school.json`만 고치면 학교명, 교훈, 주소, 전화번호, 지도 위치가 모든 페이지에 반영됩니다.

## 개발

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # dist/ 에 배포용 파일 생성
npm run preview   # 빌드 결과 확인
```

Supabase 주소와 publishable 키는 `src/config.js`에 기본값으로 들어 있습니다. 다른 프로젝트를 쓰려면 `.env.example`을 `.env`로 복사해 값을 바꾸세요.

## Google 로그인 설정 (배포 전 필수)

1. Google Cloud Console → API 및 서비스 → 사용자 인증 정보에서 **OAuth 클라이언트 ID(웹 애플리케이션)** 를 만듭니다.
   - 승인된 리디렉션 URI: `https://dbneonomwrqwlbitwdtr.supabase.co/auth/v1/callback`
2. Supabase 대시보드 → Authentication → Sign In / Providers → **Google**을 켜고 클라이언트 ID와 시크릿을 입력합니다.
3. Supabase 대시보드 → Authentication → URL Configuration
   - Site URL: 실제 도메인 (예: `https://school.example.com`)
   - Redirect URLs: `https://school.example.com/login.html`, 개발용 `http://localhost:5173/login.html`

## 배포

정적 사이트라 어디든 올릴 수 있습니다. 빌드 명령은 `npm run build`, 출력 폴더는 `dist`입니다.

- **Vercel**: 저장소 연결만 하면 됩니다. 보안 헤더는 `vercel.json`에 있습니다.
- **Netlify / Cloudflare Pages**: 보안 헤더는 `public/_headers`에 있습니다.
