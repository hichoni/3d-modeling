# X배너 v6 / 대문 — AIERA 자체 개발

2026-10-28 최종 수정: 상단 **안동발명교육연구회는 왼쪽 정렬**, **풍천풍서초 발명동아리는 우측 정렬**이다. DoHyeon 같은 크기(도면 좌표 16), 같은 기준선은 유지한다. QR 목적지는 **https://3d.aiera.co.kr/home.html**로, 스캔하면 체험 대신 대문이 열린다. PDF 두 종류·JPG·미리보기·인쇄 ZIP에 반영했다. `output/banner/click-booth-x-banner-v6-header.png`는 수정한 상단 확대 보기다.

최신 인쇄 PDF는 파일명에 **`aiera-home`**이 들어간다. 기존 PDF는 변경 전 이력으로 보존했다. 최종 150dpi JPG와 재단 여유 PDF 렌더의 QR을 실제 해독하여 대문 URL 일치를 확인했으며, 해당 HTTPS 주소에서 대문과 두 시작 버튼이 열리는 것을 확인했다.

사용자의 2026-10-28 요청: 승인한 v5 구성을 유지하고 전체 배너와 대문을 함께 보여 주며, 모델링·앱의 AIERA 자체 개발을 강조한다.

- 배너 위쪽과 대문 제목 위: **모델링부터 앱까지, AIERA 100% 자체 개발**.
- 개발 주체 표기는 사용자가 제공한 것으로 부스 전용 모델링·체험 앱을 가리킨다. 사용하는 외부 라이브러리와 글꼴의 저작권·라이선스 표시는 바꾸지 않는다.
- 배너 제품 영역은 v5와 같고, 실제 STL 렌더링은 v4의 PNG를 그대로 재사용한다.
- 대문도 같은 실제 모델 PNG를 사용한다. 왼쪽 AIERA, 오른쪽 풍천풍서초 발명동아리 WNL로 통일했다.

## 한눈에 보기

- `design/banner-v6/overview.html`: 전체 배너와 대문을 같은 화면에서 보는 페이지. 그림을 누르면 각각 PDF와 실제 대문으로 이동한다.
- `output/banner/click-booth-banner-home-overview.png`: 위 비교 화면.
- `output/banner/click-booth-home-1.1.6.png`: 1180×550 대문 전체 화면.
- `output/banner/click-booth-x-banner-v6-preview.png`: 전체 배너 미리보기.

## 인쇄 파일

- `output/pdf/click-booth-x-banner-v6-aiera-home-600x1800.pdf`: 600×1800mm.
- `output/pdf/click-booth-x-banner-v6-aiera-home-600x1800-bleed3mm.pdf`: 사방 3mm 여유, 606×1806mm.
- `output/banner/click-booth-x-banner-v6-150dpi.jpg`: 3544×10630px.
- `output/banner/click-booth-x-banner-v6-print.zip`: PDF 두 종류·JPG·인쇄 안내.

재생성은 저장소 루트에서 `python design/banner-v6/build_banner.py`. ReportLab·pypdf·저장소 글꼴·v4 제품 PNG가 필요하다. RGB, 글자·장식·QR은 벡터, 제품 이미지는 3600×2500 래스터다. 인쇄소 지정 규격을 우선한다.

일반/재단 여유 PDF를 렌더링해 전체 구성을 확인했다. 크기·한국어·AIERA/WNL·개발 문구를 검사했고 최종 JPG의 QR 주소를 해독했다. 앱 릴리스와 화면별 검수는 [개발 문구·대문·IWA 1.1.6 인수인계](../../docs/BRANDING_RELEASE_2026-10-28.md)에 있다.
