# X배너 v3 — AIERA / WNL

사용자의 “v2가 너무 미니멀하다”는 피드백을 반영한 600×1800mm 개선안이다. 기존 배너의 게임 같은 분위기를 살리면서 한글·QR은 벡터로 유지했다. v2는 보존했다.

## 반영한 요청

- **왼쪽 상단:** AIERA 안동발명교육연구회.
- **오른쪽 상단:** 풍천풍서초 발명동아리 WNL.
- 클리커 캐릭터와 말풍선, 기울어진 제목 띠, 컬러 미션 배지, 4단계 흐름, 선물 이름이 있는 룰렛을 더했다.
- 디자인 약 5분과 출력 포함 약 20~30분을 구분했다. 대상·현장 접수·룰렛 이벤트는 기존 원본을 유지했다.
- 제품 비주얼은 v2의 14mm 끼움판 개념 이미지를 재사용했다. 새 로고를 임의로 만들지 않고 사용자 지정 단체명을 텍스트 배지로 표시했다. [이미지 생성 도구·프롬프트 기록](../banner-v2/IMAGE_PROMPT.md).

## 파일

- `output/pdf/click-booth-x-banner-v3-600x1800.pdf`: 완성 크기 600×1800mm.
- `output/pdf/click-booth-x-banner-v3-600x1800-bleed3mm.pdf`: 사방 3mm 여유, 전체 606×1806mm, TrimBox 600×1800mm.
- `output/banner/click-booth-x-banner-v3-150dpi.jpg`: 3544×10630px.
- `output/banner/click-booth-x-banner-v3-preview.png`: 미리보기.
- `output/banner/click-booth-x-banner-v3-print.zip`: 위 PDF 2개와 JPG·인쇄 안내.

PDF를 Poppler로 렌더해 전체 배치·글자·기관명 위치를 확인했다. PDF에서 두 기관명·WNL·시간 문구를 검사했고, 최종 JPG에서 QR을 해독해 `https://hichoni.github.io/3d-modeling/index.html?start`와 일치함을 확인했다. RGB 문서이며 특정 인쇄소용 CMYK 프로파일은 적용하지 않았다. 제품 예시 원본은 1402×1122px이고, 글자·도형·QR은 벡터다.

재생성: 저장소 루트에서 `python design/banner-v3/build_banner.py`. ReportLab·pypdf와 저장소 글꼴, `design/banner-v2/keycap-hero.png`가 필요하다.
