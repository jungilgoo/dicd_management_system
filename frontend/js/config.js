// API 설정
const API_CONFIG = {
    BASE_URL: 'http://192.168.32.43:8080/api',
    // API 엔드포인트
    ENDPOINTS: {
        // 제품군 관련 엔드포인트
        PRODUCT_GROUPS: '/product-groups',
        // 공정 관련 엔드포인트
        PROCESSES: '/processes',
        // 타겟 관련 엔드포인트
        TARGETS: '/targets',
        // 장비 관련 엔드포인트
        EQUIPMENTS: '/equipments',
        // 측정 데이터 관련 엔드포인트
        MEASUREMENTS: '/measurements',
        // SPEC 관련 엔드포인트
        SPECS: '/specs',
        // SPC 관련 엔드포인트
        SPC: '/spc',
        // 통계 관련 엔드포인트
        STATISTICS: '/statistics',
        // 보고서 관련 엔드포인트
        REPORTS: '/reports',
        // 기존 엔드포인트들...
        DUPLICATE_CHECK: '/duplicate-check',
        // 분포 분석 엔드포인트 추가
        DISTRIBUTION: "/distribution",
        // 박스플롯 분석 엔드포인트 추가
        BOXPLOT: '/statistics/boxplot',
        // PR Thickness 관련 엔드포인트 추가
        PR_THICKNESS: '/pr-thickness',
    }
};

// 공통 유틸리티 함수
const UTILS = {
    // 날짜 포맷팅
    formatDate: function(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    },
    
    // 숫자 포맷팅 (소수점 3자리)
    formatNumber: function(number) {
        return number.toFixed(3);
    },
    
    // SPEC 상태에 따른 클래스 반환
    getStatusClass: function(value, lsl, usl) {
        if (value < lsl || value > usl) {
            return 'text-danger';
        } else if (value < lsl + (usl - lsl) * 0.1 || value > usl - (usl - lsl) * 0.1) {
            return 'text-warning';
        } else {
            return 'text-success';
        }
    },
    
    // SPEC 상태에 따른 배지 반환
    getStatusBadge: function(value, lsl, usl) {
        if (value < lsl || value > usl) {
            return '<span class="badge badge-danger">SPEC 위반</span>';
        } else if (value < lsl + (usl - lsl) * 0.1 || value > usl - (usl - lsl) * 0.1) {
            return '<span class="badge badge-warning">주의</span>';
        } else {
            return '<span class="badge badge-success">정상</span>';
        }
    },
    
    // 로딩 스피너 생성
    createLoadingSpinner: function() {
        return `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="sr-only">Loading...</span>
            </div>
        </div>
        `;
    },
    
    // 에러 메시지 표시
    showError: function(message) {
        return `
        <div class="alert alert-danger" role="alert">
            <i class="fas fa-exclamation-circle mr-2"></i> ${message}
        </div>
        `;
    }
};

// 시각화 색상 설정
const CHART_COLORS = {
    PRIMARY: 'rgba(60, 141, 188, 1)',
    SUCCESS: 'rgba(40, 167, 69, 1)',
    INFO: 'rgba(23, 162, 184, 1)',
    WARNING: 'rgba(255, 193, 7, 1)',
    DANGER: 'rgba(220, 53, 69, 1)',
    LIGHT: 'rgba(248, 249, 250, 1)',
    DARK: 'rgba(52, 58, 64, 1)',
    GRAY: 'rgba(108, 117, 125, 1)',
    
    TRANSPARENT_PRIMARY: 'rgba(60, 141, 188, 0.2)',
    TRANSPARENT_SUCCESS: 'rgba(40, 167, 69, 0.2)',
    TRANSPARENT_INFO: 'rgba(23, 162, 184, 0.2)',
    TRANSPARENT_WARNING: 'rgba(255, 193, 7, 0.2)',
    TRANSPARENT_DANGER: 'rgba(220, 53, 69, 0.2)'
};
