# AIERA 하위 도메인 연결 준비 — 2026-10-28

사용자 요청: 연구회 홈페이지 `aiera.co.kr`의 하위 주소(예: `3d.aiera.co.kr`)로 Click Studio를 이용하고 싶다. 작업 중 제안한 주소는 **https://3d.aiera.co.kr/**이다. 현재는 조사·연결 준비 단계이며, DNS나 GitHub Pages 도메인을 변경하지 않았다.

## 실제 확인한 상태

- `https://aiera.co.kr/`: HTTP 200, 제목 `안동발명교육연구회 | 발명으로 배우고, 나누고, 함께 성장하는 교사 연구 공동체`.
- 루트 A 레코드: `35.219.200.52`.
- 권한 네임서버: `ns1.whoisdomain.kr`, `ns2.whoisdomain.kr`, `ns3.whoisdomain.kr`, `ns4.whoisdomain.kr`.
- `3d.aiera.co.kr`의 CNAME/A 조회: 존재하지 않음(NXDOMAIN).
- 네임서버로 후이즈를 확인한 것이며, 계정 소유자·로그인 권한·도메인 등록대행자까지 확인한 것은 아니다.
- 사용자가 후이즈 관리 계정으로 로그인할 수 있는지 비동기 질문을 보냈다. 아직 답변·관리 화면 접근 없음. 비밀번호를 채팅으로 요청하지 않는다.

## 연결에 필요한 값

GitHub Pages에 이 하위 도메인을 직접 연결할 때 사용하는 DNS 레코드다. **아래 표만 보고 DNS부터 먼저 저장하지 않는다.** GitHub의 소유 확인과 앱 호환성 준비를 먼저 마친다.

| DNS 항목 | 값 |
| --- | --- |
| 종류 | CNAME |
| 호스트 / 이름 | `3d` (관리 화면이 전체 이름을 요구하면 `3d.aiera.co.kr`) |
| 대상 | `hichoni.github.io` |
| TTL | 관리 화면 기본값 |

대상에 `https://`, `/3d-modeling/`을 붙이지 않는다. 루트 `@`/`aiera.co.kr`와 `www`, MX 레코드, 네임서버는 이번 하위 도메인 연결 범위가 아니다. 기존 연구회 홈페이지 설정은 유지한다.

관리 화면: [후이즈 네임서버 고급설정](https://domain.whois.co.kr/ns_service/index.php) → CNAME 레코드 관리. 실제 메뉴와 도메인 소유 계정을 확인한 뒤 진행한다.

## 설치 앱 호환성 확인 결과

지금 도메인 설정만 변경하면 설치 앱의 온라인 화면/프린터 연결이 영향을 받을 수 있다. 공개 웹이 열리는 것만으로 이전이 끝났다고 판단하지 않는다.

| 구성 | 현재 기준 | 이전 전에 필요한 작업 |
| --- | --- | --- |
| IWA 1.1.6 | `scripts/build-iwa-app.cjs`의 `REMOTE`, `UPDATE_URL`이 GitHub 주소. `src/iwa-shell.js`가 `REMOTE`의 정확한 origin으로 MessagePort를 전달 | 새 주소에서도 연결할 수 있는 셸을 기존 키로 새 버전에 서명. 기존 설치 버전의 업데이트 경로·리디렉션·오프라인 동작 검증 |
| Android 1.1.1 | `MainActivity.java`의 사이트 호스트/경로, 앱 내부 이동과 네이티브 브리지 허용 origin이 GitHub 기준 | 정확한 새 HTTPS origin을 허용하는 같은 서명의 APK. 저장된 설정, 내부 이동, 오프라인 복귀 확인 |
| Windows 연결 프로그램 | `bridge/access.cjs`의 CORS/공유 링크, `bridge/server.cjs`의 CSP가 GitHub 기준 | 새 origin을 명시적으로 추가하고 기존 주소도 필요한 동안 유지. 와일드카드 허용 금지 |
| 설치 안내·업데이트·배너 QR | 공개 GitHub 주소 사용 | 기존 주소가 계속 작동하는지 확인. 새 배너 주소 변경은 새 주소의 HTTPS 정상 연결 후 진행 |

기존 앱의 origin 검사 실패는 소스에서 확인한 위험이며, 실제 도메인을 변경하여 실기 재현한 결과는 아니다. 기존 앱은 업데이트 전까지 GitHub에서 계속 온라인 화면을 받을 수 있도록 전환 시점을 조정하거나 별도 호스팅으로 두 주소를 병행해야 한다. 병행 호스팅은 아직 만들지 않았다.

## 다음 작업 순서

1. 도메인 관리자/후이즈 로그인 가능 여부 확인. GitHub의 도메인 소유 확인에 필요한 TXT 값을 실제 설정 화면에서 발급받는다. 값을 추측하지 않는다.
2. 위 앱 호환성 작업과 기존 설치 앱을 위한 전환 방식을 먼저 확정·검증한다. 지금 배포된 IWA 1.1.6을 같은 버전으로 덮어쓰지 않는다.
3. GitHub의 도메인 소유 확인 후 해당 Pages 사이트에 `3d.aiera.co.kr`을 등록하고, 후이즈에서 위 CNAME을 추가한다. GitHub는 DNS만 먼저 가리키지 않도록 안내한다.
4. DNS 및 HTTPS 인증서 준비를 확인하고 HTTPS 강제를 적용한다. 전파/인증서 준비는 최대 24시간이 걸릴 수 있다.
5. `/`, `home.html`, `index.html?start`, `studio.html`, `chromebook.html`, 다운로드·업데이트 매니페스트를 새 주소에서 확인한다. 기존 GitHub 경로에서 넘어오는 동작도 검사한다.
6. 실제 크롬북/Android 앱 업데이트와 프린터 연결을 확인하고, 출력은 해당 프린터와 베드 준비를 확인한 뒤 진행한다.

## 근거

- [GitHub Pages 사용자 지정 도메인 연결](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub Pages 도메인 소유 확인](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [후이즈 DNS 관리](https://domain.whois.co.kr/ns_service/index.php)

**현재 완료 범위: 도메인/DNS 조사, 앱 호환성 점검, 정확한 연결 값과 작업 순서 기록. 아직 새 도메인으로 배포 완료되지 않았다.**
