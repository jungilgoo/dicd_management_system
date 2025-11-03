# 탭 시스템 사용 가이드

## 📋 개요

DICD 관리 시스템에 탭 기반 멀티 페이지 시스템이 추가되었습니다.

### 주요 기능
- ✅ **탭 중복 허용**: 같은 분석 도구를 다른 설정으로 여러 개 열 수 있음
- ✅ **최대 10개 탭**: 메모리 및 성능 최적화
- ✅ **탭 자동저장 없음**: 매번 새로 시작 (사용자 요구사항)
- ✅ **Dashboard 탭 고정**: 항상 첫 번째 탭, 닫기 불가
- ✅ **탭별 독립적 설정**: 각 탭은 자신만의 설정 유지

---

## 🎯 사용 방법

### 1. 탭 열기
사이드바에서 원하는 메뉴를 클릭하면 새 탭이 생성됩니다.

```
사이드바 > 데이터 분석 > SPC 분석 클릭
→ [Dashboard] [SPC 분석 ×] 탭 생성
```

### 2. 탭 닫기
탭 이름 옆의 `×` 버튼을 클릭하면 탭이 닫힙니다.

```
[SPC 분석 ×] ← × 클릭
→ 탭 제거
```

### 3. 탭 전환
탭 이름을 클릭하면 해당 탭으로 전환됩니다.

```
[Dashboard] [SPC ×] [Trend ×]
           ↑ 클릭
→ SPC 분석 탭 활성화
```

### 4. 중복 탭 생성
같은 메뉴를 다시 클릭하면 새 탭이 추가됩니다.

```
사이드바 > SPC 분석 클릭 (2회)
→ [Dashboard] [SPC #1 ×] [SPC #2 ×]
```

---

## 🔧 구현 세부사항

### 파일 구조

```
frontend/
├── index.html                      # 메인 레이아웃 (탭 시스템 통합)
├── js/
│   ├── tabManager.js               # 탭 관리 핵심 로직
│   └── tabSettings.js              # 탭별 설정 저장/복원 유틸리티
└── css/
    └── style.css                   # 탭 시스템 스타일
```

### 주요 컴포넌트

#### 1. TabManager (`js/tabManager.js`)

탭 생성, 삭제, 활성화를 관리하는 핵심 모듈입니다.

**Public API:**
```javascript
// 탭 열기
TabManager.openTab('spc', { targetId: 123, days: 30 });

// 탭 닫기
TabManager.closeTab('spc-1');

// 탭 활성화
TabManager.activateTab('dashboard');

// 현재 활성 탭 가져오기
const activeTab = TabManager.getActiveTab();

// 모든 탭 가져오기
const allTabs = TabManager.getAllTabs();

// 탭 설정 업데이트
TabManager.updateTabSettings('spc-1', { targetId: 456 });
```

**지원하는 탭 타입:**
- `dashboard` - 대시보드 (고정)
- `input` - 데이터 입력
- `view` - 데이터 조회
- `trend` - 추이 분석
- `spc` - SPC 분석
- `distribution` - 분포 분석
- `boxplot` - 박스플롯 분석
- `reports` - 보고서 조회
- `settings` - 설정
- `bulk_upload` - 데이터 일괄 업로드
- `pr_thickness` - PR Thickness 관리
- `change_points` - 변경점 관리

#### 2. TabSettings (`js/tabSettings.js`)

각 분석 페이지(iframe 내부)에서 사용할 설정 저장/복원 유틸리티입니다.

**Public API:**
```javascript
// 설정 저장
TabSettings.save({
    productGroupId: 5,
    processId: 12,
    targetId: 45,
    dateRange: 30
});

// 설정 복원
const settings = TabSettings.restore();

// 설정 삭제
TabSettings.clear();

// 자동 저장 설정
TabSettings.autoSave({
    productGroupId: '#product-group',
    processId: '#process',
    targetId: '#target',
    dateRange: '#date-range'
});

// 자동 복원 설정
TabSettings.autoRestore({
    productGroupId: '#product-group',
    processId: '#process',
    targetId: '#target',
    dateRange: '#date-range'
}, function(settings) {
    // 복원 완료 후 실행할 로직
    loadAnalysisData(settings.targetId, settings.dateRange);
});
```

---

## 📝 분석 페이지 통합 가이드

기존 분석 페이지에 설정 저장/복원 기능을 추가하려면 다음 단계를 따르세요.

### 1단계: 스크립트 추가

분석 페이지 HTML에 `tabSettings.js`를 추가합니다.

```html
<!-- 기존 스크립트들 -->
<script src="../../js/config.js"></script>
<script src="../../js/api.js"></script>

<!-- 탭 설정 유틸리티 추가 -->
<script src="../../js/tabSettings.js"></script>

<!-- 페이지별 스크립트 -->
<script src="../../js/spc.js"></script>
```

### 2단계: 자동 저장 설정

페이지 초기화 함수에서 자동 저장을 활성화합니다.

```javascript
function initPage() {
    // 기존 초기화 로직...

    // 탭 설정 자동 저장
    TabSettings.autoSave({
        productGroupId: '#product-group',
        processId: '#process',
        targetId: '#target',
        dateRange: '#date-range'
    });
}
```

### 3단계: 자동 복원 설정

페이지 로드 시 설정을 복원합니다.

```javascript
$(document).ready(function() {
    // 제품군 목록 로드 후
    await fetchProductGroups();

    // 탭 설정 자동 복원
    TabSettings.autoRestore({
        productGroupId: '#product-group',
        processId: '#process',
        targetId: '#target',
        dateRange: '#date-range'
    }, function(settings) {
        if (settings && settings.targetId) {
            // 설정이 복원되면 자동으로 데이터 로드
            loadAnalysisData(settings.targetId, settings.dateRange);
        }
    });
});
```

### 완전한 예시 (SPC 분석)

```javascript
// spc.js 수정 예시

async function initSpcPage() {
    // 제품군 목록 로드
    await fetchProductGroups();

    // 탭 설정 자동 저장 활성화
    TabSettings.autoSave({
        productGroupId: '#product-group',
        processId: '#process',
        targetId: '#target',
        days: '#days-select'
    });

    // 탭 설정 복원
    const savedSettings = TabSettings.restore();

    if (savedSettings && savedSettings.targetId) {
        // 저장된 설정으로 UI 복원
        $('#product-group').val(savedSettings.productGroupId).trigger('change');
        $('#process').val(savedSettings.processId).trigger('change');
        $('#target').val(savedSettings.targetId).trigger('change');
        $('#days-select').val(savedSettings.days);

        // 데이터 로드
        await loadSpcAnalysis(savedSettings.targetId, savedSettings.days);
    }
}

// 설정 변경 시 자동 저장 (autoSave가 처리)
$('#product-group').on('change', function() {
    // TabSettings.autoSave()가 자동으로 저장
});
```

---

## 🎨 스타일 커스터마이징

탭 스타일은 `css/style.css`의 "탭 시스템 스타일" 섹션에서 수정할 수 있습니다.

### 주요 CSS 클래스
- `.tab-navigation-container` - 탭 네비게이션 컨테이너
- `#main-tabs` - 탭 네비게이션
- `.nav-link` - 탭 링크
- `.nav-link.active` - 활성 탭
- `.tab-close-btn` - 탭 닫기 버튼
- `.tab-count-badge` - 탭 카운트 배지
- `.tab-iframe` - iframe 스타일

### 색상 변경 예시

```css
/* 활성 탭 색상 변경 */
#main-tabs .nav-link.active {
    color: #28a745; /* 파란색 → 초록색 */
}

/* 탭 닫기 버튼 호버 색상 */
.tab-close-btn:hover {
    color: #ffc107; /* 빨간색 → 노란색 */
}
```

---

## 🐛 트러블슈팅

### 문제 1: 탭이 생성되지 않음

**증상:** 사이드바 클릭 시 탭이 생성되지 않음

**해결방법:**
1. 브라우저 콘솔에서 에러 확인
2. `tabManager.js`가 올바르게 로드되었는지 확인
3. `TabManager.init()`이 호출되었는지 확인

```javascript
// 콘솔에서 확인
console.log(TabManager);
console.log(TabManager.getAllTabs());
```

### 문제 2: 설정이 복원되지 않음

**증상:** 탭 전환 시 이전 설정이 사라짐

**해결방법:**
1. `tabSettings.js`가 분석 페이지에 포함되었는지 확인
2. `TabSettings.save()`가 호출되는지 확인
3. 세션 스토리지 확인

```javascript
// 콘솔에서 확인
console.log(sessionStorage);
console.log(TabSettings.restore());
```

### 문제 3: iframe이 제대로 로드되지 않음

**증상:** 탭 콘텐츠가 비어있거나 깨짐

**해결방법:**
1. 경로가 올바른지 확인 (`tabTypes` 객체의 `url` 속성)
2. 브라우저 콘솔에서 404 에러 확인
3. iframe의 `src` 속성 확인

```javascript
// tabManager.js의 tabTypes 확인
const tabTypes = {
    'spc': {
        url: 'pages/analysis/spc.html'  // 경로 확인
    }
};
```

### 문제 4: 최대 탭 개수 초과

**증상:** "최대 10개의 탭까지만 열 수 있습니다" 알림

**해결방법:**
1. 사용하지 않는 탭 닫기
2. 필요시 `MAX_TABS` 상수 값 변경 (권장하지 않음)

```javascript
// tabManager.js
const MAX_TABS = 10;  // 필요시 변경
```

---

## 🔍 디버깅 팁

### 콘솔 로그 확인

TabManager와 TabSettings 모두 콘솔 로그를 출력합니다.

```javascript
// TabManager 로그
'TabManager 초기화'
'탭 열림: { id: "spc-1", type: "spc", ... }'
'탭 활성화: spc-1'
'탭 닫힘: spc-1'

// TabSettings 로그
'탭 설정 저장: spc-1 { targetId: 123, ... }'
'탭 설정 복원: spc-1 { targetId: 123, ... }'
```

### 세션 스토리지 검사

브라우저 개발자 도구 > Application > Session Storage에서 저장된 설정 확인

```
Key: tab_settings_spc-1
Value: {"targetId":123,"processId":45,"productGroupId":5,"days":30}
```

### 탭 상태 확인

```javascript
// 콘솔에서 실행
TabManager.getAllTabs();
// 출력: [{ id: "dashboard", type: "dashboard", ... }, ...]

TabManager.getActiveTab();
// 출력: { id: "spc-1", type: "spc", ... }
```

---

## 📚 추가 자료

### 관련 파일
- [index.html](../index.html) - 메인 레이아웃
- [tabManager.js](../js/tabManager.js) - 탭 매니저
- [tabSettings.js](../js/tabSettings.js) - 설정 유틸리티
- [style.css](../css/style.css) - 스타일시트

### 참고 문서
- [AdminLTE 탭 컴포넌트](https://adminlte.io/docs/3.0/components/tabs.html)
- [Bootstrap 탭](https://getbootstrap.com/docs/4.6/components/navs/#tabs)
- [세션 스토리지 API](https://developer.mozilla.org/ko/docs/Web/API/Window/sessionStorage)

---

## ✅ 체크리스트

구현 완료 항목:
- [x] 메인 레이아웃에 탭 네비게이션 추가
- [x] TabManager 모듈 구현
- [x] TabSettings 유틸리티 구현
- [x] 사이드바 클릭 이벤트 연동
- [x] 탭 닫기 기능
- [x] 탭 카운트 표시
- [x] 최대 탭 개수 제한
- [x] Dashboard 탭 고정
- [x] 탭별 독립적 설정 관리
- [x] CSS 스타일링
- [x] 애니메이션 효과

추후 개선 사항:
- [ ] 분석 페이지들에 tabSettings.js 적용
- [ ] 탭 드래그 앤 드롭 재정렬
- [ ] 탭 우클릭 컨텍스트 메뉴
- [ ] 탭 즐겨찾기 기능
- [ ] 키보드 단축키 지원 (Ctrl+Tab)

---

**작성일:** 2025-11-03
**버전:** 1.0.0
