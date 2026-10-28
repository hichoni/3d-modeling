# X배너 v2 — 상상을 클릭하다!

600×1800mm 기존 배너를 바탕으로 만든 2026-10-28 개선안이다. 원본을 덮어쓰지 않았다.

## 결과물

- `output/pdf/click-booth-x-banner-v2-600x1800.pdf`: 완성 크기 600×1800mm. 한글과 QR은 벡터.
- `output/pdf/click-booth-x-banner-v2-600x1800-bleed3mm.pdf`: 사방 3mm 재단 여유를 둔 606×1806mm 파일. TrimBox는 600×1800mm.
- `output/banner/click-booth-x-banner-v2-150dpi.jpg`: 3544×10630px JPG.
- `output/banner/click-booth-x-banner-v2-preview.png`: 빠른 확인용 전체 미리보기.
- `output/banner/click-booth-x-banner-v2-print.zip`: PDF 두 종류, JPG, 인쇄 안내를 묶은 파일.

## 바꾼 내용

제목 아래에 **3D 키캡 클리커 만들기**를 명확히 넣고, 작품 이미지를 중심으로 세 단계(디자인 → 슬라이싱 과정 보기 → 출력·조립)를 정리했다. **디자인 5분**과 **출력 포함 약 20~30분**을 분리했다. 기존 AIERA 안동발명교육연구회 명칭, 대상, 현장 접수, 룰렛 이벤트는 유지했다.

제품 이미지는 built-in image_gen으로 생성한 개념 이미지이며 실제 완성품 사진이 아니다. 얇은 14mm 둥근 사각 끼움판을 미리 만든 받침에 끼우는 형태로 수정했다. 색상·선물은 현장 준비 상황에 따라 달라진다는 설명을 배너에 넣었다. 생성 프롬프트와 수정 지시는 `IMAGE_PROMPT.md`에 있다.

QR은 AI 이미지에 포함시키지 않고 ReportLab으로 별도 생성했다. 목적지는 `https://hichoni.github.io/3d-modeling/index.html?start`다. 최종 150dpi JPG에서 QR을 다시 해독해 같은 주소인지 확인했다.

## 인쇄와 편집

인쇄소가 완성 크기를 요구하면 일반 PDF, 사방 3mm 여유를 요구하면 bleed3mm PDF를 전달한다. 인쇄소가 지정한 재단/타공 규격이 있으면 그것을 우선한다. 파일은 RGB이며 특정 인쇄소용 CMYK 프로파일은 적용하지 않았다.

제품 이미지 원본은 1402×1122px이다. PDF 글자·QR은 벡터이며, JPG의 150dpi 표기는 전체 파일 기준이다. 이미지 자체를 300dpi 원본으로 생성했다고 설명하지 않는다.

원본 소스는 `build_banner.py`, `keycap-hero.png`, 저장소의 `fonts/Jua-Regular.ttf`, `fonts/DoHyeon-Regular.ttf`다. ReportLab·pypdf가 있는 Python에서 저장소 루트 기준 다음처럼 다시 만든다.

```text
python design/banner-v2/build_banner.py
```

Poppler로 최종 PDF를 렌더하고 한글 누락·겹침·QR 위치를 육안 확인했다. PDF 1페이지, 완성/재단 크기, 제목·시간 문구, QR 주소를 검사했다. 중간 시안은 `artifacts/banner-20261028/`에 보관했다.
