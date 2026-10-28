# X배너 v5 — 제품 영역을 더 풍성하게

2026-10-28 사용자가 표시한 제품 영역의 빈 공간을 채웠다. 실제 모델 렌더링, AIERA / 풍천풍서초 발명동아리 WNL, 제목과 나머지 구성은 v4와 같다.

## 변경

- ‘내가 만든 모양을 / 쏙! 끼워요’ 메모와 작품판을 가리키는 화살표.
- 작품판에서 조립한 키캡으로 이어지는 점선 화살표와 ‘착!’ 표시.
- 아이디어 전구, ‘딸깍!’ 만화 효과, ‘나만의 작품 완성!’ 배지.
- 모델과 겹치지 않는 별·색종이 장식.

추가 요소는 모두 PDF 벡터다. 실제 모델 PNG는 **v4의 동일 파일**을 참조하며 변형하거나 다시 생성하지 않았다. 모델 출처·해시·치수는 [v4 설명](../banner-v4/README.md)과 [형상 기록](../banner-v4/model-provenance.json)을 따른다.

## 최신 파일

- `output/pdf/click-booth-x-banner-v5-600x1800.pdf`: 완성 크기 600×1800mm.
- `output/pdf/click-booth-x-banner-v5-600x1800-bleed3mm.pdf`: 사방 3mm 여유, 전체 606×1806mm.
- `output/banner/click-booth-x-banner-v5-150dpi.jpg`: 3544×10630px.
- `output/banner/click-booth-x-banner-v5-preview.png`: 전체 미리보기.
- `output/banner/click-booth-x-banner-v5-detail.png`: 제품 영역 확대 미리보기.
- `output/banner/click-booth-x-banner-v5-print.zip`: PDF 2개, JPG, 인쇄 안내.

저장소 루트에서 `python design/banner-v5/build_banner.py`로 PDF를 다시 만든다. ReportLab·pypdf와 기존 글꼴, v4의 제품 PNG가 필요하다. RGB 문서이며 특정 인쇄소의 CMYK 프로파일은 적용하지 않았다. PDF 글자와 장식·QR은 벡터이고 제품 렌더링은 기존 3600×2500 래스터다.

일반판과 재단 여유판을 렌더링해 제품 가림·겹침·한글을 검수했다. 페이지 크기와 기관명을 확인하고 최종 JPG의 QR이 `https://hichoni.github.io/3d-modeling/index.html?start`로 해독되는 것을 확인했다. 앱·IWA·APK는 변경하지 않았다.
