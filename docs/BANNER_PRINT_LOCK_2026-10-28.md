# X배너 인쇄 확정 — 2026-10-28

사용자가 인쇄를 시작한다고 확인했으며 QR을 더 이상 수정하지 말라고 명시했다. 이후 일반 웹 개선 작업에서 아래 배너·QR·출력 파일을 재생성하거나 덮어쓰지 않는다. 변경은 사용자의 새로운 명시적 인쇄물 수정 요청이 있을 때만 진행한다.

- 확정 버전: 배너 v6 `aiera-home`, 소스 릴리스 `7de7d22`.
- 왼쪽: AIERA / 안동발명교육연구회 왼쪽 정렬.
- 오른쪽: 풍천풍서초 발명동아리 우측 정렬 / WNL.
- 두 기관명은 동일 크기·기준선.
- **QR 목적지 고정: https://3d.aiera.co.kr/home.html**. 대문 페이지 경로를 유지한다.
- 홈페이지 루트의 진입 동작 변경은 인쇄물 변경과 별개다.

## 확정 파일 SHA-256

| 파일 | SHA-256 |
| --- | --- |
| `output/pdf/click-booth-x-banner-v6-aiera-home-600x1800.pdf` | `2316cb5c2b5bd712fe73690254c003f3f2a9f9d1819baab4c62280a69085ebd7` |
| `output/pdf/click-booth-x-banner-v6-aiera-home-600x1800-bleed3mm.pdf` | `e418bfbd533f3503402fd697a996e050cd07d533deb59ac7ec1af76d486c781f` |
| `output/banner/click-booth-x-banner-v6-print.zip` | `a022ad5312dc728f028a5b163ce0ed89dcb9d2e872e42d5ef2bba4668d6e1491` |

일반 PDF는 600×1800mm, 재단 여유 PDF는 606×1806mm(사방 3mm). 두 파일과 최종 JPG의 QR 해독 및 새 대문 연결을 이전 릴리스에서 확인했다. 이전 이름의 PDF는 변경 전 이력이며 새 인쇄에 사용하지 않는다.
