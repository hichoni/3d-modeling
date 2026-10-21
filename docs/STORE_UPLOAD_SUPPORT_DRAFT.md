# Microsoft Store 패키지 업로드 문의 초안

**발송하지 않은 초안이다.** 계정 소유자의 발송 지시 없이 지원 요청·이메일·채팅으로 보내지 않는다. 아래에는 공개 앱 식별값과 기술 정보만 기록한다. 로그인 정보·신분증·주소·전화번호·인증 토큰·프린터 접근 코드는 넣지 않는다.

## 제목

Partner Center MSIX upload fails with Error / Paused / null Bytes for a newly registered individual developer

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

The console also reported `require is not defined`, `requirejs is not defined`, and `fdRequire is not a function`. We cannot confirm that these console errors caused the upload failure. No HTTP status or storage upload failure reason is exposed in the visible portal.

Could you check whether this account and submission are enabled for package ingestion and identify the failed upload stage? Please also confirm whether any additional packaging or signing step is required for this Store MSIX submission. We have not submitted the app for certification.

Thank you.

## 발송 전 확인

- 일반 Chrome에서 자동 파일 선택을 거치지 않는 수동 업로드 결과도 먼저 확인한다. 현재 이 결과는 미확인이며, 수동으로도 재현됐다고 단정해 보내지 않는다.
- 계정 소유자가 내용을 확인하고 명시적으로 문의 발송을 요청해야 한다.
- 스크린샷이 필요하면 `artifacts/registration/chrome-upload-error-2026-10-21.jpg`를 검토한다. 이미지와 MSIX는 Git/Pages에 공개하지 않는다.
- Microsoft가 로그를 요청하면 인증 토큰·쿠키·SAS URL의 서명 값·개인 연락처를 포함하지 않도록 검토한다.
