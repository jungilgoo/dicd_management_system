# DICD 측정 관리 시스템 - 코드 분석 보고서

**분석 일자**: 2026-02-06

## 프로젝트 개요

| 항목 | 값 |
|------|-----|
| 백엔드 | FastAPI + SQLAlchemy + MySQL (Python 44개 파일) |
| 프론트엔드 | Vanilla HTML/CSS/JS + AdminLTE + Chart.js (JS 16개, HTML 23개) |
| 테스트 | pytest (backend/tests/) |

### 백엔드 구조
- **FastAPI 애플리케이션**: `backend/main.py`
- **데이터베이스 레이어**: `backend/database/` (models.py, database.py, crud.py)
- **API 라우터**: `backend/routers/` (16개 도메인별 라우터)
- **비즈니스 로직**: `backend/services/` (statistics, spc, distribution, bulk_import, reports)
- **데이터 스키마**: `backend/schemas/` (Pydantic 스키마)

### 프론트엔드 구조
- **메인 페이지**: `frontend/index.html` (PHOTO), `frontend/etch_index.html` (ETCH)
- **기능 페이지**: `frontend/pages/` (데이터 입력/조회/설정/분석/보고서)
- **ETCH 페이지**: `frontend/pages/etch/` (PHOTO와 동일 구조 복제)
- **핵심 JS**: `frontend/js/` (api.js, config.js, 도메인별 모듈 16개)
- **UI 프레임워크**: AdminLTE + Chart.js + D3.js + jQuery

### 주요 도메인 모델
- **ProductGroup** → Process → Target → Measurement (계층 구조)
- **Spec**: 사양 한계 (LSL/USL/LCL/UCL)
- **Equipment**: 측정 장비 (코팅/노광/현상/ETCH)
- **PRThicknessEquipment/Measurement**: PR 두께 전용 모델
- **ChangePoint**: 변경점 이력 관리
- **Author**: 작성자 관리

---

## 1. 보안 분석

> **참고**: 이 시스템은 내부 네트워크 전용으로 운영되므로, 외부 공격 기반 위협은 실질적 위험이 낮음

| 항목 | 상태 | 내부 환경 위험도 | 비고 |
|------|------|----------------|------|
| CORS 전체 허용 (`*`) | `main.py:49` | 무관 | 외부 접근 불가 |
| 인증/인가 부재 | 전체 라우터 | 낮음 | 내부 직원만 접근, 실수에 의한 삭제 가능 |
| 하드코딩 DB 비밀번호 | `config.py:26` | 무관 | 소스 외부 비공개 |
| 하드코딩 서버 IP | `config.js:3` | 무관 | 내부 IP |
| HTTP 비암호화 | 전체 | 무관 | 내부 네트워크 |
| 파일 업로드 크기 미제한 | `bulk_upload.py` | 약간 주의 | 실수로 대용량 파일 업로드 가능 |
| 보안 헤더 미설정 | 전체 | 무관 | 내부 사용 |

---

## 2. 코드 품질

### 해결 완료
- ~~존재하지 않는 notification_service 모듈 참조~~ → 제거 완료
- ~~통계 계산 로직 3곳 중복~~ → `calculate_basic_statistics()` 통합 완료
- ~~update_measurement의 range 반올림 버그~~ → 수정 완료

### 잔존 이슈

| 심각도 | 항목 | 위치 |
|--------|------|------|
| HIGH | async/sync 혼용 (라우터에서 def/async def 혼재) | `backend/routers/` 전반 |
| HIGH | PHOTO/ETCH 프론트엔드 코드 중복 | `frontend/pages/` vs `frontend/pages/etch/` |
| MEDIUM | 불안정한 변수 참조 (`locals()` 검사) | `measurements.py:74` |
| MEDIUM | 운영 환경 console.log 노출 | `api.js:96-109` |
| MEDIUM | import 스타일 불일치 | `main.py` 전반 |

---

## 3. 성능

| 심각도 | 항목 | 위치 | 설명 |
|--------|------|------|------|
| CRITICAL | measurements 페이지네이션 없음 | `measurements.py:34` | 데이터 누적 시 전체 반환 → 메모리/응답 문제 |
| HIGH | DB 커넥션 풀 미설정 | `database.py:9` | pool_size, max_overflow 기본값 |
| HIGH | N+1 쿼리 (벌크 임포트 중복 검사) | `bulk_import.py:249-258` | 행마다 개별 쿼리 |
| HIGH | Eager Loading 미사용 | `crud.py` 전반 | N+1 관계 로딩 가능성 |
| MEDIUM | 프론트엔드 라이브러리 전역 로드 | `index.html` | 미사용 페이지에서도 전체 로드 |

---

## 4. 아키텍처

| 심각도 | 항목 | 설명 |
|--------|------|------|
| HIGH | crud.py 비대화 (1127줄) | 모든 엔티티 CRUD가 단일 파일에 집중 |
| HIGH | 서비스 레이어 불완전 | 일부만 services/ 사용, 나머지는 router → crud 직접 호출 |
| MEDIUM | 설정 관리 이중화 | config.py + config.json + 환경변수 3경로 혼재 |
| MEDIUM | deprecated API 사용 | `declarative_base()` (SQLAlchemy 2.0 경고) |
| LOW | 루트 디렉토리 오염 | `test_change_points.py`, `nul`, `ALTER` 등 불필요 파일 |

---

## 5. 개선 우선순위 로드맵

| 우선순위 | 항목 | 예상 영향도 |
|---------|------|-----------|
| 1 | measurements 페이지네이션 추가 | 성능 즉시 개선 |
| 2 | DB 커넥션 풀 설정 | 안정성 향상 |
| 3 | crud.py 도메인별 분리 | 유지보수성 향상 |
| 4 | PHOTO/ETCH 프론트엔드 통합 | 코드 중복 제거 |
| 5 | console.log 제거 | 운영 환경 정리 |
| 6 | 벌크 임포트 N+1 쿼리 최적화 | 업로드 성능 개선 |
