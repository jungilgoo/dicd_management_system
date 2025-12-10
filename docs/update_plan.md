# 프로그램 업데이트 계획

## 개요
이 문서는 DICD 관리 시스템의 업데이트 계획을 관리합니다.
프로그램 업데이트 작업 시 이 문서를 반드시 참고하고, 진행 상황을 업데이트해야 합니다.

## 현재 진행 중인 업데이트

### 2025-12-10 - ETCH 공정 관리 시스템 추가
- **목적**: PHOTO 공정 관리 시스템과 동일한 기능을 가진 ETCH 공정 관리 시스템 구축
- **상태**: 계획 중
- **작업 내용**:

#### 1. 프론트엔드 구조 설계 (계획 완료)
  - [x] 페이지 구조 결정: 별도 페이지 방식 (index.html, etch_index.html)
  - [x] 페이지 전환 방식: 사이드바 하단에 전환 버튼 추가
  - [ ] ETCH 전용 페이지 생성
    - [ ] `frontend/etch_index.html` (ETCH 메인 페이지)
    - [ ] `frontend/pages/etch/` 디렉토리 생성
    - [ ] ETCH 전용 페이지들 복사 및 수정
  - [ ] 페이지 전환 기능 구현
    - [ ] 사이드바 하단에 공정 전환 버튼 추가
    - [ ] PHOTO ↔ ETCH 페이지 전환 로직
  - [ ] ETCH 전용 JavaScript 모듈 생성

#### 2. 백엔드 데이터베이스 구조 설계 (설계 완료, 하위 호환성 보장)
  - [x] 데이터베이스 설계 방식 결정: **하이브리드 방식**
    - ProductGroup (제품군): 공통 사용
    - Process (공정): 공통 사용
    - Target (타겟): process_type 컬럼 추가 (PHOTO/ETCH 구분)
    - Equipment (장비): process_type 컬럼 추가 (PHOTO/ETCH 구분)
    - Measurement, Spec: Target 연결로 자동 구분
  - [ ] 데이터베이스 마이그레이션 작업 (단계별 진행)
    - [ ] 1단계: Target, Equipment 테이블에 process_type 컬럼 추가 (NULL 허용)
    - [ ] 2단계: 기존 데이터에 process_type='PHOTO' 업데이트
    - [ ] 3단계: NOT NULL 제약 및 기본값 'PHOTO' 설정
    - [ ] 4단계: 인덱스 추가 (targets.process_type, equipments.process_type)
    - [ ] 5단계: 마이그레이션 결과 검증
  - [ ] API 엔드포인트 수정 (하위 호환성 보장: 기본값 'PHOTO')
    - [ ] Target API 수정
      - [ ] GET /api/targets - process_type 쿼리 파라미터 추가 (기본값: 'PHOTO')
      - [ ] POST /api/targets - 스키마에 process_type 필드 추가 (기본값: 'PHOTO')
      - [ ] PUT /api/targets/{id} - 스키마에 process_type 필드 추가
    - [ ] Equipment API 수정
      - [ ] GET /api/equipments - process_type 쿼리 파라미터 추가 (기본값: 'PHOTO')
      - [ ] POST /api/equipments - 스키마에 process_type 필드 추가 (기본값: 'PHOTO')
      - [ ] PUT /api/equipments/{id} - 스키마에 process_type 필드 추가
    - [ ] 연관 API 수정 (자동 필터링)
      - [ ] Measurement: Target 통해 자동 구분 (수정 최소화)
      - [ ] Spec: Target 통해 자동 구분 (수정 최소화)
      - [ ] Statistics: process_type 쿼리 파라미터 추가 (기본값: 'PHOTO')
      - [ ] SPC: process_type 쿼리 파라미터 추가 (기본값: 'PHOTO')
      - [ ] Reports: process_type 쿼리 파라미터 추가 (기본값: 'PHOTO')
      - [ ] Distribution: process_type 쿼리 파라미터 추가 (기본값: 'PHOTO')
      - [ ] BulkUpload: process_type 파라미터 추가 (기본값: 'PHOTO')
      - [ ] ChangePoints: process_type 쿼리 파라미터 추가 (기본값: 'PHOTO')
  - [ ] 모델 및 스키마 수정
    - [ ] models.py: Target, Equipment 클래스 수정
    - [ ] schemas: target.py, equipment.py에 process_type 필드 추가
    - [ ] CRUD 함수에 process_type 필터링 로직 추가 (하위 호환성 보장)
    - [ ] get_targets() - process_type='PHOTO' 기본값 추가
    - [ ] create_target() - process_type='PHOTO' 기본값 추가
    - [ ] update_target() - process_type 파라미터 추가
    - [ ] get_equipments() - process_type='PHOTO' 기본값 추가
    - [ ] create_equipment() - process_type='PHOTO' 기본값 추가
    - [ ] update_equipment() - process_type 파라미터 추가
    - [ ] 기존 코드 호환성: 파라미터 없으면 자동으로 'PHOTO' 처리

#### 3. 프론트엔드 상세 작업 (예정)
  - [ ] ETCH 메인 페이지 구성
    - [ ] `frontend/etch_index.html` 생성 (index.html 복사 후 수정)
    - [ ] 타이틀: "ETCH 공정 관리 시스템"
    - [ ] 사이드바 하단에 "PHOTO 공정으로 전환" 버튼 추가
    - [ ] PR Thickness 관리 메뉴 제거
  - [ ] ETCH 전용 페이지들 생성
    - [ ] `frontend/pages/etch/input.html` - 데이터 입력
    - [ ] `frontend/pages/etch/view.html` - 데이터 조회
    - [ ] `frontend/pages/etch/settings.html` - 설정
    - [ ] `frontend/pages/etch/bulk_upload.html` - 데이터 일괄 업로드
    - [ ] `frontend/pages/etch/change_points.html` - 변경점 관리
    - [ ] `frontend/pages/etch/analysis/` - 분석 페이지들
      - [ ] trend.html - 추이 분석
      - [ ] spc.html - SPC 분석
      - [ ] distribution.html - 분포 분석
      - [ ] boxplot.html - 박스플롯 분석
    - [ ] `frontend/pages/etch/reports/` - 보고서
      - [ ] trend_view.html - 보고서 조회
  - [ ] ETCH 전용 JavaScript 수정
    - [ ] 모든 API 호출에 process_type='ETCH' 파라미터 추가
    - [ ] config.js 또는 별도 etch_config.js 생성
    - [ ] 간섭 방지: 세션 스토리지에 현재 공정 타입 저장
  - [ ] PHOTO 페이지 수정
    - [ ] index.html 사이드바에 "ETCH 공정으로 전환" 버튼 추가
    - [ ] 모든 API 호출에 process_type='PHOTO' 파라미터 명시

#### 4. 백엔드 상세 작업 (예정)
  - [ ] 데이터베이스 마이그레이션 스크립트 작성
    - [ ] `backend/utils/add_process_type.py` 생성
    - [ ] Target 테이블에 process_type 컬럼 추가 (기본값: PHOTO)
    - [ ] Equipment 테이블에 process_type 컬럼 추가 (기본값: PHOTO)
    - [ ] 기존 데이터 process_type='PHOTO' 업데이트
    - [ ] 인덱스 생성: targets.process_type, equipments.process_type
  - [ ] 모델 수정
    - [ ] `backend/database/models.py` 수정
      - [ ] Target 클래스에 process_type 필드 추가
      - [ ] Equipment 클래스에 process_type 필드 추가
  - [ ] 스키마 수정
    - [ ] `backend/schemas/target.py` 수정
    - [ ] `backend/schemas/equipment.py` 수정
    - [ ] process_type 필드 추가 및 검증 (PHOTO/ETCH만 허용)
  - [ ] CRUD 함수 수정
    - [ ] `backend/database/crud.py` 수정
    - [ ] 모든 Target 조회 함수에 process_type 필터 추가
    - [ ] 모든 Equipment 조회 함수에 process_type 필터 추가
    - [ ] 간섭 방지: 필수 파라미터로 process_type 강제
  - [ ] API 라우터 수정
    - [ ] `backend/routers/targets.py` - process_type 쿼리 파라미터 추가
    - [ ] `backend/routers/equipments.py` - process_type 쿼리 파라미터 추가
    - [ ] `backend/routers/measurements.py` - Target 통해 자동 필터링 검증
    - [ ] `backend/routers/specs.py` - Target 통해 자동 필터링 검증
    - [ ] `backend/routers/statistics.py` - process_type 필터링 추가
    - [ ] `backend/routers/spc.py` - process_type 필터링 추가
    - [ ] `backend/routers/reports.py` - process_type 필터링 추가
    - [ ] `backend/routers/distribution.py` - process_type 필터링 추가
    - [ ] `backend/routers/bulk_upload.py` - process_type 파라미터 추가
    - [ ] `backend/routers/change_points.py` - process_type 필터링 추가
  - [ ] 테스트 코드 작성
    - [ ] PHOTO/ETCH 데이터 분리 검증 테스트
    - [ ] API 간섭 방지 테스트

- **관련 파일**:
  - 프론트엔드:
    - `frontend/index.html` (PHOTO - 수정)
    - `frontend/etch_index.html` (ETCH - 신규)
    - `frontend/pages/etch/*` (ETCH 페이지들 - 신규)
    - `frontend/js/tabManager.js` (공통 - 수정 가능)
  - 백엔드: (논의 후 추가)

- **테스트 계획**:
  - 개발 환경에서 기본 기능 테스트
  - GitHub push 후 서버에서 통합 테스트 (사용자 직접 수행)

- **비고**:
  - PHOTO와 UI/UX 완전 동일하게 구성
  - ETCH는 PR Thickness 관리 기능 제외
  - 데이터는 공정별로 완전히 분리
  - 페이지 전환 시 세션 유지 검토 필요

- **🔒 하위 호환성 전략 (핵심)**:
  1. **기존 PHOTO 시스템 보호**:
     - process_type 파라미터를 **Optional**로 설계
     - 기본값을 **'PHOTO'**로 설정
     - 기존 프론트엔드 코드는 **수정 없이** 작동
     - 파라미터 없는 API 호출은 자동으로 PHOTO로 처리

  2. **점진적 마이그레이션**:
     - 데이터베이스: NULL 허용 → 데이터 업데이트 → NOT NULL 제약
     - 백엔드: 기본값 설정 → 필터링 로직 → 검증
     - 프론트엔드: ETCH 페이지만 process_type='ETCH' 명시

  3. **에러 방지**:
     - CRUD 함수: 파라미터 기본값으로 기존 코드 호환
     - API 라우터: Query 파라미터 기본값으로 하위 호환
     - 스키마: Field 기본값으로 생성 시 자동 설정

- **간섭 방지 전략**:
  1. **데이터베이스 레벨**:
     - Target, Equipment 테이블에 process_type 컬럼 추가 (기본값: 'PHOTO')
     - 인덱스 설정으로 조회 성능 확보
     - 복합 인덱스 고려: (process_id, process_type), (type, process_type)
  2. **API 레벨**:
     - 모든 조회 API에 process_type 필터링 적용 (기본값: 'PHOTO')
     - Target/Equipment 생성 시 process_type 자동 설정
     - Measurement는 Target을 통해 자동으로 공정 타입 구분
  3. **프론트엔드 레벨**:
     - 세션 스토리지에 현재 공정 타입 저장 (PHOTO/ETCH)
     - ETCH 페이지만 명시적으로 process_type='ETCH' 전송
     - PHOTO 페이지는 기존대로 파라미터 생략 가능 (자동 PHOTO 처리)

- **작업 우선순위**:
  1. **백엔드 데이터베이스 마이그레이션** (기존 PHOTO 데이터 보호 최우선)
     - 단계별 마이그레이션으로 안전성 확보
     - 각 단계마다 롤백 포인트 설정
  2. **백엔드 모델/스키마 수정** (하위 호환성 보장)
     - 기본값 설정으로 기존 코드 보호
  3. **백엔드 CRUD/API 수정 및 테스트**
     - 기존 PHOTO 시스템 동작 검증 필수
     - 단위 테스트로 하위 호환성 확인
  4. **프론트엔드 ETCH 페이지 생성**
     - PHOTO 페이지 복사 후 수정
  5. **프론트엔드 공정 전환 기능 구현**
     - 사이드바 전환 버튼 추가
  6. **통합 테스트**
     - PHOTO 시스템 정상 동작 확인 (최우선)
     - ETCH 시스템 기능 확인
     - PHOTO/ETCH 간섭 없음 검증
     - 데이터 분리 검증

- **⚠️ 위험 요소 및 대응**:
  1. **기존 PHOTO 시스템 중단 위험**
     - 대응: 하위 호환성 철저히 보장 (기본값 'PHOTO')
     - 검증: 마이그레이션 후 PHOTO 시스템 즉시 테스트
  2. **데이터 혼재 위험**
     - 대응: API 레벨에서 필터링 강제 적용
     - 검증: PHOTO/ETCH 데이터 분리 쿼리 테스트
  3. **마이그레이션 실패 위험**
     - 대응: 단계별 진행 및 각 단계 검증
     - 백업: 마이그레이션 전 데이터베이스 백업 필수

## 🔄 단계별 구현 순서 (테스트 기반)

각 Phase마다 GitHub push → 서버 테스트 → 문제 없으면 다음 Phase 진행

### **Phase 1: 데이터베이스 마이그레이션** (기반 작업) - ✅ 완료
**목표**: DB 구조 변경 및 기존 PHOTO 시스템 정상 동작 확인

1. **마이그레이션 스크립트 작성** ✅ 완료
   - `backend/utils/add_process_type.py` 생성 완료
   - 5단계 마이그레이션 로직 구현 완료
     - 1단계: process_type 컬럼 추가 (NULL 허용)
     - 2단계: 기존 데이터 업데이트 (process_type='PHOTO')
     - 3단계: NOT NULL 제약 및 기본값 설정
     - 4단계: 인덱스 추가
     - 5단계: 검증

2. **마이그레이션 실행** ✅ 완료
   - 서버에서 백업 완료
   - 마이그레이션 성공적으로 완료
   - 모든 검증 통과

3. **테스트 항목** ✅ 모두 통과
   - ✅ 기존 Target 데이터 조회 가능
   - ✅ 기존 Equipment 데이터 조회 가능
   - ✅ 기존 Measurement 데이터 조회 가능
   - ✅ process_type 컬럼이 'PHOTO'로 설정됨
   - ✅ PHOTO 시스템 모든 기능 정상 동작
   - ✅ 대시보드 접속 가능
   - ✅ 타겟 추가/수정/삭제 정상
   - ✅ 장비 관리 정상
   - ✅ 데이터 입력/조회/검색/필터링 정상
   - ✅ 추이 분석/SPC 분석 정상
   - ✅ 에러 없음

4. **완료 조건** ✅ 충족
   - 서버에서 PHOTO 시스템 완전히 정상 동작 확인
   - 데이터베이스 백업 완료
   - **Phase 1 완료! (2024-12-10)**

---

### **Phase 2: 백엔드 모델 및 스키마 수정** (구조 변경) - ✅ 완료
**목표**: 코드 레벨 process_type 지원 및 하위 호환성 검증

1. **모델 수정** ✅ 완료
   - `backend/database/models.py`
   - Target 클래스에 process_type 필드 추가 (String(20), server_default='PHOTO', index=True)
   - Equipment 클래스에 process_type 필드 추가 (String(20), server_default='PHOTO', index=True)

2. **스키마 수정** ✅ 완료
   - `backend/schemas/target.py` - process_type 필드 추가 (기본값: 'PHOTO')
   - `backend/schemas/equipment.py` - process_type 필드 추가 (기본값: 'PHOTO')

3. **테스트 항목** ✅ 모두 통과
   - ✅ 서버 재시작 성공
   - ✅ API 문서 (/docs) 정상 로드
   - ✅ API 스키마에 process_type 필드 확인 (Target, Equipment)
   - ✅ PHOTO 시스템 모든 기능 정상 동작
   - ✅ 기존 API 호출 (process_type 없이) 정상 작동
   - ✅ 대시보드, 타겟 관리, 장비 관리 정상
   - ✅ 데이터 입력/조회/분석 정상
   - ✅ 에러 없음

4. **완료 조건** ✅ 충족
   - 코드 수정 완료
   - GitHub push 완료
   - 서버 배포 및 테스트 완료
   - **Phase 2 완료! (2024-12-10)**

---

### **Phase 3: CRUD 함수 수정** (데이터 접근 로직) - ✅ 완료
**목표**: process_type 필터링 로직 추가 및 하위 호환성 유지

1. **Target CRUD 수정** ✅ 완료
   - `get_targets()` - process_type='PHOTO' 기본값 추가
   - `create_target()` - process_type 필드 추가
   - `update_target()` - process_type 업데이트 추가

2. **Equipment CRUD 수정** ✅ 완료
   - `get_equipments()` - process_type='PHOTO' 기본값 추가
   - `create_equipment()` - process_type 필드 추가
   - `update_equipment()` - process_type 업데이트 추가

3. **Measurement CRUD 수정** ✅ 완료
   - `get_measurements()` - process_type='PHOTO' 기본값 추가 (Target과 조인하여 필터링)

4. **테스트 항목** ✅ 모두 통과
   - ✅ 기존 PHOTO Target 조회 정상 (54개 타겟 전부 process_type='PHOTO' 확인)
   - ✅ 기존 PHOTO Equipment 조회 정상
   - ✅ Target 생성 시 자동으로 process_type='PHOTO' 설정 (id: 53, 54 확인)
   - ✅ Equipment 생성 시 자동으로 process_type='PHOTO' 설정
   - ✅ PHOTO 시스템 모든 CRUD 작업 정상
   - ✅ 대시보드, 타겟 관리, 장비 관리, 데이터 입력/조회 정상
   - ✅ 에러 없음

5. **완료 조건** ✅ 충족
   - 코드 수정 완료 ✅
   - GitHub push 완료 ✅ (커밋: b472e08)
   - 서버 배포 및 테스트 완료 ✅
   - **Phase 3 완료! (2024-12-10)**

---

### **Phase 4: Target API 수정** (API 레이어 - 1단계) - ✅ 완료
**목표**: Target 관련 API에 process_type 지원 추가

1. **API 라우터 수정** ✅ 완료
   - `backend/routers/targets.py` 수정 완료
   - Query, Optional import 추가
   - GET /api/targets - process_type 쿼리 파라미터 추가 (기본값: 'PHOTO')
   - POST /api/targets - 스키마 기본값으로 process_type 자동 지원
   - PUT /api/targets/{id} - 스키마 기본값으로 process_type 자동 지원

2. **테스트 항목** (대기중 - 서버 배포 후 테스트 예정)
   - ⏳ GET /api/targets (파라미터 없음) → PHOTO 타겟만 조회
   - ⏳ GET /api/targets?process_type=PHOTO → PHOTO 타겟 조회
   - ⏳ POST /api/targets (process_type 없음) → PHOTO로 생성
   - ⏳ PHOTO 시스템 타겟 관련 기능 모두 정상

3. **완료 조건**
   - 코드 수정 완료 ✅
   - GitHub push 필요 ⏳
   - 서버 배포 및 테스트 필요 ⏳
   - **코드 수정 완료! (2024-12-10)** - 서버 테스트 대기

---

### **Phase 5: Equipment API 수정** (API 레이어 - 2단계)
**목표**: Equipment 관련 API에 process_type 지원 추가

1. **API 라우터 수정**
   - `backend/routers/equipments.py`
   - GET /api/equipments - process_type 쿼리 파라미터 (기본값: 'PHOTO')
   - POST /api/equipments - process_type 필드 지원
   - PUT /api/equipments/{id} - process_type 필드 지원

2. **테스트 항목**
   - ✅ GET /api/equipments (파라미터 없음) → PHOTO 장비만 조회
   - ✅ GET /api/equipments?type=코팅 → PHOTO 코팅 장비 조회
   - ✅ POST /api/equipments (process_type 없음) → PHOTO로 생성
   - ✅ PHOTO 시스템 장비 관련 기능 모두 정상

3. **완료 조건**
   - 서버에서 PHOTO 장비 관리 완전히 정상
   - process_type 파라미터 동작 검증

---

### **Phase 6: 연관 API 수정** (API 레이어 - 3단계)
**목표**: 분석/보고서 등 연관 API에 process_type 지원 추가

1. **API 라우터 수정**
   - `backend/routers/statistics.py` - process_type 파라미터 추가
   - `backend/routers/spc.py` - process_type 파라미터 추가
   - `backend/routers/reports.py` - process_type 파라미터 추가
   - `backend/routers/distribution.py` - process_type 파라미터 추가
   - `backend/routers/bulk_upload.py` - process_type 파라미터 추가
   - `backend/routers/change_points.py` - process_type 파라미터 추가

2. **테스트 항목**
   - ✅ PHOTO 추이 분석 정상
   - ✅ PHOTO SPC 분석 정상
   - ✅ PHOTO 보고서 생성 정상
   - ✅ PHOTO 데이터 업로드 정상
   - ✅ 모든 분석 기능이 PHOTO 데이터만 처리

3. **완료 조건**
   - 서버에서 PHOTO 시스템 모든 분석 기능 정상
   - **백엔드 작업 완료**

---

### **Phase 7: ETCH 첫 타겟/장비 생성 테스트** (데이터 검증)
**목표**: ETCH 데이터 생성 가능 여부 및 PHOTO와의 분리 검증

1. **Postman/curl 테스트**
   - POST /api/targets - process_type='ETCH'로 타겟 생성
   - POST /api/equipments - process_type='ETCH'로 장비 생성
   - GET /api/targets?process_type=ETCH - ETCH 타겟만 조회 확인

2. **테스트 항목**
   - ✅ ETCH 타겟 생성 성공
   - ✅ ETCH 장비 생성 성공
   - ✅ GET /api/targets (파라미터 없음) → PHOTO만 조회 (ETCH 안보임)
   - ✅ GET /api/targets?process_type=PHOTO → PHOTO만 조회
   - ✅ GET /api/targets?process_type=ETCH → ETCH만 조회
   - ✅ PHOTO/ETCH 데이터 완전 분리 확인

3. **완료 조건**
   - PHOTO/ETCH 데이터 분리 검증 완료
   - 간섭 없음 확인
   - **프론트엔드 작업 시작 가능**

---

### **Phase 8: ETCH 메인 페이지 구성** (프론트엔드 - 1단계)
**목표**: ETCH 시스템 기본 구조 생성 및 페이지 접근 확인

1. **파일 생성**
   - `frontend/etch_index.html` (index.html 복사 후 수정)
   - 타이틀 변경: "ETCH 공정 관리 시스템"
   - PR Thickness 메뉴 제거
   - "PHOTO 공정으로 전환" 버튼 추가 (링크만, 기능은 나중에)

2. **테스트 항목**
   - ✅ http://server/etch_index.html 접근 가능
   - ✅ 페이지 레이아웃 정상 표시
   - ✅ 사이드바 메뉴 표시
   - ✅ 대시보드 로딩 (빈 상태 또는 에러는 OK)

3. **완료 조건**
   - ETCH 메인 페이지 접근 가능
   - 기본 구조 정상 표시

---

### **Phase 9: ETCH 설정 페이지** (프론트엔드 - 2단계)
**목표**: ETCH 타겟/장비 설정 기능 구현

1. **파일 생성**
   - `frontend/pages/etch/settings.html`
   - API 호출에 process_type='ETCH' 추가

2. **테스트 항목**
   - ✅ ETCH 타겟 생성/수정/삭제
   - ✅ ETCH 장비 생성/수정/삭제
   - ✅ PHOTO 데이터와 섞이지 않음 확인

3. **완료 조건**
   - ETCH 기본 설정 가능
   - PHOTO 시스템 정상 동작 확인

---

### **Phase 10: ETCH 데이터 입력 페이지** (프론트엔드 - 3단계)
**목표**: ETCH 측정 데이터 입력 기능 구현

1. **파일 생성**
   - `frontend/pages/etch/input.html`

2. **테스트 항목**
   - ✅ ETCH 타겟 선택 목록에 ETCH 타겟만 표시
   - ✅ ETCH 장비 선택 목록에 ETCH 장비만 표시
   - ✅ 측정 데이터 입력 성공
   - ✅ PHOTO 데이터와 섞이지 않음

3. **완료 조건**
   - ETCH 데이터 입력 가능

---

### **Phase 11: ETCH 데이터 조회 페이지** (프론트엔드 - 4단계)
**목표**: ETCH 측정 데이터 조회/수정/삭제 기능 구현

1. **파일 생성**
   - `frontend/pages/etch/view.html`

2. **테스트 항목**
   - ✅ ETCH 측정 데이터만 조회
   - ✅ 데이터 수정/삭제 가능
   - ✅ PHOTO 데이터 안보임

3. **완료 조건**
   - ETCH 데이터 관리 가능

---

### **Phase 12: ETCH 분석 페이지들** (프론트엔드 - 5단계)
**목표**: ETCH 데이터 분석 기능 구현

1. **파일 생성**
   - `frontend/pages/etch/analysis/trend.html`
   - `frontend/pages/etch/analysis/spc.html`
   - `frontend/pages/etch/analysis/distribution.html`
   - `frontend/pages/etch/analysis/boxplot.html`

2. **테스트 항목**
   - ✅ 각 분석 차트가 ETCH 데이터만 표시
   - ✅ 모든 분석 기능 정상 동작

3. **완료 조건**
   - ETCH 분석 기능 완료

---

### **Phase 13: ETCH 추가 기능들** (프론트엔드 - 6단계)
**목표**: 나머지 기능 구현

1. **파일 생성**
   - `frontend/pages/etch/bulk_upload.html`
   - `frontend/pages/etch/change_points.html`
   - `frontend/pages/etch/reports/trend_view.html`

2. **테스트 항목**
   - ✅ 일괄 업로드 ETCH로 동작
   - ✅ 변경점 관리 ETCH 데이터 처리
   - ✅ 보고서 ETCH 데이터 처리

3. **완료 조건**
   - ETCH 모든 기능 구현 완료

---

### **Phase 14: 공정 전환 기능** (프론트엔드 - 최종)
**목표**: PHOTO ↔ ETCH 페이지 전환 기능 구현

1. **파일 수정**
   - `frontend/index.html` - "ETCH 공정으로 전환" 버튼 기능 활성화
   - `frontend/etch_index.html` - "PHOTO 공정으로 전환" 버튼 기능 활성화

2. **테스트 항목**
   - ✅ PHOTO → ETCH 전환 동작
   - ✅ ETCH → PHOTO 전환 동작
   - ✅ 각 시스템 독립적으로 동작

3. **완료 조건**
   - 전환 기능 완료
   - **전체 개발 완료**

---

### **Phase 15: 최종 통합 테스트** (검증)
**목표**: 전체 시스템 안정성 확인

1. **PHOTO 시스템 전체 검증**
   - 모든 기능 정상 동작
   - 성능 저하 없음

2. **ETCH 시스템 전체 검증**
   - 모든 기능 정상 동작

3. **간섭 테스트**
   - PHOTO/ETCH 데이터 완전 분리
   - 동시 사용 시 문제 없음

4. **완료 조건**
   - **프로젝트 완료**

## 예정된 업데이트

### [날짜] - [업데이트 제목]
- **목적**:
- **우선순위**: 높음 / 중간 / 낮음
- **예상 작업**:
  -

## 완료된 업데이트

### [날짜] - [업데이트 제목]
- **완료일**:
- **작업 내용**:
  -
- **결과**:
  -
- **배포 상태**: GitHub push 완료 / 서버 배포 완료
