# Macaron Asset Exporter (Figma Plugin)

## 한국어 (KR)

### 개요
선택한 레이어/컴포넌트 중 이름에 `ic_` 또는 `img_`가 포함된 항목만 export 후 Google Drive 지정 폴더로 업로드합니다.

### Export 규칙
- Android
  - `ic_`, `img_` 모두 PNG
  - `mdpi(1x)`, `hdpi(1.5x)`, `xhdpi(2x)`, `xxhdpi(3x)`, `xxxhdpi(4x)`
  - density별 폴더에 업로드
- iOS
  - `img_`: PNG `@1x`, `@2x`, `@3x`
  - `ic_`: SVG
  - 공통 iOS 폴더에 업로드
- Web
  - `img_`: PNG `@1x`, `@2x`
  - `ic_`: SVG
  - 공통 Web 폴더에 업로드

### 파일명 규칙
- 레이어 이름을 소문자/안전문자 형태로 정규화하여 사용
- 예: `img_Home Banner` -> `img_home_banner@2x.png`

### 설치 및 실행
1. Figma Desktop에서 `Plugins > Development > Import plugin from manifest...`
2. 이 폴더의 `manifest.json` 선택
3. 플러그인 실행 후 OAuth / 허용 도메인 / 업로드 폴더 링크를 직접 입력
4. `Sign in with Google (Browser)` 클릭
5. 브라우저에서 코드 승인
6. 플러그인에서 `Start Export + Drive Upload` 실행

### 공개 저장소용 기본 상태
- 이 저장소에는 기본 OAuth Client ID, OAuth Client Secret, 허용 이메일 도메인, Google Drive 폴더 링크가 포함되어 있지 않음
- 사용 전 각 팀/사용자 환경에 맞는 값으로 직접 설정 필요

### 플랫폼 선택
- Android / iOS / Web 체크박스로 대상 플랫폼 선택 가능
- 기본값은 3개 모두 선택
- 선택한 플랫폼만 export/업로드

### Google OAuth 설정
- Google Cloud Console에서 OAuth Client 생성
- 권장 타입: `TV and Limited Input devices`
- 필요 scope:
  - `https://www.googleapis.com/auth/drive.file`
  - `https://www.googleapis.com/auth/userinfo.email`

### 팀 내부 운영
- Professional 플랜은 조직 전용 private publish를 지원하지 않음
- 팀원은 개발 플러그인으로 `manifest.json`을 각자 import해서 사용
- 허용 도메인(`Allowed Email Domains`)으로 계정 제한 가능

### 폴더 링크 변경
- UI에서 Android/iOS/Web 링크를 수정 후 `Save Settings`
- 설정은 `figma.clientStorage`에 저장되어 다음 실행에도 유지

---

## English (EN)

### Overview
This plugin exports only selected layers/components whose names include `ic_` or `img_`, then uploads them to configured Google Drive folders.

### Export Rules
- Android
  - Both `ic_` and `img_` are exported as PNG
  - `mdpi(1x)`, `hdpi(1.5x)`, `xhdpi(2x)`, `xxhdpi(3x)`, `xxxhdpi(4x)`
  - Uploaded to density-specific folders
- iOS
  - `img_`: PNG `@1x`, `@2x`, `@3x`
  - `ic_`: SVG
  - Uploaded to a shared iOS folder
- Web
  - `img_`: PNG `@1x`, `@2x`
  - `ic_`: SVG
  - Uploaded to a shared Web folder

### File Naming
- Layer names are normalized to lowercase/safe characters
- Example: `img_Home Banner` -> `img_home_banner@2x.png`

### Install & Run
1. In Figma Desktop, go to `Plugins > Development > Import plugin from manifest...`
2. Select `manifest.json` from this folder
3. Run the plugin and enter your own OAuth values, allowed domains, and upload folder links
4. Click `Sign in with Google (Browser)`
5. Approve in browser (device code flow)
6. Run `Start Export + Drive Upload`

### Public Repository Default State
- This repository does not include a default OAuth Client ID, OAuth Client Secret, allowed email domains, or Google Drive folder links
- Configure your own values before using the plugin

### Target Selection
- Android / iOS / Web checkboxes are available
- All three are selected by default
- Only selected targets are exported/uploaded

### Google OAuth Setup
- Create an OAuth client in Google Cloud Console
- Recommended type: `TV and Limited Input devices`
- Required scopes:
  - `https://www.googleapis.com/auth/drive.file`
  - `https://www.googleapis.com/auth/userinfo.email`

### Internal Team Usage
- Professional plan does not support private organization-wide publishing
- Teammates should import `manifest.json` as a development plugin
- Access can be restricted using `Allowed Email Domains`

### Updating Folder Links
- Edit Android/iOS/Web links in UI and click `Save Settings`
- Settings persist via `figma.clientStorage`
