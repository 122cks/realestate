# Real Estate (부동산 매물 관리)

간단한 로컬 개발 및 배포 가이드입니다. 민감한 키는 로컬 `.env.local` 또는 GitHub Secrets에 안전하게 저장하세요.

## 빠른 시작 (로컬)

1. 프로젝트 복제 후 의존성 설치:

```bash
npm install
```

2. `.env.local`을 생성하고 아래 값을 채우세요 (`.env.local.sample` 참고):

- `VITE_GOOGLE_API_KEY` — (선택) 공개 시트 접근용 API Key
- `VITE_GOOGLE_CLIENT_ID` — (선택) OAuth 로그인용 클라이언트 ID
- `VITE_SPREADSHEET_ID` — 기본값이 이미 설정되어 있습니다
- `VITE_SHEET_GID` — 기본값이 이미 설정되어 있습니다
- `VITE_KAKAO_JS_KEY` — 카카오 JavaScript 앱 키

예시 `.env.local`:

```text
VITE_GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
VITE_SPREADSHEET_ID=16urMn_RdMuw99MLpvASHG07h5EuKsCESc25-CcGH9Lo
VITE_SHEET_GID=162008221
VITE_KAKAO_JS_KEY=YOUR_KAKAO_JS_KEY
```

3. 개발 서버 실행:

```bash
npm run dev
# 열리는 주소(예): http://localhost:5176
```

4. 앱에서 `구글 연동` 버튼으로 OAuth 로그인하거나, 시트가 공개인 경우 `VITE_GOOGLE_API_KEY`만으로도 읽을 수 있습니다.

---

## GitHub Actions (자동 빌드/배포)

아래 워크플로를 추가해 `main` 브랜치 푸시 시 빌드하고 `gh-pages`로 배포할 수 있습니다. 워크플로에서 사용하는 시크릿(리포지토리 Settings → Secrets)을 등록하세요:

- `VITE_GOOGLE_API_KEY`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_KAKAO_JS_KEY`

> 주의: 빌드 시 클라이언트 환경변수가 정적 번들에 포함됩니다. 클라이언트 키(특히 Kakao JS 키)는 클라이언트에서 노출되는 것이 정상입니다. Google API 키는 가능하면 도메인 리퍼러 제한을 설정하세요.

---

## 키가 깃에 커밋된 경우

만약 API 키가 리포지토리에 커밋되었다면 즉시 키를 교체(rotate)하고 커밋 기록에서 제거하세요. 안전하게 기록을 제거하려면 `git filter-repo` 또는 `bfg-repo-cleaner`를 사용합니다. 필요하면 제가 해당 절차를 도와드리겠습니다.

---

## 유틸리티

`scripts/scan_secrets.cjs` — 로컬 저장소에서 잠재적인 키 패턴을 검색하는 도구입니다. 실행 후 결과를 확인해 노출된 키를 제거하세요.

```bash
node scripts/scan_secrets.cjs
```

문제가 발생하면 알려주세요 — 제가 직접 파일을 수정하거나 배포 워크플로를 조정해 드리겠습니다.
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
