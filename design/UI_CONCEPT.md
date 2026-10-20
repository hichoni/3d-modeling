# 새김 게임 UI 시안

2026-10-19. ImageGen 기본 내장 도구로 생성한 UI 콘셉트이며 구현 완료 화면이 아니다.

- `saegim-game-ui-v1.png`: 만들기 → 쌓아보기 → 출력하기의 3단계 게임형 체험 시안.
- 14 × 14 mm 둥근 사각 끼움부는 고정한다. 이름·이니셜·단순 그림과 윗면의 양각/음각을 꾸민다.
- 만들기 화면은 큰 3D 작품, 직접 입력, 큰 선택 버튼을 중심으로 구성한다.
- 쌓아보기 화면은 층별 노즐 이동을 재생하고 슬라이싱이 무엇인지 설명한다.
- 출력 화면은 준비/운영자 확인/실제 출력/완료를 구분하고 실제 장치 상태를 표시한다.
- 미리보기 색과 실제 필라멘트 색을 혼동하지 않도록 한다.
- 5분은 모델링 체험 목표 시간이다. 가열·교정·실제 출력 시간은 별도로 표시한다.
- 원본 캐릭터와 시각 요소를 사용한다. 닌텐도 게임의 친근한 조작감과 명확한 피드백을 참고한다.

## 생성 프롬프트

```text
Use case: ui-mockup.
Create a polished high fidelity Korean interactive 3D printing booth web app UI concept board for the existing product "새김". The user wants it to feel like playing a delightful Nintendo game, with tactile toy-like 3D UI, crisp playful typography, confident primary colors and warm friendliness. Use an original visual identity and original small rounded-square stamp mascot.

Composition: a wide landscape 2400x1600 design presentation. A large, straight-on complete modeling screen occupying the left two thirds, with two smaller complete subsequent screens on the right stacked vertically: slicing visualization above, live printing below. All are actual usable desktop/tablet UI frames, no hardware device mockups, no perspective distortion, no marketing hero illustration in place of UI. A tiny header outside the screens reads "새김 · 나만의 작은 작품이 태어나는 5분". Under it a compact journey legend "01 만들기 → 02 쌓아보기 → 03 출력하기". Enough whitespace and very clear visual hierarchy; keep visual elements consistent across all three screens.

Visual style: premium Nintendo-inspired family game interface: warm ivory canvas, rich coral red main buttons, sky blue, butter yellow and fresh mint accents, dark ink text, softly beveled chunky pill buttons, rounded panels, crisp 2px outlines and small restrained hard drop-shadows. A friendly bright square stamp mascot with tiny feet accompanies brief instruction bubbles. Subtle paper texture, dotted measurement grid, a few small sparkle motifs, rounded Korean sans serif headings with accurate readable Hangul. This should be sophisticated and carefully art-directed, not a generic SaaS dashboard and not a dense CAD program. Clear large touch targets and minimal knobs.

Large screen, modeling:
Top left "새김", small status pill "만들기 03:42", and a three-stage numbered game progress track with step 1 active.
Large title "어떤 이름을 새겨볼까?"
The main central workbench showcases a very large beautifully rendered pink 14 x 14 mm rounded-square flat insert, base 1.5mm and top lettering relief 1mm, with raised Korean name "수민" on top. It has a small embossed heart as a selectable alternative decoration. It must be a low flat rounded square tile, never a tall keycap, never a round stamp handle. The 14mm square outer footprint and rounded corners are fixed because it fits into a premanufactured holder. A tasteful small exploded assembly diagram at a corner shows that very same pink tile fitting into a white 18mm square holder above a mechanical keyswitch, caption "딱 맞게 끼워요". A dimension marker "14 × 14 mm" with a tiny lock icon identifies fixed size. A 3D rotate hint is discreet.
A left or bottom control tray has a name input labeled "이름" value "수민", three big mode chips "이름", "이니셜", "그림", three playful legible font buttons "동글", "또박", "손글씨", and two tactile relief choices "볼록하게", "오목하게". A small set of 4 simple printable emblem buttons heart, star, smile, leaf. No size or outer shape controls. Preview color swatches are clearly labeled "미리보기 색". Small instruction bubble "글자가 입체가 됐어!"
At the bottom a clear big coral primary action "다음! 층층이 쌓아보기 →". Back/reset is visually secondary.

Top right screen, slicing:
Stage 2 active. Title "한 층씩, 이렇게 만들어져요".
An enlarged cutaway/exploded view of the same fixed pink name tile in 12 stacked horizontal layers, a bright yellow nozzle icon tracing the currently active layer. A chunky horizontal playback slider and play button, label "6 / 12층". Small metrics "모델 출력 약 2분 30초" and "준비 포함 약 8분 30초". These are estimates, not a promise of print completion in 5 minutes. One primary button "내 작품 출력 준비".
This should clearly teach how slicing becomes stacked material, not resemble decorative stacked cakes.

Bottom right screen, printing:
Stage 3 active. Title "내 작품이 태어나고 있어요!"
A recognizable stylized Bambu A1 mini open frame cantilever bed-slinger printer with one upright column and horizontal gantry prints the SAME low pink 14mm tile, not a generic enclosed printer. Compact live progress "3 / 12층" and "출력 중". Show a small participant work ticket "내 작품 012". A secondary state chip "선생님 확인 후 시작" communicates staff approval before physical starts, not technical backend language. A game-like progress bar; a small peek card shows the final pink tile assembled on the white holder. Success celebration should be restrained and not claim completed printing while progress is ongoing.

Constraints: readable Korean UI text; prioritize key phrases over filler microcopy. Keep the flat 14x14mm rounded-square insert shape and consistent name tile in every frame. Physical filament color is not automatically changed by UI preview swatches. No code, STL protocol jargon, network addresses, graphs, security settings, spec tables, subscriptions, coins to purchase, copyrighted characters or existing game logos. This is a UI concept mockup, not a screenshot of implemented software.
```


## 최종 제목과 v2

사용자 확정 제목은 **상상을 클릭하다! — 3D 키캡 클리커 만들기**입니다. 시안 이미지의 이전 이름 ‘새김’은 구현에서 교체했습니다.

- `saegim-game-ui-v2.png`: A1 mini의 단일 수직 기둥과 왼쪽으로 뻗은 암, 운영자 확인 상태를 수정한 시안.
- v1/v2 모두 생성 이미지이며 실제 앱 스크린샷이 아닙니다.
- 최종 화면은 `src/`에서 HTML/CSS/Three.js로 구현합니다. 시안의 고정된 시간 수치는 그대로 쓰지 않고 실제 슬라이싱 결과로 대체합니다.

### v2 편집 의도

원본 구도·색상·마스코트를 유지하면서 출력 화면을 Bambu A1 mini의 오른쪽 단일 기둥/왼쪽 캔틸레버 형태로 바로잡고, 실제 출력 전 운영자 확인과 출력 상태를 구분하도록 편집했습니다. 구현에서는 원리 체험과 실제 경로를 별도 문구로 표시합니다.
