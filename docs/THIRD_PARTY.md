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

## 로컬 프린터 연결 참고

- Bambu CA 인증서: [ha-bambulab 공개 인증서](https://github.com/greghesp/ha-bambulab/blob/main/custom_components/bambu_lab/pybambu/certs/bambu.cert). 저장소에는 공개 CA 인증서만 포함하며 개인 키·접근 코드는 포함하지 않습니다.
- LAN 모드: [Bambu 공식 Developer Mode 안내](https://wiki.bambulab.com/en/knowledge-sharing/enable-developer-mode)
- CLI: [Bambu Studio Command Line Usage](https://github.com/bambulab/BambuStudio/wiki/Command-Line-Usage)
- MQTT 요청 형식 참고: [ha-bambulab bambu_client.py](https://github.com/greghesp/ha-bambulab/blob/main/custom_components/bambu_lab/pybambu/bambu_client.py)

Bambu Studio 실행 파일은 재배포하지 않습니다. 선택 대체 계산은 사용자가 설치한 공식 프리셋을 읽습니다. 웹 엔진 결과를 프린터 파일로 묶는 고정 A1 mini 시작·종료 절차와 해당 원본 두 필드는 `bridge/profiles/`에 포함하며, 출처·변경 내용과 Bambu Studio의 AGPL-3.0 원문을 함께 제공합니다. `bridge/`의 Node.js 전송·서버 코드는 이 프로젝트에서 작성했습니다. 연결 방식은 학교 장비에서 실제 확인한 범위에 한합니다.


## 브라우저 FDM 엔진

Kiri:Moto 4.7.0, GridSpace 커밋 d138275bbe9d4e4030d8cb8b2dcf66607da9295a에서 FDM worker를 자체 번들했습니다. [MIT 원본](https://github.com/GridSpace/grid-apps/blob/d138275bbe9d4e4030d8cb8b2dcf66607da9295a/license.md), [전체 고지](../vendor/kiri/LICENSES.txt), [고정 의존성과 재빌드](../tools/slicer/README.md)를 제공합니다. Three 0.182.0, three-mesh-bvh 0.7.6, earcut 3.2.4, JSZip 3.10.2, QuickJS/quickjs-emscripten 0.20.0, raster-path 1.1.1, Tween 16.6.0 및 포함된 코드의 MIT/ISC/Boost 고지를 보존합니다. 엔진 파일은 HTML에도 포함합니다.
