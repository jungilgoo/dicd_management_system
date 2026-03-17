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
        setupEventListeners();
        console.log('Particle 페이지 초기화 완료');
    }

    // 이벤트 리스너 설정
    function setupEventListeners() {
        setupTabEventListeners();

        const form = document.getElementById('particle-form');
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }

        const saveSettingsBtn = document.getElementById('save-equipment-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', saveEquipmentSettings);
        }

        const refreshChartBtn = document.getElementById('refresh-chart-btn');
        if (refreshChartBtn) {
            refreshChartBtn.addEventListener('click', async () => await refreshChart());
        }

        const chart7dBtn = document.getElementById('chart-7d');
        const chart30dBtn = document.getElementById('chart-30d');
        const chart90dBtn = document.getElementById('chart-90d');
        const chartCustomBtn = document.getElementById('chart-custom');

        if (chart7dBtn) chart7dBtn.addEventListener('click', async () => await changeChartPeriod('7d'));
        if (chart30dBtn) chart30dBtn.addEventListener('click', async () => await changeChartPeriod('30d'));
        if (chart90dBtn) chart90dBtn.addEventListener('click', async () => await changeChartPeriod('90d'));
        if (chartCustomBtn) chartCustomBtn.addEventListener('click', () => showCustomDateRange());

        const applyCustomDateBtn = document.getElementById('apply-custom-date');
        const cancelCustomDateBtn = document.getElementById('cancel-custom-date');
        const quickLastWeekBtn = document.getElementById('quick-last-week');
        const quickLastMonthBtn = document.getElementById('quick-last-month');

        if (applyCustomDateBtn) applyCustomDateBtn.addEventListener('click', async () => await applyCustomDateRange());
        if (cancelCustomDateBtn) cancelCustomDateBtn.addEventListener('click', hideCustomDateRange);
        if (quickLastWeekBtn) quickLastWeekBtn.addEventListener('click', () => setQuickDateRange('week'));
        if (quickLastMonthBtn) quickLastMonthBtn.addEventListener('click', () => setQuickDateRange('month'));

        const addEquipmentBtn = document.getElementById('add-equipment-btn');
        if (addEquipmentBtn) addEquipmentBtn.addEventListener('click', addNewEquipment);

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
                    case 'chart':
                        setTimeout(async () => {
                            await initChartTab();
                        }, 100);
                        break;
                    case 'data':
                        loadRecentData();
                        break;
                    case 'settings':
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
                const getVal = (id) => {
                    const el = document.getElementById(id);
                    if (!el || el.value === '') return null;
                    const v = parseInt(el.value);
                    return isNaN(v) ? null : v;
                };

                const before_y = getVal(`before-y-${equipmentNumber}`);
                const before_o = getVal(`before-o-${equipmentNumber}`);
                const before_b = getVal(`before-b-${equipmentNumber}`);
                const after_y  = getVal(`after-y-${equipmentNumber}`);
                const after_o  = getVal(`after-o-${equipmentNumber}`);
                const after_b  = getVal(`after-b-${equipmentNumber}`);

                const hasData = [before_y, before_o, before_b, after_y, after_o, after_b].some(v => v !== null);
                if (!hasData) return;

                equipmentData.push({
                    equipment_id: parseInt(equipmentNumber),
                    equipment_name: equipmentSetting.name,
                    before_y, before_o, before_b,
                    after_y, after_o, after_b
                });
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
            await refreshChart();

        } catch (error) {
            console.error('Particle 데이터 저장 실패:', error);
            showToast('데이터 저장 중 오류가 발생했습니다.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    // 측정값 초기화
    function resetMeasurementValues() {
        document.querySelectorAll('.particle-input').forEach(input => {
            input.value = '';
        });
        document.querySelectorAll('.particle-final, .particle-total').forEach(input => {
            input.value = '';
        });
    }

    // 최근 데이터 로드
    async function loadRecentData(page = 1) {
        try {
            const tbody = document.getElementById('particle-table-body');
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
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
                    <td colspan="8" class="text-center text-danger">
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
                    <td colspan="8" class="text-center text-muted">
                        데이터가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        const fmt = (v) => (v !== null && v !== undefined) ? v : '-';
        const fmtYOB = (y, o, b) => `${fmt(y)} / ${fmt(o)} / ${fmt(b)}`;

        let html = '';
        data.forEach(item => {
            let isOutOfSpec = false;
            if (item.value !== null && item.value !== undefined) {
                for (const [, setting] of Object.entries(equipmentSettings)) {
                    if (setting.name === item.equipment_name) {
                        isOutOfSpec = item.value > setting.specMax;
                        break;
                    }
                }
            }

            const valueDisplay = item.value !== null && item.value !== undefined
                ? (isOutOfSpec
                    ? `<span style="color:red;font-weight:bold;">${item.value}개 ⚠</span>`
                    : `${item.value}개`)
                : '-';

            html += `
                <tr>
                    <td>${formatDateTime(item.created_at)}</td>
                    <td>${item.equipment_name}</td>
                    <td><small>${fmtYOB(item.before_y, item.before_o, item.before_b)}</small></td>
                    <td><small>${fmtYOB(item.after_y, item.after_o, item.after_b)}</small></td>
                    <td><small>${fmtYOB(item.final_y, item.final_o, item.final_b)}</small></td>
                    <td>${valueDisplay}</td>
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

    // 차트 업데이트
    async function updateChart() {
        if (particleChart) {
            try {
                const chartData = await generateChartData(currentChartPeriod, currentChartEquipmentFilter);
                const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];

                const specMax = equipmentSetting ? equipmentSetting.specMax : 20;

                particleChart.data.labels = chartData.labels;
                particleChart.data.datasets[0].data = chartData.data_y;
                particleChart.data.datasets[1].data = chartData.data_o;
                particleChart.data.datasets[2].data = chartData.data_b;
                particleChart.data.datasets[3].data = Array(chartData.labels.length).fill(specMax);

                const stackedMax = chartData.labels.length > 0
                    ? Math.max(...chartData.labels.map((_, i) =>
                        (chartData.data_y[i] || 0) + (chartData.data_o[i] || 0) + (chartData.data_b[i] || 0)
                      ))
                    : 0;
                const yAxisMax = Math.max(specMax, stackedMax);
                const margin = Math.max(1, Math.round(yAxisMax * 0.1));
                particleChart.options.scales.y.min = 0;
                particleChart.options.scales.y.max = yAxisMax + margin;
                particleChart.options.scales.ySpec.min = 0;
                particleChart.options.scales.ySpec.max = yAxisMax + margin;

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
            const chartData = await generateChartData(currentChartPeriod, currentChartEquipmentFilter);
            const equipmentSetting = equipmentSettings[currentChartEquipmentFilter];

            const specMax = equipmentSetting ? equipmentSetting.specMax : 20;

            // 실제 누적 최대값 계산 (Y+O+B 합산)
            const stackedMax = chartData.labels.length > 0
                ? Math.max(...chartData.labels.map((_, i) =>
                    (chartData.data_y[i] || 0) + (chartData.data_o[i] || 0) + (chartData.data_b[i] || 0)
                  ))
                : 0;
            const yAxisMax = Math.max(specMax, stackedMax);
            const margin = Math.max(1, Math.round(yAxisMax * 0.1));

            particleChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: 'Y (0.3~1.0㎛)',
                        data: chartData.data_y,
                        backgroundColor: 'rgba(255, 220, 0, 0.85)',
                        borderColor: 'rgba(255, 200, 0, 1)',
                        borderWidth: 1,
                        stack: 'particle',
                        yAxisID: 'y'
                    }, {
                        label: 'O (1.0~2.5㎛)',
                        data: chartData.data_o,
                        backgroundColor: 'rgba(255, 140, 0, 0.85)',
                        borderColor: 'rgba(230, 110, 0, 1)',
                        borderWidth: 1,
                        stack: 'particle',
                        yAxisID: 'y'
                    }, {
                        label: 'B (2.5~5.1㎛)',
                        data: chartData.data_b,
                        backgroundColor: 'rgba(54, 130, 220, 0.85)',
                        borderColor: 'rgba(30, 100, 200, 1)',
                        borderWidth: 1,
                        stack: 'particle',
                        yAxisID: 'y'
                    }, {
                        label: 'SPEC 최대값',
                        data: Array(chartData.labels.length).fill(specMax),
                        type: 'line',
                        borderColor: 'rgb(220, 53, 69)',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        borderWidth: 2,
                        yAxisID: 'ySpec'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            min: 0,
                            max: yAxisMax + margin,
                            stacked: true,
                            title: {
                                display: true,
                                text: '파티클 개수 (개)'
                            }
                        },
                        ySpec: {
                            display: false,
                            min: 0,
                            max: yAxisMax + margin
                        },
                        x: {
                            stacked: true,
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
                data: chartData.data || [],
                data_y: chartData.data_y || [],
                data_o: chartData.data_o || [],
                data_b: chartData.data_b || []
            };
        } catch (error) {
            console.error('차트 데이터 로드 실패:', error);
            return { labels: [], data: [], data_y: [], data_o: [], data_b: [] };
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

        $('.content > .container-fluid').prepend(toast);

        setTimeout(() => {
            toast.alert('close');
        }, 3000);
    }

    // 전역 함수들 (HTML에서 호출)
    window.particleLoadRecentData = loadRecentData;
    window.particleCalcFinal = function(equipmentNumber) {
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el && el.value !== '' ? (parseInt(el.value) || 0) : 0;
        };
        const finalY = getVal(`after-y-${equipmentNumber}`) - getVal(`before-y-${equipmentNumber}`);
        const finalO = getVal(`after-o-${equipmentNumber}`) - getVal(`before-o-${equipmentNumber}`);
        const finalB = getVal(`after-b-${equipmentNumber}`) - getVal(`before-b-${equipmentNumber}`);
        const total = finalY + finalO + finalB;
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal(`final-y-${equipmentNumber}`, finalY);
        setVal(`final-o-${equipmentNumber}`, finalO);
        setVal(`final-b-${equipmentNumber}`, finalB);
        setVal(`total-${equipmentNumber}`, total);
    };
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

    // 모달 내 최종값 자동 계산
    function calcEditFinal() {
        const getNum = (id) => {
            const el = document.getElementById(id);
            return el && el.value !== '' ? (parseInt(el.value) || 0) : 0;
        };
        const fy = getNum('edit-after-y') - getNum('edit-before-y');
        const fo = getNum('edit-after-o') - getNum('edit-before-o');
        const fb = getNum('edit-after-b') - getNum('edit-before-b');
        document.getElementById('edit-final-y').value = fy;
        document.getElementById('edit-final-o').value = fo;
        document.getElementById('edit-final-b').value = fb;
        document.getElementById('edit-total-value').value = fy + fo + fb;
    }

    // 수정 모달 열기
    async function openEditModal(measurementId) {
        try {
            const measurement = await api.getParticleMeasurement(measurementId);

            document.getElementById('edit-measurement-id').value = measurement.id;
            document.getElementById('edit-equipment-name').value = measurement.equipment_name || '';
            document.getElementById('edit-author').value = measurement.author || '';

            const setVal = (id, v) => { document.getElementById(id).value = (v !== null && v !== undefined) ? v : ''; };
            setVal('edit-before-y', measurement.before_y);
            setVal('edit-before-o', measurement.before_o);
            setVal('edit-before-b', measurement.before_b);
            setVal('edit-after-y', measurement.after_y);
            setVal('edit-after-o', measurement.after_o);
            setVal('edit-after-b', measurement.after_b);

            calcEditFinal();

            // before/after 변경 시 자동 재계산
            ['edit-before-y','edit-before-o','edit-before-b','edit-after-y','edit-after-o','edit-after-b'].forEach(id => {
                document.getElementById(id).oninput = calcEditFinal;
            });

            $('#editParticleModal').modal('show');

        } catch (error) {
            console.error('측정 데이터 조회 실패:', error);
            showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
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
            const author = document.getElementById('edit-author').value;

            if (!author) {
                showToast('작성자를 입력해주세요.', 'error');
                return;
            }

            const getNum = (id) => {
                const el = document.getElementById(id);
                return el && el.value !== '' ? parseInt(el.value) : null;
            };

            const data = {
                before_y: getNum('edit-before-y'),
                before_o: getNum('edit-before-o'),
                before_b: getNum('edit-before-b'),
                after_y:  getNum('edit-after-y'),
                after_o:  getNum('edit-after-o'),
                after_b:  getNum('edit-after-b'),
                author: author
            };

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
            1: { name: '장비1', specMax: 20 },
            2: { name: '장비2', specMax: 20 }
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
                        id: equipment.id,
                        name: equipment.name,
                        specMax: equipment.spec_max
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
                const specMax = parseInt(document.getElementById(`equipment-spec-max-${equipmentNumber}`).value);

                if (!name || isNaN(specMax)) {
                    throw new Error(`장비${equipmentNumber}의 모든 필드를 입력해주세요.`);
                }

                if (specMax <= 0) {
                    throw new Error(`장비${equipmentNumber}의 SPEC 최대값은 0보다 커야 합니다.`);
                }

                newSettings[equipmentNumber] = {
                    name: name,
                    specMax: specMax
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
                            spec_max: setting.specMax
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
            specMax: 20
        };

        renderEquipmentSettings();
        regenerateAllTabs();

        showToast(`장비${equipmentNumber}가 추가되었습니다.`, 'success');
    }

    async function deleteEquipment(equipmentNumber) {
        if (confirm(`장비${equipmentNumber}를 삭제하시겠습니까?\n관련된 모든 측정 데이터도 함께 삭제됩니다.`)) {
            try {
                const setting = equipmentSettings[equipmentNumber];
                if (setting && setting.id) {
                    await api.deleteParticleEquipment(setting.id);
                }

                delete equipmentSettings[equipmentNumber];

                renderEquipmentSettings();
                regenerateAllTabs();

                showToast(`장비${equipmentNumber}가 삭제되었습니다.`, 'success');
            } catch (error) {
                console.error('장비 삭제 실패:', error);
                showToast('장비 삭제 중 오류가 발생했습니다.', 'error');
            }
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
                    <div class="col-md-2">
                        <input type="number" class="form-control form-control-sm text-center"
                               value="${equipmentNumber}" min="1"
                               id="equipment-number-${equipmentNumber}" readonly
                               style="background-color: #f8f9fa;">
                    </div>
                    <div class="col-md-5">
                        <input type="text" class="form-control form-control-sm"
                               value="${setting.name}"
                               id="equipment-name-${equipmentNumber}"
                               maxlength="100">
                    </div>
                    <div class="col-md-3">
                        <div class="input-group input-group-sm">
                            <input type="number" class="form-control text-center"
                                   value="${setting.specMax}" min="1" max="99999" step="1"
                                   id="equipment-spec-max-${equipmentNumber}">
                            <div class="input-group-append">
                                <span class="input-group-text">개</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-2 text-center">
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

        const sortedEquipments = Object.keys(equipmentSettings)
            .map(num => parseInt(num))
            .sort((a, b) => a - b);

        if (sortedEquipments.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-plus-circle fa-3x mb-3"></i>
                    <p>장비가 없습니다. "장비 설정" 탭에서 장비를 추가하세요.</p>
                </div>`;
            return;
        }

        const inp = (id, eqNum) =>
            `<input type="number" class="form-control form-control-sm text-center particle-input"
                    placeholder="0" min="0" max="99999" id="${id}"
                    oninput="particleCalcFinal(${eqNum})">`;
        const ro = (id, bg='#f5f5f5') =>
            `<input type="number" class="form-control form-control-sm text-center" id="${id}" readonly
                    style="background:${bg};">`;

        const nameRows = sortedEquipments.map(n => {
            const s = equipmentSettings[n];
            return `<tr>
                <td class="align-middle font-weight-bold text-nowrap px-3">
                    <i class="fas fa-cog text-secondary mr-1"></i>${s.name}
                    <small class="text-muted font-weight-normal ml-1">(SPEC≤${s.specMax})</small>
                </td>
            </tr>`;
        }).join('');

        const dataRows = sortedEquipments.map(n => `
            <tr>
                <td>${inp(`before-y-${n}`, n)}</td>
                <td>${inp(`before-o-${n}`, n)}</td>
                <td>${inp(`before-b-${n}`, n)}</td>
                <td>${inp(`after-y-${n}`, n)}</td>
                <td>${inp(`after-o-${n}`, n)}</td>
                <td>${inp(`after-b-${n}`, n)}</td>
                <td>${ro(`final-y-${n}`)}</td>
                <td>${ro(`final-o-${n}`)}</td>
                <td>${ro(`final-b-${n}`)}</td>
                <td>${ro(`total-${n}`, '#e8f5e9')}</td>
            </tr>`).join('');

        container.innerHTML = `
            <div class="d-flex" style="font-size:0.85rem;">
                <!-- 장비명 테이블 (내용 폭 자동) -->
                <table class="table table-bordered table-sm mb-0 flex-shrink-0 name-table" style="width:auto;">
                    <thead class="thead-light">
                        <tr><th class="align-middle text-nowrap px-3 name-header">장비명</th></tr>
                    </thead>
                    <tbody>${nameRows}</tbody>
                </table>
                <!-- 데이터 테이블 (균등 컬럼) -->
                <div class="flex-grow-1 overflow-auto">
                    <table class="table table-bordered table-sm text-center mb-0 data-table" style="width:100%;table-layout:fixed;">
                        <thead class="thead-light">
                            <tr>
                                <th colspan="3" class="text-primary">코팅 전</th>
                                <th colspan="3" class="text-success">코팅 후</th>
                                <th colspan="3" class="text-warning">최종</th>
                                <th rowspan="2" class="align-middle text-danger">합계</th>
                            </tr>
                            <tr>
                                <th class="text-primary">Y</th><th class="text-primary">O</th><th class="text-primary">B</th>
                                <th class="text-success">Y</th><th class="text-success">O</th><th class="text-success">B</th>
                                <th class="text-warning">Y</th><th class="text-warning">O</th><th class="text-warning">B</th>
                            </tr>
                        </thead>
                        <tbody>${dataRows}</tbody>
                    </table>
                </div>
            </div>`;

        // 장비명 헤더 높이를 데이터 테이블 thead 높이에 맞춤
        requestAnimationFrame(() => {
            const nameHeader = container.querySelector('.name-header');
            const dataThead = container.querySelector('.data-table thead');
            if (nameHeader && dataThead) {
                nameHeader.style.height = dataThead.offsetHeight + 'px';
            }
        });
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
