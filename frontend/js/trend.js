// 추이 분석 페이지 모듈
(function() {
    // 전역 변수
    let trendChart = null;
    let selectedProductGroupId = null;
    let selectedProcessId = null;
    let selectedTargetId = null;
    let currentStats = null;
    let currentMeasurements = null;
    let dateRangeType = 'last30'; // 기본값: 최근 30일
    let customStartDate = null;
    let customEndDate = null;
    
    // 페이지 초기화
    async function initTrendPage() {
        // 날짜 입력란 초기화
        utils.initDateControls({
            periodSelector: '#analysis-period',
            containerSelector: '.date-range-container',
            startDateSelector: '#start-date',
            endDateSelector: '#end-date'
        });

        // 제품군 목록 로드
        await loadProductGroups();
        
        // 이벤트 리스너 설정
        setupEventListeners();
    }
    
    // 제품군 목록 로드
    async function loadProductGroups() {
        try {
            const productGroups = await api.getProductGroups();
            
            if (!productGroups || productGroups.length === 0) {
                document.getElementById('product-group').innerHTML = '<option value="">제품군 정보가 없습니다.</option>';
                return;
            }
            
            let options = '<option value="">제품군 선택</option>';
            productGroups.forEach(productGroup => {
                options += `<option value="${productGroup.id}">${productGroup.name}</option>`;
            });
            
            document.getElementById('product-group').innerHTML = options;
            
        } catch (error) {
            console.error('제품군 로드 실패:', error);
            document.getElementById('product-group').innerHTML = '<option value="">제품군 로드 오류</option>';
        }
    }
    
    // 공정 목록 로드
    async function loadProcesses(productGroupId) {
        try {
            document.getElementById('process').innerHTML = '<option value="">로딩 중...</option>';
            document.getElementById('process').disabled = true;
            
            const processes = await api.getProcesses(productGroupId);
            
            if (processes && processes.length > 0) {
                let options = '<option value="">공정 선택</option>';
                processes.forEach(process => {
                    options += `<option value="${process.id}">${process.name}</option>`;
                });
                document.getElementById('process').innerHTML = options;
                document.getElementById('process').disabled = false;
            } else {
                document.getElementById('process').innerHTML = '<option value="">공정 없음</option>';
                document.getElementById('process').disabled = true;
            }
            
        } catch (error) {
            console.error('공정 목록 로드 실패:', error);
            document.getElementById('process').innerHTML = '<option value="">공정 로드 실패</option>';
            document.getElementById('process').disabled = true;
        }
    }
    
    // 타겟 목록 로드
    async function loadTargets(processId) {
        try {
            document.getElementById('target').innerHTML = '<option value="">로딩 중...</option>';
            document.getElementById('target').disabled = true;
            
            const targets = await api.getTargets(processId);
            
            if (targets && targets.length > 0) {
                let options = '<option value="">타겟 선택</option>';
                targets.forEach(target => {
                    options += `<option value="${target.id}">${target.name}</option>`;
                });
                document.getElementById('target').innerHTML = options;
                document.getElementById('target').disabled = false;
            } else {
                document.getElementById('target').innerHTML = '<option value="">타겟 없음</option>';
                document.getElementById('target').disabled = true;
            }
            
        } catch (error) {
            console.error('타겟 목록 로드 실패:', error);
            document.getElementById('target').innerHTML = '<option value="">타겟 로드 실패</option>';
            document.getElementById('target').disabled = true;
        }
    }
    
    // 차트 제목 생성 함수
    function generateChartTitle() {
        const productGroupSelect = document.getElementById('product-group');
        const processSelect = document.getElementById('process');
        const targetSelect = document.getElementById('target');
        const periodSelect = document.getElementById('analysis-period');

        let title = 'DICD 추이 분석';

        if (selectedTargetId && productGroupSelect.value && processSelect.value) {
            const productGroupName = productGroupSelect.options[productGroupSelect.selectedIndex]?.text || '';
            const processName = processSelect.options[processSelect.selectedIndex]?.text || '';
            const targetName = targetSelect.options[targetSelect.selectedIndex]?.text || '';

            // 기간 정보 생성
            let periodText = '';
            const periodValue = periodSelect.value;

            if (periodValue === 'custom') {
                const startDate = document.getElementById('start-date').value;
                const endDate = document.getElementById('end-date').value;
                if (startDate && endDate) {
                    periodText = `${startDate} ~ ${endDate}`;
                }
            } else {
                const periodMap = {
                    '7': '최근 7일',
                    '14': '최근 14일',
                    '30': '최근 30일',
                    '60': '최근 60일',
                    '90': '최근 90일'
                };
                periodText = periodMap[periodValue] || '최근 30일';
            }

            title = `DICD 추이 분석 (제품군:${productGroupName}, 공정:${processName}, 타겟:${targetName}, 기간:${periodText})`;
        }

        return title;
    }

    // 추이 분석 실행
    async function analyzeTrend() {
        // 타겟 선택 확인
        if (!selectedTargetId) {
            alert('분석할 타겟을 선택하세요.');
            return;
        }

        try {
            // 로딩 표시
            document.getElementById('trend-chart-container').innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">로딩 중...</span>
                </div>
                <p class="mt-2">데이터 분석 중...</p>
            </div>
            `;
            
            document.getElementById('stats-container').innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">로딩 중...</span>
                </div>
                <p class="mt-2">통계 계산 중...</p>
            </div>
            `;
            
            // 차트 데이터 섹션 숨기기
            hideChartDataSection();
            
            // API 요청 파라미터 설정
            const periodType = $('#analysis-period').val();
            let params;
            
            if (periodType === 'custom') {
                params = {
                    start_date: $('#start-date').val(),
                    end_date: $('#end-date').val()
                };
            } else {
                // 기간별 days 값 설정
                const daysMap = {
                    '7': 7,
                    '14': 14,
                    '30': 30,
                    '90': 90
                };
                params = { days: daysMap[periodType] || 30 }; // 기본값 30일
            }

            // 통계 API 호출
            const statsResult = await api.getTargetStatistics(selectedTargetId, params);
            currentStats = statsResult;
            
            // 측정 데이터 API 호출
            const measureParams = {
                target_id: selectedTargetId,
                limit: 1000,
                ...params
            };
            const measurementsResult = await api.getMeasurements(measureParams);
            currentMeasurements = measurementsResult;
            
            // 결과 표시
            updateTrendChart(measurementsResult, statsResult);
            updateStatsTable(statsResult);
            updateChartDataTable(measurementsResult);
            
        } catch (error) {
            console.error('추이 분석 실패:', error);
            document.getElementById('trend-chart-container').innerHTML = `
            <div class="text-center py-5">
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle mr-1"></i> 데이터 분석 중 오류가 발생했습니다.
                </div>
            </div>
            `;
            
            document.getElementById('stats-container').innerHTML = `
            <div class="text-center py-5">
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle mr-1"></i> 통계 데이터 로드 중 오류가 발생했습니다.
                </div>
            </div>
            `;
            
            // 에러 시 차트 데이터 테이블만 초기화
            clearChartDataTable();
        }
    }
    
    // 추이 차트 업데이트
    function updateTrendChart(measurements, stats) {
        // 데이터 체크
        if (!measurements || measurements.length === 0) {
            document.getElementById('trend-chart-container').innerHTML = `
            <div class="text-center py-5">
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle mr-1"></i> 분석할 데이터가 없습니다.
                </div>
            </div>
            `;
            return;
        }
        
        // 차트 컨테이너 준비
        document.getElementById('trend-chart-container').innerHTML = `
        <canvas id="trend-chart"></canvas>
        `;
        
        // 데이터 정렬 (날짜순)
        measurements.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        // 차트 데이터 준비
        const labels = measurements.map(m => {
            const date = new Date(m.created_at);
            return date.toLocaleDateString();
        });
        
        // 값 데이터
        const avgValues = measurements.map(m => m.avg_value);
        const minValues = measurements.map(m => m.min_value);
        const maxValues = measurements.map(m => m.max_value);
        
        // 데이터셋 준비 - 선 차트 기준
        let datasets = [
            {
                label: '평균값',
                data: avgValues,
                borderColor: '#3c8dbc',
                backgroundColor: 'rgba(60, 141, 188, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: false
            },
            {
                label: '최대값',
                data: maxValues,
                borderColor: '#f39c12',
                backgroundColor: 'rgba(243, 156, 18, 0.1)',
                borderWidth: 1,
                tension: 0.4,
                fill: false
            },
            {
                label: '최소값',
                data: minValues,
                borderColor: '#00c0ef',
                backgroundColor: 'rgba(0, 192, 239, 0.1)',
                borderWidth: 1,
                tension: 0.4,
                fill: false
            }
        ];
        
        // SPEC 정보 추가
        if (stats && stats.spec) {
            const spec = stats.spec;
            const specLSL = spec.lsl;
            const specUSL = spec.usl;
            const target = spec.target || ((specLSL + specUSL) / 2);
            
            // SPEC 라인 추가
            datasets.push(
                {
                    label: 'LSL',
                    data: Array(labels.length).fill(specLSL),
                    borderColor: '#3366ff',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false,
                    borderDash: [5, 5]
                },
                {
                    label: 'USL',
                    data: Array(labels.length).fill(specUSL),
                    borderColor: '#3366ff',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false,
                    borderDash: [5, 5]
                },
                {
                    label: '타겟',
                    data: Array(labels.length).fill(target),
                    borderColor: '#ff9900',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                }
            );
        }
        
        // Chart.js 설정
        const ctx = document.getElementById('trend-chart').getContext('2d');
        
        // 기존 차트 파괴
        if (trendChart) {
            trendChart.destroy();
        }
        
        // 차트 옵션
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: generateChartTitle()
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '날짜'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'DICD 값'
                    }
                }
            }
        };
        
        // 차트 생성
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: chartOptions
        });
    }
    
    // 통계 테이블 업데이트
    function updateStatsTable(stats) {
        if (!stats) {
            document.getElementById('stats-container').innerHTML = `
            <div class="text-center py-5">
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle mr-1"></i> 통계 데이터가 없습니다.
                </div>
            </div>
            `;
            return;
        }
        
        // 기본 통계
        const overall = stats.overall_statistics || {};
        
        // 공정능력지수
        const capability = stats.process_capability || {};
        
        // SPEC 정보
        const spec = stats.spec || {};
        
        // 통계 테이블 HTML
        let statsHtml = `
        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">기본 통계</h3>
                    </div>
                    <div class="card-body">
                        <div class="d-flex justify-content-center">
                            <div class="d-flex flex-column align-items-center">
                                <div class="font-weight-bold text-center" style="font-size: 24px;">
                                    ${stats.sample_count || 0}
                                </div>
                                <div class="text-muted">샘플 수</div>
                            </div>
                        </div>
                        
                        <div class="row mt-4">
                            <div class="col-md-6">
                                <div class="info-box bg-light">
                                    <div class="info-box-content">
                                        <span class="info-box-text text-center text-muted">평균</span>
                                        <span class="info-box-number text-center text-muted mb-0">${overall.avg ? overall.avg.toFixed(3) : '-'}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-box bg-light">
                                    <div class="info-box-content">
                                        <span class="info-box-text text-center text-muted">표준편차</span>
                                        <span class="info-box-number text-center text-muted mb-0">${overall.std_dev ? overall.std_dev.toFixed(3) : '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row mt-3">
                            <div class="col-md-4">
                                <div class="info-box bg-light">
                                    <div class="info-box-content">
                                        <span class="info-box-text text-center text-muted">최소값</span>
                                        <span class="info-box-number text-center text-muted mb-0">${overall.min ? overall.min.toFixed(3) : '-'}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="info-box bg-light">
                                    <div class="info-box-content">
                                        <span class="info-box-text text-center text-muted">최대값</span>
                                        <span class="info-box-number text-center text-muted mb-0">${overall.max ? overall.max.toFixed(3) : '-'}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="info-box bg-light">
                                    <div class="info-box-content">
                                        <span class="info-box-text text-center text-muted">범위</span>
                                        <span class="info-box-number text-center text-muted mb-0">${overall.range ? overall.range.toFixed(3) : '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">공정능력지수</h3>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <p class="mb-1 text-bold">공정능력지수 평가기준:</p>
                            <div class="d-flex flex-wrap">
                                <div class="mr-3"><span class="badge badge-success">Cp/Cpk ≥ 1.67</span> 매우 우수</div>
                                <div class="mr-3"><span class="badge badge-success">1.33 ≤ Cp/Cpk < 1.67</span> 우수</div>
                                <div class="mr-3"><span class="badge badge-warning">1.00 ≤ Cp/Cpk < 1.33</span> 적합</div>
                                <div class="mr-3"><span class="badge badge-warning">0.67 ≤ Cp/Cpk < 1.00</span> 부적합</div>
                                <div><span class="badge badge-danger">Cp/Cpk < 0.67</span> 매우 부적합</div>
                            </div>
                        </div>
                        <div class="mt-4">
                            ${createCapabilityGauge(capability.cp, 'Cp')}
                            ${createCapabilityGauge(capability.cpk, 'Cpk')}
                            ${createCapabilityGauge(capability.ppk, 'Ppk')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 위치별 통계 -->
        <div class="card mt-3">
            <div class="card-header">
                <h3 class="card-title">위치별 통계</h3>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>위치</th>
                                <th>평균</th>
                                <th>표준편차</th>
                                <th>최소값</th>
                                <th>최대값</th>
                                <th>범위</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // 위치별 통계 추가
        const positions = stats.position_statistics || {};
        const positionNames = { top: '상', center: '중', bottom: '하', left: '좌', right: '우' };
        
        for (const [position, positionStats] of Object.entries(positions)) {
            statsHtml += `
            <tr>
                <th>${positionNames[position] || position}</th>
                <td>${positionStats.avg ? positionStats.avg.toFixed(3) : '-'}</td>
                <td>${positionStats.std_dev ? positionStats.std_dev.toFixed(3) : '-'}</td>
                <td>${positionStats.min ? positionStats.min.toFixed(3) : '-'}</td>
                <td>${positionStats.max ? positionStats.max.toFixed(3) : '-'}</td>
                <td>${positionStats.range ? positionStats.range.toFixed(3) : '-'}</td>
            </tr>
            `;
        }
        
        statsHtml += `
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        `;
        
        document.getElementById('stats-container').innerHTML = statsHtml;
    }
    
    // 차트 데이터 테이블 업데이트
    function updateChartDataTable(measurements) {
        const tbody = document.querySelector('#chart-data-table tbody');
        if (!tbody) return;
        
        // 테이블 초기화
        tbody.innerHTML = '';
        
        // 데이터가 있으면 테이블 업데이트
        if (measurements && measurements.length > 0) {
            measurements.forEach(measurement => {
                const date = new Date(measurement.created_at).toLocaleDateString();
                const row = `
                    <tr>
                        <td>${date}</td>
                        <td>${measurement.device || '-'}</td>
                        <td>${measurement.lot_no || '-'}</td>
                        <td>${measurement.exposure_time || '-'}</td>
                        <td>${measurement.value_top ? measurement.value_top.toFixed(3) : '-'}</td>
                        <td>${measurement.value_center ? measurement.value_center.toFixed(3) : '-'}</td>
                        <td>${measurement.value_bottom ? measurement.value_bottom.toFixed(3) : '-'}</td>
                        <td>${measurement.value_left ? measurement.value_left.toFixed(3) : '-'}</td>
                        <td>${measurement.value_right ? measurement.value_right.toFixed(3) : '-'}</td>
                        <td>${measurement.min_value ? measurement.min_value.toFixed(3) : '-'}</td>
                        <td>${measurement.avg_value ? measurement.avg_value.toFixed(3) : '-'}</td>
                        <td>${measurement.max_value ? measurement.max_value.toFixed(3) : '-'}</td>
                        <td>${measurement.range_value ? measurement.range_value.toFixed(3) : '-'}</td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    }
    
    // 차트 데이터 테이블 초기화
    function clearChartDataTable() {
        const tbody = document.querySelector('#chart-data-table tbody');
        if (tbody) {
            tbody.innerHTML = '';
        }
    }
    
    // 차트 데이터 섹션 숨기기
    function hideChartDataSection() {
        const dataSection = document.getElementById('chart-data-section');
        const showBtn = document.getElementById('show-data-btn');
        
        if (dataSection) {
            dataSection.style.display = 'none';
        }
        if (showBtn) {
            showBtn.style.display = 'inline-block';
        }
    }

    // 이벤트 리스너 설정
    function setupEventListeners() {
        // 제품군 선택 변경 이벤트
        document.getElementById('product-group').addEventListener('change', function() {
            selectedProductGroupId = this.value;
            selectedProcessId = null;
            selectedTargetId = null;
            
            // 공정 목록 로드
            if (selectedProductGroupId) {
                loadProcesses(selectedProductGroupId);
            } else {
                document.getElementById('process').innerHTML = '<option value="">공정 선택</option>';
                document.getElementById('process').disabled = true;
                document.getElementById('target').innerHTML = '<option value="">타겟 선택</option>';
                document.getElementById('target').disabled = true;
            }
        });
        
        // 공정 선택 변경 이벤트
        document.getElementById('process').addEventListener('change', function() {
            selectedProcessId = this.value;
            selectedTargetId = null;
            
            // 타겟 목록 로드
            if (selectedProcessId) {
                loadTargets(selectedProcessId);
            } else {
                document.getElementById('target').innerHTML = '<option value="">타겟 선택</option>';
                document.getElementById('target').disabled = true;
            }
        });
        
        // 타겟 선택 변경 이벤트
        document.getElementById('target').addEventListener('change', function() {
            selectedTargetId = this.value;
        });
        
        // 분석 버튼 클릭 이벤트
        document.getElementById('analyze-btn').addEventListener('click', function() {
            analyzeTrend();
        });

        // 차트 복사 버튼 클릭 이벤트
        document.getElementById('copy-chart-btn').addEventListener('click', function() {
            copyChartToClipboard();
        });

        // 차트 데이터 보기 버튼 이벤트 (항상 활성화)
        document.getElementById('show-data-btn').addEventListener('click', function() {
            const dataSection = document.getElementById('chart-data-section');
            const tbody = document.querySelector('#chart-data-table tbody');
            
            // 데이터 유무 확인
            if (!currentMeasurements || currentMeasurements.length === 0) {
                alert('표시할 데이터가 없습니다.');
                return;
            }
            
            // 데이터가 있으면 테이블 표시
            if (dataSection) {
                dataSection.style.display = 'block';
                this.style.display = 'none';
            }
        });

        // 데이터 숨기기 버튼 이벤트
        document.getElementById('hide-data-btn').addEventListener('click', function() {
            const dataSection = document.getElementById('chart-data-section');
            const showBtn = document.getElementById('show-data-btn');
            
            if (dataSection) {
                dataSection.style.display = 'none';
            }
            if (showBtn) {
                showBtn.style.display = 'inline-block';
            }
        });
    }
    
    // 차트를 클립보드에 복사하는 함수
    async function copyChartToClipboard() {
        if (!trendChart) {
            alert('복사할 차트가 없습니다. 먼저 분석을 실행하세요.');
            return;
        }

        try {
            // 더 간단하고 안정적인 방법: 차트 이미지 다운로드
            const canvas = trendChart.canvas;
            const link = document.createElement('a');

            // 파일명 생성
            const fileName = generateChartFileName();

            link.download = fileName;
            link.href = canvas.toDataURL('image/png');

            // 임시로 링크를 클릭하여 다운로드
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showNotification('차트가 다운로드되었습니다. 다운로드된 이미지를 복사하여 사용하세요.', 'success');

        } catch (error) {
            console.error('차트 다운로드 실패:', error);

            // 마지막 대안: 새 창에서 이미지 열기
            try {
                const canvas = trendChart.canvas;
                const dataURL = canvas.toDataURL('image/png');
                const newWindow = window.open();
                newWindow.document.write(`
                    <html>
                        <head><title>차트 이미지</title></head>
                        <body style="margin:0; padding:20px; text-align:center;">
                            <h3>차트 이미지</h3>
                            <p>이미지를 우클릭하여 "이미지 복사"를 선택하세요.</p>
                            <img src="${dataURL}" style="max-width:100%; height:auto;" />
                        </body>
                    </html>
                `);
                newWindow.document.close();

                showNotification('새 창에서 차트가 열렸습니다. 이미지를 우클릭하여 복사하세요.', 'success');

            } catch (winError) {
                console.error('새 창 열기 실패:', winError);
                showNotification('차트 복사에 실패했습니다. 차트를 우클릭하여 "이미지로 저장"을 선택하세요.', 'error');
            }
        }
    }

    // 차트 파일명 생성 함수
    function generateChartFileName() {
        const productGroupSelect = document.getElementById('product-group');
        const processSelect = document.getElementById('process');
        const targetSelect = document.getElementById('target');
        const periodSelect = document.getElementById('analysis-period');

        let fileName = 'DICD_추이분석';

        if (selectedTargetId && productGroupSelect.value && processSelect.value) {
            const productGroupName = productGroupSelect.options[productGroupSelect.selectedIndex]?.text || '';
            const processName = processSelect.options[processSelect.selectedIndex]?.text || '';
            const targetName = targetSelect.options[targetSelect.selectedIndex]?.text || '';

            // 파일명에 사용할 수 없는 문자 제거
            const cleanName = (name) => name.replace(/[<>:"/\\|?*]/g, '_');

            fileName = `DICD_${cleanName(productGroupName)}_${cleanName(processName)}_${cleanName(targetName)}`;
        }

        // 현재 날짜 추가
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 19).replace(/:/g, '-');

        return `${fileName}_${dateStr}.png`;
    }

    // 알림 표시 함수
    function showNotification(message, type = 'info') {
        // 간단한 alert으로 변경 (중복 방지)
        alert(message);
    }

    // 공정 능력 지수 게이지 생성 함수
    function createCapabilityGauge(value, type) {
        if (!value) return `<div>${type}: - (데이터 없음)</div>`;
        
        // 게이지 설정
        const gaugeWidth = 100;
        const gaugeHeight = 12;
        
        // 평가 기준에 따른 색상 및 텍스트 결정
        let fillColor = '#dc3545'; // 기본: 부적합 (빨간색)
        let statusText = '매우 부적합';
        let statusClass = 'text-danger';
        
        // Cp/Cpk 평가 기준
        if (value >= 1.67) {
            fillColor = '#28a745'; // 매우 우수 (녹색)
            statusText = '매우 우수';
            statusClass = 'text-success';
        } else if (value >= 1.33) {
            fillColor = '#5cb85c'; // 우수 (연한 녹색)
            statusText = '우수';
            statusClass = 'text-success';
        } else if (value >= 1.0) {
            fillColor = '#ffc107'; // 적합 (노란색)
            statusText = '적합';
            statusClass = 'text-warning';
        } else if (value >= 0.67) {
            fillColor = '#fd7e14'; // 부적합 (주황색)
            statusText = '부적합';
            statusClass = 'text-warning';
        }
        
        // 게이지 채우기 너비 계산 (최대 100%, 최소 0%)
        const fillWidth = Math.min(100, Math.max(0, value * 60)); // 1.67 이상이면 100%
        
        return `
        <div class="d-flex align-items-center mb-2">
            <div class="mr-2 font-weight-bold" style="width: 40px;">${type}</div>
            <div style="position: relative; width: ${gaugeWidth}px; height: ${gaugeHeight}px; background-color: #e9ecef; border-radius: 4px;">
            <div style="position: absolute; width: ${fillWidth}%; height: 100%; background-color: ${fillColor}; border-radius: 4px;"></div>
            </div>
            <div class="ml-2">
            <span class="font-weight-bold">${value.toFixed(3)}</span>
            <span class="ml-2 ${statusClass}">(${statusText})</span>
            </div>
        </div>
        `;
    }

    // 이벤트 리스너 등록
    $(document).ready(function() {
        initTrendPage();
        setupEventListeners();

        // 날짜 컨트롤 활성화
        utils.initDateControls({
            periodSelector: '#analysis-period',
            containerSelector: '#custom-date-range',
            startDateSelector: '#start-date',
            endDateSelector: '#end-date'
        });
    });
})();