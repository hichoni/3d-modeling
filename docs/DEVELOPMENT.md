# 개발 구조

## 빌드와 실행

Node.js 20 이상. npm 패키지 설치 없이 Node 표준 라이브러리와 저장소에 포함한 Three.js·글꼴을 사용합니다.

```powershell
node scripts/build.cjs
node --test tests/*.test.cjs
node scripts/serve.cjs
# 실제 슬라이싱/현장 연결
node bridge/setup.cjs
node bridge/server.cjs
```

`src`를 수정한 뒤 `index.html`을 다시 빌드해야 합니다. Pages는 `main`의 루트 `index.html`을 제공합니다. 정적 미리보기는 5186, 로컬 공방은 5188입니다. 두 서버 모두 허용된 파일만 제공하며 `runtime`, `artifacts`, 임의 경로는 제공하지 않습니다.

## 모델링

브라우저 캔버스에 한글/영문/숫자 또는 직접 그린 기하 아이콘을 렌더링 → marching squares → 윤곽 간략화 → 구멍/내부 영역 분류 → Three.js extrusion → 바이너리 STL 순서입니다.

외곽은 14×14mm, R2.8mm 둥근 사각입니다. 모서리당 14개 선분으로 근사하고 래스터에서 얻은 점은 같은 외곽 안으로 투영합니다. 바닥은 1.5mm이며 윗면과 0.02mm 겹칩니다. Boolean union을 수행하지 않으므로 겹치는 닫힌 메쉬입니다. Bambu Studio에서 슬라이싱을 확인했지만 모든 다른 슬라이서의 병합 결과를 보장하지는 않습니다.

기본 새김 높이는 0.8mm입니다. 0.6/0.8/1mm 선택을 제공합니다. 글자는 1~4자, Jua/Do Hyeon/Gaegu 3종. 글씨는 키캡 위에서 읽는 방향이며 도장용 반전을 적용하지 않습니다. 이전 프로젝트의 손잡이·크기·형태 값은 JSON 불러오기 시 허용하지 않습니다.

## 브라우저 슬라이싱 · 기본 경로

`src/browser-slice-worker.js`가 고정 Kiri:Moto FDM worker의 slice/prepare/export를 호출합니다. `vendor/kiri/fdm-worker.js`를 HTML에 포함하고 Blob Worker에서 실행하므로 외부 엔진 요청이 없습니다. 재빌드는 [tools/slicer](../tools/slicer/README.md)를 참고하세요.

`src/browser-slicer.js`가 진행·취소·모델 변경 시 무효화를 관리하고, `src/toolpaths.js`가 경로를 해석·검증합니다. 같은 검증기를 중계기에서도 사용합니다. `bridge/browser-job.cjs`는 STL·경로 검증 후 고정 A1 mini 기계 절차를 추가하고 3MF와 해시를 생성합니다. Bambu Studio를 실행하지 않습니다. 시간·무게는 모델 경로 기준이며 준비 동작은 별도입니다. 새 조합의 실물 출력은 검증 전입니다.

## Bambu Studio 슬라이싱 · 선택 대체 경로

`bridge/core.cjs`는 설치된 Bambu Studio의 공식 BBL 프로필에서 `inherits`, `include`를 전개합니다. A1 mini 0.4 / 0.20mm Standard / Generic PLA / Textured PEI로 CLI를 실행합니다. 실행 파일과 인수는 shell 문자열이 아닌 인수 배열로 전달하고 창은 숨깁니다.

서버는 업로드된 바이너리 STL의 파일 길이·좌표·외곽·높이를 검증합니다. CLI 반환값과 `result.json`, 출력물 1개, 크기, 3MF 내 G-code, 시간·재료량을 확인합니다. ZIP의 `Metadata/plate_1.gcode`에서 실제 압출 선분을 추출해 층별 미리보기에 사용합니다. 교정·퍼지 선분은 제외하고 모델 중앙(90,90)의 경로만 시각화합니다. 이 파서는 현재 A1 mini 중앙 배치 / G0·G1 경로에 맞춰져 있으며 범용 G-code 뷰어가 아닙니다.

Pages에서 계산 전 층 미리보기는 교육용 메쉬 절단입니다. 웹 엔진 계산 후에는 실제 노즐 경로와 경로 시간으로 전환합니다. 선택 대체 계산을 사용한 작업은 Bambu Studio 결과로 구분하며 해당 시간에는 준비 동작이 포함됩니다.

## 현장 서버

- `runtime/config.json`: PC별 프린터 설정과 운영자 PIN. Git 제외.
- `runtime/jobs/<무작위 ID>/`: STL, CLI 프로필·로그, 3MF, 작업 상태.
- 기본 `127.0.0.1` bind. 부스 모드에서는 `0.0.0.0` bind + 설정한 PC IPv4 Host 허용 + 부스 접속 키 + GitHub Pages origin CORS를 사용. 중앙 전체 관리 권한은 loopback에서만 허용. 크롬북 운영자 PIN 토큰은 현재 기기·미니·매칭 버전으로 제한. 요청 토큰 검증, 운영자 토큰 30분 만료, PIN 시도 제한.
- 실제 출력은 운영자 토큰, 빈 베드·외부 PLA 확인, 최신 장비 상태, 0.4mm 노즐, SD 카드, 파일 해시가 필요합니다.
- SSDP로 지정 IP·일련번호의 모델 N1(A1 mini)과 LAN 모드를 확인합니다. MQTT 8883 / FTPS 990의 TLS 인증서와 일련번호 호스트명을 검증합니다.
- 출력 파일은 Bambu Studio로 생성한 고정 경로의 파일만 사용합니다. 임의 G-code 업로드 API는 없습니다.
- 업로드 크기를 검증하고 시작 시도 상태를 저장한 뒤 MQTT `project_file`을 한 번 전송합니다. 작업 ID가 일치하는 상태만 반영합니다.
- 시작 결과가 불확실하거나 서버가 재시작되면 `uncertain`으로 표시합니다. 자동 재전송·자동 연속 출력은 없습니다.
- 참가자가 사용하는 같은 PC에서 운영자 PIN은 기본적인 조작 분리 장치입니다. 로컬 파일·개발자 도구 접근 권한을 가진 사람에 대한 보안 경계는 아닙니다. 인터넷에 포트 포워딩하지 마세요. 부스 모드는 참가자 접수 권한만 공유합니다.

## 데이터와 화면

디자인은 브라우저 localStorage, 현재 작업 연결은 sessionStorage에 보관합니다. 새 참가자 초기화는 디자인을 기본값으로 바꾸며 이미 접수한 서버 대기표는 보존합니다. 운영자 창을 닫으면 클라이언트의 운영자 토큰을 지웁니다. 작업 이름과 코드에는 `textContent`를 사용하고 설정 불러오기는 허용 목록으로 제한합니다.

학교 프린터의 실제 주소·일련번호·접근 코드는 공개 소스에 넣지 않습니다. 실제 출력 파일에는 로컬 경로가 포함될 수 있으므로 Git에 넣지 않습니다.

## 다음 개발 범위

현장 끼움 공차·작은 획 테스트, 여러 작품의 한 베드 배치, ChromeOS 실기·학교 Wi-Fi 환경 확인은 후속 작업입니다. 여러 참가자 기기의 공통 접수와 순차 슬라이싱은 구현했으며, 현장 PC 한 대가 여러 A1 mini를 독립 관리하며, 각 프린터에서 작품 한 개씩 시작합니다.

## 부스 연결 모듈

`src/connection.js`는 부스 링크의 사설 IPv4·키를 검증하고, GitHub Pages에서 설정한 PC로 HTTP 요청을 보냅니다. 연결 정보는 URL fragment와 localStorage에만 보관합니다. `bridge/access.cjs`는 참가자/로컬 운영자 경계를 확인하고 사전에 허용한 origin의 CORS preflight만 응답합니다. Chrome LNA는 별도로 적용되며 학교 정책을 우회하지 않습니다.

슬라이싱은 동시 요청을 디스크 작업으로 접수하고 `slice_wait` → `slicing` → `ready` 순서로 직렬 처리합니다. 출력 대기표는 별도의 `queued` 상태입니다. `scripts/start-background.ps1`과 `scripts/install-autostart.ps1`은 사용자 PC에서 직접 실행하는 편의 도구입니다.

## 현장 매칭과 여러 프린터

`bridge/printers.cjs`는 여러 미니의 ID/IP/일련번호 중복을 거부합니다. `bridge/pairings.cjs`는 기기↔프린터의 유일한 매칭을 저장하고, 버전 증가로 이전 접수를 무효화합니다. 브라우저는 무작위 기기 토큰을 보관하고 서버는 SHA-256 식별자로 저장합니다. `bridge/fleet.cjs`는 미니별 MQTT·FTPS 연결, 현재 작업, 진행·오류를 별도로 보관합니다. 한 프린터의 작업/중지 상태는 다른 프린터에 반영되지 않습니다.

슬라이싱 전 현재 매칭을 기록하고 업로드 이후에도 버전을 다시 검사합니다. 시작 전 기기 소유자·매칭 버전·프린터 ID·실제 일련번호 스냅샷을 확인합니다. 출력 중/불확실 상태는 재매칭하지 않습니다. 미출력 접수를 취소하기로 확인한 경우에만 안전한 매칭 변경이 가능합니다. 중앙 관리에서 분실 기기의 매칭을 해제할 수 있고, 각 크롬북은 PIN을 통해 자신의 현재 미니만 제어합니다.
