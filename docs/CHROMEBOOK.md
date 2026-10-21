# 크롬북에서 링크로 체험하기

**현재 방식은 여러 크롬북과 여러 A1 mini를 현장에서 1:1로 매칭하는 구성입니다.** 자세한 단계는 [현장 매칭 안내](FLEET.md)를 보세요.

## 처음 준비

**[다운로드 → 압축 해제 → 실행 → 프린터 연결 웹 안내](https://hichoni.github.io/3d-modeling/setup.html#mode=shared)**에서 순서대로 진행할 수 있습니다. 연결 프로그램은 Windows 출력 PC에서 준비하며 크롬북에는 설치하지 않습니다.

운영자 묶음은 **코드 서명 전 개발용**입니다. Windows가 실행을 차단하면 [Smart App Control·학교 정책 안내](SMART_APP_CONTROL.md)를 먼저 확인하세요. 이 배포본의 SAC 호환성은 검증되지 않았습니다.

[부스 사이트](https://hichoni.github.io/3d-modeling/)에서 **부스 연결 → 운영자 처음 설정 → 운영자 설정 파일 받기 (ZIP)**을 누릅니다. 내려받은 ZIP을 압축 해제한 뒤 `click-workshop/configure-booth.cmd`를 실행합니다. 설정 CMD와 필요한 공방 모듈을 함께 제공합니다.

- [운영자 설정 묶음 ZIP](https://hichoni.github.io/3d-modeling/downloads/booth-setup.zip)
- [configure-booth.cmd 단독](https://hichoni.github.io/3d-modeling/configure-booth.cmd): 기존 공방 폴더용입니다. 단독 파일만 실행하면 필요한 ZIP을 안내합니다.

Windows 출력 PC 한 대에 공식 Node.js LTS를 준비합니다. 새 설정 파일은 먼저 미니 대수와 출력 PC 주소만 확인합니다. 이후 웹에서 미니를 찾아 IP·일련번호를 자동 입력하고 본체의 8자리 코드로 연결합니다. PC의 운영자 화면에서 부스 링크를 공유하세요.

## 참가자 크롬북

1. 부스 Wi-Fi에서 공유 링크를 엽니다. 프로그램 설치나 CMD 실행은 하지 않습니다.
2. 출력 화면의 프린터 선택에서 현장 번호와 같은 미니를 고릅니다. 한 대면 자동으로 연결합니다.
3. 모델링 → 실제 슬라이싱 → 바로 출력을 진행합니다. 화면에 대상 미니가 표시됩니다.
4. 빈 베드·0.4mm 노즐·외부 PLA·텍스처 PEI를 준비한 뒤 **바로 출력**을 누릅니다. 대기표나 운영자 PIN 없이 시작하고, 3D 튜토리얼과 실제 온도·진행 상태를 확인합니다.

매칭은 기억됩니다. 다른 미니로 바꾸려면 해제·재매칭하며, 이미 다른 크롬북이 사용하거나 출력 중인 미니로 무작정 변경할 수 없습니다. 중앙 PC는 전체 매칭을 관리합니다. 서로 다른 미니는 독립적으로 출력합니다.

## CMD 창 없이 실행

`start-booth.cmd`는 공방 PC의 서버를 백그라운드에서 실행하고 운영자 화면을 엽니다. `install-booth-autostart.cmd`를 PC에서 한 번 실행하면 현재 Windows 사용자 로그인 시 공방을 자동 시작하는 바로가기를 등록합니다. 자동 시작을 취소하려면 시작프로그램 폴더의 **Click Imagination Booth** 바로가기를 제거합니다.

PC 전원·로그인·Wi-Fi는 필요합니다. Bambu Studio는 대체 계산용 선택 사항입니다. 행사 중 PC가 절전 상태에 들어가면 연결이 끊깁니다. 앱이 이번 배포 과정에서 시작프로그램이나 방화벽을 임의로 바꾸지는 않았습니다. Smart App Control이나 학교 정책이 실행을 막으면 실행을 멈추고 담당자와 승인된 배포 방식을 확인하세요. 다른 명령으로 차단을 우회하도록 안내하지 않습니다.

로그는 `runtime/server.log`, 오류는 `runtime/server-error.log`, 실행 PID는 `runtime/server.pid`입니다. 구버전 서버가 실행 중이면 종료한 뒤 새로 실행하세요. 서버 종료가 이미 시작된 프린터의 출력을 중지하지는 않습니다.

## 네트워크 조건

GitHub Pages는 웹 화면을 배포하고 실제 슬라이싱은 브라우저가 계산합니다. 출력 PC는 파일 검증·3MF 작성과 각 미니 통신을 맡습니다. 웹 접속만으로 크롬북에서 Windows CMD를 실행하는 구조가 아닙니다.

[Chrome 공식 Local Network Access 안내](https://developer.chrome.com/blog/local-network-access)에 따라 공개 HTTPS 페이지가 부스 PC의 사설 주소에 접속할 때 허용이 필요할 수 있습니다. 학교에서 관리하는 Chrome의 정책, 게스트/AP 격리, PC 방화벽이 기기 사이 통신을 막으면 연결할 수 없습니다. 앱은 이 정책을 우회하거나 방화벽을 자동으로 바꾸지 않습니다.

Pages에서 연결이 어렵다면 운영자가 제공하는 직접 접속 링크도 사용할 수 있습니다. Wi-Fi에서 기기 사이 통신 자체가 차단됐다면 직접 링크도 동작하지 않습니다. 실제 ChromeOS와 학교 네트워크 조합의 최종 확인은 현장에서 해야 합니다.

## 보관과 권한

매칭은 브라우저의 무작위 기기 키와 PC의 `runtime/pairings.json`에 저장합니다. 참가자 브라우저에는 프린터 접근 코드를 보내지 않습니다. 운영자 PIN으로 발급되는 토큰도 해당 기기의 현재 미니와 매칭 버전으로 제한합니다. 중앙 PC의 전체 관리 권한은 loopback 운영자 화면에서만 열립니다.

설정 ZIP은 `node scripts/build.cjs` 실행 시 공개 파일 허용 목록으로 생성합니다. 학교 프린터 IP·일련번호·접근 코드, 운영자 PIN, 참가자 작업과 매칭은 ZIP에 넣지 않습니다.
