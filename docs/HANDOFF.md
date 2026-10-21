# 인수인계 — Click Studio·운영자 공방 (2026-10-21)

## 최신: 크롬북 직접 연결 앱 — 출력 PC 없이 (2026-10-21)

사용자 요청: Bambu Studio를 분석해 **크롬북에서 같은 Wi-Fi의 A1 mini를 찾아 1:1 연결 → 슬라이싱 → 출력**을 노트북 경유 없이 하도록 보완. [CHROMEBOOK_DIRECT.md](CHROMEBOOK_DIRECT.md)가 설치·사용·검증 기록이고, 사용자용 설치 안내 페이지는 [chromebook.html](https://hichoni.github.io/3d-modeling/chromebook.html)(`src/chromebook.*`)이다.

- 방식: Chrome **Isolated Web App**(서명 번들 `downloads/click-studio.swbn`) + **Direct Sockets**. 앱 안에 TLS 1.2(`src/direct/tls.js`), MQTT·FTPS(`src/direct/printer-link.js`), SSDP·인증서 검색(`src/direct/discovery.js`), 중계기 API를 그대로 흉내 내는 앱 내부 중계기(`src/direct/relay.js`)를 넣었다. 기존 화면은 API 호출만 바뀌고 그대로 쓴다. 공개 Pages에서는 꺼져 있다.
- 중계기와 공유: 출력 파일·안전 규칙을 `src/print-job.js`로 옮기고 `bridge/browser-job.cjs`·`core.cjs`·`print-preparation.cjs`가 이를 쓴다. 출력 파일 내용은 이전과 동일함을 테스트로 확인했다. 새로 `plate_1.png`/`plate_1_small.png` 썸네일(선택)을 넣는다. ZIP·Windows 허용 목록에 `src/print-job.js`를 추가했다.
- 검증: 자동 테스트 + `scripts/iwa-e2e.cjs`(실제 Chromium에 앱 설치 ↔ 모의 A1 mini, 검색·코드·슬라이싱·업로드·시작·일시정지/계속·완료) 통과. 서명 번들 설치·실행 확인. **실물 A1 mini·실제 ChromeOS 시험은 안 했다.** 다음 작업은 문서의 첫 실물 시험 체크리스트다.
- 서명 키: 이번 클라우드 세션에서 새로 만든 `runtime/iwa-signing-key.pem`(Git 제외)으로 서명했다. 세션 컨테이너가 사라지면 이 키도 사라지므로 사용자가 비공개로 보관해야 한다. 키가 없으면 다음 버전은 다른 앱 ID가 되어 재설치가 필요하다. 앱 ID는 `downloads/click-studio.json`.
- 학교 일괄 배포(관리 콘솔 강제 설치)는 Chrome 143+의 Google 허용 목록 등록이 필요하며 아직 신청하지 않았다.

## 다음 작업자는 여기부터

사용자 목표는 **크롬북/노트북의 웹 화면에서 모델링 또는 STL 불러오기 → 웹 슬라이싱 → 여러 A1 mini와 현장 1:1 매칭 → 출력**이다. 14×14mm 둥근 사각 끼움판의 이름 새기기 체험과 일반 STL 스튜디오를 함께 제공한다. 프린터와 통신하는 현장 Windows 중계기가 필요하며, 학교 PC의 Smart App Control 차단을 해결하기 위해 개인 명의 Microsoft Store 앱을 준비 중이다.

| 항목 | 마지막으로 확인한 상태 |
| --- | --- |
| 웹 | [체험 화면](https://hichoni.github.io/3d-modeling/), [STL 스튜디오](https://hichoni.github.io/3d-modeling/studio.html), [연결 안내](https://hichoni.github.io/3d-modeling/setup.html) 배포 확인 완료. 기능·검증 기록은 아래에 있다. |
| Store 계정 | 개인 개발자 등록·본인 확인·프로필·개발자 계약·앱 예약 완료. 다시 등록하지 않는다. |
| Store 앱 | **상상을 클릭하다! 운영자 공방**, Store ID `9N2V9KQDSJ0G`, 제출 초안 `1152921505702187840`, 버전 `3.0.0.0`, x64. |
| 제출 파일 | 실제 Store 식별값의 MSIX 생성·MakeAppx 검증 완료. 원본을 담은 MSIXUPLOAD도 생성·내부 해시 일치 확인. 파일명·크기·해시는 [Store 진행 기록](STORE_PROGRESS_2026-10-21.md). |
| 업로드 | 일반 Chrome의 자동·수동 MSIX와 MSIXUPLOAD 모두 Error, 재조회 시 Paused/null Bytes. 패키지 검증 성공·Save 완료 미확인. 정확한 실패 원인은 아직 불명이다. |
| Microsoft 문의 | **2026-10-21 16:03 KST 이메일 1회 발송 완료**. Gmail 전송 완료 알림·보낸편지함·첨부 1개 확인. 답변·담당 배정·접수 번호는 발송 확인 시점에 미확인. |
| 정식 앱 출시 | Store 심사 제출·Microsoft 서명·공개·학교 PC 설치/업데이트/제거 검증 미완료. 다운로드나 빌드 성공으로 설치 차단이 해결됐다고 안내하지 않는다. |
| 현장 검증 | 이전 14mm 출력 완료와 일반 STL/서포트 출력 검증을 구분한다. 일반 STL·서포트 실물, 학교 Wi-Fi·크롬북 정책·6대 동시 운영은 미검증이다. |

현재 문서는 위 확인 결과를 정리한 것이다. **이번 인수인계 작성에서 Gmail 답변, 프린터 상태, 로컬 서버 실행 상태를 새로 조회하지 않았다.** 아래의 ‘실행 중’, ‘현재’ 등은 해당 기록 시점의 관찰이며 다음 작업 때 필요한 범위에서 재확인한다.

## 사용자 선택과 이어갈 순서

- 사용자는 **전화번호 제공 없이 이메일로 진행**하겠다고 선택했다. 전화번호 필수인 문의 폼은 2/3 단계에서 멈췄고, 대신 공식 문서의 `reportapp@microsoft.com`으로 이메일을 보냈다. 전화번호를 다시 요구하거나 임의 번호를 입력하지 않는다.
- 사용자는 Microsoft 문의 발송과 **그 문의를 위한 Gmail 접속·작성·발송**을 명시적으로 허용했다. 동일한 허락을 다시 묻지 않는다. 처음 Gmail 접속의 자동 승인 거부는 이후 사용자 명시적 승인으로 해소됐으며 우회하지 않았다.
- 메일은 **이메일로만 회신**하고, 인증 전 업로드 문제를 담당 부서에 이관하거나 이메일 전용 지원 경로를 알려 달라고 요청했다. 메일 발송은 지원 담당 배정·티켓 생성·문제 해결과 구분한다. 같은 문의를 중복 발송하지 않는다.

1. 작업 재개 요청이 오면 [문의 발송 기록](STORE_UPLOAD_SUPPORT_DRAFT.md)의 제목·발송일·앱 ID로 **해당 문의의 Microsoft 답변이나 반송 여부부터 확인**한다. 아직 자동 모니터링이나 알림 예약을 설정한 상태는 아니다.
2. 답변의 오류 단계·계정 상태·추가 자료 요청을 확인하고 필요한 조치를 정한다. 같은 대용량 파일 선택이나 업로드를 근거 없이 반복하지 않는다. 로그인/파일 선택 권한 오류는 이미 해소됐으므로 처음부터 다시 안내하지 않는다.
3. 업로드가 실제 성공하면 서버의 패키지 식별·검증 결과와 Windows Desktop 대상·Save 저장을 확인한다. 이후 [제출 자료](STORE_SUBMISSION.md), WACK/대상 PC 검사, 심사 절차를 진행한다. 새 약관·법적 확인이 나오면 계정 소유자의 검토와 실제 동의가 필요하다.
4. 정식 배포 뒤 학교 PC 설치·업데이트·제거·설정 보존, 최신 중계기 API v8, 일반 STL/서포트 실물과 여러 대의 현장 매칭을 검증한다. 실제 출력을 새로 시작할 때는 그 시험에 대한 사용자 요청과 준비 상태를 확인한다.

## 저장 위치와 다른 PC에서 이어가기

- 저장소: `https://github.com/hichoni/3d-modeling`, 브랜치 `main`. 이 PC 작업 사본은 `C:/Users/User/Documents/ChatGPT/New project/stamp-studio`다. 메일 발송 기록을 반영한 커밋은 `b36e793`이다.
- 공개 식별값: [desktop/store-identity.json](../desktop/store-identity.json). 재빌드에는 `desktop/build.ps1`의 실제 `NodePath`, 필요 도구 경로와 이 파일의 IdentityName/Publisher/PublisherDisplayName/Version을 명시한다. `-Mode Store`만 주거나 Preview 기본 식별값으로 제출하지 않는다.
- 제출 파일: `artifacts/store-submission-20261021-initial/ClickBooth-3.0.0.0-x64-STORE-SUBMISSION-UNSIGNED.msix`, 같은 폴더의 `ClickBooth-3.0.0.0-x64.msixupload`.
- 발송 증거: `artifacts/registration/microsoft-support-email-sent-2026-10-21.jpg`. 오류 화면과 보관용 `Microsoft-Store-support-email-DRAFT.eml`도 같은 폴더에 있다. EML은 보관 초안이므로 다시 보내지 않는다.
- `artifacts/`, `runtime/`과 프린터 비공개 설정은 Git에서 제외된다. **집에서 GitHub만 내려받으면 이 파일들이 함께 오지 않는다.** 필요 파일·현장 설정은 비공개로 보존하고, 새로 빌드한 파일은 해시를 다시 계산해 기존 파일과 구분한다. 계정 이메일·인증 정보·Gmail 링크·프린터 접근 코드를 Git/Pages에 넣지 않는다.

아래는 시간순 작업 근거와 이전 현장 기록이다. 현재 결과는 위 표와 이어갈 순서를 먼저 따른다.

## 최신: Microsoft 문의 이메일 발송 완료 · 16:03 KST

사용자는 **전화번호를 제공하지 않겠다고 선택**한 뒤 **Gmail 접속·문의 발송을 명시적으로 허용**했다. `reportapp@microsoft.com`으로 업로드 실패 재현 기록과 오류 이미지 1개를 발송했고 Gmail 메시지 전송됨·보낸편지함을 확인했다. 제목은 `Partner Center MSIX upload Error / null Bytes - Store ID 9N2V9KQDSJ0G`, 발송 시각은 2026-10-21 16:03 KST다. 이메일 회신 및 담당 부서 이관/이메일 경로 안내를 요청했다. **답변·담당 배정·접수 번호는 아직 미확인**이다. 업로드와 Store 출시는 여전히 미완료다. 전화번호나 Gmail 접근 허락을 다시 요구하거나 같은 문의를 중복 발송하지 않는다. 비공개 Gmail 링크·이미지는 artifacts/registration에만 보관한다. [발송 기록](STORE_UPLOAD_SUPPORT_DRAFT.md).

## 최신: 수동 업로드와 MSIXUPLOAD도 실패 · 15:01 KST

일반 Chrome 로그인과 확장 프로그램의 파일 URL 권한은 사용자가 직접 완료했다. 자동 파일 선택 성공 후 포털 전송이 Error였다. 이어 사용자의 **수동 MSIX 선택도 Error**임을 확인했다. 공식 방법으로 원본 MSIX를 담은 `.msixupload`를 만들고 내부 해시를 검증해 한 번 전송했지만 이것도 즉시 Error였다. 두 파일의 정확한 크기가 표시되나 상세 오류·패키지 검증 성공은 없고 Save도 미완료다. HTTP 원인이나 포털 장애 여부는 확정하지 못했다. 계정 등록·로그인·파일 권한·같은 파일 선택을 다시 요구하거나 완료로 보고하지 않는다.

파일 해시는 최초 MSIX와 일치하고 `e056eee`의 Windows CI도 성공했다. 업로드와 별개다. [현재 Store 기록](STORE_PROGRESS_2026-10-21.md), [Microsoft 문의 발송 기록](STORE_UPLOAD_SUPPORT_DRAFT.md)을 먼저 읽는다. 실제 프린터·보안 정책은 변경하지 않았다.

## 최신: 개인 개발자 등록·앱 예약 완료, 제출 초안 준비

사용자가 본인 확인·프로필·개발자 계약 동의를 직접 완료했고 Microsoft의 계정 생성 완료를 확인했다. Partner Center 앱 **상상을 클릭하다! 운영자 공방**, Store ID `9N2V9KQDSJ0G`, Submission 1 초안을 만들었다. 실제 Name/Publisher/PublisherDisplayName은 [desktop/store-identity.json](../desktop/store-identity.json)에 기록했다. 계정 등록이나 식별값 전달을 다시 요구하지 않는다.

실제 식별값의 `3.0.0.0` Store 제출용 MSIX 생성·MakeAppx 검증·공개 payload 41개 해시 검사를 마쳤다. 설치·차단 우회·프린터 작동은 하지 않았다. Partner Center 업로드는 위 후속 수동·묶음 확인까지 모두 **Error**로, 저장 성공이 확인되지 않았다. 심사 제출·Microsoft 서명·공개·학교 설치는 미완료다. 파일 경로·해시·다음 절차는 [STORE_PROGRESS_2026-10-21.md](STORE_PROGRESS_2026-10-21.md)에 있다.

아래의 ‘계정 등록·본인 확인·실제 식별값이 필요’ 문구는 이 작업 이전의 기록이다. 현재 남은 외부 작업은 업로드·제출 자료 검토·심사·실제 설치 검증이다.

## 현재 차단 상태 · 11:49 KST 재확인

사용자가 최신 ZIP의 `configure-booth.cmd` 또는 `start-workshop.cmd`를 실행할 때 Smart App Control 차단을 다시 보고했다. 읽기 전용 확인에서 SAC는 On이며 11:48~11:49에 탐색기의 cmd.exe 실행 차단 이벤트가 있었다. 다운로드·페이지 배포 성공과 학교 PC 설치·실행 성공을 구분한다. 현재 ZIP/Preview MSIX는 정식 서명 전이며, 우회 실행이나 보안 설정 변경을 하지 않았다.

개인 명의 Store 앱 경로의 다음 조건은 계정 소유자의 개발자 등록·본인 확인 → 앱 이름 예약 → Product identity의 Name/Publisher/PublisherDisplayName 세 값이다. 실제 계정 값이 없으므로 Store 모드 제출용 빌드·심사·서명·설치 검증은 미완료다. [SAC 확인 기록](SMART_APP_CONTROL.md), [계정 준비 절차](WINDOWS_APP.md#사용자가-준비할-것)를 먼저 읽는다. 이 상태에서 ZIP을 다시 받거나 미서명 EXE로 바꿔 실행하는 것을 해결로 안내하지 않는다.

## 최신 보완: 다운로드부터 연결까지 웹 안내

사용자가 연결 프로그램의 다운로드·실행 방법을 웹에서 바로 따라갈 수 있게 요청했다. `/setup.html` 5단계 안내를 추가했고 스튜디오 연결 창·기존 부스 처음 설정·README에서 진입한다. 공식 Node.js 24 LTS Windows 64비트 MSI와 운영자 ZIP을 직접 받는다. 압축 해제 → 모드별 CMD → 미니 대수 → 로컬 연결 창 → 검색·8자리 코드까지 이어진다. 원격 크롬북에는 설치하지 않도록 구분한다.

- 이 PC 전용: `start-workshop.cmd`, 처음 설정 때 `bridge/setup.cjs --web`. 미니 대수만 묻고 연결 정보는 웹에서 입력한다. 검은 실행 창을 유지한다.
- 크롬북 함께 쓰기: `configure-booth.cmd`가 `--booth --web`으로 대수·출력 PC 주소를 확인한다. 배경 실행 후 스튜디오 연결 창을 연다. 일반 `start-booth.cmd`의 기존 화면 진입은 유지한다.
- 기존 연결 정보·이름·ID·PIN·공유 키는 보존한다. 업데이트 시 runtime 비공개 백업·보존을 안내한다. 실행 중인 구버전 서버는 자동 종료하지 않는다.
- 안내의 `#connect=1` 링크는 프린터 연결 창만 자동으로 열며, 검색·인증·출력은 명시적 클릭으로 진행한다. 공개 웹이 PC 실행 여부를 검사하거나 CMD를 자동 실행하지 않는다.
- ZIP은 여전히 정식 서명 전 개발용이다. SAC/학교 차단 시 멈추고 담당자 배포 검토를 요청하는 별도 화면을 제공한다. 차단된 실행 파일을 이 PC에서 재시도하거나 우회하지 않았다.
- **자동 검사 72개 통과**. 최초 6칸 준비·기존 비공개 설정 보존·공유 PC 주소 확인·실패 시 기존 파일 유지, ZIP/HTML 일치·정적 경로 보호 포함. 가상 서버의 안내 → 설정 새 탭 → 연결 창 자동 열기, 단계 전환·모드·차단 안내를 브라우저에서 확인했다.

기능 커밋 `0c9a44c`의 Pages 배포와 Windows 전체 검사·MSIX 빌드·격리 앱 실행이 성공했다. 공개 스튜디오 → 안내 페이지 진입과 HTML 3개·운영자 ZIP의 HTTP 200 및 로컬 해시 일치를 확인했다. [다운로드부터 연결까지 안내](https://hichoni.github.io/3d-modeling/setup.html)를 사용자에게 먼저 안내한다. 실제 설치 차단 해결·학교 Wi-Fi·6대 운영은 별도 현장 확인이 필요하다.

기능·배포 기록과 공개 화면: [SETUP_GUIDE_2026-10-21.md](SETUP_GUIDE_2026-10-21.md). 아래는 이전 STL·연결 보완 기록이다.

## 최신 보완: STL 가져오기와 연결 안내

- 사용자가 제공한 48,738면 STL이 ‘면적 없는 삼각형’으로 거절됐다. `studio-core.js`에서 면적이 정확히 0인 면만 제거하며, 원래 1e-8 기준으로 거절하던 작은 유효 면은 유지한다. 1e-4 반올림 모서리 키가 정상 연결을 합치던 문제도 고쳤다.
- `closed`(모든 모서리에 2면)와 `watertight`(열린/홀수 접합 없음)를 구분한다. 이 파일의 접합 모서리 2개는 경고로 보여주고 레이어를 검토하게 한다. 열린 모서리·퇴화/NaN·범위 제한은 중계기에서도 유지한다. 구멍을 자동으로 메우는 기능은 아니다.
- 파일을 연 뒤 복잡한 층 계산이 멈추던 별도 원인은 upstream의 보조 worker 기본값이었다. `tools/slicer/build.cjs`의 고정 소스 어댑터에서 풀 크기를 0으로 고정해 단일 worker의 boolean 계산을 사용한다. upstream 체크아웃은 수정하지 않았다.
- 해당 파일 브라우저 열기와 동일 worker의 **서포트 켬·72층·3MF 생성**을 확인했다. 약 80×44.31×14.31mm, 작품 경로 1시간 29분·10.68g. 실제 출력 명령은 보내지 않았다. 개인 파일명·원본·출력 파일은 artifacts에서만 다루고 Git/ZIP에 포함하지 않는다.
- 연결 화면은 ‘이 PC에서 출력 / 크롬북·다른 기기’, 웹→출력 PC→미니 그림, 필요한 단계로 바꿨다. 일반 공개 웹이 8자리 비밀번호만으로 MQTT/FTPS에 직접 연결하는 기능은 아니다. [사용자용 연결 안내](PRINTER_CONNECTION.md).
- 출력 PC에서 명시적으로 누르는 `/api/discover-printers` 읽기 전용 검색을 추가했다. 선택한 미니의 IP/SN을 채운 뒤 8자리 코드로 기존 검증·저장을 한다. 다른 기기·공개 출처에서는 검색 불가. 기존 등록 칸을 쓰며 자동으로 프린터를 추가/인증/출력하지 않는다. 실제 학교 Wi-Fi 검색은 미검증, 가짜 UDP·프린터·UI로 검증했다.
- **전체 자동 검사 68개 통과.** 정식 서명 앱·Store 출시·학교의 실행 차단 문제는 별도로 남아 있다. 보안 정책을 우회하지 않는다. 출력 PC는 수정된 최신 ZIP/코드로 갱신해야 새 검색·STL 검사 수정이 반영된다.

기능 커밋 `7292d68`의 Pages·Windows 전체 검사·MSIX·격리 앱 실행이 모두 성공했다. 공개 HTML 두 개·운영자 ZIP의 해시 일치와 새 연결 화면·공개 60층 계산을 확인했다. 상세 배포 결과는 [이번 수정 기록](STL_IMPORT_CONNECTION_FIX_2026-10-21.md)에 남겼다. 아래는 먼저 배포한 스튜디오의 기록이다.

## 최신 작업부터 확인

요청은 **일반 STL 업로드 → 웹 슬라이싱 → A1 mini 출력 검토까지 가능한 전문 스튜디오로 확장하고 배포하는 것**이다. 기존 14mm 부스 화면은 유지하고 `/studio.html`을 추가했다. 공개 진입은 [Click Studio](https://hichoni.github.io/3d-modeling/studio.html), 구현·제한은 [STL_STUDIO.md](STL_STUDIO.md)다.

- 작업 사본: `C:/Users/User/Documents/ChatGPT/New project/stamp-studio`, main. 시작 시 원격 `40fd7b7`까지 fast-forward한 뒤 작업했다.
- STL 바이너리/ASCII, 최대 6개·6MB·12만 삼각형, 170×170×160mm 허용. 이동·회전·균일 배율/치수·복제·자동 배치·실행 취소, 메쉬/범위/겹침 진단, 프로젝트 저장/불러오기를 추가했다.
- 품질·PLA·채움·벽 수·자동 일반 서포트·브림·속도, 실제 층·기능별 경로·시간·무게, 명시적 출력 검토를 제공한다. A1 mini·0.4mm·외부 PLA·텍스처 PEI만 지원한다.
- **중계기 API v8 필요**. 기존 API v7은 14mm 체험에 계속 쓸 수 있지만 새 STL 출력에는 최신 ZIP으로 업데이트해야 한다. `/api/studio-jobs`로 범위를 분리하고 기존 14mm 검증을 유지했다.
- 중계기는 메쉬·프로필·경로·배치를 다시 검사하고 고정 기계 절차를 덧붙인다. 큰 STL용 레벨링 영역과 종료 Z 상승을 모델에 맞게 계산한다. 자신의 3MF 저장/준비 취소만 허용하며 출력 시작은 별도 검토 버튼이다.
- **자동 검사 62개 통과**. 실제 엔진의 서포트·160mm 높이·3MF·인증·중복 시작·모의 전송 포함. 브라우저에서 업로드·변환·187층 계산 및 가상 미니 매칭/전송을 확인했다.
- 이번 작업은 실제 프린터를 켜거나 출력하지 않았다. 기존 실제 중계기 5188은 작업 시작 때 응답하지 않았다. 검증용 5193은 MQTT/FTPS를 가짜 전송으로 대체한 격리 서버였다. 아래 08시의 ‘실행 중/현재 상태’는 **그 시점의 과거 기록**이며 지금 상태가 아니다.
- **큰 STL·서포트의 실물 출력, ChromeOS 학교 정책·6대 동시 운영은 미검증**이다. 자동 메쉬 수리·트리 서포트·AMS·다른 재료/기종/노즐은 없다. 기존 SM v3 완료와 새 STL 경로의 실물 검증을 혼동하지 않는다.

다음 작업은 최신 ZIP/API v8로 기존 비공개 runtime을 보존해 업데이트하고, 20mm 블록의 첫 층·종료 동작·치수, 다음에 T자 서포트를 현장에서 비교하는 것이다. 프린터를 움직이는 시험은 사용자 요청·실물 준비 확인 후 진행한다. 학교 보안 정책과 Smart App Control을 우회하지 않는다. Store 정식 서명/출시는 별도 미완료다.

기능 커밋 `8323014`의 Pages 배포와 Windows 전체 검사·MSIX 빌드·격리 앱 실행 검사가 성공했다. 공개 index.html·studio.html·운영자 ZIP 모두 HTTP 200 및 로컬 SHA-256 일치를 확인했다. 공개 스튜디오에서도 실제 계산 75층과 중간 층 속 채움을 확인했다. 검증용 5186/5193 프로세스는 종료했다.

배포 커밋·Actions·공개 파일 해시는 [STL 스튜디오 배포 기록](STL_STUDIO_RELEASE_2026-10-21.md)에 남겼다. 화면만 보려면 공개 스튜디오를 열고, 출력에는 실행 중인 현장 중계기와 1:1 매칭이 필요하다. 공개 페이지 접속만으로 중계기 프로세스가 실행되지는 않는다.

## 이전 08:12 KST 관찰 기록

**아래는 14mm SM v3 출력 당시 기록이다. 실행 중이라는 표현·통계·연결 상태는 현재값으로 인용하지 말고 재조회한다.**

다음 작업자는 이 문서부터 읽는다. 코드·중계기 API·보관 작업을 읽어 확인한 상태다. 프린터 상태와 집계는 이후 달라질 수 있으므로 다시 조회한다. 이전 날짜 문서는 해당 배포 시점의 기록이다.

## 가장 먼저 알아둘 점

**지금 이 PC에서 출력할 때는 http://127.0.0.1:5186/ 를 사용한다.** 이 주소의 브라우저에 기존 SM 디자인·기기 매칭이 있고, 실제 A1 mini 목록과 실시간 상태 수신을 확인했다.

- GitHub 공개 사이트 https://hichoni.github.io/3d-modeling/ 는 공방 연결 없이 열면 모델링·슬라이싱은 가능하지만 프린터 목록은 비어 있다. 설정이 지워진 것이 아니다.
- 직전 안내에서 공개 사이트를 출력 진입 주소처럼 제공해 사용자가 빈 목록을 보게 됐다. 현재 탭을 연결된 로컬 5186 공방으로 옮겨 해결했다. 같은 혼동을 반복하지 않는다.
- 중계기는 5188에서 실행 중이고 개발 미리보기 5186이 API 요청을 전달한다. 두 주소는 브라우저 저장소·기기 토큰이 다르므로 기존 작업을 이어가며 임의로 주소를 바꾸지 않는다.
- 현재 부스 모드는 **false**다. 다른 크롬북·GitHub Pages에서 이 PC에 붙는 공유 부스 연결을 설정한 상태가 아니다. 기존 액세스 코드를 다시 입력하거나 네트워크 공개 범위를 임의로 넓히지 않는다.
- 현재 사용자 요청은 **상황을 MD로 인수인계하는 것**이다. 새 출력·가열·설정 변경을 시작하라는 요청은 아니다.

## 저장소와 배포

| 항목 | 상태 |
| --- | --- |
| 저장소 / 브랜치 | https://github.com/hichoni/3d-modeling · main |
| 작업 사본 | 이 대화 작업공간의 `work/3d-modeling` |
| 출력 전 설정·프리셋 기능 | `a32e1d3e32f3b19514d5f33870cd3a27e9159912` |
| 최신 연결 유지 보완 | `4826bb2ef10473af856023c60a9260f1157c6d86` |
| 이 인수인계 갱신 직전 HEAD | `0fe8140ee609c25ff012fd2128ba8141b1cb0820` |
| 로컬 중계기 | http://127.0.0.1:5188/ · API v7 |
| 현재 사용할 화면 | http://127.0.0.1:5186/ · HTTP 200 확인 |

코드·공개 HTML·운영자 ZIP은 main에 반영돼 있다. [기능 Pages 배포](https://github.com/hichoni/3d-modeling/actions/runs/39506689387), [Windows 빌드·MSIX·격리 시작/종료·UI 검사](https://github.com/hichoni/3d-modeling/actions/runs/39506690767), [직전 문서 Pages 배포](https://github.com/hichoni/3d-modeling/actions/runs/39506987043)는 모두 성공했다.

- 최신 자동 검사: **54개 통과·실패 0개**. 이번 갱신은 문서뿐이므로 전체 검사를 다시 실행하지 않는다.
- 공개 HTML SHA-256: `8221cd25426b3546465e0b53f88c8542dda71d2d454c9ecc05c0955283bf7d76`
- 공개 ZIP SHA-256: `4827a3a834f26c095d47c49ce23da3e16b1d0d1773a93b60052de7841c0b5360`
- 공개 HTML·ZIP의 HTTP 200과 로컬 해시 일치는 직전 배포에서 확인했다. Windows 패키지는 미서명 검토용이며 Store 정식 출시는 하지 않았다.

## 실제 프린터와 현재 집계

- 등록 프린터: `mini-01`, 화면 이름 **A1 mini 1439**.
- 현재 상태: **online=true, fresh=true, FINISH, busy=false, 오류 없음**.
- LAN Only·Developer Mode 연결로 MQTT 상태 수신과 FTPS 출력 경로를 사용한다. 액세스 코드는 로컬 비공개 설정에 이미 저장돼 있다.
- 본체 보고: 외부 스풀·PLA·흰색(`#FFFFFF`), 노즐 권장 190–240°C. AMS 목록은 비어 있다.
- **종류·색상은 본체 등록값이며 실제 스풀을 센서로 식별한 결과가 아니다.** 초록색 실물 사진과 흰색 등록값이 다르지만 본체 설정을 임의로 바꾸지 않았다.
- 현재 중앙 집계: 오늘 체험 **1명**, 누적 체험 **1명**, 오늘 완료 출력 **2개**, 누적 완료 출력 **3개**. 한국 날짜 기준이다. 과거 인원 기록이 없어 집계 기능 도입 이후부터 센다.
- `runtime`의 설정·매칭·통계·작업은 보존했다. 가짜 프린터 UI 시험 서버는 종료했고 시험 파일은 Git에서 제외된 `work`에 있다.

## 완료한 기능

1. **14×14mm 키캡 모델링과 실제 웹 슬라이싱**: Kiri worker가 브라우저에서 계산한다. 이 기본 경로에는 Bambu Studio가 필요 없다. 실제 경로의 층 쌓기·한 층 분리·속 채움·완성 모델을 살펴본다.
2. **바로 출력**: 대기표·개별 운영자 PIN 승인 없이 브라우저 계산 → 중계기 검증·3MF → 해당 프린터 업로드·시작으로 이어진다. 다음 작품을 자동 출력하지 않는다.
3. **웹에서 연결 설정 입력**: 부스 연결 창에서 LAN 액세스 코드를 직접 입력·저장·연결 확인한다. 메모장 편집을 요구하지 않는다. 현재 PC는 이미 연결돼 있다.
4. **출력 전 보정**: 베드 레벨링·자동 유량 보정을 각각 체크/해제한다. 기본 모두 켬이며 브라우저·프린터별 선택을 저장한다. 시작 순간 작업에 복사하고 전송·출력 중에는 잠근다. 실제 `bed_leveling`, `flow_cali`까지 반영한다.
5. **필라멘트 정보**: 최신 본체 재질·색상·권장 온도를 표시하고 오래된 값은 숨긴다. 현재 출력은 외부 PLA 전용이며 보고된 비-PLA나 사용 중인 AMS 재료는 시작을 막는다. AMS 슬롯은 읽기 전용이고 자동 라우팅은 없다.
6. **웹 품질 선택**: 0.12mm 정밀·0.16mm 균형·0.20mm 표준, Generic PLA·Bambu PLA Matte. 선택 변경 시 기존 계산을 버리고 다시 슬라이싱한다. 첫 층은 모두 0.20mm이며 0.4mm 노즐 고정이다.
7. **3D A1 mini 튜토리얼**: 베드·노즐·필라멘트·층 쌓기·식히기 애니메이션과 실제 온도·목표 온도·작업 상태. 원리 미리보기는 하드웨어를 움직이지 않는다.
8. **상단 날짜·카운터**: 오늘/누적 체험 인원·완료 출력 수. 공방 연결 시 중앙 합계, 미연결 시 이 브라우저 기준이다. 같은 체험 새로고침·재시도와 작업 완료 중복 합산을 막는다.

## 실물 출력과 품질

현재 보관 작업 3개 모두 SM·실제 웹 슬라이싱 출력이며 중계기 상태는 complete다.

| 프로필 | 층 수 | 작품 경로 예상 / 작품 재료 | 실물 피드백 |
| --- | --- | --- | --- |
| v1 · 0.20mm | 10 | 약 2분 13초 / 0.270g | 바닥·윗면·글씨의 빈틈과 실 끌림 |
| v2 · 0.20mm | 10 | 약 2분 26초 / 0.331g | 전반적 개선. S 안쪽 틈, M 꺾이는 부분·접합부 구멍이 남았다는 사진 피드백 |
| v3 · 0.20mm Generic PLA | 10 | 약 2분 29초 / 0.337g | **2026-10-21 08:09:34 KST 기기 완료 확인. 새 실물 사진·품질 피드백은 아직 없음** |

**최신 v3 작업**:

- 작업 ID `8bcdd4421adecb227e4a6996`.
- 접수 2026-10-21 08:02:07 KST → 완료 08:09:34 KST.
- 정확한 프로필 `click-paths-0.4-0.2-generic-v3`.
- 저장된 옵션은 **bedLeveling=false, flowCalibration=false**. 사용자가 두 옵션을 끈 상태로 보낸 작업이다. 기본값 모두 켬과 이 작업의 실제 선택을 혼동하지 않는다.
- 기기 완료는 품질 합격이나 보정 효과 검증을 뜻하지 않는다. 위 예상은 작품 경로 범위이며 예열·퍼지·보정을 포함한 총시간/총재료와 직접 비교하지 않는다.

v2는 Kiri/Bambu 비드 단면 계산 차이와 재료 유량 0.98을 반영하고 윗면 5겹·바닥 3겹·thin-fill을 적용했다. v3는 글씨 형상 자체에 구멍이 없음을 확인하고 Kiri 채움/벽 겹침을 15→35%로 늘렸다. 같은 SM 경로 진단의 빈틈 표본은 줄었지만 실물 개선을 단정하지 않았다.

**Bambu Studio의 A1 mini PLA Matte·0.20mm Standard와 동급 품질이라고 확정하지 않는다.** 일부 온도·유량·선폭·층 수를 참고했지만 엔진·채움·속도·냉각이 다르다. 웹은 12mm³/s 상한을 유지하고 공식 Matte의 22mm³/s를 그대로 적용하지 않는다. 0.08mm·강도·다른 노즐 옵션은 아직 없다.

다음 비교 후보로 **0.16mm·Bambu PLA Matte·두 보정 모두 켬**을 안내했으나 이 조합의 실물 출력을 완료했다고 기록하면 안 된다. 실제 재료가 해당 Matte인지 확인하고 새 출력은 사용자 요청 후 진행한다. 얇은 층만으로 가로 방향 빈틈이 자동 해결되지는 않는다.

## 다음 작업 우선순위

1. **방금 완료된 v3 실물 피드백**: S/M 글씨 속 틈·M 접합부·밑판 외벽 안쪽·바닥면·실 끌림·치수·받침 끼움. 앞선 v2 사진을 v3 결과로 오인하지 않는다.
2. 사용자 요청 시 같은 디자인으로 조건을 정해 비교 출력한다. 현재 v3 기준은 0.20mm Generic/보정 둘 다 끔이므로 재료·층 높이·보정 옵션을 기록한다.
3. **공개 웹/로컬 공방 진입 UX 개선 여지**: 빈 목록의 이유와 이 PC 공방/다른 PC 부스 연결 경로를 더 분명히 안내할 수 있다. 자동 연결·주소 간 디자인/설정 자동 이관은 구현하지 않았다. 현재 해결은 기존 5186 공방으로 이동한 것이다.
4. 실제 학교 ChromeOS·학교 Wi-Fi·여러 미니 동시 운영, 앱 제어 정책, 정식 Store 배포는 별도 미검증이다.

## 실행·업데이트

지금은 서버가 실행 중이므로 기존 주소부터 확인한다. 출력 중이거나 결과가 불확실하면 중계기·연결을 재시작하지 않는다. 동일 자격 증명으로 연결되고 보고가 최신이면 재확인 시 연결을 유지한다. 오래됐거나 자격 증명이 바뀌면 discovery·TLS 검증을 다시 한다.

새 실행이 필요하면 저장소 루트에서 각각 별도 프로세스로 실행한다. 이미 포트를 사용 중이면 중복 실행하지 않는다.

```powershell
node bridge/server.cjs
node scripts/serve.cjs
```

중계기는 5188, 미리보기는 5186. Node.js 20 이상이 필요하고 일반 실행에는 npm 설치가 필수가 아니다.

다른 PC 업데이트는 작업이 끝난 뒤 서버를 종료하고 **runtime 전체를 비공개 백업**한 후 공개 코드만 갱신한다. config.json·pairings.json·statistics.json·jobs를 새 기본 파일로 덮어쓰지 않는다. 새 PC 최초 등록은 configure-booth.cmd 또는 node bridge/setup.cjs다. 다른 기기 참가자 접속에는 별도 부스 모드·공유 링크·같은 네트워크 허용이 필요하다.

## 주요 파일과 확인 명령

| 영역 | 파일 |
| --- | --- |
| 사용자 흐름·출력 UI | src/app.js, src/index.html, src/style.css |
| 공방 연결·매칭 | src/connection.js, bridge/connection-settings.cjs, bridge/pairings.cjs |
| 보정 체크·필라멘트 | src/print-preparation.js, bridge/print-preparation.cjs |
| 웹 프리셋·엔진 | src/print-profiles.js, src/browser-slice-worker.js, src/browser-slicer.js |
| 경로 검증·3MF·출력 시작 | src/toolpaths.js, bridge/browser-job.cjs, bridge/direct-print.cjs, bridge/fleet.cjs |
| 층 시각화·프린터 튜토리얼 | src/layer-view.js, src/print-lesson.js, src/printer-tutorial.js |
| 날짜·통계 | src/statistics-core.js, src/statistics.js, bridge/statistics.cjs |
| ZIP·Windows 허용 목록 | scripts/package-operator.cjs, desktop/prepare-payload.cjs |

화면·중계기 변경 후:

```powershell
node scripts/build.cjs
node --test tests/*.test.cjs
git diff --check
```

엔진·공통 프리셋을 바꾸면 먼저 node tools/slicer/build.cjs로 worker를 재생성한다. 고정 upstream과 잠금 의존성은 [빌드 안내](../tools/slicer/README.md)를 따른다. index.html·downloads/booth-setup.zip·worker·해시 파일을 소스와 함께 갱신한다. 새 런타임 모듈은 ZIP과 Windows 두 허용 목록에 포함한다.

runtime·work·artifacts 및 실제 IP·일련번호·액세스 코드·운영자 PIN·부스 키를 공개 저장소나 ZIP에 넣지 않는다. 소유자·매칭 버전·해시·중복 시작 방지·최신 상태·SD·0.4mm 노즐 검사를 유지한다. 학교 정책이나 인증서 검증을 우회하지 않는다.

상세 기록: [출력 전 설정·품질 프리셋·배포](PRINT_PREPARATION_2026-10-21.md), [집계 도입 배포](DEPLOYMENT_2026-10-21.md), [이전 실물 진단](PRINT_VALIDATION_2026-10-20.md), [웹 구현 범위](WEB_FIRST.md), [현장 매칭](FLEET.md), [부스 운영](BOOTH_GUIDE.md).
