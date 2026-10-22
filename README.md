# 상상을 클릭하다! — 3D 키캡 클리커 만들기

**[바로 체험하기 →](https://hichoni.github.io/3d-modeling/)**

**[새 · 크롬북만으로 출력 — Click Studio 앱 설치하기 →](https://hichoni.github.io/3d-modeling/chromebook.html)** — 크롬북에 앱(Isolated Web App)을 한 번 설치하면 출력 PC 없이 같은 Wi-Fi의 A1 mini를 찾아 1:1 연결하고, 슬라이싱·전송·출력·일시정지·속도·조명까지 앱에서 합니다. [앱 파일](https://hichoni.github.io/3d-modeling/downloads/click-studio.swbn) · [기술 문서](docs/CHROMEBOOK_DIRECT.md) · 모의 프린터와 실제 Chromium으로 끝까지 시험했고, **실물 A1 mini·실제 크롬북 시험은 남아 있습니다.**

**[새 · 안드로이드 태블릿 앱 (APK) →](https://hichoni.github.io/3d-modeling/chromebook.html#android)** — 태블릿에 Click Studio 앱을 설치하면 크롬북 앱과 같은 방식으로 같은 Wi-Fi의 A1 mini에 바로 출력합니다. Windows·Mac·iPad에서 사이트를 열면 STL 저장 + Bambu Studio 안내가 나옵니다. [APK](https://hichoni.github.io/3d-modeling/downloads/click-studio.apk) · [기술 문서](docs/ANDROID_APP.md) · 실제 태블릿 + A1 mini에서 부스 출력까지 확인했습니다(MakerWorld 링크 받기는 시험 전).

**[Windows 연결 프로그램 받기 · 다운로드부터 프린터 연결까지 5단계 →](https://hichoni.github.io/3d-modeling/setup.html)** — 공식 Node.js 설치 파일, 연결 프로그램 ZIP, 압축 해제, 실행할 파일, 미니 검색·8자리 코드 입력을 웹에서 따라갑니다. 크롬북에는 이 프로그램을 설치하지 않습니다. 학교 PC가 개발용 ZIP 실행을 차단하면 담당자의 배포 승인이 필요합니다.

**[Click Studio · STL 웹 스튜디오 →](https://hichoni.github.io/3d-modeling/studio.html)** — 일반 STL을 올려 배치·회전·크기를 조정하고, 채움·외벽·서포트·브림을 설정해 실제 레이어를 계산합니다. 프로젝트 저장과 출력 전 검토를 제공합니다. A1 mini/0.4mm/외부 PLA 베타이며, 출력에는 최신 중계기 API v8이 필요합니다. [기능·제한·검증 상태](docs/STL_STUDIO.md)를 확인하세요.

[출력 전 보정·필라멘트 표시·품질 프리셋](docs/PRINT_PREPARATION_2026-10-21.md) · [2026-10-21 변경·집계·배포 기록](docs/DEPLOYMENT_2026-10-21.md) · [집에서 이어가기](docs/HANDOFF.md)

**웹에서 실제 슬라이싱됩니다.** 크롬북·노트북에서 모델링 → 웹 엔진 계산 → 실제 노즐 경로를 확인하고, 현장 중계기를 연결하면 **바로 출력** 버튼으로 선택한 A1 mini에 전송합니다. 출력 중에는 3D 프린터 튜토리얼과 실제 온도·진행 상태가 표시됩니다. 이 경로에 Bambu Studio는 필요하지 않습니다. **웹 v1·v2 모두 실물 완료 기록이 있으며, v2 표면 품질·받침 결합·실제 ChromeOS·6대 동시 현장 검증은 아직 남아 있습니다.** [구현 범위와 다음 시험](docs/WEB_FIRST.md)을 확인하세요. Windows 설치 앱은 중계기 배포의 선택 사항이며 Store 출시는 하지 않았습니다.

상단에는 한국 날짜와 오늘/누적 체험 인원·완료 출력 수를 표시합니다. 공방 연결 시 여러 기기의 합계를 보관하며, 미연결 상태에서는 이 브라우저 기록을 보관합니다.

약 5분 동안 내 이름·이니셜·그림을 3D로 만드는 학교 부스용 공방입니다. 제작 중인 전용 받침에 맞춰 **14 × 14 mm 둥근 사각 조각**을 만들고, 한 층씩 쌓이는 원리를 살펴본 뒤 출력합니다.

## 여러 크롬북 ↔ 여러 미니, 현장 매칭

**[현장 1:1 매칭 안내](docs/FLEET.md)** · **[크롬북·설정 파일 다운로드](docs/CHROMEBOOK.md)**

출력 PC 한 대에서 `configure-booth.cmd`로 미니 여러 대를 등록합니다. 각 크롬북은 같은 부스 링크를 열고 **현장에서 비어 있는 미니 한 대를 선택해 1:1 매칭**합니다. 이후 **모델링 → 실제 슬라이싱 → 접수 → 해당 미니 출력**으로 이어집니다. 해제·재매칭과 중앙 관리가 가능하며, 서로 다른 미니는 독립적으로 출력합니다. 출력 PC는 웹에서 계산한 경로의 검증·파일 작성과 각 미니 통신을 맡아 켜져 있어야 합니다. `start-booth.cmd`로 창 없이 실행하고 `install-booth-autostart.cmd`로 로그인 시 자동 시작을 선택할 수 있습니다.

처음 연결에는 운영자 링크와 Chrome의 로컬 네트워크 허용이 필요할 수 있습니다. 기기 간 통신을 차단하는 학교 Wi-Fi/관리 정책은 현장에서 확인해야 합니다.

## 두 가지 실행 방식

| 기능 | GitHub Pages / HTML 파일 | 현장 PC 로컬 공방 |
| --- | --- | --- |
| 이름·그림 모델링, 3D 회전 | 가능 | 가능 |
| 층 쌓기 원리 체험 | 가능 | 가능 |
| STL / 작품 설정 묶음 저장 | 가능 | 가능 |
| 실제 브라우저 슬라이싱·노즐 경로 | 가능 · 설치 없음 | 가능 · 설치 없음 |
| Bambu Studio 대체 계산 | 설치된 부스 PC 연결 시 | 선택 설치 시 |
| 바로 출력·내 작품 시작/중지 | 부스 PC 연결 시 가능 | 가능 · 개별 PIN 불필요 |
| 3D 프린터 튜토리얼·온도·진행 상태 | 원리 미리보기 / 연결 시 실제 상태 | 가능 |
| 운영자 문제 해결·전체 관리 | 제한 | PIN으로 관리 |

Pages는 정적 웹사이트이며 슬라이싱은 브라우저의 Kiri:Moto FDM worker가 계산합니다. 프린터로 보내려면 같은 Wi-Fi의 공용 PC 중계기가 실행되어 있어야 합니다. 일반 브라우저가 A1 mini의 FTPS·MQTT에 직접 연결하는 구조는 아닙니다.

## 집에서 이어가기

1. 이 저장소를 `git clone`하거나 **Code → Download ZIP**으로 내려받습니다.
2. 화면만 확인하려면 위 체험 링크 또는 내려받은 `index.html`을 Chrome/Edge로 엽니다.
3. 웹 슬라이싱은 바로 됩니다. 현장 출력 연결에는 공용 PC에 Node.js 20 이상을 준비하고 `start-workshop.cmd`를 실행합니다. npm 설치는 필요 없습니다. Bambu Studio는 대체 계산용 선택 사항입니다.
4. 설정 후 표시되는 `http://127.0.0.1:5188/`에 접속합니다. 프린터가 없어도 모델링·실제 슬라이싱까지 가능합니다.

```powershell
git clone https://github.com/hichoni/3d-modeling.git
cd 3d-modeling
node bridge/setup.cjs
node bridge/server.cjs
```

**[집에서 이어가기 / 인수인계](docs/HANDOFF.md)** · **[부스 운영 안내](docs/BOOTH_GUIDE.md)** · **[개발 구조](docs/DEVELOPMENT.md)** · **[검증 기록](docs/VALIDATION.md)**

## 체험 흐름

1. **내 맘대로 만들기:** 한글·영문·숫자 1~4자, 글꼴 3종, 하트·별·웃는 얼굴·잎, 볼록/오목, 새김 높이를 고릅니다.
2. **층층이 쌓아보기:** 진입하면 브라우저에서 자동 슬라이싱합니다. 기본 화면은 밑판부터 현재 층까지 불투명하게 누적하고 마지막 층에서는 완성 모델을 보여줍니다. ‘바닥 보기 / 속 채움 보기 / 맨 위 보기’로 비교하고, ‘한 층 분리’는 선택한 경우에만 적용합니다. 시간·재료량은 작품 경로 기준이며 준비 동작은 별도입니다.
3. **진짜로 출력하기:** 베드·외부 PLA 등 화면에 적힌 준비를 마치고 **바로 출력**을 누릅니다. 대기표 발급이나 별도의 운영자 승인 없이 선택한 미니로 보냅니다. 3D 모형에서 베드·노즐·필라멘트를 강조하며 실제 온도·출력 상태를 함께 설명합니다. 연결하지 않은 상태에서는 원리 미리보기와 파일 저장을 사용할 수 있습니다.

5분은 **디자인 체험 시간**입니다. 프린터 준비·보정·출력·식히기·결합에는 별도의 시간이 필요합니다. 화면의 색은 미리보기용이고 실제 색은 필라멘트로 결정됩니다.

## 고정 규격

- 가로·세로 14 mm / 모서리 반지름 2.8 mm / 바닥 두께 1.5 mm
- 새김 높이 0.6, 0.8, 1.0 mm / 전체 높이 2.1~2.5 mm
- 손잡이 없음, 키캡 용도라 글씨 좌우 반전 없음
- 외곽은 화면·설정 불러오기·STL 검증에서 고정
- STL 단위 mm. 받침과 스위치는 별도 준비물입니다.

## 실제로 확인한 것

2026-10-19 학교의 A1 mini에서 **로컬 웹 버튼 → FTPS 전송 → MQTT 출력 시작 → 12층 / 100% FINISH**를 확인했습니다. 출력 중 외부 스풀 압출 확인은 사용자가 본체에서 처리했습니다. 새 UI에서 만든 모델도 Bambu Studio CLI로 슬라이싱했고 실제 경로와 대기표를 확인했습니다. 자세한 구분은 [검증 기록](docs/VALIDATION.md)에 있습니다.

프린터에서 완료 신호를 받은 사실과 **완성품의 글자 품질·받침 압입 공차가 적합하다는 판정은 다릅니다.** 실물 결합 상태는 현장에서 확인해야 합니다.

## 개발 및 배포

```powershell
node scripts/build.cjs
node --test tests/*.test.cjs
node scripts/serve.cjs
```

정적 미리보기는 `http://127.0.0.1:5186/`입니다. `src/` 수정 후 반드시 빌드하고 **루트 `index.html`도 커밋**하세요. GitHub Pages는 `main` 브랜치 루트에서 배포합니다.

`runtime/`, `artifacts/`, 프린터 IP·일련번호·접근 코드·운영자 PIN·출력 파일은 공개 저장소에서 제외합니다. 접근 코드는 출력 PC의 **부스 연결 → A1 mini 직접 연결**에서 입력하고 저장·연결 테스트합니다. 코드는 서버의 비공개 `runtime/config.json`에만 저장하며, 브라우저 저장소나 API 응답에는 넣지 않습니다. Bambu Studio의 로컬 설정을 읽는 기존 연결도 지원합니다. 참가자 디자인은 해당 브라우저의 로컬 저장소에 저장되며 ‘새로 시작하기’로 초기화됩니다.

원본 `stamp-maker-2.html`의 윤곽 추출·STL/ZIP 로직을 바탕으로 만들었습니다. [제3자 코드·글꼴](docs/THIRD_PARTY.md), [승인된 UI 시안](design/UI_CONCEPT.md)을 참고하세요.

운영자 설정 ZIP은 코드 서명 전 개발용입니다. Windows가 실행을 차단하면 [Smart App Control·학교 정책 안내](docs/SMART_APP_CONTROL.md)를 확인하세요. 서명된 설치 앱은 아직 제공하지 않습니다.
