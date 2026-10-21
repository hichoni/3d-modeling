# 개인 Store 등록·제출용 패키지 준비 · 2026-10-21

## 현재 상태

계정 소유자가 Microsoft 로그인, 휴대폰 신분증·셀피 확인, 연락처·주소 프로필 입력과 개발자 계약 동의를 직접 완료했다. Microsoft 화면에서 ‘계정 설정이 완료되었습니다’, ‘개발자 계정이 준비되었습니다’를 확인했다. 같은 계정으로 Partner Center에 로그인했다. 계정 등록이나 본인 확인을 다시 요구하지 않는다.

앱 이름 **상상을 클릭하다! 운영자 공방**을 예약하고 **Submission 1 초안**을 만들었다. **Store 심사 제출·인증·서명·공개·학교 PC 설치는 아직 완료하지 않았다.** 업로드 화면의 Error를 성공으로 기록하지 않는다.

## 실제 패키지 식별값

Partner Center의 Product identity에서 읽었다. 아래 값은 패키지에 포함되는 공개 식별 정보다. Microsoft 계정 이메일·전화번호·주소·신분증·인증 토큰은 저장소에 기록하지 않는다.

| 항목 | 확인한 값 |
| --- | --- |
| Package/Identity/Name | `A308E608.60496DA248AF4` |
| Package/Identity/Publisher | `CN=38F92221-47DE-4ED3-BA81-5B7A692E3551` |
| Package/Properties/PublisherDisplayName | `초니쌤` |
| Store ID | `9N2V9KQDSJ0G` |
| 제출 초안 ID | `1152921505702187840` |

반복 빌드용 값은 [desktop/store-identity.json](../desktop/store-identity.json)에 보관한다. 현재 버전은 `3.0.0.0`이다. 이 파일에 계정 비밀번호나 인증서 비밀 키를 추가하지 않는다.

- [Partner Center 앱 개요](https://partner.microsoft.com/ko-KR/dashboard/products/9N2V9KQDSJ0G/overview)
- [제출 초안의 패키지 화면](https://partner.microsoft.com/ko-KR/dashboard/products/9N2V9KQDSJ0G/submissions/1152921505702187840/packages)
- Store 제품 URL은 할당되었으나 출시 전이다. 공개 설치 링크처럼 안내하지 않는다.

## 생성한 MSIX

실제 Store 식별값을 넣어 `desktop/build.ps1 -Mode Store`로 만들었다. 공식 .NET SDK `10.0.402`, Node `v24.22.0`, Microsoft MakeAppx `10.0.28000.2705`를 사용했다. SDK와 Node 도구의 서명을 확인했고 MakeAppx 패키지 생성·검증이 성공했다.

- 로컬 파일: `artifacts/store-submission-20261021-initial/ClickBooth-3.0.0.0-x64-STORE-SUBMISSION-UNSIGNED.msix`
- 크기: **91,197,601 bytes**
- SHA-256: `6c6ba3fc6c389069fdf8b9da2c20374d6ee93d429a931187a4d3389c586c08a7`
- ZIP 구조 48개 항목, 공개 payload 41개 파일의 SHA-256 일치 확인.
- AppxManifest의 Name·Publisher·PublisherDisplayName·Version을 실제 등록 값과 비교했다.
- CMD·PowerShell 실행 파일, 비공개 runtime·config·인증서 비밀 키 경로가 패키지에 없음을 검사했다.
- **미서명 심사 제출용**이다. 설치하거나 차단된 앱을 다시 실행하지 않았다. 이 패키지로 학교 PC 설치 성공이나 WACK 전체 통과를 주장하지 않는다.

패키지 본체와 인증 화면 이미지는 Git에서 제외되는 artifacts에 있다. 원본 패키지·이미지를 public Pages나 Git에 올리지 않았다. 기능 코드는 직전 Windows CI에서 검사된 상태이며, 이번 작업은 계정 식별값과 패키지 메타데이터를 맞춘 것이다.

## 업로드 상태와 다음 작업

### 후속 Chrome 확인

사용자가 일반 Chrome에서 같은 개인 Microsoft 계정으로 로그인했다. 패스키 대신 암호 로그인으로 진행했고, 사용자가 ChatGPT 확장 프로그램의 파일 URL 접근 권한도 직접 켰다. 권한 변경 후 새 Chrome 연결로 기존 제출 초안에 다시 연결했다. **이후 파일 선택 API는 정상 성공했으며 권한 오류는 해소됐다.**

동일한 MSIX가 `86.97 MB`로 표시됐지만 포털이 즉시 `Error`를 표시했고 Save는 비활성 상태였다. 영문 포털에서 같은 초안을 조회하니 `Paused / null Bytes / taking a long time to process` 상태였다. 실제 업로드·패키지 검증·저장 완료는 여전히 확인되지 않았다. 권한 설정이나 계정 등록을 다시 요구하지 않는다.

콘솔에는 require/requirejs/fdRequire 관련 오류도 있으나 이것이 전송 실패 원인인지 확인되지 않았다. HTTP 오류 상태, 업로드 서비스 장애, 학교 네트워크 차단, 패키지 내용 오류 중 어느 하나로 단정하지 않는다. 같은 파일 재전송을 원인 확인 없이 반복하지 않는다. [지원 문의 초안](STORE_UPLOAD_SUPPORT_DRAFT.md)을 준비했으며 **계정 소유자의 발송 지시를 받기 전에는 보내지 않는다.**

SHA-256을 다시 계산해 원래 파일과 동일함을 확인했다. 최신 등록 기록 커밋 `e056eee`의 [Windows 전체 검사·앱 빌드·격리 실행 검사](https://github.com/hichoni/3d-modeling/actions/runs/39544174396)는 성공했다. 이 CI 성공이 Partner Center 업로드나 학교 PC 설치 성공을 뜻하지는 않는다.

실패한 임시 항목 정리 후 사용자가 일반 Chrome에서 같은 MSIX를 직접 선택했지만 다시 오류를 보고했다. 포털에서도 해당 수동 선택 항목의 정확한 파일명·`86.97 MB`·`Error`를 확인했다. 수동 업로드는 더 이상 미확인 항목이 아니다. 자동 선택만의 문제라고 설명하거나 같은 파일 선택을 다시 요구하지 않는다. 계정 설정 화면만으로 추가 활성화 대기 여부는 확인하지 못했으므로 ‘계정이 미활성화됐다’고 설명하지 않는다.

### 15:01 KST: Store 권장 제출 묶음도 같은 오류

[Microsoft의 업로드 안내](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/upload-app-packages)는 원본 MSIX도 허용하며 Windows 10 이상 앱에 `.msixupload`를 권장한다. [공식 수동 생성 방법](https://learn.microsoft.com/en-us/windows/msix/package/packaging-uwp-apps#generate-your-app-package-upload-file-manually)에 따라 검증된 원본 MSIX 한 개를 ZIP 루트에 넣고 `.msixupload`로 만들었다. 선택 사항인 심볼 파일은 포함하지 않았다. 단순히 MSIX 확장자를 바꾼 파일이 아니다.

- 로컬 파일: `artifacts/store-submission-20261021-initial/ClickBooth-3.0.0.0-x64.msixupload`
- 크기: **90,755,674 bytes**, 포털 표시 `86.55 MB`
- SHA-256: `6690c1af53043cc1b02140a5b18f874e7feb664257e27f047f5d47e7b788c93d`
- 내부 항목 1개이며 원본 MSIX의 SHA-256 `6c6ba3fc6c389069fdf8b9da2c20374d6ee93d429a931187a4d3389c586c08a7`이 일치한다.
- 일반 Chrome 파일 선택은 성공했으나 포털은 이 형식도 즉시 **Error**로 표시했다. 상세 오류·서버의 패키지 검증 결과는 없다. Save도 완료하지 못했다.
- 오류 스크린샷: `artifacts/registration/chrome-msixupload-error-2026-10-21.jpg`. 비공개 로컬 증거이며 Git에 넣지 않는다.

파일 형식 변경으로 해결되지 않았다. 현 단계에서 원인을 서명·SAC·학교망·Microsoft 장애 중 하나로 확정할 수 없다. 지원 문의 초안에는 수동 선택 실패와 두 제출 형식의 재현 결과를 반영했다. 문의 발송은 아직 하지 않았으며 계정 소유자의 명시적 요청이 필요하다.

### 최초 업로드 기록 및 남은 절차

Partner Center에서 해당 패키지를 선택했으나, 파일 선택·업로드 응답이 장시간 지연된 뒤 화면에 **Error**가 표시됐다. 패키지 저장·검증 성공을 확인하지 못했다. 이유를 SAC나 파일 내용으로 단정할 증거는 없다. 자동 업로드를 같은 방식으로 반복하지 않는다.

1. 일반 Chrome 수동 업로드와 `.msixupload`도 실패했다. 같은 업로드를 반복하지 않고 위 기록과 [문의 초안](STORE_UPLOAD_SUPPORT_DRAFT.md)을 바탕으로 계정 소유자의 발송 지시 후 Microsoft 지원에 원인 확인을 요청한다.
2. 업로드 완료 및 서버의 패키지 식별·검증 결과를 확인한 뒤 Windows Desktop 대상과 Save를 확인한다. 아직 성공 저장되지 않았다면 완료로 기록하지 않는다.
3. 속성, 무료 배포·시장, 연령별 등급, 한국어 Store 설명·실제 앱 스크린샷, 개인정보처리방침·지원 페이지, runFullTrust 심사 설명을 실제 기능에 맞춰 준비한다. [제출 자료 초안](STORE_SUBMISSION.md)을 사용한다.
4. 학교 PC 설치·업데이트·제거·설정 보존과 SAC, 학교 Wi-Fi·6대 운영, 새 일반 STL 출력의 현장 검증은 남아 있다. 앞서 완료된 14mm 실물 시험과 구분한다.
5. 최종 인증 제출이나 새로운 약관·법적 확인은 계정 소유자가 검토하고 수행한다. 현재 초안을 심사에 보냈다고 안내하지 않는다.

계정 등록은 끝났지만 연결 프로그램 차단이 해결된 것은 아니다. 정식 Store 배포 후 대상 학교 PC에서 설치·실행을 확인해야 한다.
