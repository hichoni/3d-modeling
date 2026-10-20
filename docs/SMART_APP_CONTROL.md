# Windows에서 운영자 파일 실행이 차단될 때

현재 운영자 ZIP은 **정식 코드 서명 전 개발용 배포본**입니다. Smart App Control 또는 학교의 앱 실행 정책이 켜진 모든 PC에서 실행된다고 보장하지 않습니다. ZIP을 다시 받거나 CMD를 EXE로 포장하는 것만으로 해결되지 않습니다.

## 확인한 사실 · 2026-10-20

- 확인한 PC의 `SmartAppControlState`는 `On`입니다.
- Windows Code Integrity 이벤트 3033에서 탐색기가 `Windows/System32/cmd.exe`를 실행하는 과정에 서명 수준 제한이 적용된 기록을 확인했습니다.
- 설치된 `cmd.exe`와 Node.js 실행 파일의 Authenticode 서명은 유효했습니다. 이 사실만으로 공방 CMD나 그 하위 스크립트가 허용된다는 뜻은 아닙니다.
- 확인한 기록만으로 사용자가 본 알림의 정확한 대상 파일, SAC와 별도 학교 정책 중 최종 차단 주체를 확정하지 못했습니다.
- 보안 설정·정책·방화벽·인증서 저장소는 변경하지 않았으며, 차단된 다운로드 파일을 다른 경로로 재실행하지 않았습니다.

## 차단됐다면

1. 차단 창의 파일명과 발생 시각을 기록합니다. 접근 코드와 운영자 PIN은 전달하지 않습니다.
2. 학교 관리 PC라면 담당자에게 이 문서와 [공개 소스](https://github.com/hichoni/3d-modeling)를 전달해 배포 검토를 요청합니다. 관리형 App Control 정책은 담당자가 승인된 절차로 판단해야 합니다.
3. Smart App Control 자체에는 개별 앱만 예외로 허용하는 기능이 없습니다. 일반 배포에는 신뢰할 수 있는 인증서로 서명한 앱이 필요합니다. 현재 ZIP은 이 조건을 충족한 설치 앱이 아닙니다.

보호 기능 끄기, 실행 정책 우회, 다운로드 보안 표시 제거, 확장자 변경을 해결 방법으로 안내하지 않습니다. 자체 서명 인증서를 PC에 신뢰시키는 작업도 제공하지 않습니다.

## 운영 가능한 범위

참가자 크롬북에는 이 ZIP이나 CMD를 설치하지 않습니다. 승인된 공방 PC 한 대가 켜져 있으면 여러 크롬북에서 부스 링크를 열고 각각 다른 A1 mini와 현장 매칭할 수 있습니다. 공방 PC가 차단되어 서버를 실행하지 못하면 실제 슬라이싱·접수·웹 출력 시작은 사용할 수 없습니다.

그동안 공개 웹의 모델링과 STL 저장은 사용할 수 있습니다. STL을 학교에서 이미 사용이 승인된 Bambu Studio로 열어 A1 mini에 출력하는 수동 방식도 가능합니다. 이 경우 웹에서 실시간 상태나 출력 시작을 제공하는 통합 흐름은 아닙니다.

## 정식 배포를 위해 남은 작업

CMD/PowerShell에 의존하지 않는 네이티브 설정 앱과 MSIX 패키징을 추가했습니다. 사용자가 **Store 설치 가능·개인 명의 배포**를 선택했으므로 [Windows 앱 안내](WINDOWS_APP.md)의 계정 확인 → 실제 식별값 반영 → MSIX 제출 → Microsoft 심사·서명 순서로 진행합니다. 이 경로는 별도의 유료 코드 서명 인증서를 먼저 구매할 필요가 없습니다. 현재 패키지는 심사·서명 전입니다.

Store 이외 직접 배포에는 신뢰되는 코드 서명 인증서 또는 적합한 서명 서비스 권한이 필요합니다. 현재는 배포자 계정의 본인 확인·실제 앱 식별값이 준비되지 않아 정식 서명된 설치 파일을 제공하지 않습니다. 서명 후에도 SAC가 켜진 별도 PC와 학교의 관리 정책에서 실제 설치·시작을 확인해야 합니다. 새로 컴파일한 서명 전 앱도 현재 PC의 앱 제어 정책에 차단되어 해당 파일의 로컬 실행 시험을 중단했습니다.

## Microsoft 근거

- [Smart App Control FAQ](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions): 평판으로 판단할 수 없는 앱의 서명 확인, 개별 앱 예외 불가, 개발자의 유효한 서명 권고.
- [Smart App Control 코드 서명 안내](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control): 신뢰되는 인증서와 코드 서명 조건.
