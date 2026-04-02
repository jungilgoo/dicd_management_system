# SPC 이상치 감지 모니터링 기능 구현 계획

## Context

DICD 측정 관리 시스템에 실시간 SPC 알람 기능을 추가한다. 현재 SPC 분석은 사용자가 수동으로 요청해야만 실행되며, 알람/알림 시스템이 없다. 측정 데이터 입력 시점에 자동으로 이상치를 판정하고, 3계층 알람으로 기록하는 체계를 구축한다.

---

## 기존 코드베이스 핵심 현황

| 항목 | 현재 상태 | 변경 필요 |
|------|----------|----------|
| 서브그룹 | 측정 1건 = 서브그룹 1개 (5위치값) | 변경 없음 |
| X-bar / R | Measurement.avg_value / range_value에 이미 저장 | 별도 테이블 불필요 |
| Nelson Rules | spc.py에 8개 전부 구현됨 | Rule 1,2,3만 사용하도록 분리 |
| R차트 관리한계 | 프론트엔드 JS에서만 계산 (d2=2.326, d3=0.864) | 백엔드에 추가 필요 |
| 스펙 초과 | 판정 로직 없음 | 신규 추가 |
| 알람 시스템 | 없음 | 신규 추가 |
| 측정 수정 이력 | 없음 | 신규 추가 |
| 캐시 | 없음 | DB 인덱스로 대체 (아래 설명) |

### 캐시 대신 DB 인덱스를 제안하는 이유

Nelson Rule 윈도우는 최대 9개 포인트(Rule 2). `target_id + created_at` 인덱스가 이미 있으므로, 최근 9건 쿼리는 인덱스 스캔으로 충분히 빠르다 (< 1ms). Redis/메모리 캐시를 도입하면 캐시 무효화 로직(수정/삭제 시)이 추가되어 복잡도만 증가한다.

### SubgroupResult 별도 테이블 대신 SpcAlarm에 판정 스냅샷을 포함하는 이유

요구사항에서 "서브그룹 계산결과 테이블 분리"를 요청했으나, 현재 구조에서 **Measurement 자체가 서브그룹**이고 X-bar(avg_value), R(range_value)이 이미 저장되어 있다. 별도 테이블은 데이터 중복만 야기한다. 대신 **SpcAlarm 테이블에 판정 시점의 관리한계 스냅샷**을 포함시켜 감사 추적성을 확보한다.

---

## Phase 1: DB 모델 추가

### 1-1. SpcAlarm 테이블 (신규)

**파일**: `backend/database/models.py`

```
class SpcAlarm(Base):
    __tablename__ = "spc_alarms"

    id              = Integer, PK
    measurement_id  = FK → measurements.id, NOT NULL, INDEX
    target_id       = FK → targets.id, NOT NULL, INDEX
    alarm_type      = String(20)   # 'SPEC', 'XBAR', 'R_CHART', 'NELSON'
    severity        = String(10)   # 'CRITICAL', 'WARNING', 'INFO'
    rule_number     = Integer, NULL # Nelson Rule 번호 (1,2,3) 또는 NULL
    description     = Text         # 판정 상세 내용
    
    # 판정 시점 스냅샷 (감사 추적용)
    value           = Float        # 판정 대상 값 (avg_value 또는 range_value 또는 개별값)
    cl_snapshot     = Float, NULL  # 판정 시점 CL
    ucl_snapshot    = Float, NULL  # 판정 시점 UCL  
    lcl_snapshot    = Float, NULL  # 판정 시점 LCL
    spec_usl        = Float, NULL  # 판정 시점 USL
    spec_lsl        = Float, NULL  # 판정 시점 LSL
    
    # 상태 관리 (삭제 금지, 상태 변경만 허용)
    status          = String(20), default='ACTIVE'  # ACTIVE, ACKNOWLEDGED, RESOLVED
    acknowledged_by = String(100), NULL
    acknowledged_at = DateTime, NULL
    resolved_by     = String(100), NULL
    resolved_at     = DateTime, NULL
    
    created_at      = DateTime, server_default=now()
    updated_at      = DateTime, onupdate=now()
```

**인덱스**: `(target_id, created_at)`, `(measurement_id)`, `(severity, status)`

### 1-2. MeasurementChangeHistory 테이블 (신규)

**파일**: `backend/database/models.py`

```
class MeasurementChangeHistory(Base):
    __tablename__ = "measurement_change_history"

    id              = Integer, PK
    measurement_id  = FK → measurements.id, NOT NULL, INDEX
    change_type     = String(20)   # 'UPDATE', 'DELETE'
    
    # 변경 전 값 스냅샷
    before_values   = Text         # JSON: {value_top, center, bottom, left, right, avg, range, std_dev}
    after_values    = Text, NULL   # JSON (DELETE 시 NULL)
    
    changed_by      = String(100), NOT NULL
    reason          = String(500), NULL
    created_at      = DateTime, server_default=now()
```

### 1-3. DB 마이그레이션

**파일**: `backend/utils/create_spc_alarm_tables.py` (신규 유틸리티)

- 기존 패턴(`recreate_tables.py`)을 따라 테이블 생성 스크립트 작성
- `Base.metadata.create_all()`로 신규 테이블만 추가 (기존 테이블 영향 없음)

---

## Phase 2: 백엔드 판정 서비스

### 2-1. 알람 판정 서비스 (신규)

**파일**: `backend/services/spc_alarm.py` (신규)

핵심 함수:

#### `evaluate_measurement_alarms(db, measurement_id) → List[SpcAlarm]`
- 측정 생성/수정 후 호출되는 메인 함수
- 내부에서 아래 3개 판정을 순차 실행
- 생성된 알람 레코드 목록 반환

#### `_check_spec_exceedance(db, measurement, spec) → List[SpcAlarm]`
- 개별 측정값 5개(top/center/bottom/left/right) 각각에 대해 USL/LSL 초과 확인
- avg_value에 대해서도 확인
- **Severity**: CRITICAL

#### `_check_r_chart(db, measurement, target_id) → List[SpcAlarm]`
- 해당 target의 최근 N건 측정값의 range_value로 R_bar 계산
- R_UCL = R_bar × D4 (서브그룹 크기 5: D4 = 2.114)
- R_LCL = R_bar × D3 (서브그룹 크기 5: D3 = 0)
- 현재 measurement의 range_value가 R_UCL 초과 시 알람
- **Severity**: CRITICAL
- **참고**: D3/D4 상수 사용이 d2/d3보다 표준적. 프론트엔드의 d2/d3 방식도 수학적으로 동치이나, 백엔드는 D3/D4 상수표를 사용하여 정확도 확보

#### `_check_nelson_rules(db, measurement, target_id) → List[SpcAlarm]`
- 최근 9건 측정의 avg_value를 조회 (Rule 2의 윈도우)
- Spec의 UCL/LCL로 관리한계 설정 (없으면 데이터 기반 계산)
- Nelson Rule 1: 3σ 이탈 → CRITICAL
- Nelson Rule 2: 9점 연속 같은 쪽 → WARNING
- Nelson Rule 3: 6점 연속 증감 → WARNING
- **기존 `detect_nelson_rules()` 재사용**: spc.py의 함수를 Rule 필터링하여 호출

#### `_get_recent_measurements(db, target_id, count=9) → List[Measurement]`
- target_id + created_at DESC 인덱스 활용
- 최근 N건 조회 (Nelson Rule 윈도우)

### 2-2. 수정 시 재판정 로직

**파일**: `backend/services/spc_alarm.py`

#### `reevaluate_after_edit(db, measurement_id) → None`
1. 수정된 measurement의 target_id 확인
2. 해당 measurement 기준 앞뒤 8건(Nelson Rule 2 윈도우) 조회 → 최대 17건
3. 이 범위에 속하는 모든 measurement에 대해:
   - 기존 알람의 status를 'SUPERSEDED'로 변경 (삭제하지 않음)
   - `evaluate_measurement_alarms()` 재실행하여 새 알람 생성
4. MeasurementChangeHistory 기록

### 2-3. R차트 관리한계 상수

**파일**: `backend/services/spc_alarm.py` 상단에 상수 정의

```python
# X-bar R 관리도 상수표 (서브그룹 크기별)
CONTROL_CHART_CONSTANTS = {
    5: {"A2": 0.577, "D3": 0, "D4": 2.114, "d2": 2.326}
}
SUBGROUP_SIZE = 5
```

---

## Phase 3: CRUD 통합

### 3-1. create_measurement 수정

**파일**: `backend/database/crud.py` (153행 부근)

현재 `create_measurement()` 끝에 알람 판정 호출 추가:

```
# 기존 코드 끝 (db.refresh 이후)
from ..services.spc_alarm import evaluate_measurement_alarms
alarms = evaluate_measurement_alarms(db, db_measurement.id)
# 알람 결과를 measurement 응답에 포함하지 않음 (별도 API로 조회)
return db_measurement
```

### 3-2. update_measurement 수정

**파일**: `backend/database/crud.py` (257행 부근)

수정 전 스냅샷 저장 + 수정 후 재판정 호출 추가:

```
# 수정 전: MeasurementChangeHistory에 before 스냅샷 저장
# 수정 후: reevaluate_after_edit(db, measurement_id) 호출
```

---

## Phase 4: API 엔드포인트

### 4-1. 알람 라우터 (신규)

**파일**: `backend/routers/spc_alarms.py` (신규)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/spc-alarms/` | 알람 목록 조회 (필터: target_id, severity, status, date_range) |
| GET | `/api/spc-alarms/{alarm_id}` | 알람 상세 조회 |
| PATCH | `/api/spc-alarms/{alarm_id}/acknowledge` | 알람 확인 처리 |
| PATCH | `/api/spc-alarms/{alarm_id}/resolve` | 알람 해결 처리 |
| GET | `/api/spc-alarms/summary` | 대시보드용 알람 요약 (severity별 건수) |

### 4-2. main.py 라우터 등록

**파일**: `backend/main.py` (80행 부근)

```
app.include_router(spc_alarms_router.router)
```

---

## Phase 5: 프론트엔드 알람 표시

### 5-1. 대시보드 상단 알람 요약 바

**파일**: `frontend/index.html`, `frontend/etch_index.html` (CPK 히트맵 카드 위에 삽입)
**파일**: `frontend/js/dashboard.js` (알람 로드/렌더 로직 추가)

히트맵은 수정하지 않음. CPK 히트맵 카드 **바로 위**에 알람 요약 바를 추가.

**레이아웃**:
```
┌─ ⚠️ 활성 알람 ────────────────────────────────────────────────────┐
│                                                                    │
│  🔴 Critical 2건   🟠 Warning 5건                                  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  시간     │ 타겟        │ 유형          │ 내용             │    │
│  │  3분전   │ Target A    │ 스펙 초과     │ USL 5.0 → 5.3   │    │
│  │  12분전  │ Target B    │ R차트 UCL     │ R=0.45 > 0.38   │    │
│  │  1시간전 │ Target A    │ Nelson Rule 2 │ 9점 연속 상측    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                     [전체보기 →]   │
└────────────────────────────────────────────────────────────────────┘
```

**동작 규칙**:
- 활성 알람 0건 → 바 완전 숨김 (대시보드 레이아웃 변화 없음)
- Critical 존재 → 바 배경 `bg-danger` 계열 (연한 빨강)
- Warning만 존재 → 바 배경 `bg-warning` 계열 (연한 주황)
- 최근 Critical/Warning 최대 5건만 간략 테이블로 표시
- "전체보기" 클릭 → 알람 관리 페이지 탭 열기 (`tabManager.openTab()`)
- 대시보드 진입 시 `/api/spc-alarms/summary` + `/api/spc-alarms/?status=ACTIVE&limit=5` 호출
- AdminLTE `card` 컴포넌트 사용 (접기/펼치기 지원)

### 5-2. 사이드바 알람 배지

**파일**: `frontend/index.html`, `frontend/etch_index.html` (사이드바 메뉴)
**파일**: `frontend/js/dashboard.js`

사이드바 "대시보드" 메뉴 항목에 빨간 숫자 배지 추가:
```html
<a href="#" class="nav-link" onclick="openTab('dashboard')">
  <i class="nav-icon fas fa-tachometer-alt"></i>
  <p>대시보드 <span class="badge badge-danger right" id="alarm-badge" style="display:none">0</span></p>
</a>
```
- Active Critical 건수 표시
- 0건이면 `display:none`
- 다른 탭에서 작업 중에도 알람 발생을 인지 가능
- 주기적 갱신: 대시보드 탭 활성화 시 또는 60초 간격 폴링

### 5-3. SPC 차트 페이지 알람 연동

**파일**: `frontend/js/spc.js`
- 차트에 알람 포인트 마커 표시 (빨강=Critical, 주황=Warning)
- 알람 이력 테이블 추가

### 5-4. 알람 관리 페이지 (신규)

**파일**: `frontend/pages/alarms/spc_alarms.html` (신규)
**파일**: `frontend/js/spc_alarms.js` (신규)

- 알람 목록 테이블 (필터: severity, status, target, 기간)
- 확인(Acknowledge) / 해결(Resolve) 버튼
- 알람 상세 정보 모달 (판정 시점 스냅샷 값 표시)
- 기존 AdminLTE 테이블 + 배지 패턴 재사용

---

## 수정 대상 파일 요약

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `backend/database/models.py` | 수정 | SpcAlarm, MeasurementChangeHistory 모델 추가 |
| `backend/schemas/spc_alarm.py` | **신규** | 알람 Pydantic 스키마 |
| `backend/services/spc_alarm.py` | **신규** | 알람 판정 서비스 (핵심 로직) |
| `backend/routers/spc_alarms.py` | **신규** | 알람 API 엔드포인트 |
| `backend/database/crud.py` | 수정 | create/update_measurement에 알람 호출 추가 |
| `backend/main.py` | 수정 | 라우터 등록 1줄 추가 |
| `backend/utils/create_spc_alarm_tables.py` | **신규** | DB 마이그레이션 스크립트 |
| `frontend/index.html` | 수정 | 알람 요약 바 HTML + 사이드바 배지 추가 |
| `frontend/etch_index.html` | 수정 | 동일 (ETCH 버전) |
| `frontend/js/dashboard.js` | 수정 | 알람 요약 로드/렌더 + 배지 갱신 로직 |
| `frontend/pages/alarms/spc_alarms.html` | **신규** | 알람 관리 페이지 |
| `frontend/js/spc_alarms.js` | **신규** | 알람 페이지 JS |
| `frontend/js/spc.js` | 수정 | 차트에 알람 마커 추가 |
| `frontend/js/api.js` | 수정 | 알람 API 함수 추가 |

---

## 구현 순서

0. **Phase 0**: 이 계획서를 `docs/spc_alarm_plan.md`로 저장
1. **Phase 1**: DB 모델 + 마이그레이션 (models.py, 스크립트)
2. **Phase 2**: 판정 서비스 (spc_alarm.py) — 핵심 로직
3. **Phase 3**: CRUD 통합 (crud.py 수정)
4. **Phase 4**: API 엔드포인트 (라우터, 스키마)
5. **Phase 5**: 프론트엔드 (알람 페이지, SPC 차트 연동)

---

## 검증 방법

1. **단위 테스트**: spc_alarm.py의 각 판정 함수에 대해 경계값 테스트
   - Spec 초과: USL 정확히 일치 / 초과 / 미만
   - R차트: R_UCL 경계값
   - Nelson Rule 1: 3σ 경계
   - Nelson Rule 2: 8점 같은쪽(미감지) vs 9점(감지)
   - Nelson Rule 3: 5점 증가(미감지) vs 6점(감지)
2. **통합 테스트**: 측정 생성 → 알람 자동 생성 확인
3. **수정 재판정 테스트**: 측정 수정 → 기존 알람 SUPERSEDED + 새 알람 생성 확인
4. **API 테스트**: 알람 조회/확인/해결 API 동작 확인
5. **프론트엔드**: SPC 차트에서 알람 포인트 시각적 확인
