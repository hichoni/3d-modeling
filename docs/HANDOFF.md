# 집에서 이어가기 — 2026-10-21

최신 기능과 집계 기준·배포 확인은 [2026-10-21 기록](DEPLOYMENT_2026-10-21.md)에 있다. 이전 날짜의 검증 문서는 당시 상태를 보관한 기록이다.

## 현재까지 확인한 범위

- 브라우저에서 모델링과 실제 Kiri 웹 슬라이싱을 한다. Bambu Studio는 대체 계산용 선택 사항이다.
- A1 mini 연결 설정을 웹에 입력하고, 대기표와 개별 운영자 승인 없이 **바로 출력**한다.
- 3D 프린터 튜토리얼에서 베드·노즐·필라멘트를 설명하며 실제 온도와 작업 상태를 표시한다.
- 상단에 한국 날짜와 오늘/누적 체험 인원·완료 출력 수를 표시한다. 공방 연결 시 전체 합계, 미연결 시 이 브라우저 합계다. 과거 인원 기록은 없으므로 새 기능 적용 이후부터 쌓인다.
- 웹 v1·v2 SM 각각 실물 완료 기록을 확인했다. v2의 새 사진·표면 품질·받침 결합 확인은 남아 있다. 기기 완료를 품질 합격으로 해석하지 않는다.
- 실제 학교 ChromeOS·학교 Wi-Fi·6대 동시 실물 운영과 정식 Store 배포는 아직 검증하지 않았다.

## 실행과 업데이트

1. 최신 main을 받는다. 기존 수정이 없는 체크아웃에서는 git pull --ff-only를 쓴다.
2. Node.js 20 이상을 준비한다. 웹을 계산하고 중계기를 실행하는 데 npm 설치와 Bambu Studio는 필수가 아니다.
3. 기존 공방이면 출력이 끝난 뒤 서버를 종료하고 비공개 **runtime 폴더 전체를 백업**한다. 새 공개 코드로 갱신하되 config.json·pairings.json·statistics.json·jobs는 보존한다.
4. 새 PC는 configure-booth.cmd 또는 node bridge/setup.cjs로 미니를 등록한다. node bridge/server.cjs 또는 start-workshop.cmd로 중계기를 실행한다.
5. http://127.0.0.1:5188/ 를 열고 **부스 연결 → A1 mini 직접 연결**에서 현재 LAN 액세스 코드를 입력해 저장·연결을 확인한다. 프린터의 LAN Only와 Developer Mode, 같은 Wi-Fi가 필요하다.
6. 참가자 크롬북은 부스 링크를 열고 사용할 미니를 고른다. 한 대면 자동 매칭한다. 빈 베드·텍스처 PEI·0.4mm 노즐·외부 PLA 준비 뒤 바로 출력을 누른다.
7. 최신 중계기는 API v6이다. HTML만 갱신하고 구버전 중계기를 계속 켜 두지 않는다. IP·일련번호·접근 코드·운영자 PIN은 공개 저장소와 ZIP에 없다.

로컬 개발 미리보기: node scripts/serve.cjs → http://127.0.0.1:5186/ . /api 요청은 로컬 중계기 5188로 전달된다. 미리보기만 열어도 프린터 없이 디자인과 실제 슬라이싱을 할 수 있다.

## 수정과 검사

- 화면·중계기 변경: node scripts/build.cjs, node --test tests/*.test.cjs.
- 웹 엔진 설정 변경: 먼저 node tools/slicer/build.cjs. 고정 소스·잠금 의존성은 tools/slicer/README.md를 따른다.
- 통계 로직: src/statistics-core.js, src/statistics.js, bridge/statistics.cjs.
- 바로 출력: bridge/direct-print.cjs, bridge/fleet.cjs, src/app.js.
- 3D 안내: src/print-lesson.js, src/printer-tutorial.js.
- 다운로드 ZIP과 Windows payload는 허용 목록이다. 새 런타임 require를 추가하면 scripts/package-operator.cjs와 desktop/prepare-payload.cjs에 포함됐는지 확인한다.
- runtime, work, artifacts는 Git에서 제외한다. 다른 PC로 옮길 비공개 백업은 공개 저장소에 올리지 않는다.

## 문제 해결과 후속 검증

출력 결과가 불확실하면 재전송하지 않고 본체를 확인한다. ⚙ 운영자 PIN은 전체 프린터 관리·매칭 복구·이전 작업 정리에 쓴다. 출력 중에는 서버나 프린터 연결을 재시작하지 않는다. 학교 네트워크/앱 제어 정책은 우회하지 않는다.

다음 검증은 v2 표면·실 끌림·치수·받침 결합, 학교 ChromeOS와 여러 미니의 동시 운영이다. 상세 안내: [부스 운영](BOOTH_GUIDE.md), [현장 매칭](FLEET.md), [크롬북](CHROMEBOOK.md), [실물 기록](PRINT_VALIDATION_2026-10-20.md).
