// 공통 유틸리티 함수 모음

/**
 * 날짜를 YYYY-MM-DD 형식의 문자열로 변환합니다.
 * @param {Date} date - 변환할 날짜 객체
 * @returns {string} YYYY-MM-DD 형식의 문자열
 */
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 문자열 형식의 날짜(YYYY-MM-DD)를 Date 객체로 변환합니다.
 * @param {string} dateString - YYYY-MM-DD 형식의 날짜 문자열
 * @returns {Date} Date 객체
 */
function parseDate(dateString) {
    return new Date(dateString);
}

/**
 * 날짜 선택 컨트롤을 초기화합니다.
 * @param {Object} options - 초기화 옵션
 * @param {string} options.periodSelector - 기간 선택 드롭다운의 셀렉터
 * @param {string} options.containerSelector - 커스텀 날짜 선택 컨테이너의 셀렉터
 * @param {string} options.startDateSelector - 시작일 input의 셀렉터
 * @param {string} options.endDateSelector - 종료일 input의 셀렉터
 * @param {Function} options.onChange - 변경 시 호출될 콜백 함수 (선택적)
 */
function initDateControls(options) {
    const periodSelect = document.querySelector(options.periodSelector);
    const dateContainer = document.querySelector(options.containerSelector);
    const startDateInput = document.querySelector(options.startDateSelector);
    const endDateInput = document.querySelector(options.endDateSelector);
    
    if (!periodSelect || !dateContainer || !startDateInput || !endDateInput) {
        console.error('날짜 선택 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 기본값으로 오늘 날짜와 30일 전 날짜 설정
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    startDateInput.value = formatDateForInput(thirtyDaysAgo);
    endDateInput.value = formatDateForInput(today);
    
    // 기간 선택 변경 이벤트
    periodSelect.addEventListener('change', function() {
        const selectedValue = this.value;
        
        if (selectedValue === 'custom') {
            dateContainer.style.display = 'block';
        } else {
            dateContainer.style.display = 'none';
            
            // 선택된 기간에 따라 날짜 설정 (onChange 콜백이 있을 경우 호출)
            if (options.onChange) {
                options.onChange(selectedValue);
            }
        }
    });
    
    // 날짜 입력 값 변경 이벤트
    startDateInput.addEventListener('change', function() {
        const startDate = new Date(this.value);
        const endDate = new Date(endDateInput.value);
        
        // 시작일이 종료일보다 늦으면 종료일을 시작일로 변경
        if (startDate > endDate) {
            endDateInput.value = this.value;
        }
        
        // onChange 콜백이 있을 경우 호출
        if (options.onChange) {
            options.onChange('custom', this.value, endDateInput.value);
        }
    });
    
    endDateInput.addEventListener('change', function() {
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(this.value);
        
        // 종료일이 시작일보다 이전이면 시작일을 종료일로 변경
        if (endDate < startDate) {
            startDateInput.value = this.value;
        }
        
        // onChange 콜백이 있을 경우 호출
        if (options.onChange) {
            options.onChange('custom', startDateInput.value, this.value);
        }
    });
}

/**
 * 분석 기간에 따른 날짜 범위를 계산합니다.
 * @param {string} periodType - 기간 유형 ('last7', 'last14', 'last30', 'last90', 'custom')
 * @param {string} startDate - 사용자 지정 시작 날짜 (periodType이 'custom'인 경우에만 사용)
 * @param {string} endDate - 사용자 지정 종료 날짜 (periodType이 'custom'인 경우에만 사용)
 * @returns {Object} 시작 날짜와 종료 날짜를 포함하는 객체
 */
function calculateDateRange(periodType, startDate, endDate) {
    const today = new Date();
    let start, end = today;
    
    switch (periodType) {
        case 'last7':
            start = new Date(today);
            start.setDate(today.getDate() - 7);
            break;
        case 'last14':
            start = new Date(today);
            start.setDate(today.getDate() - 14);
            break;
        case 'last30':
            start = new Date(today);
            start.setDate(today.getDate() - 30);
            break;
        case 'last90':
            start = new Date(today);
            start.setDate(today.getDate() - 90);
            break;
        case 'custom':
            if (startDate && endDate) {
                start = new Date(startDate);
                end = new Date(endDate);
            } else {
                // 사용자 지정 날짜가 없으면 기본값으로 30일
                start = new Date(today);
                start.setDate(today.getDate() - 30);
            }
            break;
        default:
            // 기본값은 30일
            start = new Date(today);
            start.setDate(today.getDate() - 30);
    }
    
    return {
        startDate: formatDateForInput(start),
        endDate: formatDateForInput(end),
        days: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    };
}

/**
 * API 요청을 위한 날짜 파라미터를 준비합니다.
 * @param {string} periodType - 기간 유형
 * @param {string} startDate - 사용자 지정 시작 날짜 (periodType이 'custom'인 경우에만 사용)
 * @param {string} endDate - 사용자 지정 종료 날짜 (periodType이 'custom'인 경우에만 사용)
 * @returns {Object} API 요청에 사용될 파라미터 객체
 */
function prepareApiDateParams(periodType, startDate, endDate) {
    if (periodType === 'custom' && startDate && endDate) {
        return {
            start_date: startDate,
            end_date: endDate
        };
    } else {
        // 기간으로 days 파라미터 설정
        let days = 30; // 기본값
        
        switch (periodType) {
            case '7':
                days = 7;
                break;
            case '14':
                days = 14;
                break;
            case '30':
                days = 30;
                break;
            case '90':
                days = 90;
                break;
        }
        
        return { days };
    }
}

// 모듈 내보내기
window.utils = {
    formatDateForInput,
    parseDate,
    initDateControls,
    calculateDateRange,
    prepareApiDateParams
};