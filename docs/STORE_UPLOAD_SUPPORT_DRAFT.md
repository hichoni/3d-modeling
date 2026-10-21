# Microsoft Store 패키지 업로드 문의 초안

**접수 작성 중이며 아직 접수 번호는 없다.** 사용자가 ‘마이크로소프트에 문의 보내줘. 알아서 진행해’라고 명시적으로 발송을 요청했다. 이 문의의 발송 허락을 다시 요구하지 않는다. 아래에는 공개 앱 식별값과 기술 정보만 기록한다. 로그인 정보·신분증·주소·전화번호·인증 토큰·프린터 접근 코드는 넣지 않는다.

## 현재 작성 상태

Partner Center 도움말 → 등록 → Windows용 개발자로 등록(앱 및 게임) → 지원 요청 만들기의 실제 3단계 문의 폼을 열었다. 앱 제출 분류가 제공되지 않아 본문 첫머리에 **등록은 완료됐고 패키지 업로드 문제이므로 Store 개발자 지원으로 이관해 달라**고 명시했다. 아래 본문과 오류 이미지 `chrome-msixupload-error-2026-10-21.jpg`의 첨부 완료를 확인했다.

2/3 연락처 단계에서 등록 계정의 이름·이메일, 국가 한국, 기본 언어 한국어를 설정했다. **전화번호 입력이 필수이며 자동으로 채워지지 않았다.** 임의 번호를 만들거나 다른 용도의 연락처를 쓰지 않고 사용자가 해당 칸을 직접 입력하도록 요청했다. 새 제출 약관이 나타나지 않는다면 전화번호 입력 뒤 검토·발송을 이어간다. 현재 티켓 접수 완료·이메일 발송·지원 답변 수신은 확인되지 않았다.

공식 MSA Engage Center는 로그인 후 빈 작업 공간으로 남았고, 연결된 Services Hub 링크도 같은 포털로 이동했다. 이 포털에서 문의가 접수됐다고 설명하지 않는다. 실제 작성 중인 폼은 기존 Chrome Partner Center 패키지 탭의 오른쪽 패널이다.

## 제목

Partner Center MSIX and MSIXUPLOAD uploads fail with Error / Paused / null Bytes

## 본문

Hello Microsoft Store Developer Support,

I completed individual developer registration and identity verification, reserved an MSIX app, and created Submission 1. The package upload does not complete.

- Store ID: `9N2V9KQDSJ0G`
- App name: 상상을 클릭하다! 운영자 공방
- Submission ID: `1152921505702187840`
- Package identity: `A308E608.60496DA248AF4`
- Publisher: `CN=38F92221-47DE-4ED3-BA81-5B7A692E3551`
- Publisher display name: 초니쌤
- Version / architecture: `3.0.0.0` / `x64`
- File: `ClickBooth-3.0.0.0-x64-STORE-SUBMISSION-UNSIGNED.msix`
- File size: `91,197,601 bytes` (shown as `86.97 MB` in the portal)
- SHA-256: `6c6ba3fc6c389069fdf8b9da2c20374d6ee93d429a931187a4d3389c586c08a7`

The MSIX was created with Microsoft MakeAppx 10.0.28000.2705. Package creation and manifest validation succeeded. The identity and publisher values match the Product identity page. This is an unsigned package prepared for Store submission, not a sideload installation package.

We retried after signing in using a normal Google Chrome window. The browser extension's local file selection permission was explicitly enabled by the account owner. File selection completed successfully and the portal displayed the correct filename and size, but the upload then showed only `Error`. Another page load showed `Paused`, `null Bytes`, and a message that package processing was taking a long time. Both Korean and English portal views showed the same incomplete package. Save remains disabled. No successful package validation result has been displayed.

The account owner then selected the same MSIX manually in normal Chrome, without automated file selection, and reported the same upload failure. We observed that attempt in the portal: the correct filename and `86.97 MB` were displayed, followed by `Error`.

On October 21, 2026, at approximately 06:01 UTC, we also tried the recommended `.msixupload` submission format. This was a ZIP archive containing the unchanged original MSIX at its root, with no optional symbol file. We verified the inner MSIX SHA-256 before uploading. The portal showed the correct filename and `86.55 MB`, then immediately `Error` again, without any detailed error or successful validation.

- Upload archive: `ClickBooth-3.0.0.0-x64.msixupload`
- Archive size: `90,755,674 bytes`
- Archive SHA-256: `6690c1af53043cc1b02140a5b18f874e7feb664257e27f047f5d47e7b788c93d`
- Inner MSIX SHA-256: same as the original package listed above
- Packaging reference: https://learn.microsoft.com/en-us/windows/msix/package/packaging-uwp-apps#generate-your-app-package-upload-file-manually

The console also reported `require is not defined`, `requirejs is not defined`, and `fdRequire is not a function`. We cannot confirm that these console errors caused the upload failure. No HTTP status or storage upload failure reason is exposed in the visible portal.

Could you check whether this account and submission are enabled for package ingestion and identify the failed upload stage? Please also confirm whether any additional packaging or signing step is required for this Store MSIX submission. We have not submitted the app for certification.

Thank you.

## 발송 전 확인

- 공식 [Windows 개발자 지원](https://developer.microsoft.com/ko-kr/windows/support)의 **비기술 지원(개발자 센터 프로그램) → 지원 사례 만들기(MSA)**가 개인 Microsoft 계정용 경로다. 무료 계정·제출 지원과 유료 앱 개발 기술 지원을 구분한다. 이 경로는 빈 화면으로 남아 Partner Center 내부 문의 폼을 사용했다.
- 15:11 KST 이후 다시 읽은 초안에서는 두 형식 모두 `일시 중지됨 / null Bytes`였고 Save는 비활성이었다. 이 상태를 접수 완료나 패키지 검사 성공으로 설명하지 않는다.
- 일반 Chrome 수동 업로드도 사용자가 실패를 보고했고 포털의 해당 Error 항목을 확인했다. 새 `.msixupload` 형식도 동일하게 실패했다. 같은 파일 선택을 다시 요구하지 않는다.
- 계정 소유자의 명시적 문의 발송 요청은 이미 받았다. 같은 허락을 다시 묻지 않는다. 전화번호처럼 누락된 필수 입력이나 새 약관은 별도로 구분한다.
- 스크린샷이 필요하면 두 형식의 Error가 함께 보이는 `artifacts/registration/chrome-msixupload-error-2026-10-21.jpg`를 검토한다. 이미지와 패키지는 Git/Pages에 공개하지 않는다.
- Microsoft가 로그를 요청하면 인증 토큰·쿠키·SAS URL의 서명 값·개인 연락처를 포함하지 않도록 검토한다.
