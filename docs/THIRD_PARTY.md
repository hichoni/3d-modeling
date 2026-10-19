# 제3자 코드와 글꼴

오프라인 실행을 위해 원본 파일을 저장소에 포함하고 단일 HTML에도 넣습니다.

| 항목 | 버전/파일 | 출처 | 라이선스 |
| --- | --- | --- | --- |
| Three.js | r128 / `vendor/three.min.js` | [Three.js](https://github.com/mrdoob/three.js/tree/r128), cdnjs 배포 파일 | [MIT](../vendor/THREE-LICENSE.txt) |
| OrbitControls | Three.js r128 | [공식 예제](https://github.com/mrdoob/three.js/blob/r128/examples/js/controls/OrbitControls.js), jsDelivr 배포 파일 | [MIT](../vendor/THREE-LICENSE.txt) |
| Jua | Jua-Regular.ttf | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/jua) | [OFL](../fonts/jua-OFL.txt) |
| Do Hyeon | DoHyeon-Regular.ttf | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/dohyeon) | [OFL](../fonts/dohyeon-OFL.txt) |
| Gaegu | Gaegu-Bold.ttf | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/gaegu) | [OFL](../fonts/gaegu-OFL.txt) |
| Nanum Myeongjo | NanumMyeongjo-ExtraBold.ttf | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/nanummyeongjo) | [OFL](../fonts/nanummyeongjo-OFL.txt) |

글꼴 원본은 이름이나 내용을 수정하지 않았습니다. Three.js와 OrbitControls는 제공받은 초안과 동일한 버전으로 유지했습니다. 해당 버전으로 로컬 API를 직접 검증했으며 최신 버전으로 자동 교체하지 않습니다.

제공받은 `stamp-maker-2.html`에서 기하 처리, STL 작성, ZIP 작성 로직을 재사용했습니다. 원본 파일은 로컬에서만 참고했고 `.gitignore`로 제외했습니다. 별도 프로젝트 전체 라이선스는 저장소 소유자가 결정하도록 추가하지 않았습니다.
