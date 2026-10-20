# Windows 운영자 앱 · 개인 명의 Store 배포

사용자가 선택한 경로는 **개인 명의 Microsoft Store → MSIX 심사·서명 → 학교 PC 설치**입니다. 학교·기관 명의 등록은 진행하지 않습니다. 지금 생성한 패키지는 서명 전 시험본이며, 정식 Store 앱이나 학교 설치 성공본으로 안내하지 않습니다.

## 사용자가 준비할 것

1. [Microsoft Store 개발자 등록](https://storedeveloper.microsoft.com/)에서 **Individual developer**를 선택합니다. 학교 업무용 Entra 계정이 아닌 개인 Microsoft 계정을 사용합니다.
2. 본인의 실제 정보로 신원 확인을 완료합니다. 공식 안내는 정부 발행 신분증 원본과 휴대전화로 촬영하는 셀피를 요구합니다. 화면에서 지원하는 신분증 종류를 확인하세요. 신분증·계정 비밀번호·인증 코드는 채팅이나 GitHub에 보내지 않습니다.
3. [Partner Center](https://partner.microsoft.com/dashboard/apps-and-games)에서 Windows 앱을 만들고 이름을 예약합니다. 권장 표시 이름은 **상상을 클릭하다! 운영자 공방**이며, 사용 가능 여부는 실제 예약 화면에서 확인해야 합니다.
4. 앱의 **Product identity**에서 `Package/Identity/Name`, `Package/Identity/Publisher`, `Package/Properties/PublisherDisplayName` 세 값을 확인합니다. 이 세 값은 패키지를 맞추는 공개 식별 정보이며, 로그인 비밀번호나 서명 비밀 키가 아닙니다. 실제 이름을 추측해 넣지 않습니다.
5. 공개 지원 이메일 또는 지원 페이지를 정합니다. Microsoft가 요구하는 본인 동의·개발자 계약·이용 등급·심사 제출은 계정 소유자가 공식 화면에서 완료합니다.

2026-10-20 확인한 [Microsoft 계정 등록 안내](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account)는 새 등록 경로의 개인 개발자 등록을 무료로 설명합니다. 등록 화면이 다르거나 추가 확인을 요구하면 해당 공식 절차를 따르세요. 개인 비상업 학교 프로젝트 용도에 맞춰 선택하며, 심사 완료 시점은 보장하지 않습니다.

## 만든 앱의 기능

- Windows 설정 화면에서 미니 1~32대의 이름·IP·일련번호·접근 코드·미니별 PIN을 입력합니다. 비밀 값은 화면에서 가립니다.
- Bambu Studio 실행 파일과 공방 PC의 Wi-Fi 주소를 고르고 저장·시작합니다.
- 기존 개발용 폴더의 `runtime/config.json`을 선택해서 설정만 가져올 수 있습니다. 기존 출력·접수·매칭 데이터는 자동 이동하지 않습니다. 이전 공방 작업을 먼저 정리하세요.
- 운영자 웹 열기, 크롬북 링크 복사, 공방 중지를 버튼으로 제공합니다. 각 크롬북은 기존 웹에서 현장 1:1 매칭합니다.
- Node.js와 .NET 런타임을 포함합니다. 참가자에게 Node.js·CMD·PowerShell 설치나 실행을 요구하지 않습니다. **Bambu Studio는 별도로 설치되어 있어야 합니다.**
- 앱의 실행 경로는 `ClickBooth.exe → 포함된 node.exe → 공방 서버 → Bambu Studio`입니다. CMD/PowerShell 실행 도구는 설치 패키지에 넣지 않습니다.
- 앱을 닫을 때 서버가 실행 중이면 트레이로 이동해 공방을 유지합니다. 트레이에서 종료를 선택해도 슬라이싱·파일 전송·출력·확인 필요 상태에서는 종료를 거절합니다. 강제 종료하거나 물리 출력을 자동 시작하지 않습니다.

설정과 작업은 현재 사용자의 `%LOCALAPPDATA%/Hichoni/ClickBooth`에 저장합니다. 패키지로 설치한 앱은 Windows의 앱 데이터 가상화가 적용될 수 있습니다. 비공개 접근 코드·PIN과 참가자 파일이 있으므로 폴더 전체를 공개하지 않습니다. 삭제·업데이트 전에 필요한 작업을 비공개로 백업하세요. MSIX 설치·제거 시 데이터 보존 동작은 실제 설치본에서 확인해야 합니다.

## 설치 패키지 상태 구분

| 산출물 | 의미 | 학교 PC에 바로 설치 가능 여부 |
| --- | --- | --- |
| `UNSIGNED-PREVIEW.msix` | 개발·구조 검사용, 임시 배포자 | 불가. 정식 서명 전 |
| `STORE-SUBMISSION-UNSIGNED.msix` | 실제 Partner Center 식별값으로 만든 심사 제출용 | 심사 전 직접 설치용 아님 |
| Microsoft Store에서 받은 앱 | Microsoft 심사 후 서명·배포 | 대상 PC 정책과 기능 실기 확인 필요 |

[Microsoft의 MSIX 서명 안내](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)에 따르면 Store는 심사 후 MSIX 패키지를 다시 서명합니다. MSI/EXE 업로드와는 절차가 다릅니다. 따라서 선택한 Store 경로에는 별도 유료 코드 서명 인증서를 먼저 구매할 필요가 없습니다.

서명은 학교의 추가 정책·네트워크 허용을 대신하지 않습니다. 학교 PC에서 Store 앱 설치가 가능하다는 사용자 확인을 받았지만, 이 앱 자체의 허용과 학교 Wi-Fi 통신은 최종 설치 후 확인해야 합니다. 현재 PC에서 서명 전 EXE가 앱 제어 정책에 차단된 것은 정식 설치 검증 성공이 아닙니다. 차단된 파일을 우회 실행하지 않습니다.

## 다시 빌드하기

GitHub의 **Actions → Windows operator app**이 앱과 MSIX를 빌드합니다. 일반 push는 `Preview`이며, **Run workflow → Store**에는 앞의 실제 식별값 세 개를 입력합니다. 비밀 키나 신분증을 입력하는 곳이 아닙니다. 작업 종료 후 Artifacts에서 패키지를 내려받습니다.

Store용 패키지를 Partner Center의 패키지 제출 화면에 업로드합니다. 기본 앱 설명, 스크린샷, 이용 등급, 개인정보처리방침 URL과 지원 연락처를 함께 검토합니다. 앱이 로컬 서버를 실행하고 외부 프린터·Bambu Studio를 사용하는 `runFullTrust` 권한이 필요한 이유는 [심사 안내 초안](STORE_SUBMISSION.md)에 적었습니다. 심사 중 권한·동작 검토나 수정 요청이 있을 수 있습니다.

개발 PC에서 직접 빌드하려면 .NET 10 SDK와 PowerShell을 사용합니다. 아래 스크립트는 **개발자용 빌드 절차**이며, 학교 PC의 차단을 우회하는 실행 방법이 아닙니다.

```powershell
$tools = ./desktop/bootstrap-tools.ps1
./desktop/build.ps1 -NodePath $tools.node -MakeAppxPath $tools.makeappx
```

`desktop/toolchain.json`은 Node·SDK 도구 버전을 고정합니다. Node 다운로드의 SHA256, Microsoft/OpenJS 도구의 Authenticode 서명을 확인합니다. 앱은 컴파일에 포함된 SHA256 목록으로 자신의 웹·서버·Node 파일을 실행 전에 확인합니다. 개인 설정은 공개 파일 허용 목록에 포함되지 않습니다.

Store 이외 직접 배포용 `desktop/sign.ps1`, `package.ps1 -Mode Signed`, `verify-release.ps1`도 준비했습니다. 신뢰되는 코드 서명 인증서와 접근 권한이 있어야 실제 서명할 수 있고, 검증 실패 시 배포를 중단합니다. 현재 선택한 개인 Store 경로에는 이 절차를 사용할 필요가 없습니다.
