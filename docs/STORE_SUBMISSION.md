# Microsoft Store 제출 자료 초안

이 문서는 계정 소유자가 검토할 제출 초안입니다. 앱 등록과 제출 초안 생성은 완료했으며, 최종 심사에는 제출하지 않았습니다. 아래 문구가 심사 통과를 보장하지 않습니다.

**2026-10-21 갱신:** 계정 등록·앱 이름 예약·실제 식별값 확인과 제출 초안 생성은 완료했습니다. 실제 값은 [store-identity.json](../desktop/store-identity.json), 패키지 경로·검증·업로드 Error 상태는 [현재 진행 기록](STORE_PROGRESS_2026-10-21.md)을 따릅니다. 최종 심사 제출·서명·공개는 하지 않았습니다.

## 앱 정보

- 예약한 표시 이름: 상상을 클릭하다! 운영자 공방
- 용도: 교육 부스의 3D 키캡 클리커 만들기 운영 도구
- 배포 목표: 개인 명의 무료 Windows 앱, x64, 한국어
- 최소 OS 패키지 설정: Windows 10 2004 (빌드 19041) 이상. 실제 지원·보안 업데이트가 제공되는 Windows 11에서 우선 검증합니다.
- 현재 빌드: 3.0.0.0
- 별도 요구사항: 같은 네트워크의 A1 mini(0.4mm 노즐), LAN Only + Developer Mode. Bambu Studio는 대체 계산용 선택 사항입니다. 실제 출력은 운영자가 빈 베드와 재료를 확인한 뒤 수동 시작합니다. 새 웹 엔진 파일의 실물 검증은 아직 남아 있습니다.

## 설명 초안

여러 대의 A1 mini와 여러 크롬북을 사용하는 학교 체험 부스를 준비하세요. 미니의 이름과 연결 정보를 등록하고 공방을 시작하면 참가자는 웹에서 자신의 크롬북과 현장의 미니를 1:1로 매칭할 수 있습니다. 약 5분 동안 이름과 간단한 그림으로 14mm 조각을 디자인하고, 층이 쌓이는 원리와 실제 슬라이싱 결과를 살펴봅니다. 운영자가 프린터와 재료를 확인한 작품만 해당 미니에서 출력합니다. 출력 시간은 디자인 시간과 별개입니다.

이 앱은 Bambu Lab의 공식 앱이 아닙니다. 기본 슬라이싱은 참가자 브라우저에서 수행하고, 운영자 앱은 검증·파일 작성·프린터 통신을 중계합니다. 학교 네트워크나 PC 정책이 기기 간 통신을 막으면 담당자 확인이 필요합니다.

별도 STL 스튜디오에서는 STL 가져오기·배치·크기 조정, 서포트·브림 설정, 실제 층별 미리보기와 출력 검토를 제공합니다. A1 mini·0.4mm 노즐·외부 PLA·텍스처 PEI 조건으로 제한합니다. 모델링 체험 시간과 실제 출력 시간은 다릅니다.

## runFullTrust 권한 사유 초안 · 심사 담당자용

The app is a desktop relay for a supervised educational 3D-printing workshop. It runs a bundled official Node.js runtime without CMD or PowerShell launchers and hosts an HTTP server on port 5188. Participants design fixed 14mm inserts or import supported STL models in the web studio, then slice in the browser. The relay validates model bounds, profiles and paths and prepares an A1 mini print package. A separately installed Bambu Studio executable is used only for an optional alternative slicing action. With booth mode explicitly enabled, Chromebooks on the same local network access the relay through an authenticated booth link. The relay communicates with individually configured A1 mini printers using TLS MQTT and FTPS. An operator PIN and explicit bed/material review are required before a print starts. No automatic print start, kernel drivers or automatic firewall/policy changes are included. Full-trust desktop process and local file/network access are required for these functions. General STL/support physical printing, target-school policy, signed installation and update validation remain pending; review these limitations before certification submission.

## 심사 재현 절차

1. 앱을 실행합니다. 외부 하드웨어가 없으면 빈 미니 슬롯을 유지할 수 있습니다.
2. 운영자 PIN은 설정 화면에서 지정합니다. Bambu Studio 경로는 선택 사항이며 기본 웹 슬라이싱에는 설치가 필요하지 않습니다.
3. 로컬 체험은 ‘크롬북 접속 허용’을 끈 채 시작합니다. 브라우저에서 운영자 화면을 엽니다.
4. 프린터가 없어도 브라우저 모델링·STL 가져오기·웹 엔진의 실제 슬라이싱과 층 미리보기를 확인할 수 있습니다. 물리 출력에는 별도 A1 mini와 현장 확인이 필요합니다.
5. 크롬북 체험은 해당 옵션을 켜고 PC 주소를 선택해 부스 링크를 복사합니다. 같은 네트워크의 기기에서 웹을 열고 미니 매칭을 선택합니다.
6. 종료는 트레이 메뉴에서 선택합니다. 실제 프린터는 심사 자동화 대상에 포함하지 않습니다.

## 제출 전 채울 항목

- 실제 Package/Identity/Name, Publisher, PublisherDisplayName: 확인·제출용 패키지 반영 완료
- 공개 지원 이메일 또는 지원 페이지
- 계정 소유자가 확인한 개인정보처리방침 URL: [초안](PRIVACY.md)
- 실제 앱 스크린샷(합성 안내가 아닌 실행 화면). 시험 화면에는 실제 프린터 비밀 정보가 없어야 합니다.
- Partner Center의 이용 등급·대상 시장·무료 가격·권한 질문 응답
- 실제 서명 설치 후 시작·업데이트·제거·데이터 보존·SAC·학교 네트워크 검증 결과
