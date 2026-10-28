# X배너 v4 — 실제 출력 모델

2026-10-28 사용자가 요청한 **“키 이미지를 실제 출력물 모델링으로 교체”**를 반영했다. v3의 구성과 AIERA / 풍천풍서초 발명동아리 WNL 표기를 유지하고, 제품 이미지를 실제 STL과 앱의 모델 생성 코드로 렌더링한 이미지로 교체했다. v2·v3는 작업 이력으로 보존한다.

## 실제로 사용한 형상

- 3구 본체: `models/keychain-holder/holder-3-slim-loop.stl`
- 1구 본체: `models/keychain-holder/holder-1-slim-loop.stl`
- 둥근 키캡 받침: `models/keycap-base/keycap-base-socket-1.5-low-tight-outer17.stl`
- 작품판: `src/state.js`, `src/engine.js`의 `buildGeometries()`를 그대로 사용한다. 모두 **14×14mm**, 바닥 1.5mm다. 고양이·별·하트·토끼는 말랑, ‘상상’은 볼록 모드 / 동글 글씨체 / 높이 0.8mm다.
- 실제 앱과 같은 배치: 키 간격 17.5mm, 받침 하단 17.4mm, 작품판 바닥 23.6mm. STL 치수·비율·삼각형은 변형하지 않았으며, 본체는 앱과 같이 Z축으로 90도 돌려 가로로 놓았다.

**실물 사진이 아니라 실제 모델의 렌더링**이다. 색상과 조명은 예시이며 PLA 출력 표면을 실물 사진처럼 보정하지 않았다. 외관에서 보이지 않는 내부 스위치 및 금속 키링은 그리지 않았다. 원본 파일 해시·치수·검증 결과는 `model-provenance.json`에 있다. 모델 생성 코드 기준은 Git `10ced0f`이며 앱 코드는 이번 배너 작업에서 수정하지 않았다.

## 최신 인쇄 파일

- `output/pdf/click-booth-x-banner-v4-600x1800.pdf` — 완성 크기 600×1800mm.
- `output/pdf/click-booth-x-banner-v4-600x1800-bleed3mm.pdf` — 사방 3mm 여유, 전체 606×1806mm. TrimBox는 완성 크기.
- `output/banner/click-booth-x-banner-v4-150dpi.jpg` — 3544×10630px.
- `output/banner/click-booth-x-banner-v4-preview.png` — 전체 미리보기.
- `output/banner/click-booth-x-banner-v4-print.zip` — PDF 2개, JPG, 인쇄 안내.
- `design/banner-v4/keycap-actual-models.png` — 3600×2500px 투명 배경 제품 렌더링.

PDF 글자·도형·QR은 벡터다. 제품 이미지는 위 해상도의 래스터이며 배치 너비 552mm에서 약 166ppi다. RGB 문서이고 특정 인쇄소용 CMYK 프로파일은 적용하지 않았다. 인쇄소 요구에 따라 일반판 또는 재단 여유판을 사용한다.

## 다시 만들기

1. 저장소 루트에서 `python -m http.server 5192 --bind 127.0.0.1` 실행.
2. `http://127.0.0.1:5192/design/banner-v4/render-models.html`을 브라우저로 열기.
3. 완료 표시 후 **인쇄용 PNG 저장** 클릭. 받은 파일을 `design/banner-v4/keycap-actual-models.png`로 복사.
4. ReportLab·pypdf가 있는 Python으로 `python design/banner-v4/build_banner.py` 실행.
5. Poppler로 PDF를 PNG/JPG로 렌더해 육안 확인. 최종 JPG에서 QR을 다시 해독한다.

렌더링 도구는 저장소의 Three.js, 글꼴, 실제 모델 생성 코드를 사용한다. AI 이미지 생성·배경 제거·형태 재해석은 사용하지 않았다. 최종 PDF의 한글/두 기관명/규격과 배치, QR 목적지 `https://hichoni.github.io/3d-modeling/index.html?start`를 검수했다.
