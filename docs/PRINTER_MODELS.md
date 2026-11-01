# Bambu Lab 기종 확장 준비 (A1 mini · A1 · X1C · P2S · X2D)

2026-11-01. 사용자 요청: “A1 mini 말고도 다른 뱀부랩 프린터도 확장할 수 있게 준비해줘. A1 // X1C // X2D // P2S”.

## 지금 상태

| 기종 | 모델 코드 (SSDP·Studio) | 베드 | 노즐 | 찾기·연결·상태 보기 | 출력 |
| --- | --- | --- | --- | --- | --- |
| A1 mini | `N1` | 180 × 180 | 1 | ✓ | ✓ 검증됨 |
| A1 | `N2S` | 256 × 256 | 1 | ✓ | 잠금 (검증 전) |
| X1C | `BL-P001` (`3DPrinter-X1-Carbon`) | 256 × 256 | 1 | ✓ | 잠금 (검증 전) |
| P2S | `N7` | 256 × 256 | 1 | ✓ | 잠금 (검증 전) |
| X2D | `N6` | 256 × 256 | **2** | ✓ | 잠금 (검증 전) |

출처: Bambu Studio 02.08.00.09 `resources/profiles/BBL` (`machine/<기종>.json`, `<기종> 0.4 nozzle.json`, 시작·끝 G-code 템플릿).

## 준비된 것

- `src/printer-models.js`: 기종 목록(코드·이름·베드·높이·노즐 수·검증 상태). 브라우저·크롬북 앱·태블릿 앱·공방 PC가 같이 쓴다. `printable()`은 `verified`만 참이다.
- 찾기(`src/direct/discovery.js`): 다섯 기종을 모두 목록에 보여 준다. 검증 전 기종에는 “연결·상태 확인만 · 출력은 검증 전” 표시. IP 찾기는 인증서 일련번호 앞자리(A1 mini `030`, A1 `039`, X1C `00M`)로 기종을 알아내고, 모르면 “기종 확인 전”으로 출력 잠금.
- 등록(`src/direct/relay.js`): 등록할 때 기종을 저장한다(기존 등록분은 A1 mini). 상태 정보에 `model`, `modelId`, `printable`이 붙는다. 출력 작업 생성은 검증 전 기종이면 거절하고, 출력 화면 버튼도 잠긴다.
- 출력 파일(`src/print-job.js`): 기계 설정의 `bed`·`modelId`·`printerModel`을 따른다. 슬라이싱 경로는 180mm 베드 중앙(90) 기준으로 검사한 뒤, 다른 베드면 그 중앙(256 → 128)으로 옮겨 다시 쓴다. 메타데이터(`printer_model_id`, `printer_model`, `printer_settings_id`), 3D 모델, 베드 측정 범위, 대기 위치도 같이 옮긴다. A1 mini 결과는 이전과 바이트 단위로 같다.
- 공식 원본 보관: `bridge/profiles/a1-source.json`, `x1c-source.json`, `p2s-source.json`, `x2d-source.json`(AGPL-3.0, `BAMBU-LICENSE.txt`). **참고용 템플릿이고 출력용 시작 G-code가 아니다.**
- 공방 PC(`bridge/`)는 그대로 A1 mini만 등록하며, 다른 기종을 찾으면 기종 이름과 함께 “검증 전”이라고 알려 준다.

## 기종을 출력 가능으로 바꾸는 순서

1. **시작·끝 G-code 만들기**: `<id>-source.json`의 템플릿(`[bed_temperature_initial_layer_single]`, `{if curr_bed_type=="Textured PEI Plate"}` 같은 자리표시)을 PLA 220/65°C · 텍스처 PEI · 외부 스풀 · 0.4mm 노즐로 채운다. A1 mini의 `a1-mini-pla.json`과 같은 형식(`id`, `origin`, `license`, `changes`, `start`, `end`)에 `bed`, `modelId`, `printerModel`을 더해 `bridge/profiles/<id>-pla.json`으로 저장한다.
2. **기종별 차이 반영**:
   - 베드 측정 명령: A1 계열은 `G29 A1 X… Y… I… J…`로 판 주변만 잰다. X1C·P2S·X2D는 명령과 인자가 달라서 템플릿을 그대로 따르고, 부분 측정을 넣으려면 따로 검증한다.
   - 재료: 지금은 외부 스풀(`use_ams:false`, `ams_mapping:[-1]`). X1C·P2S의 AMS나 외부 스풀 경로는 실제 기기에서 확인한다.
   - **X2D는 노즐이 2개**: 어느 노즐로 출력할지, 재료 매핑(`ams_mapping2` 등)과 템플릿의 노즐 전환부를 따로 확인해야 해서 가장 나중에 연다.
   - 끝 G-code의 대기 위치(예: A1 mini의 `G1 X0 Y90`)가 그 기종 베드 기준인지 확인한다.
3. **연결**: `src/direct/relay.js`의 `machineFor`에 기종 → 기계 설정을 추가하고, `scripts/build.cjs`에서 `A1_MINI_MACHINE`처럼 페이지에 넣는다.
4. **실물 검증(빈 베드, 바로 옆에서)**: 예열 → 베드 측정 범위 → 첫 층 높이·압출 → 14mm 판 1개 → 3구 세트 → 끝나고 대기 위치·온도 끄기 → 진행률·남은 시간·완료 판정. 문제가 없으면 `src/printer-models.js`에서 그 기종을 `verified`로 바꾼다.
5. 기종마다 이 문서의 표와 검증 기록을 갱신한다.

## 확인한 것

- `tests/printer-models.test.cjs`: 다섯 기종 코드 인식, A1 mini만 출력 가능, 256mm 베드용 출력 파일이 같은 경로를 +38mm 옮기고 메타데이터가 A1(`N2S`)로 바뀌는지.
- `tests/direct-relay.test.cjs`: 찾기 결과의 기종·출력 가능 여부.
- 실제 A1·X1C·P2S·X2D 기기로는 아직 아무것도 확인하지 않았다(찾기·연결 포함).
