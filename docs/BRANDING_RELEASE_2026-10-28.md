# AIERA 개발 표기 / 대문 / IWA 1.1.6

사용자는 전체 X배너와 대문을 함께 볼 수 있게 해 달라고 요청했고, 모든 부스 모델링·앱이 AIERA 자체 개발이라는 점을 100%로 강조하도록 했다. 배너 v6와 대문에 **“모델링부터 앱까지, AIERA 100% 자체 개발”**을 넣었다. 사용자가 제공한 프로젝트 개발 주체 표시다. 외부 라이브러리·폰트의 저작권까지 AIERA 소유라는 뜻으로 확장하지 않으며, 기존 라이선스는 그대로 유지한다.

## 화면 변경

- `src/launcher.html`: 개발 배지, WNL 헤더, 실제 STL 렌더링으로 교체. 제품 이미지는 배너 v4의 PNG와 바이트 단위로 동일하다.
- 작은 크롬북 화면에서는 제목·이미지·시작 버튼이 모두 첫 화면에 들어간다. 그림이 체험 단계 줄과 겹치던 초기 시안을 수정했다.
- 1180×550, 1024×600, 800×550: 문서 높이가 뷰포트와 같고 두 시작 버튼이 모두 보임. 390×844: 가로 넘침 없이 세로 스크롤로 전체 접근 가능.
- `design/banner-v6/overview.html`: 전체 배너와 대문 비교. 실제 기본 브라우저 1280×543에서 두 이미지 전체가 첫 화면 안에 보이는 것을 확인했다.
- 모든 주요 버튼 목적지와 접힌 앱 소개를 유지한다. 프린터 통신·출력·슬라이싱 동작은 이번 수정에서 변경하지 않는다.

## 크롬북 패키지

설치된 대문은 앱에 포함되므로 **IWA 1.1.6**으로 서명했다. 공개 웹만 수정한 것으로 설치 대문까지 바뀌었다고 안내하지 않는다.

- 앱 ID: `at56pqaemxzzojbx5idsvupqxolmoddxarz4eumk2bgzbq2ilpgaaaic` (기존 키와 동일).
- 업데이트 매니페스트: `https://hichoni.github.io/3d-modeling/downloads/click-studio-update.json`
- 이번 버전 전용 파일: `https://hichoni.github.io/3d-modeling/downloads/click-studio-v1.1.6.swbn`
- 바이트: **17,021,430**.
- SHA-256: `25fc90f569c2fd17dd070ee35ece06073ec5251be2b604a68213d273eb349ecc`.
- 독립 서명 검증 통과. 번들 안의 **16개 파일 모두** 최종 빌드와 일치. 기존 파일명 `click-studio.swbn`도 같은 바이트를 제공한다. 이번부터 버전별 URL을 업데이트 매니페스트에 사용한다.

검증 결과는 로컬 `artifacts/banner-20261028/iwa-1.1.6-verification.json`, 화면별 기록은 `home-1.1.6-viewport.json`. 키·비밀번호는 이 문서와 Git에 포함하지 않는다.

사용자가 실제 크롬북에서 적용했다고 확인한 버전은 **1.1.5**까지다. 1.1.6은 앱 창을 닫고 `chrome://iwa-dev`에서 Update 후 확인해야 한다. 실제 프린터 연결·출력은 아직 확인 대기다.

Android APK 자체는 **1.1.1(versionCode 3)** 그대로다. 온라인에서 여는 공통 대문이 갱신되며 APK 자체를 새 버전으로 배포한 것은 아니다. 새로운 오프라인 작업대 기능 변경은 없다.

## 배포 확인

- 배포 커밋: `38f083502bda15bc5071350b7723ed2ccf92f9a4`.
- [GitHub Pages 40634433644](https://github.com/hichoni/3d-modeling/actions/runs/40634433644): 성공.
- [Windows operator app 40634434373](https://github.com/hichoni/3d-modeling/actions/runs/40634434373): 성공.
- 공개 업데이트 매니페스트의 1.1.6 버전 전용 URL에서 SWBN을 내려받았고, 파일 SHA-256이 위 로컬 서명 번들과 일치한다. 로컬 확인 파일: `artifacts/banner-20261028/published-1.1.6.swbn`.
- 공개 비교 페이지: <https://hichoni.github.io/3d-modeling/design/banner-v6/overview.html>.
- 후속으로 요청한 `3d.aiera.co.kr`은 아직 연결 전이다. [별도 도메인 준비 기록](CUSTOM_DOMAIN_2026-10-28.md)을 따른다.
