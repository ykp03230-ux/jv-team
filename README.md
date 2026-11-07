# jv-team

JUST VUILD 2026 팀 공동작업 저장소입니다.

## 현재 상태

- TEXTOPIA 파일럿 앱은 [`textopia/`](textopia/)에서 공동작업합니다.
- 2.5D 독서마을 맵과 에셋은 아래 공용 에셋 안내에서 확인할 수 있습니다.
- 온팟 배포와 GitHub 자동 배포는 아직 연결하지 않았습니다.

## TEXTOPIA 공용 에셋

[독서마을 2.5D 에셋 v02 사용 안내](textopia/public/assets/village/v02/README.md)

바닥 맵 1장, 배치 참고 이미지 1장, 투명 PNG 8종(책집 3색·문장 전시대·독서 벤치·나무·관목·꽃)을 포함합니다. `assets.json`에 표시 크기, 배치 기준점과 예시 좌표가 있습니다. 앱 화면 적용은 별도 작업입니다.

## 처음 참여하기

저장소 관리자가 GitHub의 **Settings → Collaborators**에서 팀원을 초대하고, 팀원은 초대를 수락합니다.

```sh
git clone https://github.com/ykp03230-ux/jv-team.git
cd jv-team
```

이 컴퓨터에서는 이미 `JUST VUILD` 폴더에 복제되어 있으므로 다시 복제하지 않아도 됩니다.

각 팀원은 자신의 컴퓨터에서 커밋 작성자 정보를 확인합니다. 설정이 없다면 본인의 이름과 GitHub 이메일을 등록합니다. 이메일 공개를 피하려면 GitHub **Settings → Emails**에 표시되는 본인의 `noreply` 주소를 사용하세요.

```sh
git var GIT_AUTHOR_IDENT
git config user.name "YOUR_GITHUB_LOGIN"
git config user.email "YOUR_GITHUB_NOREPLY_EMAIL"
```

다음 설정은 현재 저장소에만 적용합니다. 이 컴퓨터에는 적용되어 있으며, 팀원은 각자 한 번 실행하면 됩니다.

```sh
git config --local pull.ff only
git config --local fetch.prune true
git config --local push.default simple
```

## 작업 순서

`main`은 함께 확인할 수 있는 실행 가능한 상태로 유지합니다. 초기 설정 이후 기능 개발은 각자 브랜치에서 진행하고 PR로 합칩니다.

1. 작업 중인 변경 사항을 커밋한 뒤 `main`을 최신 상태로 받습니다.

   ```sh
   git switch main
   git pull --ff-only origin main
   ```

2. 본인의 작업 브랜치를 만듭니다. 아래 이름은 예시이며 기능에 맞게 바꿉니다.

   ```sh
   git switch -c feat/login
   ```

3. 변경 내용을 확인하고 필요한 파일만 커밋·푸시합니다.

   ```sh
   git status
   git diff
   git add path/to/changed-file
   git diff --cached
   git commit -m "feat: 로그인 화면 추가"
   git push -u origin feat/login
   ```

4. GitHub에서 **Pull request → base: main**으로 PR을 만들고 팀원이 확인한 뒤 병합합니다.

- 브랜치 이름 예시: `feat/login`, `fix/save-error`, `docs/pitch`, `chore/deploy`.
- 같은 파일을 동시에 수정하기 전 담당 범위를 공유합니다. 공통 레이아웃·의존성·DB 구조 변경은 먼저 팀과 맞춥니다.
- 충돌이나 `pull --ff-only` 오류가 나면 팀원과 변경 내용을 확인해서 해결합니다. 공유 브랜치에 강제 푸시하지 않습니다.
- PR에는 변경 내용, 확인 방법과 결과, 화면 변경 시 스크린샷을 남깁니다.

## 비밀키와 환경 설정

- `.env`, API 키, DB 비밀번호, 인증서 개인키는 커밋하지 않습니다.
- 팀에 필요한 환경변수 이름은 `.env.example`에 **실제 값 없이** 기록하고, 실제 값은 별도 경로로 공유합니다.
- 의존성 잠금 파일은 함께 커밋합니다. 패키지 매니저는 팀에서 하나로 통일합니다.
- `.gitignore`는 이미 추적 중인 파일의 비밀값을 제거해주지 않습니다. 비밀값이 올라갔다면 즉시 키를 폐기·재발급하고 팀에 알립니다.

## 개발 시작 후 채울 내용

- 서비스 목적과 핵심 사용자 흐름
- 담당 기능과 공통 파일 담당자
- 개발 환경, 의존성 설치·실행·검증 명령
- 필요한 환경변수 이름과 데이터베이스 초기화 방법
- 온팟 서비스 주소와 `main` 자동 배포 설정

현재 앱의 실행·검증 명령은 [`textopia/package.json`](textopia/package.json)의 `scripts`에서 확인할 수 있습니다. 배포 환경과 자동 배포 연결 상태는 담당자가 확인한 뒤 문서에 반영합니다.
