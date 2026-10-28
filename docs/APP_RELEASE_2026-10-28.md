# 크롬북·Android 앱 업데이트 인수인계 (2026-10-28)

## 배포 대상

| 항목 | 버전 | 공개 파일 |
| --- | --- | --- |
| 크롬북 Click Studio IWA | **1.1.4** | [서명된 앱](https://hichoni.github.io/3d-modeling/downloads/click-studio.swbn) · [업데이트 매니페스트](https://hichoni.github.io/3d-modeling/downloads/click-studio-update.json) |
| Android Click Studio APK | **1.1.1**, versionCode **3** | [APK](https://hichoni.github.io/3d-modeling/downloads/click-studio.apk) |
| 웹·설치 안내 | 웹 빌드 `4987400` | [체험](https://hichoni.github.io/3d-modeling/index.html?start) · [설치 안내](https://hichoni.github.io/3d-modeling/chromebook.html) |

1단계 도구 패널·실행 취소·실제 작품 썸네일, 2·3단계 작품/프린터/시간 요약과 새 작업대를 두 설치 패키지의 오프라인 화면에도 포함했다. 온라인 화면만 바꾸고 설치 파일을 남겨 두었던 이전 상태를 갱신했다. Windows Store 제출·인증과는 별개이며 Store 출시는 완료되지 않았다.

## 기존 키 복구와 보관

원래 앱을 만들었던 Claude Code 작업의 비공개 `runtime/`에서 원본을 복구했다. 사용자는 해당 작업에 **키 백업 파일 생성만** 요청하도록 허용했다. 요청에는 새 키 생성·기존 키 변경·Git 업로드·앱 빌드/배포를 제외했고, 세 파일만 담긴 ZIP을 내려받았다. 이미 따로 복구한 PEM·암호 파일과 ZIP 안의 원본이 바이트 단위로 일치한다.

- 로컬 기본 경로: `runtime/iwa-signing-key.pem`, `runtime/android-signing.p12`, `runtime/android-signing.pass`.
- 로컬 비공개 백업: `runtime/signing-keys-backup-2026-10-28.zip`. 다운로드 폴더에도 원본 백업 ZIP이 있다.
- 세 키 파일과 백업은 모두 Git에서 제외했다. 키 내용·암호·ZIP은 공개 저장소, Pages, CI에 업로드하지 않는다. ZIP 자체는 암호화되어 있지 않으므로 개인의 암호화된 저장소에 별도 보관한다.
- 이전 인수인계의 **“이 PC에 서명 키가 없다”는 문구는 이 복구로 해소**했다. 키가 바뀌는 새 앱을 만들지 않았다.

공개 신원:

- IWA ID: `at56pqaemxzzojbx5idsvupqxolmoddxarz4eumk2bgzbq2ilpgaaaic` — 기존 1.1.3과 동일.
- Android 인증서 SHA-256: `5B:32:A5:2F:36:0A:E4:6F:00:76:56:78:1E:B2:58:F0:9F:CD:CD:8F:9E:E9:E9:D7:76:8E:DC:3F:5C:1D:6E:47` — 기존 1.1.0과 동일.

## 검사 근거

- 준비 코드 `cf8542423b40d786215872ba154773af6811b632`: 원래 키·앱 신원·버전 증가·APK 오프라인 페이지 일치 검사. 키가 없다고 새 키를 생성하지 않는다. Android는 임시 산출물의 v2 서명 검증을 통과한 뒤 공개 파일을 교체한다.
- 전체 자동 검사 **167개 통과**, 실패·건너뜀 0개. 로컬 로그 `artifacts/release-tests-20261028.log`.
- [Android CI 40621991823](https://github.com/hichoni/3d-modeling/actions/runs/40621991823)에서 versionName 1.1.1 / versionCode 3의 미서명 APK와 원본 커밋·페이지 해시가 담긴 `build.json` 생성. 서명 검증 Java 코드 컴파일도 통과했다.
- [Windows CI 40621991916](https://github.com/hichoni/3d-modeling/actions/runs/40621991916) 통과. Windows CI는 미서명 패키지 검사이며 Store 승인 근거가 아니다.
- 로컬에서 원래 Android 인증서 일치, APK v2 서명 검증과 인증서 일치 검사를 통과했다. 키 암호를 명령행이나 로그에 출력하지 않았다.
- 최종 IWA 파일을 다시 읽어 서명을 독립 검증하고, 안의 **16개 파일 모두**를 최종 빌드와 바이트 단위 비교했다.
- APK 안의 `index.html`, `studio.html`은 CI 페이지 해시와 일치한다. `design-history`, `design-workbench`, `production-status`, `production-workbench` 소스가 IWA와 APK에 모두 포함됨을 확인했다. 현재 공개 HTML과 APK 페이지의 차이는 APK 다운로드 이름을 만드는 상수의 1.1.0→1.1.1 변경뿐이며 기능 코드는 동일하다. APK 자체 버전은 1.1.1이다.
- 로컬 상세 자료: `artifacts/app-release-20261028/android-build.json`, `verification.json`, 미서명 APK. Microsoft 공식 JDK ZIP의 SHA-256 및 Maven apksig의 고정 체크섬을 확인해 사용했다. 시스템 Java 설정은 바꾸지 않았다.

| 최종 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `click-studio.swbn` | 18,598,284 | `7d5a2eafa4df1f048c1f5190610f31a02027c46ae74514a04b231e44922c0cb3` |
| `click-studio.apk` | 11,013,974 | `e9a2e0ee526c5aaa093f1f7968bf6063c3209671b223506781696452c31a1176` |

## 현장에서 업데이트

1. **크롬북:** `chrome://iwa-dev`에서 기존 Click Studio의 **Update**를 사용한다. 업데이트 주소는 기존과 같은 `https://hichoni.github.io/3d-modeling/downloads/click-studio-update.json`이다. 개발자 모드 설치는 자동 업데이트를 보장하지 않으므로 버전 **1.1.4**를 확인한다.
2. **Android:** 설치 안내의 **태블릿 앱 v1.1.1 받기** 또는 기존 앱의 업데이트 알림으로 APK를 받아 설치한다. 기존 앱을 삭제하지 않고 같은 서명의 업데이트로 설치한다.
3. 앱을 다시 열고 작업대·실행 취소·슬라이싱/출력 요약을 확인한다. 같은 앱 신원과 저장소를 유지하므로 기존 프린터 설정을 유지하는 업데이트다.

**이번 버전의 실제 ChromeOS·Android 기기 업데이트 설치/출력은 이 PC에서 확인하지 않았다.** 크롬북은 이전 실제 설치·검색과 모의 프린터 전체 흐름까지, Android는 10월 22일 사용자의 실제 부스 출력 확인 기록까지가 실기 근거다. 학교 관리 정책, 여러 기기 동시 운영, STL/MakerWorld 실기 출력 등 기존 미검증 범위는 그대로다. 이번 작업 중 프린터 가열·이동·출력 명령은 보내지 않았다.

## 다음 릴리스 순서

기능 수정 → 웹 빌드/검사 → IWA 버전·Android versionCode/versionName 증가 → 해당 커밋의 Android CI APK와 `build.json` 확인 → 원래 키로 APK 서명 → 다운로드 메타데이터를 반영해 웹/IWA 재빌드 → 원래 키로 IWA 서명 → 설치 안내 재빌드 → Git/Pages 배포 → 공개 메타데이터와 내려받은 파일 해시 확인.

서명 스크립트는 이전 공개 버전보다 큰 버전만 받는다. 배포 전 후보를 다시 만드는 경우에도 이전 공개 메타데이터를 검증 기준으로 보관하고, 현재 공개된 버전을 같은 번호로 다시 배포하지 않는다. APK 서명은 CI 페이지와 작업 사본이 같은 상태에서 수행한 뒤 설치 안내를 다시 빌드한다. 키를 저장소에 넣어 CI 자동 서명으로 바꾸지 않는다.
