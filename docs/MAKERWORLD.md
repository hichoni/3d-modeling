# MakerWorld 모드 (3MF 프로젝트 출력)

MakerWorld에서 고른 프로젝트를 Click Studio로 가져와 A1 mini에 맞게 다시 슬라이싱해서 출력합니다.

## 가져오는 길

| 기기 | 방법 |
| --- | --- |
| 안드로이드 태블릿 앱 (1.1.0~) | MakerWorld(브라우저)에서 **Bambu Studio로 열기** → 앱 선택에서 **Click Studio**. 앱이 `bambustudio://open?file=<3MF 주소>` 링크를 받아 파일을 내려받고 스튜디오로 넘깁니다. 받은 .3mf를 파일 앱에서 열어도 됩니다. |
| 크롬북 앱 · 웹 | MakerWorld에서 **3MF 다운로드** → 스튜디오의 **STL·3MF 불러오기** 또는 끌어다 놓기. (설치형 웹 앱은 `bambustudio://` 링크를 받을 수 없음) |
| Windows · Mac | 진짜 Bambu Studio가 링크를 받습니다. 그대로 Bambu Studio로 출력하세요. |

링크 형식과 믿을 수 있는 다운로드 주소는 Bambu Studio 소스(`src/slic3r/GUI/GUI_App.cpp`의 `bambustudio://open`, `bambustudioopen://`, `is_trusted_model_download_url`)와 같습니다. 앱은 https이면서 그 주소(`makerworld.bblmw.com`, `public-cdn.bblmw.com`, `makerworld.bblmw.cn`, MakerLab S3/OSS)인 파일만 내려받습니다.

## 3MF를 읽는 방식 (`src/threemf.js`)

- ZIP(ZIP64 포함 — Bambu Studio는 항상 ZIP64로 씀)을 브라우저의 `DecompressionStream`으로 풉니다.
- `3D/3dmodel.model`의 객체가 `3D/Objects/object_N.model`의 부품을 `p:path`로 참조하는 구조를 따라가며 부품·배치 변환을 곱합니다.
- `Metadata/model_settings.config`의 `<part subtype>`에서 **normal_part만** 출력합니다(modifier·negative·support 칠하기 부품은 빼고 경고).
- `<plate>`의 `model_instance`(object_id·instance_id)로 플레이트별 모델을 모읍니다. 같은 객체의 n번째 build item이 instance n입니다.
- `Metadata/project_settings.config`에서 층 높이·채움·벽·서포트·브림만 스튜디오 설정으로 가져옵니다. 나머지는 스튜디오의 A1 mini PLA 프로필입니다.
- 색 칠하기·여러 재료·PLA 아닌 재료·0.4 아닌 노즐은 경고로 알려 주고 외부 스풀 PLA 한 가지로 출력합니다. 미리 슬라이싱된 G-code가 들어 있어도 안전 확인을 위해 다시 슬라이싱합니다.
- 한 플레이트 모델이 6개 이하면 따로따로(배치 유지), 더 많으면 배치를 그대로 둔 한 덩어리로 불러옵니다. 삼각형은 플레이트 전체 120,000개까지입니다.

## 확인한 것

- Bambu Studio 저장소의 실제 3MF(`resources/calib/…`)로 ZIP64·분리 객체 파일·수정자 부품·설정 읽기 확인(라이선스 때문에 저장소에는 넣지 않고, 테스트는 같은 구조의 합성 프로젝트 `tests/helpers/make-3mf.cjs`로 함).
- 브라우저에서 불러오기 → 플레이트 선택 → 배치 → 슬라이싱, 안드로이드 다리 흉내로 앱 → 스튜디오 넘기기까지 E2E.
- **실제 MakerWorld 다운로드 파일과 실제 태블릿에서의 링크 받기는 아직 시험하지 않았습니다.** MakerWorld 모바일 화면에 "Bambu Studio로 열기" 버튼이 안 보이면 Chrome의 **데스크톱 사이트**를 켜거나 3MF 다운로드를 쓰세요.
