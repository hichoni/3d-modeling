# 크롬북만으로 A1 mini 출력하기 — Click Studio 앱 (출력 PC 없음)

2026-10-21 구현. 크롬북에 **Click Studio 앱(Isolated Web App)** 을 한 번 설치하면, 같은 Wi-Fi의 A1 mini를 크롬북에서 직접 찾아 1:1로 연결하고, 모델링·슬라이싱·전송·출력까지 노트북/출력 PC 없이 진행합니다.

```text
이전:  크롬북 웹 → 출력 PC 연결 프로그램(Node) → A1 mini
지금:  크롬북 Click Studio 앱 ───────────────→ A1 mini   (같은 Wi-Fi · LAN Only · 개발자 모드)
```

> **검증 상태 (2026-10-28 갱신):** 실제 Chromium에 설치한 앱↔모의 A1 mini의 전체 흐름을 확인했고, 사용자는 실제 ChromeOS 154의 설치·검색까지 확인했습니다. 10월 28일에는 앱의 직접 연결 코드를 **PC의 Node 소켓 어댑터**로 실행해 실제 A1 mini의 TLS/MQTT 인증·상태 수신에 성공했습니다. **실제 ChromeOS 앱 UI에서 파일 전송→출력→완료까지는 아직 확인하지 않았습니다.** 이번 점검은 출력·업로드 없이 연결 조회만 했습니다. [상세 인수인계](HANDOFF.md)의 직접 연결과 Windows 중계 방식 차이를 참고하세요.

공개 IWA 번들은 **1.1.4**입니다(`downloads/click-studio.json`). 2026-10-28 원래 키를 복구했고 기존 앱 ID를 유지해 서명했습니다. 1단계 도구 패널·실행 취소·작품 썸네일과 2·3단계 슬라이싱·출력 작업대를 오프라인 화면에도 포함합니다. 기존 설치는 `chrome://iwa-dev`에서 **Update**로 갱신하세요. 앱 삭제나 새 프린터 등록은 필요하지 않습니다. [서명·패키지 검증과 인수인계](APP_RELEASE_2026-10-28.md). 이번 배포에서 학교 관리 정책은 변경하지 않았습니다.

## 왜 앱이 필요한가

A1 mini는 상태·명령에 **MQTT over TLS(8883)**, 파일 전송에 **암묵적 FTPS(990)** 를 씁니다. 일반 웹 페이지(GitHub Pages)는 이런 TCP/UDP 통신을 열 수 없어서 지금까지 출력 PC가 대신 전달했습니다.

Chrome의 **Isolated Web App(IWA)** 은 서명된 웹 앱 묶음(`.swbn`)으로 설치되며, **Direct Sockets API**(`TCPSocket`, `UDPSocket`)를 쓸 수 있습니다. 브라우저에는 TLS 소켓이 없으므로, 앱 안에 **TLS 1.2 클라이언트**를 직접 구현했고(WebCrypto: ECDHE P-256/P-384/X25519 · AES-GCM · RSA/ECDSA 인증서 검증 · 세션 재사용), 그 위에 MQTT·FTPS를 올렸습니다. 출력 파일(.gcode.3mf)도 중계기와 **바이트 단위로 같은 내용**을 브라우저가 만듭니다.

## 크롬북에 설치하기

화면을 보며 따라 하는 안내: **<https://hichoni.github.io/3d-modeling/chromebook.html>** (주소 복사 버튼·문제 해결 포함)

### A. 개인/개발자 크롬북 (지금 바로 가능)

1. Chrome 주소창에 `chrome://flags/#enable-isolated-web-app-dev-mode` 입력 → **Enabled** → 다시 시작.
2. `chrome://iwa-dev` 열기 (Chrome 154부터 설치 화면이 여기로 옮겨짐. 이전 버전은 `chrome://web-app-internals` 맨 위).
3. **+ Install** → **Update Manifest** 탭 → `https://hichoni.github.io/3d-modeling/downloads/click-studio-update.json` → **Fetch** → **Install**.
   또는 **Signed Bundle** 탭 → **Install** → [앱 파일](https://hichoni.github.io/3d-modeling/downloads/click-studio.swbn) 선택.
4. 런처(앱 목록)에서 **Click Studio** 를 엽니다.

Chrome 154.0.8037.0에서 `chrome://iwa-dev`의 Update Manifest 설치·실행·Direct Sockets 사용 가능을 확인했습니다. 파일 앱에서 `.swbn`을 더블클릭하는 설치는 실제 크롬북(Chrome 154)에서 “앱을 설치할 수 없음”으로 거절됐습니다. Google 허용 목록 등록 전이라서로 보입니다.

ChromeOS 150부터는 관리 정책(`IsolatedWebAppUserInstallationEnabled`)이 허용하면 사용자가 IWA를 직접 설치할 수 있다고 Google 릴리스 노트에 적혀 있지만, 이 앱은 그 경로(파일 더블클릭)로 설치되지 않았습니다. 위 개발자 모드 방법을 쓰세요.

### B. 학교 관리 크롬북

학교 계정은 보통 **개발자 도구 정책(`DeveloperToolsAvailability`)이 막혀 있고**, Chrome 119부터 이 정책이 IWA 개발자 모드도 함께 막습니다. 이 경우 flags를 Enabled로 바꾸고 다시 시작해도 `chrome://web-app-internals`에 설치 칸이 나타나지 않습니다(`chrome://policy`에서 값 2 확인). 관리자가 해당 조직 단위에 개발자 도구를 허용하면 위 A 방법이 가능해집니다. 또는 Google 관리 콘솔에서 IWA로 강제 설치해야 하며, 필요한 값은 다음과 같습니다.

| 항목 | 값 |
| --- | --- |
| 웹 번들 ID | `downloads/click-studio.json`의 `bundleId` |
| 업데이트 매니페스트 URL | `https://hichoni.github.io/3d-modeling/downloads/click-studio-update.json` |

Chrome 143부터 **관리 정책으로 설치하는 IWA는 Google이 관리하는 허용 목록에 있어야** 합니다(개발자 모드 설치는 예외). 학교 일괄 배포는 이 허용 목록 등록이 선행돼야 하며, 아직 신청하지 않았습니다.

## 웹 화면 자동 반영과 설치 앱 업데이트의 차이

앱은 얇은 **껍데기(shell)** 입니다. 열면 `https://hichoni.github.io/3d-modeling/`의 최신 스튜디오·키캡 화면을 앱 안에 띄우고, 그 화면에 프린터 연결(Direct Sockets)과 저장소만 빌려줍니다. **사이트 배포는 온라인 웹 화면에 반영**됩니다. 설치된 IWA의 버전·네이티브 연결 부분·내장 오프라인 화면까지 자동으로 바뀌는 것은 아닙니다. 이 부분을 바꾸려면 같은 키로 서명한 새 번들을 설치 화면의 **Update**로 적용해야 합니다.

크롬북에 Android APK를 설치해 쓰는 경우에는 IWA 버전이 아니라 APK 버전을 확인합니다. 이번 배포는 **IWA 1.1.4 / APK 1.1.1**로 서로 다릅니다. 기기 종류만 보고 오래된 앱이라고 판단하지 않습니다.

- 빌려주는 연결은 A1 mini 통신으로 제한합니다: 사설 IPv4의 MQTT 8883 · FTPS 990(열린 FTPS 연결이 있을 때만 그 데이터 포트) · 카메라 6000, SSDP용 UDP 2021/1990과 멀티캐스트 239.255.255.250. 그 밖의 주소·포트는 거절합니다.
- 화면은 사이트 원본을 credentialless iframe으로 띄우며, 앱의 출처(`isolated-app://`+번들 ID)에서 온 연결만 받습니다. 프린터 목록·코드 등 `click-` 설정은 앱 저장소에 보관합니다.
- 인터넷이 없거나 사이트가 응답하지 않으면 약 6–15초 뒤 앱에 들어 있는 버전으로 엽니다.
- Chrome은 개발자 모드로 설치한 앱을 스스로 업데이트하지 않았습니다(재시작 + 90초 동안 업데이트 매니페스트 요청 없음). 껍데기 자체가 바뀔 때만 `chrome://iwa-dev`의 **Update**가 필요합니다. 앱 화면에서 `chrome://` 주소는 Chrome이 막아 직접 열 수 없습니다.
- 시험: `xvfb-run -a node scripts/iwa-e2e.cjs --shell` (로컬 HTTPS 사이트 ↔ 설치한 앱 ↔ 모의 A1 mini, 재실행 후 설정 유지 포함).

## Windows·Mac에서는?

- **일반 웹 페이지만으로는 안 됩니다.** 크롬북과 마찬가지로 브라우저가 프린터의 MQTT·FTPS 통신을 막습니다.
- **같은 앱을 설치하는 방법:** 데스크톱 Chrome은 IWA가 기본으로 꺼져 있습니다. 리눅스 Chrome 154에서는 IWA 기능을 켜야(`IsolatedWebApps`) `chrome://iwa-dev`가 열렸고, 켠 뒤에는 설치·실행·Direct Sockets 모두 됐습니다. Windows에서도 `chrome://flags`에서 **Isolated Web Apps**와 **Isolated Web App Developer Mode**를 켜면 같은 방법이 될 것으로 보이지만, **Windows 실기는 아직 확인하지 않았습니다.**
- **확실한 방법:** Windows PC는 기존 연결 프로그램(중계기, `start-workshop.cmd`)으로 이 PC에서 바로 출력할 수 있습니다. 학교 PC의 실행 차단(Smart App Control)은 [안내](SMART_APP_CONTROL.md)를 참고하세요.

## 프린터 준비 (한 번)

1. A1 mini와 크롬북을 **같은 Wi-Fi**에 연결합니다. 손님용/학생용 Wi-Fi가 기기 간 통신을 막으면(AP 격리) 연결되지 않습니다.
2. 프린터 화면 **설정 → LAN Only** 켜기, **개발자 모드(Developer Mode)** 켜기. 개발자 모드가 꺼져 있으면 최신 펌웨어가 서명 없는 출력 명령을 거절합니다. 앱이 이 상태를 감지하면 경고를 보여줍니다.
3. 같은 화면의 **액세스 코드 8자리**를 확인합니다.

## 사용하는 법 (1:1 연결)

1. 앱 첫 화면 → **STL 스튜디오** (또는 키캡 만들기 체험).
2. **프린터 연결** → **같은 Wi-Fi에서 A1 mini 찾기**. 프린터가 5초마다 보내는 알림(SSDP)을 듣고, 안 들리면 같은 대역 주소를 차례로 확인해 *Bambu Lab 인증서가 있는 프린터만* 찾습니다.
3. 본체와 같은 미니를 고르고 **8자리 코드** 입력 → **연결 정보 저장하고 확인**. 인증과 실시간 상태 수신이 확인되면 그 미니가 *이 크롬북의 프린터*로 자동 지정됩니다.
4. STL 불러오기 → 레이어 계산 → 출력 준비 → 준비 항목 체크 → **A1 mini로 출력 시작**.
5. 출력 중에는 단계(베드 레벨링·노즐 가열 등), 층 수, 남은 시간, 온도, Wi-Fi 신호와 **일시 정지 / 계속 / 속도(조용히·표준·스포츠·최고) / 조명**, HMS 알림 코드(Bambu 안내 링크)를 보여줍니다.

검색이 막힌 Wi-Fi에서는 **IP·일련번호 직접 입력**을 펼쳐 프린터 IP만 넣고 **이 IP의 일련번호 자동 확인**을 누르면 인증서에서 일련번호를 읽어 채웁니다.

여러 크롬북 × 여러 미니 현장에서는 각 크롬북이 자기 미니 한 대만 등록하면 됩니다. 다른 기기가 출력 중인 미니는 `다른 작업 출력 중`으로 표시되고 시작이 막힙니다(프린터 자체 상태 기준이며, 중앙 매칭 서버는 없습니다).

## Bambu Studio에서 가져와 반영한 것

Bambu Studio의 공개 소스(`src/slic3r/GUI/DeviceCore/*`, `resources/printers/N1.json`, `bbs_3mf`)와, 네트워크 부분이 들어 있는 비공개 플러그인을 다시 구현한 커뮤니티 자료(OpenBambuAPI, open-bamboo-networking, ha-bambulab)를 분석했습니다.

| Bambu Studio 동작 | 앱 반영 |
| --- | --- |
| UDP 2021의 SSDP NOTIFY를 *듣기만* 해서 프린터 목록 구성 (`USN`=일련번호, `DevModel`=N1, `DevConnect`=lan) | 같은 방식 + 인증서 기반 주소 검색 대체 경로 |
| MQTT 8883, 사용자 `bblp`, 비밀번호=액세스 코드, 인증서 CN=일련번호(BBL CA) | 앱이 Bambu CA 묶음으로 체인·일련번호까지 검증 후 코드 전송 |
| `pushall`은 최소 간격을 두고, 5분마다 유지 신호. A1/P1은 바뀐 값만 보고 | 조용할 때만 요청, 출력 추적 중 10초, 5분 유지. 보고는 병합 |
| FTPS 990, 데이터 채널은 제어 채널 TLS 세션 재사용, SD 루트에 업로드 | 세션 ID·티켓 재사용 모두 구현, 업로드 후 크기 확인 |
| `project_file` 출력 명령 | 실물 출력이 확인된 중계기 명령을 그대로 사용 (레벨링·유량 보정 선택 유지) |
| `.gcode.3mf`의 `plate_1.png`(512) / `plate_1_small.png`(128) | 3D 화면에서 썸네일을 만들어 넣음 → 프린터 화면에 미리보기 (중계기 경로에도 적용) |
| `stg_cur` 단계표, HMS 코드(`HMS_XXXX_…`)·위키 링크, `print_error` | 한국어 단계 표시, 코드·링크 표시 |
| `pause` / `resume` / `print_speed`(1–4) / `ledctrl chamber_light` | 이 기기가 시작한 출력에 한해 제공 |
| `print.fun` 비트 29로 개발자 모드 판별 | 꺼져 있으면 경고 |

가져오지 않은 것: 카메라 실시간 보기(포트 6000), AMS 매핑, 클라우드 출력, 서명 명령(개발자 모드에서는 불필요).

## 보안·개인정보

- 액세스 코드는 **그 크롬북의 앱 전용 저장소에만** 저장됩니다(다른 사이트·다른 앱과 분리). 서버로 보내지 않습니다.
- 코드는 프린터의 TLS 인증서가 **Bambu Lab CA로 서명됐고 일련번호가 일치할 때만** 전송합니다. 같은 Wi-Fi의 가짜 장치에는 보내지 않습니다.
- 공개 웹 페이지(GitHub Pages)에서는 Direct Sockets가 없으므로 이 기능이 꺼져 있고, 기존 출력 PC 연결이 그대로 동작합니다.
- 브라우저가 만든 경로는 중계기와 같은 규칙(`src/print-job.js`)으로 다시 검사하고, 검토된 A1 mini 시작·종료 절차만 붙입니다.

## 확인한 것

- 자동 테스트: TLS(RSA·ECC·중간 인증서·X25519/P-256/P-384·세션 재사용·위조/일련번호 불일치 거부), MQTT 인증·명령, FTPS(세션 재사용을 *요구하는* 모의 서버), SSDP, 출력 파일이 중계기와 동일한지, MD5, 썸네일, 패키지 허용 목록.
- `scripts/iwa-e2e.cjs`: 실제 Chromium에 앱을 설치하고 모의 A1 mini를 상대로 **검색 → 코드 → 50층 슬라이싱 → FTPS 업로드 → 출력 시작 → 진행 표시 → 일시 정지/계속 → 완료**, 키캡 화면 직접 연결 표시까지 오류 없이 통과.
- 서명된 `click-studio.swbn`을 Chromium에 설치·실행해 직접 연결 모드, 교차 출처 격리, 글꼴 로드를 확인.

## 첫 실물 시험 체크리스트 (남은 일)

1. 실제 크롬북에 설치 → 앱 열기.
2. 실제 A1 mini 검색이 되는지(학교/집 Wi-Fi), 안 되면 IP 입력 → 일련번호 자동 확인.
3. 코드 입력 → `실시간 상태 수신` 확인. 실패하면 화면의 문구(인증 거절/인증서/개발자 모드)를 기록.
4. 20 mm 블록 같은 작은 STL로 출력 → 업로드·시작·진행률·완료 확인. 프린터 화면 썸네일 확인.
5. 실패 시 기존 출력 PC 경로로 출력해 비교하고, 크롬북 앱의 오류 문구를 알려주세요.

## 다시 빌드·업데이트

```powershell
node scripts/build.cjs                 # 공개 페이지 + artifacts/iwa-app
cd tools/iwa; npm ci --no-audit --no-fund; cd ../..
node tools/iwa/build.cjs               # downloads/click-studio.swbn 서명
```

- 서명 키가 앱 ID를 정합니다. **같은 키로 서명해야 기존 설치를 업데이트**할 수 있습니다. 키는 `IWA_SIGNING_KEY`(PEM 내용) 또는 `IWA_SIGNING_KEY_FILE`, 없으면 `runtime/iwa-signing-key.pem`(Git 제외)을 씁니다. 키를 잃어버리면 새 키로 서명한 앱은 다른 앱이 되어 다시 설치하고 프린터를 다시 등록해야 합니다.
- 이미 배포된 앱은 키가 없거나 앱 ID가 다르거나 버전이 증가하지 않으면 빌드가 중단됩니다. `--new-key`로 기존 앱을 대체할 수 없습니다. 새 키를 만들지 말고 원래 비공개 백업을 복구하세요.
- 업데이트할 때는 `scripts/build-iwa-app.cjs`의 `VERSION`을 올립니다.
- 하드웨어 없는 끝까지 시험(리눅스): `xvfb-run -a node scripts/iwa-e2e.cjs`

주요 파일: `src/direct/tls.js`(TLS 1.2), `src/direct/printer-link.js`(MQTT·FTPS), `src/direct/discovery.js`(SSDP·인증서 검색), `src/direct/relay.js`(앱 안의 중계기), `src/direct/direct-ui.js`(화면), `src/print-job.js`(중계기와 공유하는 출력 파일·안전 규칙), `scripts/build-iwa-app.cjs`, `tools/iwa/build.cjs`.

참고: [Isolated Web Apps](https://developer.chrome.com/docs/iwa/introduction), [Direct Sockets](https://developer.chrome.com/docs/iwa/direct-sockets), [IWA 시작하기](https://chromeos.dev/en/tutorials/getting-started-with-isolated-web-apps), [Bambu 네트워크 포트](https://wiki.bambulab.com/en/general/printer-network-ports), [Bambu 개발자 모드](https://wiki.bambulab.com/en/knowledge-sharing/enable-developer-mode).
