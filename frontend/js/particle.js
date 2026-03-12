// Particle 관리 페이지 모듈
(function() {
    // 전역 변수
    let currentPage = 1;
    let totalPages = 1;
    let itemsPerPage = 50;
    let totalItems = 0;
    let particleChart = null;
    let currentEquipmentFilter = 'all';
    let currentChartEquipmentFilter = '1';
    let currentChartPeriod = '30d';
    let customStartDate = null;
    let customEndDate = null;

    // 장비 설정 데이터 관리 (동적)
    let equipmentSettings = {};
    let nextEquipmentNumber = 1;

    // 페이지 초기화
    async function initParticlePage() {
        // 이벤트 리스너 설정
        setupEventListeners();

        // 초기 탭 설정 확인
        console.log('Particle 페이지 초기화 완료');

        // 첫 번째 탭(입력 탭)이 기본 활성화
        // 다른 탭의 초기화는 탭 클릭 시 수행
    }

    // 이벤트 리스너 설정
    function setupEventListeners() {
        // 탭 전환 이벤트
        setupTabEventListeners();

        // 폼 제출 이벤트
        const form = document.getElementById('particle-form');
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
                equipmentFilterBtns.forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline-secondary');
                });
                this.classList.remove('btn-outline-secondary');
                this.classList.add('active', 'btn-primary');
                currentEquipmentFilter = this.dataset.equipment;
                loadRecentData(1);
            });
        });

        // 차트 장비 필터 버튼 이벤트 (차트 탭)
        const chartEquipmentFilterBtns = document.querySelectorAll('.chart-equipment-filter-btn');
        chartEquipmentFilterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                chartEquipmentFilterBtns.forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline-secondary');
                });
                this.classList.remove('btn-outline-secondary');
                this.classList.add('active', 'btn-primary');
                currentChartEquipmentFilter = this.dataset.equipment;
                const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];
                document.getElementById('current-chart-equipment').textContent = equipmentSetting.name;
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
        const tabLinks = document.querySelectorAll('#particle-tabs a[data-toggle="tab"]');

        tabLinks.forEach(tabLink => {
            tabLink.addEventListener('click', function(e) {
                e.preventDefault();

                document.querySelectorAll('#particle-tabs .nav-link').forEach(link => {
                    link.classList.remove('active');
                    link.setAttribute('aria-selected', 'false');
                });
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('show', 'active');
                });

                this.classList.add('active');
                this.setAttribute('aria-selected', 'true');

                const targetId = this.getAttribute('href').substring(1);
                const targetPane = document.getElementById(targetId);
                if (targetPane) {
                    targetPane.classList.add('show', 'active');
                }

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

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 저장 중...';

        try {
            const equipmentData = [];

            Object.keys(equipmentSettings).forEach(equipmentNumber => {
                const equipmentSetting = equipmentSettings[equipmentNumber];
                const waferCount = equipmentSetting.waferCount || 1;
                const waferMeasurements = [];

                for (let waferIndex = 1; waferIndex <= waferCount; waferIndex++) {
                    const inputId = waferCount > 1 ? `${equipmentNumber}-${waferIndex}` : equipmentNumber;
                    const targetInput = document.getElementById(`target-${inputId}`);

                    if (!targetInput) continue;

                    const targetThickness = parseFloat(targetInput.value);
                    const measurements = {};

                    const positions = ['top', 'center', 'bottom', 'left', 'right'];
                    positions.forEach(position => {
                        const input = document.querySelector(`input[data-equipment="${equipmentNumber}"][data-wafer="${waferIndex}"][data-position="${position}"]`);
                        if (input) {
                            measurements[position] = input.value ? parseFloat(input.value) : null;
                        }
                    });

                    const validMeasurements = Object.values(measurements).filter(val => val !== null);
                    if (validMeasurements.length === 5) {
                        waferMeasurements.push(measurements);
                    }
                }

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

            const result = await api.createParticleMeasurements(data);

            showToast(`Particle 데이터가 성공적으로 저장되었습니다. (${result.length}건)`, 'success');

            resetMeasurementValues();

            await loadRecentData();
            await loadStatistics();
            await refreshChart();

        } catch (error) {
            console.error('Particle 데이터 저장 실패:', error);
            showToast('데이터 저장 중 오류가 발생했습니다.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    // 특정 장비+웨이퍼의 측정값 계산
    function calculateEquipmentValues(equipmentId, waferIndex = null) {
        const positions = ['top', 'center', 'bottom', 'left', 'right'];
        const values = [];

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

        const equipmentSetting = equipmentSettings[equipmentId];
        const waferCount = equipmentSetting ? (equipmentSetting.waferCount || 1) : 1;
        const displayId = (waferIndex !== null && waferCount > 1) ? `${equipmentId}-${waferIndex}` : equipmentId;
        const avgSpan = document.getElementById(`avg-${displayId}`);
        const rangeSpan = document.getElementById(`range-${displayId}`);

        if (avgSpan && rangeSpan) {
            if (values.length === 5) {
                const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                const max = Math.max(...values);
                const min = Math.min(...values);
                const range = max - min;

                const setting = equipmentSettings[equipmentId];
                let isOutOfSpec = false;
                if (setting) {
                    isOutOfSpec = avg < setting.specMin || avg > setting.specMax;
                }

                if (isOutOfSpec) {
                    avgSpan.innerHTML = `<span style="color: red; font-weight: bold;">${avg.toFixed(0)}Å</span>`;
                } else {
                    avgSpan.textContent = avg.toFixed(0) + 'Å';
                }

                rangeSpan.textContent = range.toFixed(0) + 'Å';
            } else {
                avgSpan.textContent = '-';
                rangeSpan.textContent = '-';
            }
        }
    }

    // 측정값만 초기화
    function resetMeasurementValues() {
        const measurementInputs = document.querySelectorAll('.measurement-value');
        measurementInputs.forEach(input => {
            input.value = '';
        });

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
            const tbody = document.getElementById('particle-table-body');
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="sr-only">로딩 중...</span>
                        </div>
                    </td>
                </tr>
            `;

            const response = await api.getParticleData({
                page: page,
                limit: itemsPerPage,
                equipment_number: currentEquipmentFilter !== 'all' ? parseInt(currentEquipmentFilter) : null
            });

            currentPage = page;
            totalItems = response.total;
            totalPages = Math.ceil(totalItems / itemsPerPage);

            updateTable(response.data);
            updatePagination();
            updateTableInfo();

        } catch (error) {
            console.error('최근 데이터 로드 실패:', error);
            const tbody = document.getElementById('particle-table-body');
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
        const tbody = document.getElementById('particle-table-body');

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

        let html = '';
        data.forEach(item => {
            let avgValueDisplay = '-';
            if (item.avg_value !== null && item.avg_value !== undefined) {
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
                        <button class="btn btn-sm btn-primary mr-1" onclick="particleEditItem(${item.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="particleDeleteItem(${item.id})">
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

        if (currentPage > 1) {
            html += `
                <li class="paginate_button page-item">
                    <a href="#" class="page-link" onclick="particleLoadRecentData(${currentPage - 1})">이전</a>
                </li>
            `;
        }

        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            html += `
                <li class="paginate_button page-item ${activeClass}">
                    <a href="#" class="page-link" onclick="particleLoadRecentData(${i})">${i}</a>
                </li>
            `;
        }

        if (currentPage < totalPages) {
            html += `
                <li class="paginate_button page-item">
                    <a href="#" class="page-link" onclick="particleLoadRecentData(${currentPage + 1})">다음</a>
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
            const stats = await api.getParticleStatistics();

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
        hideCustomDateRange();

        document.querySelectorAll('#chart-7d, #chart-30d, #chart-90d, #chart-custom').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`chart-${period}`).classList.add('active');

        await updateChart();
    }

    // 사용자 지정 날짜 범위 표시
    function showCustomDateRange() {
        document.querySelectorAll('#chart-7d, #chart-30d, #chart-90d, #chart-custom').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById('chart-custom').classList.add('active');
        document.getElementById('custom-date-range-section').style.display = 'block';

        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        document.getElementById('chart-start-date').value = thirtyDaysAgo.toISOString().split('T')[0];
        document.getElementById('chart-end-date').value = today.toISOString().split('T')[0];
    }

    // 사용자 지정 날짜 범위 숨기기
    function hideCustomDateRange() {
        document.getElementById('custom-date-range-section').style.display = 'none';

        if (document.getElementById('chart-custom').classList.contains('active')) {
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
            startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (type === 'month') {
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

        document.getElementById('custom-date-range-section').style.display = 'none';

        await updateChart();

        showToast(`${startDateStr} ~ ${endDateStr} 기간으로 차트를 업데이트했습니다.`, 'success');
    }

    // 차트 업데이트 (공통 함수)
    async function updateChart() {
        if (particleChart) {
            try {
                const chartData = await generateChartData(currentChartPeriod, currentChartEquipmentFilter);
                const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];

                const targetThickness = equipmentSetting ? equipmentSetting.target : 25000;
                const specMin = equipmentSetting ? equipmentSetting.specMin : 24000;
                const specMax = equipmentSetting ? equipmentSetting.specMax : 26000;

                particleChart.data.labels = chartData.labels;
                particleChart.data.datasets[0].data = chartData.data;
                particleChart.data.datasets[1].data = Array(chartData.labels.length).fill(targetThickness);
                particleChart.data.datasets[2].data = Array(chartData.labels.length).fill(specMin);
                particleChart.data.datasets[3].data = Array(chartData.labels.length).fill(specMax);

                let margin = 1000;
                if (equipmentSetting) {
                    const specRange = equipmentSetting.specMax - equipmentSetting.specMin;
                    margin = Math.max(200, Math.min(1000, Math.round(specRange * 0.1)));
                }
                particleChart.options.scales.y.min = equipmentSetting ? equipmentSetting.specMin - margin : 23000;
                particleChart.options.scales.y.max = equipmentSetting ? equipmentSetting.specMax + margin : 27000;

                particleChart.update();
            } catch (error) {
                console.error('차트 업데이트 실패:', error);
                showToast('차트 업데이트 중 오류가 발생했습니다.', 'error');
            }
        } else {
            await initChart();
        }
    }

    // 차트 탭 초기화
    async function initChartTab() {
        try {
            if (Object.keys(equipmentSettings).length === 0) {
                await loadEquipmentSettings();
            }

            regenerateChartFilters();

            const firstEquipmentNumber = Object.keys(equipmentSettings)[0];
            if (firstEquipmentNumber) {
                currentChartEquipmentFilter = firstEquipmentNumber;
                const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];
                document.getElementById('current-chart-equipment').textContent = equipmentSetting.name;
            }

            await initChart();

        } catch (error) {
            console.error('차트 탭 초기화 실패:', error);
            showToast('차트를 초기화하는 중 오류가 발생했습니다.', 'error');
        }
    }

    // 차트 초기화
    async function initChart() {
        try {
            if (particleChart) {
                particleChart.destroy();
                particleChart = null;
            }

            const canvas = document.getElementById('particle-chart');
            if (!canvas) {
                console.warn('차트 캔버스를 찾을 수 없습니다.');
                return;
            }

            const ctx = canvas.getContext('2d');
            const chartData = await generateChartData('30d', currentChartEquipmentFilter);
            const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];

            const targetThickness = equipmentSetting ? equipmentSetting.target : 25000;
            const specMin = equipmentSetting ? equipmentSetting.specMin : 24000;
            const specMax = equipmentSetting ? equipmentSetting.specMax : 26000;

            particleChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: 'Particle (Å)',
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

            console.log('Particle 차트 초기화 완료');

        } catch (error) {
            console.error('차트 초기화 실패:', error);
            showToast('차트 초기화 중 오류가 발생했습니다.', 'error');
        }
    }

    // 차트 새로고침
    async function refreshChart() {
        await updateChart();
    }

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

            const chartData = await api.getParticleChartData(params);
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

        $('.content-header .container-fluid').prepend(toast);

        setTimeout(() => {
            toast.alert('close');
        }, 3000);
    }

    // 전역 함수들 (HTML에서 호출)
    window.particleLoadRecentData = loadRecentData;
    window.particleEditItem = async function(id) {
        await openEditModal(id);
    };
    window.particleDeleteItem = async function(id) {
        if (confirm('정말 삭제하시겠습니까?')) {
            try {
                await api.deleteParticleMeasurement(id);
                showToast('데이터가 삭제되었습니다.', 'success');

                if (api.cache) {
                    api.cache.data = {};
                }

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
            const measurement = await api.getParticleMeasurement(measurementId);

            document.getElementById('edit-measurement-id').value = measurement.id;
            document.getElementById('edit-equipment-name').value = measurement.equipment_name || '';
            document.getElementById('edit-target-thickness').value = measurement.target_thickness || '';
            document.getElementById('edit-value-top').value = measurement.value_top || '';
            document.getElementById('edit-value-center').value = measurement.value_center || '';
            document.getElementById('edit-value-bottom').value = measurement.value_bottom || '';
            document.getElementById('edit-value-left').value = measurement.value_left || '';
            document.getElementById('edit-value-right').value = measurement.value_right || '';
            document.getElementById('edit-author').value = measurement.author || '';

            calculateEditedValues();

            const editMeasurementInputs = document.querySelectorAll('.edit-measurement-value');
            editMeasurementInputs.forEach(input => {
                input.removeEventListener('input', calculateEditedValues);
                input.addEventListener('input', calculateEditedValues);
            });

            $('#editParticleModal').modal('show');

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

        if (values.length === 5) {
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            const max = Math.max(...values);
            const min = Math.min(...values);
            const range = max - min;

            const equipmentName = document.getElementById('edit-equipment-name').value;
            let isOutOfSpec = false;

            for (const [equipmentNumber, setting] of Object.entries(equipmentSettings)) {
                if (setting.name === equipmentName) {
                    isOutOfSpec = avg < setting.specMin || avg > setting.specMax;
                    break;
                }
            }

            if (isOutOfSpec) {
                avgDisplay.innerHTML = `<span style="color: red; font-weight: bold;">${avg.toFixed(0)}Å</span>`;
            } else {
                avgDisplay.textContent = avg.toFixed(0) + 'Å';
            }

            rangeDisplay.textContent = range.toFixed(0) + 'Å';
        } else {
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

            await api.updateParticleMeasurement(measurementId, data);

            showToast('데이터가 성공적으로 수정되었습니다.', 'success');

            $('#editParticleModal').modal('hide');

            if (api.cache) {
                api.cache.data = {};
            }

            await loadRecentData(currentPage);
            await refreshChart();

        } catch (error) {
            console.error('데이터 수정 실패:', error);
            showToast('데이터 수정 중 오류가 발생했습니다.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }

    // 기본 장비 설정 생성 함수
    function createDefaultEquipmentSettings() {
        return {
            1: { name: '장비1', target: 25000, specMin: 24000, specMax: 26000, waferCount: 1 },
            2: { name: '장비2', target: 25000, specMin: 24000, specMax: 26000, waferCount: 1 }
        };
    }

    // 장비 설정 관리 함수들
    async function loadEquipmentSettings() {
        try {
            const equipmentList = await api.getParticleEquipments();

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
                console.log('서버에 장비 설정이 없음. 기본 설정 생성 중...');
                equipmentSettings = createDefaultEquipmentSettings();
                await saveEquipmentSettings();
            }

            const maxEquipmentNumber = Math.max(...Object.keys(equipmentSettings).map(num => parseInt(num)), 0);
            nextEquipmentNumber = maxEquipmentNumber + 1;

            localStorage.setItem('particleEquipmentSettings', JSON.stringify(equipmentSettings));

            renderEquipmentSettings();
            regenerateAllTabs();

        } catch (error) {
            console.error('서버에서 장비 설정 로드 실패:', error);

            const savedSettings = localStorage.getItem('particleEquipmentSettings');
            if (savedSettings) {
                try {
                    equipmentSettings = JSON.parse(savedSettings);
                    console.log('localStorage에서 장비 설정 로드 완료 (백업)');
                } catch (parseError) {
                    equipmentSettings = createDefaultEquipmentSettings();
                }
            } else {
                equipmentSettings = createDefaultEquipmentSettings();
                console.log('기본 장비 설정 생성 완료');
            }

            const maxEquipmentNumber = Math.max(...Object.keys(equipmentSettings).map(num => parseInt(num)), 0);
            nextEquipmentNumber = maxEquipmentNumber + 1;

            renderEquipmentSettings();
            regenerateAllTabs();

            showToast('장비 설정을 불러오는 중 오류가 발생했습니다. 기본 설정을 사용합니다.', 'warning');
        }
    }

    async function saveEquipmentSettings() {
        try {
            const equipmentRows = document.querySelectorAll('[data-equipment-row]');
            const newSettings = {};

            equipmentRows.forEach(row => {
                const equipmentNumber = row.dataset.equipmentRow;
                const name = document.getElementById(`equipment-name-${equipmentNumber}`).value;
                const target = parseInt(document.getElementById(`equipment-target-${equipmentNumber}`).value);
                const specMin = parseInt(document.getElementById(`equipment-spec-min-${equipmentNumber}`).value);
                const specMax = parseInt(document.getElementById(`equipment-spec-max-${equipmentNumber}`).value);
                const waferCount = parseInt(document.getElementById(`equipment-wafer-count-${equipmentNumber}`).value);

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

            equipmentSettings = newSettings;

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
            await api.bulkUpsertParticleEquipments(settingsForServer);

            localStorage.setItem('particleEquipmentSettings', JSON.stringify(equipmentSettings));

            regenerateAllTabs();

            showToast('장비 설정이 서버에 성공적으로 저장되었습니다.', 'success');

        } catch (error) {
            console.error('장비 설정 저장 실패:', error);
            showToast(error.message || '장비 설정 저장 중 오류가 발생했습니다.', 'error');
        }
    }

    // 동적 장비 관리 함수들
    function addNewEquipment() {
        while (equipmentSettings[nextEquipmentNumber]) {
            nextEquipmentNumber++;
        }

        const equipmentNumber = nextEquipmentNumber;

        equipmentSettings[equipmentNumber] = {
            name: `장비${equipmentNumber}`,
            target: 25000,
            specMin: 24000,
            specMax: 26000,
            waferCount: 1
        };

        renderEquipmentSettings();
        regenerateAllTabs();

        showToast(`장비${equipmentNumber}가 추가되었습니다.`, 'success');
    }

    function deleteEquipment(equipmentNumber) {
        if (confirm(`장비${equipmentNumber}를 삭제하시겠습니까?\n관련된 모든 측정 데이터도 함께 삭제됩니다.`)) {
            delete equipmentSettings[equipmentNumber];

            renderEquipmentSettings();
            regenerateAllTabs();

            showToast(`장비${equipmentNumber}가 삭제되었습니다.`, 'success');
        }
    }

    function renderEquipmentSettings() {
        const container = document.getElementById('equipment-settings-container');
        if (!container) return;

        let html = '';

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
                                onclick="particleDeleteEquipment(${equipmentNumber})"
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
        regenerateInputTab();
        regenerateChartFilters();
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

            for (let waferIndex = 1; waferIndex <= waferCount; waferIndex++) {
                const waferLabel = waferCount > 1 ? ` (${waferIndex}/${waferCount})` : '';
                const inputId = waferCount > 1 ? `${equipmentNumber}-${waferIndex}` : equipmentNumber;

                html += `
                    <div class="row align-items-center mb-2">
                        <div class="col-md-2">
                            <label class="form-label font-weight-bold mb-0">${setting.name}${waferLabel}</label>
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
        setupMeasurementInputListeners();
    }

    function setupMeasurementInputListeners() {
        const measurementInputs = document.querySelectorAll('.measurement-value');

        measurementInputs.forEach(input => {
            input.removeEventListener('input', handleMeasurementInput);
            input.addEventListener('input', handleMeasurementInput);
        });
    }

    function handleMeasurementInput(event) {
        const input = event.target;
        const equipmentId = input.dataset.equipment;
        const waferIndex = input.dataset.wafer ? parseInt(input.dataset.wafer) : null;
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
        setupChartFilterListeners();
    }

    function regenerateDataFilters() {
        const container = document.getElementById('data-equipment-filter-container');
        if (!container) return;

        let html = '';

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
        setupDataFilterListeners();
    }

    function setupChartFilterListeners() {
        const chartEquipmentFilterBtns = document.querySelectorAll('.chart-equipment-filter-btn');
        chartEquipmentFilterBtns.forEach(btn => {
            btn.addEventListener('click', async function() {
                chartEquipmentFilterBtns.forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline-secondary');
                });

                this.classList.remove('btn-outline-secondary');
                this.classList.add('active', 'btn-primary');

                currentChartEquipmentFilter = this.dataset.equipment;
                const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];
                if (equipmentSetting) {
                    document.getElementById('current-chart-equipment').textContent = equipmentSetting.name;
                }

                await updateChart();
            });
        });
    }

    function setupDataFilterListeners() {
        const equipmentFilterBtns = document.querySelectorAll('.equipment-filter-btn');
        equipmentFilterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                equipmentFilterBtns.forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline-secondary');
                });

                this.classList.remove('btn-outline-secondary');
                this.classList.add('active', 'btn-primary');

                currentEquipmentFilter = this.dataset.equipment;
                loadRecentData(1);
            });
        });
    }

    // 전역 함수들에 장비 설정 관련 함수 추가
    window.particleLoadEquipmentSettings = loadEquipmentSettings;
    window.particleSaveEquipmentSettings = saveEquipmentSettings;
    window.particleDeleteEquipment = deleteEquipment;

    // 페이지 로드 시 초기화
    document.addEventListener('DOMContentLoaded', function() {
        initParticlePage();
        loadEquipmentSettings();
    });
})();
