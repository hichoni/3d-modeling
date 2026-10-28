# AIERA 하위 도메인 연결 — 2026-10-28

사용자가 예스닉에 로그인한 뒤 `3d.aiera.co.kr` 연결을 진행했다. 기존 설치 앱을 유지하기 위해 **원본 Pages는 바꾸지 않고 별도 배포 저장소를 사용한다.**

## 적용한 구성

| 항목 | 설정 |
| --- | --- |
| 원본 | `hichoni/3d-modeling`의 `main` |
| 기존 주소 | `https://hichoni.github.io/3d-modeling/` 유지 |
| 새 주소 | `https://3d.aiera.co.kr/` |
| 배포 미러 | [hichoni/3d-aiera-pages](https://github.com/hichoni/3d-aiera-pages) |
| 미러 Pages | GitHub Actions / 도메인 `3d.aiera.co.kr` |
| DNS | 예스닉, 권한 NS는 ns1~ns4.whoisdomain.kr |
| 추가 CNAME | `3d` → `hichoni.github.io` |
| 소유 확인 TXT | `_github-pages-challenge-hichoni.3d.aiera.co.kr`, GitHub 발급 값 유지 |

GitHub에서 도메인 소유 확인 성공 후 미러 Pages에 도메인을 저장했다. 예스닉 CNAME 신규 한 건만 신청해 등록완료를 확인했다. 권한 DNS와 1.1.1.1에서 CNAME 일치를 확인했다. 루트·www·메일·기존 Firebase 인증 레코드·네임서버는 변경하지 않았다.

첫 미러 [배포 40642339772](https://github.com/hichoni/3d-aiera-pages/actions/runs/40642339772)와 최신 소스 `68270f4`의 [배포 40643474210](https://github.com/hichoni/3d-aiera-pages/actions/runs/40643474210)가 성공했다. **HTTPS 인증서 발급 및 실제 접속 확인 완료.** Settings의 Enforce HTTPS도 체크한 뒤 새로고침해 저장을 확인했다. 공개 `/`, `/home.html`, `/studio.html`, `/chromebook.html`, 업데이트 JSON이 모두 HTTPS 200이며 `deployment.json`의 소스 SHA가 일치한다. Chrome에서도 경고 없이 실제 앱을 열었다. 인증서 검증을 우회하지 않았다.

기존 GitHub 주소와 연구회 홈페이지는 HTTP 200이고 원래 URL을 유지한다. 두 주소의 배너 PDF가 최종 로컬 PDF와 SHA-256까지 일치한다. 검증 결과는 비공개 로컬 `artifacts/domain-20261028/public-verification.json`에 있다. 이 PC의 Node 기본 CA는 기존 GitHub에도 체인 오류를 내므로 Windows 신뢰 저장소를 사용하는 PowerShell과 Chrome으로 확인했다. Node TLS 검증을 끄지 않았다.

## 업데이트 방법

1. 원본에서 빌드·검증 후 main에 push한다.
2. 미러 Actions → Deploy AIERA 3D → Run workflow로 즉시 반영한다. 15분 간격 예약 실행도 있지만 GitHub에서 지연·장기 비활성화될 수 있다.
3. 두 저장소 배포 성공 및 새 주소 `deployment.json`의 `source_sha`를 확인한다.
4. 대문·체험·스튜디오·설치 안내·다운로드와 기존 주소를 점검한다.

미러는 공개 원본의 Git 커밋 파일만 배포한다. runtime/artifacts/.env/.git가 포함되면 실패한다. 추가 PAT·서명 키는 만들거나 배포 저장소에 넣지 않았다.

## 설치 앱 호환성

- IWA 1.1.6 / APK 1.1.1의 origin과 업데이트 경로는 기존 GitHub다. **원본 저장소에 CNAME이나 새 Pages 도메인을 추가하지 않는다.** 리디렉션은 설치 앱의 엄격한 origin 검사를 깨뜨릴 수 있다.
- 이번 수정은 온라인 화면에 반영된다. 서명된 패키지는 같은 버전으로 덮어쓰지 않았다. 오프라인 내장 안내는 이전 내용이다.
- Windows 연결 프로그램은 정확히 `https://3d.aiera.co.kr`만 참가자 CORS에 추가했다. 부스 모드·접속 키·운영자 제한 유지. 기존 프로그램은 새 ZIP으로 업데이트해야 새 origin을 허용한다.
- 일반 웹사이트에 접속한다고 원시 LAN 소켓 권한이 생기지 않는다. 크롬북 직접 연결은 IWA, Android는 APK, 일반 PC 웹은 연결 프로그램을 사용한다.
- 배너 v6 QR은 사용자 요청에 따라 `https://3d.aiera.co.kr/home.html`로 변경했다. 스캔하면 체험 화면 대신 대문이 먼저 열린다. 기존 설치 앱의 GitHub 주소는 그대로 유지한다.

## 후속 확인

Enforce HTTPS 설정 직후 캐시된 HTTP 루트는 200이었지만, 새 쿼리로 재확인한 HTTP 요청은 **같은 경로의 HTTPS로 전환**됐다. GitHub UI의 DNS Check in Progress 문구가 한동안 남아 있어도 실제 DNS·인증서·HTTPS 파일 응답을 구분해서 기록한다. 기존 설치 앱의 주소와 서명은 유지했다. 실제 크롬북의 프린터 연결 성공은 사용자가 확인했고 출력 완료는 아직 확인 전이다.

근거: [GitHub 도메인 연결](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [도메인 소유 확인](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages), [예스닉 DNS](https://www.yesnic.com/?_task=ns&_action=index).
