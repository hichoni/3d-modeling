# Android 태블릿 앱 (Click Studio · APK)

안드로이드 태블릿에서 같은 Wi-Fi의 A1 mini로 바로 출력하는 앱입니다. 크롬북 앱과 같은 방식으로, 앱은 사이트(`https://hichoni.github.io/3d-modeling/`)의 최신 화면을 WebView로 열고 프린터 연결용 소켓만 빌려줍니다. 사이트에 연결하지 못하면 빌드할 때 넣어 둔 화면(`assets/web/`)으로 엽니다.

## 구조

| 위치 | 역할 |
| --- | --- |
| `android/` | Java 앱(AppCompat 없음). `MainActivity`: WebView·오프라인 화면·파일 선택·화면 켜짐 유지. `SocketBridge`: 네이티브 TCP/UDP |
| `src/direct/android-bridge.js` | 페이지 쪽. 앱이 넣어 주는 `ClickNative` 메시지 채널을 `TCPSocket`/`UDPSocket`으로 바꿔 줌. 다른 브라우저에서는 아무 일도 안 함 |
| `tests/helpers/fake-android-native.cjs` | 테스트용 네이티브 대역(Node). 같은 메시지·같은 허용 규칙 |
| `.github/workflows/android-app.yml` | 서명 안 된 release APK를 빌드해 `android-build` 브랜치에 올림 |
| `ModelImport.java` | MakerWorld "Bambu Studio로 열기" 링크(`bambustudio://`)와 .3mf 파일을 받아 스튜디오로 넘김 ([MakerWorld 모드](MAKERWORLD.md)) |
| `tools/android/sign-apk.cjs` | 그 APK를 서명해 `downloads/click-studio.apk`와 `downloads/click-studio-android.json`을 만듦 |

허용 규칙(크롬북 앱의 `src/iwa-shell.js`와 같음): 사설 IPv4만, TCP 8883·990·6000, FTPS 연결이 열려 있는 동안 그 주소의 1024 이상 포트(패시브 데이터), UDP는 2021/1990에 바인드하거나 SSDP 그룹(239.255.255.250)·사설 주소의 2021/1990으로만 보냄. `ClickNative`는 `https://hichoni.github.io`와 앱 내부 화면 출처에만 주입됩니다.

## 새 버전 만들기

1. `android/app/build.gradle`의 `versionCode`(+1)와 `versionName`을 올립니다. 화면만 바뀐 경우는 새 APK가 필요 없습니다(앱이 사이트를 그대로 씀).
2. `android/` 변경을 푸시하면 **Android tablet app** 워크플로가 `android-build` 브랜치에 `click-studio-unsigned.apk`를 올립니다.
3. 서명:
   ```
   git fetch origin android-build:refs/remotes/origin/android-build
   git show origin/android-build:click-studio-unsigned.apk > /tmp/unsigned.apk
   node tools/android/sign-apk.cjs /tmp/unsigned.apk
   node scripts/build.cjs   # 설치 안내 페이지의 버전·크기·서명 지문 갱신
   ```
4. `downloads/click-studio.apk`, `downloads/click-studio-android.json`, 빌드 결과를 커밋합니다.

**서명 키:** `runtime/android-signing.p12`와 `runtime/android-signing.pass`(git에 올리지 않음). 안드로이드는 같은 키로 서명한 APK만 업데이트로 설치하므로 **두 파일을 꼭 따로 백업**하세요. 키를 잃으면 태블릿에서 앱을 지우고 새로 설치해야 합니다. 서명은 apksig 2.3.0(Maven Central, SHA-1 확인)으로 APK Signature Scheme v2만 씁니다(minSdk 29).

## 확인한 것 / 아직 못 한 것

- `scripts/iwa-e2e.cjs --android`: 일반 Chromium 페이지 + Node 네이티브 대역으로 검색 → 연결 → 슬라이싱 → 업로드 → 출력·일시정지·완료, 느린 수신자 180 KB + FIN까지 통과.
- CI에서 APK 빌드 성공, 서명 후 apksig로 v2 검증, `resources.arsc` 비압축·4바이트 정렬 확인.
- **실제 안드로이드 태블릿에서는 아직 실행해 보지 않았습니다.** (이 개발 환경에는 에뮬레이터·SDK가 없음)
