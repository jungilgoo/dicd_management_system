// PR Thickness 관리 페이지 모듈
(function() {
    // 전역 변수
    let currentPage = 1;
    let totalPages = 1;
    let itemsPerPage = 50;
    let totalItems = 0;
    let prThicknessChart = null;
    let currentEquipmentFilter = 'all';
    let currentChartEquipmentFilter = '1';
    let currentChartPeriod = '30d';
    let customStartDate = null;
    let customEndDate = null;
    
    // 장비 설정 데이터 관리 (동적)
    let equipmentSettings = {};
    let nextEquipmentNumber = 1;
    
    // 페이지 초기화
    async function initPRThicknessPage() {
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // 초기 탭 설정 확인
        console.log('PR Thickness 페이지 초기화 완료');
        
        // 첫 번째 탭(입력 탭)이 기본 활성화
        // 다른 탭의 초기화는 탭 클릭 시 수행
    }
    
    // 이벤트 리스너 설정
    function setupEventListeners() {
        // 탭 전환 이벤트
        setupTabEventListeners();
        
        // 폼 제출 이벤트
        const form = document.getElementById('pr-thickness-form');
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }
        
        // 측정값 입력 시 실시간 계산
        const measurementInputs = document.querySelectorAll('.measurement-value');
        measurementInputs.forEach(input => {
            input.addEventListener('input', () => {
                const equipmentId = input.dataset.equipment;
                calculateEquipmentValues(equipmentId);
            });
        });
        
        // 장비 설정 관련 버튼 이벤트
        const saveSettingsBtn = document.getElementById('save-equipment-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', saveEquipmentSettings);
        }
        
        // 장비 필터 버튼 이벤트 (데이터 조회 탭)
        const equipmentFilterBtns = document.querySelectorAll('.equipment-filter-btn');
        equipmentFilterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // 모든 버튼 비활성화
                equipmentFilterBtns.forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline-secondary');
                });
                
                // 클릭된 버튼 활성화
                this.classList.remove('btn-outline-secondary');
                this.classList.add('active', 'btn-primary');
                
                // 필터 적용
                currentEquipmentFilter = this.dataset.equipment;
                loadRecentData(1);
            });
        });
        
        // 차트 장비 필터 버튼 이벤트 (차트 탭)
        const chartEquipmentFilterBtns = document.querySelectorAll('.chart-equipment-filter-btn');
        chartEquipmentFilterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // 모든 버튼 비활성화
                chartEquipmentFilterBtns.forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline-secondary');
                });
                
                // 클릭된 버튼 활성화
                this.classList.remove('btn-outline-secondary');
                this.classList.add('active', 'btn-primary');
                
                // 필터 적용
                currentChartEquipmentFilter = this.dataset.equipment;
                const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];
                document.getElementById('current-chart-equipment').textContent = equipmentSetting.name;
                
                // 차트 새로고침
                updateChart();
            });
        });
        
        // 차트 관련 버튼들
        const refreshChartBtn = document.getElementById('refresh-chart-btn');
        if (refreshChartBtn) {
            refreshChartBtn.addEventListener('click', async () => await refreshChart());
        }
        
        // 차트 기간 선택 버튼들
        const chart7dBtn = document.getElementById('chart-7d');
        const chart30dBtn = document.getElementById('chart-30d');
        const chart90dBtn = document.getElementById('chart-90d');
        const chartCustomBtn = document.getElementById('chart-custom');
        
        if (chart7dBtn) chart7dBtn.addEventListener('click', async () => await changeChartPeriod('7d'));
        if (chart30dBtn) chart30dBtn.addEventListener('click', async () => await changeChartPeriod('30d'));
        if (chart90dBtn) chart90dBtn.addEventListener('click', async () => await changeChartPeriod('90d'));
        if (chartCustomBtn) chartCustomBtn.addEventListener('click', () => showCustomDateRange());
        
        // 사용자 지정 날짜 관련 버튼들
        const applyCustomDateBtn = document.getElementById('apply-custom-date');
        const cancelCustomDateBtn = document.getElementById('cancel-custom-date');
        const quickLastWeekBtn = document.getElementById('quick-last-week');
        const quickLastMonthBtn = document.getElementById('quick-last-month');
        
        if (applyCustomDateBtn) applyCustomDateBtn.addEventListener('click', async () => await applyCustomDateRange());
        if (cancelCustomDateBtn) cancelCustomDateBtn.addEventListener('click', hideCustomDateRange);
        if (quickLastWeekBtn) quickLastWeekBtn.addEventListener('click', () => setQuickDateRange('week'));
        if (quickLastMonthBtn) quickLastMonthBtn.addEventListener('click', () => setQuickDateRange('month'));
        
        // 장비 추가/삭제 버튼 이벤트
        const addEquipmentBtn = document.getElementById('add-equipment-btn');
        if (addEquipmentBtn) addEquipmentBtn.addEventListener('click', addNewEquipment);
        
        // 수정 모달 관련 이벤트
        const saveEditBtn = document.getElementById('save-edit-btn');
        if (saveEditBtn) saveEditBtn.addEventListener('click', saveEditedData);
        
    }
    
    // 탭 이벤트 리스너 설정
    function setupTabEventListeners() {
        // 수동 탭 전환 구현
        const tabLinks = document.querySelectorAll('#pr-thickness-tabs a[data-toggle="tab"]');
        
        tabLinks.forEach(tabLink => {
            tabLink.addEventListener('click', function(e) {
                e.preventDefault();
                
                // 모든 탭과 탭 콘텐츠 비활성화
                document.querySelectorAll('#pr-thickness-tabs .nav-link').forEach(link => {
                    link.classList.remove('active');
                    link.setAttribute('aria-selected', 'false');
                });
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('show', 'active');
                });
                
                // 클릭된 탭 활성화
                this.classList.add('active');
                this.setAttribute('aria-selected', 'true');
                
                // 해당 탭 콘텐츠 활성화
                const targetId = this.getAttribute('href').substring(1);
                const targetPane = document.getElementById(targetId);
                if (targetPane) {
                    targetPane.classList.add('show', 'active');
                }
                
                // 탭별 초기화 로직
                switch(targetId) {
                    case 'input':
                        console.log('데이터 입력 탭 활성화');
                        break;
                    case 'chart':
                        console.log('차트 탭 활성화');
                        setTimeout(async () => {
                            await initChartTab();
                        }, 100);
                        break;
                    case 'data':
                        console.log('데이터 조회 탭 활성화');
                        loadRecentData();
                        break;
                    case 'settings':
                        console.log('장비 설정 탭 활성화');
                        setTimeout(() => {
                            loadEquipmentSettings();
                        }, 100);
                        break;
                }
            });
        });
    }
    
    // 폼 제출 처리
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        // 버튼 비활성화 (try 밖에서 선언)
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 저장 중...';
        
        try {
            // 장비별 데이터 수집 (웨이퍼별로 처리)
            const equipmentData = [];
            
            Object.keys(equipmentSettings).forEach(equipmentNumber => {
                const equipmentSetting = equipmentSettings[equipmentNumber];
                const waferCount = equipmentSetting.waferCount || 1;
                const waferMeasurements = [];
                
                // 웨이퍼별 측정값 수집
                for (let waferIndex = 1; waferIndex <= waferCount; waferIndex++) {
                    const inputId = waferCount > 1 ? `${equipmentNumber}-${waferIndex}` : equipmentNumber;
                    const targetInput = document.getElementById(`target-${inputId}`);
                    
                    if (!targetInput) continue;
                    
                    const targetThickness = parseFloat(targetInput.value);
                    const measurements = {};
                    
                    // 각 포지션별 측정값 수집
                    const positions = ['top', 'center', 'bottom', 'left', 'right'];
                    positions.forEach(position => {
                        const input = document.querySelector(`input[data-equipment="${equipmentNumber}"][data-wafer="${waferIndex}"][data-position="${position}"]`);
                        if (input) {
                            measurements[position] = input.value ? parseFloat(input.value) : null;
                        }
                    });
                    
                    // 5개 측정값이 모두 입력된 경우만 웨이퍼 측정값에 추가
                    const validMeasurements = Object.values(measurements).filter(val => val !== null);
                    if (validMeasurements.length === 5) {
                        waferMeasurements.push(measurements);
                    }
                }
                
                // 웨이퍼 측정값이 있는 경우 장비 데이터에 추가
                if (waferMeasurements.length > 0) {
                    equipmentData.push({
                        equipment_id: parseInt(equipmentNumber),
                        equipment_name: equipmentSetting.name,
                        target_thickness: equipmentSetting.target,
                        measurements: waferMeasurements
                    });
                }
            });
            
            if (equipmentData.length === 0) {
                showToast('최소 한 개 장비의 측정값을 입력해주세요.', 'error');
                return;
            }
            
            const data = {
                equipment_data: equipmentData,
                author: document.getElementById('author').value
            };
            
            // 실제 API 호출
            const result = await api.createPRThicknessMeasurements(data);
            
            showToast(`PR Thickness 데이터가 성공적으로 저장되었습니다. (${result.length}건)`, 'success');
            
            // 측정값만 초기화 (목표 두께와 작성자는 유지)
            resetMeasurementValues();
            
            // 데이터 새로고침
            await loadRecentData();
            await loadStatistics();
            await refreshChart();
            
        } catch (error) {
            console.error('PR Thickness 데이터 저장 실패:', error);
            showToast('데이터 저장 중 오류가 발생했습니다.', 'error');
        } finally {
            // 버튼 복원
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
    
    // 특정 장비+웨이퍼의 측정값 계산
    function calculateEquipmentValues(equipmentId, waferIndex = null) {
        console.log('calculateEquipmentValues 호출:', { equipmentId, waferIndex });
        
        const positions = ['top', 'center', 'bottom', 'left', 'right'];
        const values = [];
        
        // 웨이퍼별 측정값 수집
        positions.forEach(position => {
            let input;
            if (waferIndex !== null) {
                input = document.querySelector(`input[data-equipment="${equipmentId}"][data-wafer="${waferIndex}"][data-position="${position}"]`);
            } else {
                input = document.querySelector(`input[data-equipment="${equipmentId}"][data-position="${position}"]`);
            }
            
            if (input) {
                const value = parseFloat(input.value);
                if (!isNaN(value) && value > 0) {
                    values.push(value);
                }
            }
        });
        
        console.log('수집된 측정값들:', values);
        
        // 표시할 ID 결정 (waferCount가 1인 경우는 장비번호만 사용)
        const equipmentSetting = equipmentSettings[equipmentId];
        const waferCount = equipmentSetting ? (equipmentSetting.waferCount || 1) : 1;
        const displayId = (waferIndex !== null && waferCount > 1) ? `${equipmentId}-${waferIndex}` : equipmentId;
        const avgSpan = document.getElementById(`avg-${displayId}`);
        const rangeSpan = document.getElementById(`range-${displayId}`);
        
        console.log('표시 요소들:', { displayId, avgSpan: !!avgSpan, rangeSpan: !!rangeSpan });
        
        if (avgSpan && rangeSpan) {
            if (values.length === 5) { // 5개 값이 모두 입력되었을 때만 계산
                // 평균값 계산
                const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                
                // 최대값, 최소값, 범위 계산
                const max = Math.max(...values);
                const min = Math.min(...values);
                const range = max - min;
                
                console.log('계산 결과:', { avg, range, min, max });
                
                // 해당 장비의 SPEC 범위 확인
                const equipmentSetting = equipmentSettings[equipmentId];
                let isOutOfSpec = false;
                if (equipmentSetting) {
                    isOutOfSpec = avg < equipmentSetting.specMin || avg > equipmentSetting.specMax;
                    console.log('SPEC 확인:', { equipmentSetting, isOutOfSpec });
                }
                
                // 평균값 표시 (SPEC 벗어나면 빨간색 굵은 글씨)
                if (isOutOfSpec) {
                    avgSpan.innerHTML = `<span style="color: red; font-weight: bold;">${avg.toFixed(0)}Å</span>`;
                } else {
                    avgSpan.textContent = avg.toFixed(0) + 'Å';
                }
                
                // 범위 표시
                rangeSpan.textContent = range.toFixed(0) + 'Å';
            } else {
                console.log('값 부족:', values.length, '< 5');
                // 5개 값이 모두 입력되지 않은 경우
                avgSpan.textContent = '-';
                rangeSpan.textContent = '-';
            }
        } else {
            console.log('표시 요소를 찾을 수 없음');
        }
    }
    
    
    // 측정값만 초기화 (목표 두께는 유지)
    function resetMeasurementValues() {
        // 모든 측정값 입력 필드 초기화
        const measurementInputs = document.querySelectorAll('.measurement-value');
        measurementInputs.forEach(input => {
            input.value = '';
        });
        
        // 각 장비+웨이퍼별 계산 결과 초기화
        Object.keys(equipmentSettings).forEach(equipmentNumber => {
            const equipmentSetting = equipmentSettings[equipmentNumber];
            const waferCount = equipmentSetting.waferCount || 1;
            
            for (let waferIndex = 1; waferIndex <= waferCount; waferIndex++) {
                const inputId = waferCount > 1 ? `${equipmentNumber}-${waferIndex}` : equipmentNumber;
                const avgSpan = document.getElementById(`avg-${inputId}`);
                const rangeSpan = document.getElementById(`range-${inputId}`);
                
                if (avgSpan) avgSpan.textContent = '-';
                if (rangeSpan) rangeSpan.textContent = '-';
            }
        });
    }
    
    // 최근 데이터 로드
    async function loadRecentData(page = 1) {
        try {
            // 로딩 표시
            const tbody = document.getElementById('pr-thickness-table-body');
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="sr-only">로딩 중...</span>
                        </div>
                    </td>
                </tr>
            `;
            
            // 실제 API 호출
            const response = await api.getPRThicknessData({
                page: page,
                limit: itemsPerPage,
                equipment_number: currentEquipmentFilter !== 'all' ? parseInt(currentEquipmentFilter) : null
            });
            
            currentPage = page;
            totalItems = response.total;
            totalPages = Math.ceil(totalItems / itemsPerPage);
            
            // 테이블 업데이트
            updateTable(response.data);
            updatePagination();
            updateTableInfo();
            
        } catch (error) {
            console.error('최근 데이터 로드 실패:', error);
            const tbody = document.getElementById('pr-thickness-table-body');
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center text-danger">
                        데이터를 불러오는 중 오류가 발생했습니다.
                    </td>
                </tr>
            `;
        }
    }
    
    // 테이블 업데이트
    function updateTable(data) {
        const tbody = document.getElementById('pr-thickness-table-body');
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" class="text-center text-muted">
                        데이터가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }
        
        // 디버그용 로그 추가
        console.log('PR Thickness 테이블 데이터:', data);
        if (data.length > 0) {
            console.log('첫 번째 데이터 항목:', data[0]);
        }
        
        let html = '';
        data.forEach(item => {
            const uniformityClass = item.uniformity >= 95 ? 'text-success' : 
                                  item.uniformity >= 90 ? 'text-warning' : 'text-danger';
            
            // 평균값 SPEC 확인
            let avgValueDisplay = '-';
            if (item.avg_value !== null && item.avg_value !== undefined) {
                // 해당 장비의 SPEC 정보 찾기
                let isOutOfSpec = false;
                for (const [equipmentNumber, setting] of Object.entries(equipmentSettings)) {
                    if (setting.name === item.equipment_name) {
                        isOutOfSpec = item.avg_value < setting.specMin || item.avg_value > setting.specMax;
                        break;
                    }
                }
                
                if (isOutOfSpec) {
                    avgValueDisplay = `<span style="color: red; font-weight: bold;">${item.avg_value}Å</span>`;
                } else {
                    avgValueDisplay = item.avg_value + 'Å';
                }
            }
            
            html += `
                <tr>
                    <td>${formatDateTime(item.created_at)}</td>
                    <td>${item.equipment_name}</td>
                    <td>${item.target_thickness !== null && item.target_thickness !== undefined ? item.target_thickness + 'Å' : '-'}</td>
                    <td>${item.top !== null && item.top !== undefined ? item.top + 'Å' : '-'}</td>
                    <td>${item.center !== null && item.center !== undefined ? item.center + 'Å' : '-'}</td>
                    <td>${item.bottom !== null && item.bottom !== undefined ? item.bottom + 'Å' : '-'}</td>
                    <td>${item.left !== null && item.left !== undefined ? item.left + 'Å' : '-'}</td>
                    <td>${item.right !== null && item.right !== undefined ? item.right + 'Å' : '-'}</td>
                    <td>${avgValueDisplay}</td>
                    <td>${item.range_value !== null && item.range_value !== undefined ? item.range_value + 'Å' : '-'}</td>
                    <td>${item.author}</td>
                    <td>
                        <button class="btn btn-sm btn-primary mr-1" onclick="editItem(${item.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteItem(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
    
    // 페이지네이션 업데이트
    function updatePagination() {
        const pagination = document.getElementById('pagination');
        let html = '';
        
        // 이전 페이지 버튼
        if (currentPage > 1) {
            html += `
                <li class="paginate_button page-item">
                    <a href="#" class="page-link" onclick="loadRecentData(${currentPage - 1})">이전</a>
                </li>
            `;
        }
        
        // 페이지 번호 버튼
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            html += `
                <li class="paginate_button page-item ${activeClass}">
                    <a href="#" class="page-link" onclick="loadRecentData(${i})">${i}</a>
                </li>
            `;
        }
        
        // 다음 페이지 버튼
        if (currentPage < totalPages) {
            html += `
                <li class="paginate_button page-item">
                    <a href="#" class="page-link" onclick="loadRecentData(${currentPage + 1})">다음</a>
                </li>
            `;
        }
        
        pagination.innerHTML = html;
    }
    
    // 테이블 정보 업데이트
    function updateTableInfo() {
        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);
        
        document.getElementById('table-info').textContent = 
            `${totalItems}개 중 ${startItem} - ${endItem}개 표시`;
    }
    
    
    // 통계 데이터 로드
    async function loadStatistics() {
        try {
            // 실제 API 호출
            const stats = await api.getPRThicknessStatistics();
            
            // DOM 요소가 존재하는 경우에만 업데이트
            const todayCountEl = document.getElementById('today-count');
            const weekCountEl = document.getElementById('week-count');
            const avgThicknessEl = document.getElementById('avg-thickness');
            const avgUniformityEl = document.getElementById('avg-uniformity');
            
            if (todayCountEl) todayCountEl.textContent = stats.today_count;
            if (weekCountEl) weekCountEl.textContent = stats.week_count;
            if (avgThicknessEl) avgThicknessEl.textContent = stats.avg_thickness.toFixed(2);
            if (avgUniformityEl) avgUniformityEl.textContent = stats.avg_uniformity.toFixed(1) + '%';
            
        } catch (error) {
            console.error('통계 데이터 로드 실패:', error);
        }
    }
    
    // 차트 기간 변경
    async function changeChartPeriod(period) {
        currentChartPeriod = period;
        
        // 사용자 지정 날짜 섹션 숨기기
        hideCustomDateRange();
        
        // 버튼 상태 업데이트
        document.querySelectorAll('#chart-7d, #chart-30d, #chart-90d, #chart-custom').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`chart-${period}`).classList.add('active');
        
        // 차트 데이터 새로고침
        await updateChart();
    }
    
    // 사용자 지정 날짜 범위 표시
    function showCustomDateRange() {
        // 버튼 상태 업데이트
        document.querySelectorAll('#chart-7d, #chart-30d, #chart-90d, #chart-custom').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById('chart-custom').classList.add('active');
        
        // 날짜 선택 영역 표시
        document.getElementById('custom-date-range-section').style.display = 'block';
        
        // 기본값 설정 (지난 30일)
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        document.getElementById('chart-start-date').value = thirtyDaysAgo.toISOString().split('T')[0];
        document.getElementById('chart-end-date').value = today.toISOString().split('T')[0];
    }
    
    // 사용자 지정 날짜 범위 숨기기
    function hideCustomDateRange() {
        document.getElementById('custom-date-range-section').style.display = 'none';
        
        // custom 버튼이 활성화되어 있으면 30일로 되돌리기 (재귀 호출 방지)
        if (document.getElementById('chart-custom').classList.contains('active')) {
            // 직접 버튼 상태 변경 및 차트 업데이트 (changeChartPeriod 호출 없이)
            document.querySelectorAll('#chart-7d, #chart-30d, #chart-90d, #chart-custom').forEach(btn => {
                btn.classList.remove('active');
            });
            document.getElementById('chart-30d').classList.add('active');
            currentChartPeriod = '30d';
            updateChart();
        }
    }
    
    // 빠른 날짜 선택
    function setQuickDateRange(type) {
        const today = new Date();
        let startDate;
        
        if (type === 'week') {
            // 지난 주 (7일)
            startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (type === 'month') {
            // 지난 달 (30일)
            startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        
        document.getElementById('chart-start-date').value = startDate.toISOString().split('T')[0];
        document.getElementById('chart-end-date').value = today.toISOString().split('T')[0];
    }
    
    // 사용자 지정 날짜 적용
    async function applyCustomDateRange() {
        const startDateStr = document.getElementById('chart-start-date').value;
        const endDateStr = document.getElementById('chart-end-date').value;
        
        if (!startDateStr || !endDateStr) {
            showToast('시작일과 종료일을 모두 선택해주세요.', 'error');
            return;
        }
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        if (startDate >= endDate) {
            showToast('시작일은 종료일보다 빨라야 합니다.', 'error');
            return;
        }
        
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 365) {
            showToast('선택 가능한 최대 기간은 365일입니다.', 'error');
            return;
        }
        
        customStartDate = startDate;
        customEndDate = endDate;
        currentChartPeriod = 'custom';
        
        // 사용자 지정 날짜 섹션 직접 숨기기 (hideCustomDateRange 호출하지 않음)
        document.getElementById('custom-date-range-section').style.display = 'none';
        
        // 차트 업데이트
        await updateChart();
        
        showToast(`${startDateStr} ~ ${endDateStr} 기간으로 차트를 업데이트했습니다.`, 'success');
    }
    
    // 차트 업데이트 (공통 함수)
    async function updateChart() {
        if (prThicknessChart) {
            try {
                const chartData = await generateChartData(currentChartPeriod, currentChartEquipmentFilter);
                const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];
                
                // 장비 설정이 없으면 기본값 사용
                const targetThickness = equipmentSetting ? equipmentSetting.target : 25000;
                const specMin = equipmentSetting ? equipmentSetting.specMin : 24000;
                const specMax = equipmentSetting ? equipmentSetting.specMax : 26000;
                
                prThicknessChart.data.labels = chartData.labels;
                prThicknessChart.data.datasets[0].data = chartData.data;
                prThicknessChart.data.datasets[1].data = Array(chartData.labels.length).fill(targetThickness);
                prThicknessChart.data.datasets[2].data = Array(chartData.labels.length).fill(specMin);
                prThicknessChart.data.datasets[3].data = Array(chartData.labels.length).fill(specMax);
                
                // Y축 범위도 업데이트 (SPEC 범위의 10% 여백 적용, 최소 200, 최대 1000)
                let margin = 1000; // 기본값
                if (equipmentSetting) {
                    const specRange = equipmentSetting.specMax - equipmentSetting.specMin;
                    margin = Math.max(200, Math.min(1000, Math.round(specRange * 0.1)));
                }
                prThicknessChart.options.scales.y.min = equipmentSetting ? equipmentSetting.specMin - margin : 23000;
                prThicknessChart.options.scales.y.max = equipmentSetting ? equipmentSetting.specMax + margin : 27000;
                
                prThicknessChart.update();
                console.log('차트 업데이트 완료');
            } catch (error) {
                console.error('차트 업데이트 실패:', error);
                showToast('차트 업데이트 중 오류가 발생했습니다.', 'error');
            }
        } else {
            console.warn('차트가 초기화되지 않았습니다. 차트를 다시 초기화합니다.');
            await initChart();
        }
    }
    
    // 차트 탭 초기화 (장비 설정 로드 후)
    async function initChartTab() {
        try {
            // 장비 설정이 없으면 먼저 로드
            if (Object.keys(equipmentSettings).length === 0) {
                await loadEquipmentSettings();
            }
            
            // 차트 필터 재생성
            regenerateChartFilters();
            
            // 첫 번째 장비로 필터 설정
            const firstEquipmentNumber = Object.keys(equipmentSettings)[0];
            if (firstEquipmentNumber) {
                currentChartEquipmentFilter = firstEquipmentNumber;
                const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];
                document.getElementById('current-chart-equipment').textContent = equipmentSetting.name;
            }
            
            // 차트 초기화
            await initChart();
            
        } catch (error) {
            console.error('차트 탭 초기화 실패:', error);
            showToast('차트를 초기화하는 중 오류가 발생했습니다.', 'error');
        }
    }

    // 차트 초기화
    async function initChart() {
        try {
            // 기존 차트가 있으면 삭제
            if (prThicknessChart) {
                prThicknessChart.destroy();
                prThicknessChart = null;
            }
            
            const canvas = document.getElementById('pr-thickness-chart');
            if (!canvas) {
                console.warn('차트 캔버스를 찾을 수 없습니다.');
                return;
            }
            
            const ctx = canvas.getContext('2d');
            
            // 차트 데이터 가져오기 (기본 30일, 현재 선택된 장비)
            const chartData = await generateChartData('30d', currentChartEquipmentFilter);
            const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];
            
            // 장비 설정이 없으면 기본값 사용
            const targetThickness = equipmentSetting ? equipmentSetting.target : 25000;
            const specMin = equipmentSetting ? equipmentSetting.specMin : 24000;
            const specMax = equipmentSetting ? equipmentSetting.specMax : 26000;
            
            prThicknessChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: 'PR Thickness (Å)',
                        data: chartData.data,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'transparent',
                        tension: 0.1,
                        fill: false,
                        pointBackgroundColor: 'rgb(75, 192, 192)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        borderWidth: 2
                    }, {
                        label: '목표값',
                        data: Array(chartData.labels.length).fill(targetThickness),
                        borderColor: 'rgb(34, 139, 34)',
                        backgroundColor: 'transparent',
                        fill: false,
                        pointRadius: 0,
                        borderWidth: 1
                    }, {
                        label: 'SPEC 최소값',
                        data: Array(chartData.labels.length).fill(specMin),
                        borderColor: 'rgb(220, 53, 69)',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        borderWidth: 1
                    }, {
                        label: 'SPEC 최대값',
                        data: Array(chartData.labels.length).fill(specMax),
                        borderColor: 'rgb(220, 53, 69)',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: function() {
                                if (equipmentSetting) {
                                    const specRange = equipmentSetting.specMax - equipmentSetting.specMin;
                                    const margin = Math.max(200, Math.min(1000, Math.round(specRange * 0.1)));
                                    return equipmentSetting.specMin - margin;
                                }
                                return 23000;
                            }(),
                            max: function() {
                                if (equipmentSetting) {
                                    const specRange = equipmentSetting.specMax - equipmentSetting.specMin;
                                    const margin = Math.max(200, Math.min(1000, Math.round(specRange * 0.1)));
                                    return equipmentSetting.specMax + margin;
                                }
                                return 27000;
                            }(),
                            title: {
                                display: true,
                                text: 'Thickness (Å)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: '측정 시간'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    }
                }
            });
            
            console.log('차트 초기화 완료');
            
        } catch (error) {
            console.error('차트 초기화 실패:', error);
            showToast('차트 초기화 중 오류가 발생했습니다.', 'error');
        }
    }
    
    // 차트 새로고침
    async function refreshChart() {
        await updateChart();
    }
    
    // 임시 데이터 생성 함수들은 개발 완료로 제거됨
    // 실제 운영에서는 백엔드 API를 통해 데이터를 가져옴
    
    async function generateChartData(period = '30d', equipmentNumber = '1') {
        try {
            const params = {
                period: period,
                equipment_number: parseInt(equipmentNumber)
            };
            
            if (period === 'custom' && customStartDate && customEndDate) {
                params.start_date = customStartDate.toISOString();
                params.end_date = customEndDate.toISOString();
            }
            
            const chartData = await api.getPRThicknessChartData(params);
            return {
                labels: chartData.labels || [],
                data: chartData.data || []
            };
        } catch (error) {
            console.error('차트 데이터 로드 실패:', error);
            return { labels: [], data: [] };
        }
    }
    
    // 유틸리티 함수들
    function formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    function showToast(message, type = 'info') {
        // 간단한 토스트 메시지 (AdminLTE 토스트 사용 가능)
        const alertClass = type === 'success' ? 'alert-success' : 
                          type === 'error' ? 'alert-danger' : 'alert-info';
        
        const toast = $(`
            <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="close" data-dismiss="alert">
                    <span>&times;</span>
                </button>
            </div>
        `);
        
        // 페이지 상단에 토스트 추가
        $('.content-header .container-fluid').prepend(toast);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            toast.alert('close');
        }, 3000);
    }
    
    // 전역 함수들 (HTML에서 호출)
    window.loadRecentData = loadRecentData;
    window.viewDetails = function(id) {
        alert(`상세 정보 보기: ID ${id}`);
    };
    window.editItem = async function(id) {
        await openEditModal(id);
    };
    window.deleteItem = async function(id) {
        if (confirm('정말 삭제하시겠습니까?')) {
            try {
                // 삭제 API 호출
                await api.deletePRThicknessMeasurement(id);
                showToast('데이터가 삭제되었습니다.', 'success');
                
                // API 캐시 클리어
                if (api.cache) {
                    api.cache.data = {};
                }
                
                // 테이블만 새로고침 (전체 페이지 새로고침 아님)
                await loadRecentData(currentPage);
                
            } catch (error) {
                console.error('데이터 삭제 실패:', error);
                showToast('데이터 삭제 중 오류가 발생했습니다.', 'error');
            }
        }
    };
    
    // 수정 모달 열기
    async function openEditModal(measurementId) {
        try {
            // 측정 데이터 조회
            const measurement = await api.getPRThicknessMeasurement(measurementId);
            
            // 모달 폼에 데이터 설정
            document.getElementById('edit-measurement-id').value = measurement.id;
            document.getElementById('edit-equipment-name').value = measurement.equipment_name || '';
            document.getElementById('edit-target-thickness').value = measurement.target_thickness || '';
            document.getElementById('edit-value-top').value = measurement.value_top || '';
            document.getElementById('edit-value-center').value = measurement.value_center || '';
            document.getElementById('edit-value-bottom').value = measurement.value_bottom || '';
            document.getElementById('edit-value-left').value = measurement.value_left || '';
            document.getElementById('edit-value-right').value = measurement.value_right || '';
            document.getElementById('edit-author').value = measurement.author || '';
            
            // 평균값과 범위 계산
            calculateEditedValues();
            
            // 수정 모달 측정값 입력 시 실시간 계산 이벤트 설정
            const editMeasurementInputs = document.querySelectorAll('.edit-measurement-value');
            editMeasurementInputs.forEach(input => {
                input.removeEventListener('input', calculateEditedValues);
                input.addEventListener('input', calculateEditedValues);
            });
            
            // 모달 표시
            $('#editPRThicknessModal').modal('show');
            
        } catch (error) {
            console.error('측정 데이터 조회 실패:', error);
            showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
        }
    }
    
    // 수정 모달 측정값 계산
    function calculateEditedValues() {
        const values = [];
        const positions = ['top', 'center', 'bottom', 'left', 'right'];
        
        positions.forEach(position => {
            const input = document.getElementById(`edit-value-${position}`);
            if (input) {
                const value = parseFloat(input.value);
                if (!isNaN(value) && value > 0) {
                    values.push(value);
                }
            }
        });
        
        const avgDisplay = document.getElementById('edit-avg-display');
        const rangeDisplay = document.getElementById('edit-range-display');
        
        if (values.length === 5) { // 5개 값이 모두 입력되었을 때만 계산
            // 평균값 계산
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            
            // 최대값, 최소값, 범위 계산
            const max = Math.max(...values);
            const min = Math.min(...values);
            const range = max - min;
            
            // 현재 수정 중인 장비의 SPEC 정보 확인
            const equipmentName = document.getElementById('edit-equipment-name').value;
            let isOutOfSpec = false;
            
            // 장비명으로 설정 정보 찾기
            for (const [equipmentNumber, setting] of Object.entries(equipmentSettings)) {
                if (setting.name === equipmentName) {
                    isOutOfSpec = avg < setting.specMin || avg > setting.specMax;
                    break;
                }
            }
            
            // 평균값 표시 (SPEC 벗어나면 빨간색 굵은 글씨)
            if (isOutOfSpec) {
                avgDisplay.innerHTML = `<span style="color: red; font-weight: bold;">${avg.toFixed(0)}Å</span>`;
            } else {
                avgDisplay.textContent = avg.toFixed(0) + 'Å';
            }
            
            // 범위 표시
            rangeDisplay.textContent = range.toFixed(0) + 'Å';
        } else {
            // 값이 부족한 경우
            avgDisplay.textContent = '-';
            rangeDisplay.textContent = '-';
        }
    }
    
    // 수정된 데이터 저장
    async function saveEditedData() {
        const saveBtn = document.getElementById('save-edit-btn');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 저장 중...';
        
        try {
            const measurementId = document.getElementById('edit-measurement-id').value;
            
            const data = {
                value_top: document.getElementById('edit-value-top').value ? parseInt(document.getElementById('edit-value-top').value) : null,
                value_center: document.getElementById('edit-value-center').value ? parseInt(document.getElementById('edit-value-center').value) : null,
                value_bottom: document.getElementById('edit-value-bottom').value ? parseInt(document.getElementById('edit-value-bottom').value) : null,
                value_left: document.getElementById('edit-value-left').value ? parseInt(document.getElementById('edit-value-left').value) : null,
                value_right: document.getElementById('edit-value-right').value ? parseInt(document.getElementById('edit-value-right').value) : null,
                author: document.getElementById('edit-author').value
            };
            
            // 유효성 검사
            if (!data.author) {
                showToast('작성자를 입력해주세요.', 'error');
                return;
            }
            
            const measurementValues = [data.value_top, data.value_center, data.value_bottom, data.value_left, data.value_right];
            const validValues = measurementValues.filter(val => val !== null);
            if (validValues.length < 5) {
                showToast('모든 측정값(상/중/하/좌/우)을 입력해주세요.', 'error');
                return;
            }
            
            // 수정 API 호출
            await api.updatePRThicknessMeasurement(measurementId, data);
            
            showToast('데이터가 성공적으로 수정되었습니다.', 'success');
            
            // 모달 닫기
            $('#editPRThicknessModal').modal('hide');
            
            // API 캐시 클리어
            if (api.cache) {
                api.cache.data = {};
            }
            
            // 테이블 새로고침
            await loadRecentData(currentPage);
            await refreshChart();
            
        } catch (error) {
            console.error('데이터 수정 실패:', error);
            showToast('데이터 수정 중 오류가 발생했습니다.', 'error');
        } finally {
            // 버튼 복원
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }
    
    // 기본 장비 설정 생성 함수
    function createDefaultEquipmentSettings() {
        return {
            1: { name: 'Coater 1호기 1라인_#08', target: 24800, specMin: 22000, specMax: 27000, waferCount: 1 },
            2: { name: 'Coater 1호기 2라인_#04', target: 17800, specMin: 16000, specMax: 20000, waferCount: 1 },
            3: { name: 'Coater 3C_#06 (1/3)', target: 10200, specMin: 9000, specMax: 12000, waferCount: 1 },
            4: { name: 'Coater 3C_#06 (2/3)', target: 10200, specMin: 9000, specMax: 12000, waferCount: 1 },
            5: { name: 'Coater 3C_#06 (3/3)', target: 10200, specMin: 9000, specMax: 12000, waferCount: 1 },
            6: { name: 'Coater 4호기_#35', target: 35000, specMin: 32000, specMax: 38000, waferCount: 1 },
            7: { name: 'Coater 2호기 2라인_#03', target: 40000, specMin: 37000, specMax: 43000, waferCount: 1 },
            8: { name: 'Coater 2호기 2라인_#04', target: 45000, specMin: 42000, specMax: 48000, waferCount: 1 },
            9: { name: 'Coater 2호기 2라인_#05', target: 55000, specMin: 52000, specMax: 58000, waferCount: 1 },
            10: { name: 'Coater 6호기_#17', target: 17000, specMin: 15000, specMax: 19000, waferCount: 1 }
        };
    }

    // 장비 설정 관리 함수들
    async function loadEquipmentSettings() {
        try {
            // 서버에서 장비 설정 로드
            const equipmentList = await api.getPRThicknessEquipments();
            
            // 서버 데이터가 있으면 변환
            if (equipmentList && equipmentList.length > 0) {
                equipmentSettings = {};
                equipmentList.forEach(equipment => {
                    equipmentSettings[equipment.equipment_number] = {
                        name: equipment.name,
                        target: equipment.target_thickness,
                        specMin: equipment.spec_min,
                        specMax: equipment.spec_max,
                        waferCount: equipment.wafer_count || 1
                    };
                });
                
                console.log('서버에서 장비 설정 로드 완료:', equipmentSettings);
            } else {
                // 서버에 데이터가 없으면 기본 설정 사용 후 서버에 저장
                console.log('서버에 장비 설정이 없음. 기본 설정 생성 중...');
                equipmentSettings = createDefaultEquipmentSettings();
                
                // 기본 설정을 서버에 저장
                await saveEquipmentSettings();
            }
            
            // 다음 장비 번호 설정
            const maxEquipmentNumber = Math.max(...Object.keys(equipmentSettings).map(num => parseInt(num)), 0);
            nextEquipmentNumber = maxEquipmentNumber + 1;
            
            // localStorage에도 백업 저장
            localStorage.setItem('prThicknessEquipmentSettings', JSON.stringify(equipmentSettings));
            
            // UI 렌더링
            renderEquipmentSettings();
            regenerateAllTabs();
            
        } catch (error) {
            console.error('서버에서 장비 설정 로드 실패:', error);
            
            // 서버 연결 실패 시 localStorage에서 로드 시도
            const savedSettings = localStorage.getItem('prThicknessEquipmentSettings');
            if (savedSettings) {
                try {
                    equipmentSettings = JSON.parse(savedSettings);
                    console.log('localStorage에서 장비 설정 로드 완료 (백업)');
                } catch (parseError) {
                    console.error('localStorage 파싱 오류:', parseError);
                    equipmentSettings = createDefaultEquipmentSettings();
                }
            } else {
                // localStorage도 없으면 기본 설정 사용
                equipmentSettings = createDefaultEquipmentSettings();
                console.log('기본 장비 설정 생성 완료');
            }
            
            // 다음 장비 번호 설정
            const maxEquipmentNumber = Math.max(...Object.keys(equipmentSettings).map(num => parseInt(num)), 0);
            nextEquipmentNumber = maxEquipmentNumber + 1;
            
            // UI 렌더링
            renderEquipmentSettings();
            regenerateAllTabs();
            
            showToast('장비 설정을 불러오는 중 오류가 발생했습니다. 기본 설정을 사용합니다.', 'warning');
        }
    }
    
    async function saveEquipmentSettings() {
        try {
            // 현재 화면의 모든 장비에서 설정 값 수집
            const equipmentRows = document.querySelectorAll('[data-equipment-row]');
            const newSettings = {};
            
            equipmentRows.forEach(row => {
                const equipmentNumber = row.dataset.equipmentRow;
                const name = document.getElementById(`equipment-name-${equipmentNumber}`).value;
                const target = parseInt(document.getElementById(`equipment-target-${equipmentNumber}`).value);
                const specMin = parseInt(document.getElementById(`equipment-spec-min-${equipmentNumber}`).value);
                const specMax = parseInt(document.getElementById(`equipment-spec-max-${equipmentNumber}`).value);
                const waferCount = parseInt(document.getElementById(`equipment-wafer-count-${equipmentNumber}`).value);
                
                // 유효성 검사
                if (!name || !target || !specMin || !specMax || !waferCount) {
                    throw new Error(`장비${equipmentNumber}의 모든 필드를 입력해주세요.`);
                }
                
                if (specMin >= specMax) {
                    throw new Error(`장비${equipmentNumber}의 SPEC 최소값이 최대값보다 크거나 같습니다.`);
                }
                
                if (target < specMin || target > specMax) {
                    throw new Error(`장비${equipmentNumber}의 목표 두께가 SPEC 범위를 벗어났습니다.`);
                }

                if (waferCount < 1 || waferCount > 10) {
                    throw new Error(`장비${equipmentNumber}의 웨이퍼 수는 1-10 범위 내에 있어야 합니다.`);
                }
                
                newSettings[equipmentNumber] = {
                    name: name,
                    target: target,
                    specMin: specMin,
                    specMax: specMax,
                    waferCount: waferCount
                };
            });
            
            // 설정 업데이트
            equipmentSettings = newSettings;
            
            // 서버 API로 장비 설정 저장 (스키마에 맞게 변환)
            const settingsForServer = { 
                settings: Object.fromEntries(
                    Object.entries(equipmentSettings).map(([equipmentNumber, setting]) => [
                        equipmentNumber,
                        {
                            equipment_number: parseInt(equipmentNumber),
                            name: setting.name,
                            target_thickness: setting.target,
                            spec_min: setting.specMin,
                            spec_max: setting.specMax,
                            wafer_count: setting.waferCount || 1
                        }
                    ])
                )
            };
            await api.bulkUpsertPRThicknessEquipments(settingsForServer);
            
            // localStorage에도 저장 (백업용)
            localStorage.setItem('prThicknessEquipmentSettings', JSON.stringify(equipmentSettings));
            
            // 모든 탭 재생성
            regenerateAllTabs();
            
            showToast('장비 설정이 서버에 성공적으로 저장되었습니다.', 'success');
            
        } catch (error) {
            console.error('장비 설정 저장 실패:', error);
            showToast(error.message || '장비 설정 저장 중 오류가 발생했습니다.', 'error');
        }
    }
    
    
    // 이 함수는 더 이상 사용하지 않습니다 (regenerateAllTabs로 대체)
    function updateInputTabTargetValues() {
        // regenerateAllTabs() 함수로 모든 탭이 동적으로 재생성됩니다
        regenerateAllTabs();
    }
    
    // 동적 장비 관리 함수들
    function addNewEquipment() {
        // 다음 사용 가능한 장비 번호 찾기
        while (equipmentSettings[nextEquipmentNumber]) {
            nextEquipmentNumber++;
        }
        
        const equipmentNumber = nextEquipmentNumber;
        
        // 기본 장비 설정 추가
        equipmentSettings[equipmentNumber] = {
            name: `장비${equipmentNumber}`,
            target: 25000,
            specMin: 24000,
            specMax: 26000,
            waferCount: 1
        };
        
        // UI 업데이트
        renderEquipmentSettings();
        regenerateAllTabs();
        
        showToast(`장비${equipmentNumber}가 추가되었습니다.`, 'success');
    }
    
    function deleteEquipment(equipmentNumber) {
        if (confirm(`장비${equipmentNumber}를 삭제하시겠습니까?\n관련된 모든 측정 데이터도 함께 삭제됩니다.`)) {
            delete equipmentSettings[equipmentNumber];
            
            // UI 업데이트
            renderEquipmentSettings();
            regenerateAllTabs();
            
            showToast(`장비${equipmentNumber}가 삭제되었습니다.`, 'success');
        }
    }
    
    function renderEquipmentSettings() {
        const container = document.getElementById('equipment-settings-container');
        if (!container) return;
        
        let html = '';
        
        // 장비 번호 순으로 정렬
        const sortedEquipments = Object.keys(equipmentSettings)
            .map(num => parseInt(num))
            .sort((a, b) => a - b);
        
        sortedEquipments.forEach(equipmentNumber => {
            const setting = equipmentSettings[equipmentNumber];
            html += `
                <div class="row align-items-center mb-2" data-equipment-row="${equipmentNumber}">
                    <div class="col-md-1">
                        <input type="number" class="form-control form-control-sm text-center" 
                               value="${equipmentNumber}" min="1" 
                               id="equipment-number-${equipmentNumber}" readonly
                               style="background-color: #f8f9fa;">
                    </div>
                    <div class="col-md-2">
                        <input type="text" class="form-control form-control-sm" 
                               value="${setting.name}" 
                               id="equipment-name-${equipmentNumber}"
                               maxlength="100">
                    </div>
                    <div class="col-md-2">
                        <div class="input-group input-group-sm">
                            <input type="number" class="form-control text-center" 
                                   value="${setting.target}" min="1" max="99999" step="1" 
                                   id="equipment-target-${equipmentNumber}">
                            <div class="input-group-append">
                                <span class="input-group-text">Å</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="input-group input-group-sm">
                            <input type="number" class="form-control text-center" 
                                   value="${setting.specMin}" min="1" max="99999" step="1" 
                                   id="equipment-spec-min-${equipmentNumber}">
                            <div class="input-group-append">
                                <span class="input-group-text">Å</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="input-group input-group-sm">
                            <input type="number" class="form-control text-center" 
                                   value="${setting.specMax}" min="1" max="99999" step="1" 
                                   id="equipment-spec-max-${equipmentNumber}">
                            <div class="input-group-append">
                                <span class="input-group-text">Å</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="input-group input-group-sm">
                            <input type="number" class="form-control text-center" 
                                   value="${setting.waferCount || 1}" min="1" max="10" step="1" 
                                   id="equipment-wafer-count-${equipmentNumber}">
                            <div class="input-group-append">
                                <span class="input-group-text">매</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-1 text-center">
                        <button type="button" class="btn btn-danger btn-sm" 
                                onclick="deleteEquipment(${equipmentNumber})"
                                title="장비 삭제">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        if (sortedEquipments.length === 0) {
            html = `
                <div class="row">
                    <div class="col-md-12 text-center text-muted py-4">
                        <i class="fas fa-plus-circle fa-3x mb-3"></i>
                        <p>장비가 없습니다. "장비 추가" 버튼을 클릭하여 장비를 추가하세요.</p>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    function regenerateAllTabs() {
        // 데이터 입력 탭 재생성
        regenerateInputTab();
        
        // 차트 탭 필터 재생성
        regenerateChartFilters();
        
        // 데이터 조회 탭 필터 재생성  
        regenerateDataFilters();
    }
    
    function regenerateInputTab() {
        const container = document.getElementById('equipment-input-container');
        if (!container) return;
        
        let html = '';
        const sortedEquipments = Object.keys(equipmentSettings)
            .map(num => parseInt(num))
            .sort((a, b) => a - b);
        
        sortedEquipments.forEach(equipmentNumber => {
            const setting = equipmentSettings[equipmentNumber];
            const waferCount = setting.waferCount || 1;
            
            // 웨이퍼 수만큼 입력 행 생성
            for (let waferIndex = 1; waferIndex <= waferCount; waferIndex++) {
                const waferLabel = waferCount > 1 ? ` (${waferIndex}/${waferCount})` : '';
                const inputId = waferCount > 1 ? `${equipmentNumber}-${waferIndex}` : equipmentNumber;
                
                console.log('입력 행 생성:', { equipmentNumber, waferIndex, waferCount, inputId });
                
                html += `
                    <div class="row align-items-center mb-2">
                        <div class="col-md-2">
                            <label class="form-label font-weight-bold mb-0" data-equipment-label="${inputId}">${setting.name}${waferLabel}</label>
                        </div>
                        <div class="col-md-2">
                            <div class="input-group input-group-sm">
                                <input type="number" class="form-control text-center" 
                                       value="${setting.target}" min="1" max="99999" step="1" 
                                       id="target-${inputId}" readonly tabindex="-1">
                                <div class="input-group-append">
                                    <span class="input-group-text">Å</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-1">
                            <input type="number" class="form-control form-control-sm text-center measurement-value" 
                                   placeholder="상" min="1" max="99999" step="1" 
                                   data-equipment="${equipmentNumber}" data-wafer="${waferIndex}" data-position="top">
                        </div>
                        <div class="col-md-1">
                            <input type="number" class="form-control form-control-sm text-center measurement-value" 
                                   placeholder="중" min="1" max="99999" step="1" 
                                   data-equipment="${equipmentNumber}" data-wafer="${waferIndex}" data-position="center">
                        </div>
                        <div class="col-md-1">
                            <input type="number" class="form-control form-control-sm text-center measurement-value" 
                                   placeholder="하" min="1" max="99999" step="1" 
                                   data-equipment="${equipmentNumber}" data-wafer="${waferIndex}" data-position="bottom">
                        </div>
                        <div class="col-md-1">
                            <input type="number" class="form-control form-control-sm text-center measurement-value" 
                                   placeholder="좌" min="1" max="99999" step="1" 
                                   data-equipment="${equipmentNumber}" data-wafer="${waferIndex}" data-position="left">
                        </div>
                        <div class="col-md-1">
                            <input type="number" class="form-control form-control-sm text-center measurement-value" 
                                   placeholder="우" min="1" max="99999" step="1" 
                                   data-equipment="${equipmentNumber}" data-wafer="${waferIndex}" data-position="right">
                        </div>
                        <div class="col-md-3">
                            <small class="text-muted">평균: <span id="avg-${inputId}">-</span> | 범위: <span id="range-${inputId}">-</span></small>
                        </div>
                    </div>
                `;
            }
        });
        
        if (sortedEquipments.length === 0) {
            html = `
                <div class="row">
                    <div class="col-md-12 text-center text-muted py-4">
                        <i class="fas fa-plus-circle fa-3x mb-3"></i>
                        <p>장비가 없습니다. "장비 설정" 탭에서 장비를 추가하세요.</p>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // 측정값 입력 이벤트 리스너 재설정
        setupMeasurementInputListeners();
    }
    
    function setupMeasurementInputListeners() {
        const measurementInputs = document.querySelectorAll('.measurement-value');
        console.log('측정값 입력 필드 개수:', measurementInputs.length);
        
        measurementInputs.forEach(input => {
            // 기존 이벤트 리스너 제거 (중복 방지)
            input.removeEventListener('input', handleMeasurementInput);
            
            // 새 이벤트 리스너 추가
            input.addEventListener('input', handleMeasurementInput);
        });
    }
    
    // 측정값 입력 핸들러 함수 (재사용을 위해 분리)
    function handleMeasurementInput(event) {
        const input = event.target;
        const equipmentId = input.dataset.equipment;
        const waferIndex = input.dataset.wafer ? parseInt(input.dataset.wafer) : null;
        
        console.log('측정값 입력 감지:', { equipmentId, waferIndex, value: input.value });
        calculateEquipmentValues(equipmentId, waferIndex);
    }
    
    function regenerateChartFilters() {
        const container = document.getElementById('chart-equipment-filter-container');
        if (!container) return;
        
        let html = '';
        const sortedEquipments = Object.keys(equipmentSettings)
            .map(num => parseInt(num))
            .sort((a, b) => a - b);
        
        sortedEquipments.forEach((equipmentNumber, index) => {
            const setting = equipmentSettings[equipmentNumber];
            const isActive = index === 0 ? 'btn-primary active' : 'btn-outline-secondary';
            
            html += `
                <button type="button" class="btn ${isActive} btn-sm mr-2 mb-2 chart-equipment-filter-btn" 
                        data-equipment="${equipmentNumber}">
                    <i class="fas fa-cog mr-1"></i> ${setting.name}
                </button>
            `;
        });
        
        container.innerHTML = html;
        
        // 이벤트 리스너 재설정
        setupChartFilterListeners();
    }
    
    function regenerateDataFilters() {
        const container = document.getElementById('data-equipment-filter-container');
        if (!container) return;
        
        let html = '';
        
        // "전체" 버튼 추가
        const isAllActive = currentEquipmentFilter === 'all' ? 'btn-primary active' : 'btn-outline-secondary';
        html += `
            <button type="button" class="btn ${isAllActive} btn-sm mr-2 mb-2 equipment-filter-btn" 
                    data-equipment="all">
                <i class="fas fa-list mr-1"></i> 전체
            </button>
        `;
        
        const sortedEquipments = Object.keys(equipmentSettings)
            .map(num => parseInt(num))
            .sort((a, b) => a - b);
        
        sortedEquipments.forEach((equipmentNumber) => {
            const setting = equipmentSettings[equipmentNumber];
            const isActive = currentEquipmentFilter === equipmentNumber.toString() ? 'btn-primary active' : 'btn-outline-secondary';
            
            html += `
                <button type="button" class="btn ${isActive} btn-sm mr-2 mb-2 equipment-filter-btn" 
                        data-equipment="${equipmentNumber}">
                    <i class="fas fa-cog mr-1"></i> ${setting.name}
                </button>
            `;
        });
        
        container.innerHTML = html;
        
        // 이벤트 리스너 재설정
        setupDataFilterListeners();
    }
    
    function setupChartFilterListeners() {
        const chartEquipmentFilterBtns = document.querySelectorAll('.chart-equipment-filter-btn');
        chartEquipmentFilterBtns.forEach(btn => {
            btn.addEventListener('click', async function() {
                // 모든 버튼 비활성화
                chartEquipmentFilterBtns.forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline-secondary');
                });
                
                // 클릭된 버튼 활성화
                this.classList.remove('btn-outline-secondary');
                this.classList.add('active', 'btn-primary');
                
                // 필터 적용
                currentChartEquipmentFilter = this.dataset.equipment;
                const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];
                if (equipmentSetting) {
                    document.getElementById('current-chart-equipment').textContent = equipmentSetting.name;
                }
                
                // 차트 새로고침
                await updateChart();
            });
        });
    }
    
    function setupDataFilterListeners() {
        const equipmentFilterBtns = document.querySelectorAll('.equipment-filter-btn');
        equipmentFilterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // 모든 버튼 비활성화
                equipmentFilterBtns.forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline-secondary');
                });
                
                // 클릭된 버튼 활성화
                this.classList.remove('btn-outline-secondary');
                this.classList.add('active', 'btn-primary');
                
                // 필터 적용
                currentEquipmentFilter = this.dataset.equipment;
                loadRecentData(1);
            });
        });
    }
    
    // 전역 함수들에 장비 설정 관련 함수 추가
    window.loadEquipmentSettings = loadEquipmentSettings;
    window.saveEquipmentSettings = saveEquipmentSettings;
    window.deleteEquipment = deleteEquipment;
    
    // 페이지 로드 시 초기화
    document.addEventListener('DOMContentLoaded', function() {
        initPRThicknessPage();
        // 장비 설정 초기 로드
        loadEquipmentSettings();
        updateInputTabTargetValues();
    });
})();