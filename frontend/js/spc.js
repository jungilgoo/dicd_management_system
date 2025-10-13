// SPC 분석 페이지 모듈
(function() {
    // 전역 변수
    let controlChart = null;
    let selectedProductGroupId = null;
    let selectedProcessId = null;
    let selectedTargetId = null;
    let rChart = null; // 추가: R 차트 변수
    let currentMeasurements = null; // 추가: 현재 측정 데이터
    let currentChangePoints = null; // 변경점 데이터
    let showChangePoints = true; // 변경점 표시 여부
    
    // 변경점 데이터 로드
    async function loadChangePoints(targetId, startDate = null, endDate = null) {
        try {
            let url = `/api/change-points/by-target-and-date-range/${targetId}`;
            const params = new URLSearchParams();
            
            if (startDate) {
                params.append('start_date', startDate);
            }
            if (endDate) {
                params.append('end_date', endDate);
            }
            
            if (params.toString()) {
                url += '?' + params.toString();
            }
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('변경점 데이터 로드 실패:', error);
            return [];
        }
    }

    // 페이지 초기화
    async function initSpcPage() {
        // 제품군 목록 로드
        await fetchProductGroups();
        
        // URL 파라미터에서 타겟 정보 확인
        const urlParams = new URLSearchParams(window.location.search);
        let targetInfo = null;

        if (urlParams.has('targetId')) {
            targetInfo = {
                targetId: urlParams.get('targetId'),
                productGroup: decodeURIComponent(urlParams.get('productGroup') || ''),
                process: decodeURIComponent(urlParams.get('process') || ''),
                targetName: decodeURIComponent(urlParams.get('targetName') || '')
            };
        } else {
            // 하위 호환성 유지: URL 파라미터가 없으면 localStorage 확인
            const targetInfoJson = localStorage.getItem('selected_target_for_spc');
            if (targetInfoJson) {
                try {
                    targetInfo = JSON.parse(targetInfoJson);
                    
                    // 사용 후 로컬 스토리지에서 제거
                    localStorage.removeItem('selected_target_for_spc');
                } catch (error) {
                    console.error('타겟 정보 파싱 오류:', error);
                    localStorage.removeItem('selected_target_for_spc');
                }
            }
        }

        // 타겟 정보가 있으면 처리
        if (targetInfo) {
            console.log('전달된 타겟 정보:', targetInfo);
            
            // 제품군 선택
            const productGroupSelect = document.getElementById('product-group');
            for (let i = 0; i < productGroupSelect.options.length; i++) {
                if (productGroupSelect.options[i].text === targetInfo.productGroup) {
                    productGroupSelect.selectedIndex = i;
                    selectedProductGroupId = productGroupSelect.value;
                    break;
                }
            }
            
            // 공정 목록 로드 후 선택
            if (selectedProductGroupId) {
                await fetchProcesses(selectedProductGroupId);
                const processSelect = document.getElementById('process');
                for (let i = 0; i < processSelect.options.length; i++) {
                    if (processSelect.options[i].text === targetInfo.process) {
                        processSelect.selectedIndex = i;
                        selectedProcessId = processSelect.value;
                        break;
                    }
                }
            }
            
            // 타겟 목록 로드 후 선택
            if (selectedProcessId) {
                await fetchTargets(selectedProcessId);
                const targetSelect = document.getElementById('target');
                for (let i = 0; i < targetSelect.options.length; i++) {
                    if (targetSelect.options[i].text === targetInfo.targetName) {
                        targetSelect.selectedIndex = i;
                        selectedTargetId = targetSelect.value;
                        break;
                    }
                }
            }
            
            // 타겟 ID가 직접 제공된 경우에는 직접 설정
            if (!selectedTargetId && targetInfo.targetId) {
                selectedTargetId = targetInfo.targetId;
            }
            
            // 타겟이 선택되었으면 SPC 분석 실행
            if (selectedTargetId) {
                analyzeSpc();
                
                // URL에서 파라미터 제거 (페이지 새로고침 시 중복 로드 방지)
                const cleanUrl = window.location.protocol + "//" + 
                                window.location.host + 
                                window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        }
    }
    
    // 제품군 목록 로드
    async function fetchProductGroups() {
        try {
            const productGroups = await api.getProductGroups();
            
            if (productGroups && productGroups.length > 0) {
                let options = '<option value="">제품군 선택</option>';
                productGroups.forEach(productGroup => {
                    options += `<option value="${productGroup.id}">${productGroup.name}</option>`;
                });
                document.getElementById('product-group').innerHTML = options;
            }
            
        } catch (error) {
            console.error('제품군 목록 로드 실패:', error);
        }
    }
    
    // 공정 목록 로드
    async function fetchProcesses(productGroupId) {
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
    async function fetchTargets(processId) {
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
    
    // SPC 분석 실행
    async function analyzeSpc() {
        // 타겟 선택 확인
        if (!selectedTargetId) {
            alert('분석할 타겟을 선택하세요.');
            return;
        }
        
        // 분석 기간 가져오기
        const periodSelect = document.getElementById('analysis-period');
        let days = parseInt(periodSelect.value);
        let startDate = null;
        let endDate = null;
        
        // 사용자 지정 기간인 경우
        if (periodSelect.value === 'custom') {
            startDate = document.getElementById('start-date').value;
            endDate = document.getElementById('end-date').value;
            
            if (!startDate || !endDate) {
                alert('시작일과 종료일을 모두 선택하세요.');
                return;
            }
            
            // 날짜 범위 유효성 검사
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (start > end) {
                alert('시작일은 종료일보다 이전이어야 합니다.');
                return;
            }
            
            // 두 날짜 간의 차이(일수) 계산
            const timeDiff = end.getTime() - start.getTime();
            days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1은 당일 포함
        }
        
        try {
            // 로딩 표시
            document.getElementById('control-chart-container').innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">로딩 중...</span>
                </div>
                <p class="mt-2">SPC 분석 중...</p>
            </div>
            `;
            
            // R 차트 로딩 표시 추가
            document.getElementById('r-chart-container').innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">로딩 중...</span>
                </div>
                <p class="mt-2">R 차트 분석 중...</p>
            </div>
            `;

            // API 호출 파라미터 준비
            let apiParams = utils.prepareApiDateParams(
                $('#analysis-period').val(),
                $('#start-date').val(),
                $('#end-date').val()
            );
            
            // 사용자 지정 기간인 경우 시작일/종료일 추가
            if (periodSelect.value === 'custom') {
                apiParams.start_date = startDate;
                apiParams.end_date = endDate;
            }

            // SPC 분석 API 호출
            const result = await api.analyzeSpc(selectedTargetId, apiParams);

            // API 응답 로깅 (디버깅용)
            console.log(`타겟 ID ${selectedTargetId}에 대한 SPC 분석 API 응답:`, result);
            
            // 측정 데이터 API 호출 (차트 데이터 보기용)
            const measureParams = {
                target_id: selectedTargetId,
                limit: 1000,
                ...apiParams
            };
            const measurementsResult = await api.getMeasurements(measureParams);
            currentMeasurements = measurementsResult;
            
            // 변경점 데이터 로드
            let startDateForChangePoints = startDate;
            let endDateForChangePoints = endDate;
            
            if (!startDateForChangePoints && !endDateForChangePoints && days) {
                // 기간별로 시작/끝 날짜 계산
                const endDateCalc = new Date();
                const startDateCalc = new Date();
                startDateCalc.setDate(endDateCalc.getDate() - days);
                
                startDateForChangePoints = startDateCalc.toISOString().split('T')[0];
                endDateForChangePoints = endDateCalc.toISOString().split('T')[0];
            }
            
            const changePointsResult = await loadChangePoints(
                selectedTargetId, 
                startDateForChangePoints, 
                endDateForChangePoints
            );
            currentChangePoints = changePointsResult;
            
            // 차트 데이터 섹션 숨기기
            hideChartDataSection();
            
            // 결과 표시
            updateSpcResults(result);
            updateChartDataTable(measurementsResult);
            
        } catch (error) {
            console.error('SPC 분석 실패:', error);
            document.getElementById('control-chart-container').innerHTML = `
            <div class="text-center py-5">
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle mr-1"></i> SPC 분석 중 오류가 발생했습니다.
                </div>
            </div>
            `;
            
            // 에러 시 데이터 초기화
            currentMeasurements = null;
            clearChartDataTable();
        }
    }
    
    // SPC 분석 결과 업데이트
    function updateSpcResults(result) {
        // 패턴 정보 로깅 (디버깅용)
        console.log("SPC 분석 전체 결과:", result);
        console.log("감지된 SPC 패턴:", result.patterns);

        // 결과 체크
        if (!result || result.sample_count === 0) {
            document.getElementById('control-chart-container').innerHTML = `
            <div class="text-center py-5">
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle mr-1"></i> 분석할 데이터가 없습니다.
                </div>
            </div>
            `;
            document.getElementById('r-chart-container').innerHTML = `
            <div class="text-center py-5">
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle mr-1"></i> 분석할 데이터가 없습니다.
                </div>
            </div>
            `;
            return;
        }
        
        // 관리도 차트 그리기
        createControlChart(result);
        
        // R 차트 그리기
        createRChart(result);
        
        // 관리 한계 테이블 업데이트
        updateControlLimitsTable(result.control_limits);
        
        // 공정능력지수 테이블 업데이트 (process_capability가 없을 수도 있음)
        updateCapabilityTable(result.process_capability || {});
        
        // SPEC 테이블 업데이트
        updateSpecTable(result.spec);
        
        // 패턴 감지 결과 업데이트
        updatePatternsTable(result.patterns);
    }

    // 차트 제목 생성 함수
    function generateChartTitle(chartType = '') {
        const productGroupSelect = document.getElementById('product-group');
        const processSelect = document.getElementById('process');
        const targetSelect = document.getElementById('target');
        const periodSelect = document.getElementById('analysis-period');

        let title = chartType ? `DICD ${chartType}` : 'DICD SPC 분석';

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

            title = `DICD ${chartType} (제품군:${productGroupName}, 공정:${processName}, 타겟:${targetName}, 기간:${periodText})`;
        }

        return title;
    }

    // 관리도 차트 생성
    function createControlChart(data) {
        // 차트 컨테이너 준비
        document.getElementById('control-chart-container').innerHTML = `
        <canvas id="control-chart"></canvas>
        `;
        
        // 차트 데이터 준비
        // labels를 날짜에서 LOT NO로 변경
        const labels = data.data.lot_nos || data.data.dates.map(date => date.split('T')[0]);
        const values = data.data.values;
        
        // Chart.js 설정
        const ctx = document.getElementById('control-chart').getContext('2d');
        
        // 기존 차트 파괴
        if (controlChart) {
            controlChart.destroy();
        }
        
        // 시그마 구간 변수 초기화
        let cl = null, ucl = null, lcl = null;
        let sigma = null;
        let zone_a_upper = null, zone_a_lower = null;
        let zone_b_upper = null, zone_b_lower = null;
        
        // 데이터셋 준비
        const datasets = [
            {
                label: 'DICD 값',
                data: values,
                borderColor: '#3c8dbc',
                backgroundColor: 'rgba(60, 141, 188, 0.1)',
                fill: false,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }
        ];
        
        // 차트 옵션 초기화
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: generateChartTitle('관리도 분석')
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
                        text: 'LOT NO'  // X축 제목 변경
                    },
                    ticks: {
                        // LOT NO를 90도 회전시켜 세로로 표시
                        maxRotation: 90,
                        minRotation: 90,
                        autoSkip: true,
                        maxTicksLimit: 30,
                        font: {
                            size: 10
                        }
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
        
        // 관리 한계선이 있는 경우
        if (data.control_limits && data.control_limits.cl !== undefined) {
            cl = data.control_limits.cl;
            ucl = data.control_limits.ucl;
            lcl = data.control_limits.lcl;
            
            // 시그마 구간 계산 (3-시그마 기준)
            sigma = (ucl - cl) / 3;
            zone_a_upper = cl + (2 * sigma);
            zone_a_lower = cl - (2 * sigma);
            zone_b_upper = cl + sigma;
            zone_b_lower = cl - sigma;
            
            // 중심선 추가
            datasets.push({
                label: 'CL',
                data: Array(labels.length).fill(cl),
                borderColor: '#28a745',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            });
            
            // UCL 추가
            datasets.push({
                label: 'UCL',
                data: Array(labels.length).fill(ucl),
                borderColor: '#dc3545',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            });
            
            // LCL 추가
            datasets.push({
                label: 'LCL',
                data: Array(labels.length).fill(lcl),
                borderColor: '#dc3545',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            });
            
            // 시그마 구간이 계산된 경우에만 툴팁 콜백과 시그마 구간 표시 추가
            if (sigma !== null) {
                // 툴팁 콜백 추가
                chartOptions.plugins.tooltip.callbacks = {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        
                        if (label === 'DICD 값') {
                            const value = context.parsed.y;
                            let zoneInfo = '';
                            
                            // 시그마 구간 표시
                            if (value > zone_a_upper || value < zone_a_lower) {
                                zoneInfo = ' (Zone A)';
                            } else if (value > zone_b_upper || value < zone_b_lower) {
                                zoneInfo = ' (Zone B)';
                            } else {
                                zoneInfo = ' (Zone C)';
                            }
                            
                            return `${label}: ${value.toFixed(3)}${zoneInfo}`;
                        }
                        
                        return `${label}: ${context.parsed.y.toFixed(3)}`;
                    }
                };
                
                // 시그마 구간 애노테이션 추가
                chartOptions.plugins.annotation = {
                    annotations: [
                        {
                            // Zone A (2σ ~ 3σ) - 상단
                            type: 'box',
                            drawTime: 'beforeDatasetsDraw',
                            xScaleID: 'x',
                            yScaleID: 'y',
                            xMin: 0,
                            xMax: labels.length - 1,
                            yMin: zone_a_upper,
                            yMax: ucl,
                            backgroundColor: 'rgba(255, 200, 200, 0.2)',
                            borderWidth: 0
                        },
                        {
                            // Zone A (2σ ~ 3σ) - 하단
                            type: 'box',
                            drawTime: 'beforeDatasetsDraw',
                            xScaleID: 'x',
                            yScaleID: 'y',
                            xMin: 0,
                            xMax: labels.length - 1,
                            yMin: lcl,
                            yMax: zone_a_lower,
                            backgroundColor: 'rgba(255, 200, 200, 0.2)',
                            borderWidth: 0
                        },
                        {
                            // Zone B (1σ ~ 2σ) - 상단
                            type: 'box',
                            drawTime: 'beforeDatasetsDraw',
                            xScaleID: 'x',
                            yScaleID: 'y',
                            xMin: 0,
                            xMax: labels.length - 1,
                            yMin: zone_b_upper,
                            yMax: zone_a_upper,
                            backgroundColor: 'rgba(255, 230, 180, 0.2)',
                            borderWidth: 0
                        },
                        {
                            // Zone B (1σ ~ 2σ) - 하단
                            type: 'box',
                            drawTime: 'beforeDatasetsDraw',
                            xScaleID: 'x',
                            yScaleID: 'y',
                            xMin: 0,
                            xMax: labels.length - 1,
                            yMin: zone_a_lower,
                            yMax: zone_b_lower,
                            backgroundColor: 'rgba(255, 230, 180, 0.2)',
                            borderWidth: 0
                        },
                        {
                            // Zone C (0 ~ 1σ) - 상단
                            type: 'box',
                            drawTime: 'beforeDatasetsDraw',
                            xScaleID: 'x',
                            yScaleID: 'y',
                            xMin: 0,
                            xMax: labels.length - 1,
                            yMin: cl,
                            yMax: zone_b_upper,
                            backgroundColor: 'rgba(200, 255, 200, 0.2)',
                            borderWidth: 0
                        },
                        {
                            // Zone C (0 ~ 1σ) - 하단
                            type: 'box',
                            drawTime: 'beforeDatasetsDraw',
                            xScaleID: 'x',
                            yScaleID: 'y',
                            xMin: 0,
                            xMax: labels.length - 1,
                            yMin: zone_b_lower,
                            yMax: cl,
                            backgroundColor: 'rgba(200, 255, 200, 0.2)',
                            borderWidth: 0
                        }
                    ]
                };
            }
        }
        
        // SPEC 추가
        if (data.spec) {
            const usl = data.spec.usl;
            const lsl = data.spec.lsl;
            const target = data.spec.target || ((usl + lsl) / 2);
            
            // USL 추가
            datasets.push({
                label: 'USL',
                data: Array(labels.length).fill(usl),
                borderColor: '#3366ff',
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false
            });
            
            // LSL 추가
            datasets.push({
                label: 'LSL',
                data: Array(labels.length).fill(lsl),
                borderColor: '#3366ff',
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false
            });

            // 타겟값 추가 - 새로 추가하는 코드
            datasets.push({
                label: '타겟',
                data: Array(labels.length).fill(target),
                borderColor: '#FF9900',  // 주황색 사용
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false
            });
        }
        
        // 패턴 표시
        if (data.patterns && data.patterns.length > 0) {
            // Rule 1 (한계선 초과) 패턴만 표시
            const rule1Patterns = data.patterns.filter(pattern => pattern.rule === 1);
            
            if (rule1Patterns.length > 0) {
                // 이상점 데이터셋 생성 (나머지는 null)
                const outlierData = Array(values.length).fill(null);
                
                rule1Patterns.forEach(pattern => {
                    outlierData[pattern.position] = values[pattern.position];
                });
                
                // 이상점 데이터셋 추가
                datasets.push({
                    label: '이상점',
                    data: outlierData,
                    borderColor: '#dc3545',
                    backgroundColor: '#dc3545',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointStyle: 'circle',
                    fill: false,
                    showLine: false
                });
            }
        }
        
        // 변경점 annotations 생성
        const changePointAnnotations = {};
        if (currentChangePoints && currentChangePoints.length > 0 && showChangePoints) {
            console.log('변경점 처리 시작:', currentChangePoints.length, '개');
            console.log('SPC 차트 실제 날짜 데이터:', data.data.dates);
            
            currentChangePoints.forEach((changePoint, index) => {
                const changeDate = new Date(changePoint.change_date);
                const changeDateStr = changeDate.toLocaleDateString('ko-KR');
                
                console.log('변경점 처리:', changeDateStr, '라벨:', labels);
                
                // SPC 차트에서는 labels가 LOT 번호이므로, data.data.dates와 비교
                let dateIndex = -1;
                
                if (data.data.dates && data.data.dates.length > 0) {
                    const changeDateTime = changeDate.getTime();
                    
                    // 실제 측정 날짜와 변경점 날짜 비교
                    for (let i = 0; i < data.data.dates.length; i++) {
                        const measurementDate = new Date(data.data.dates[i]);
                        
                        // 변경점 날짜와 같거나 이후인 첫 번째 측정 날짜 찾기
                        if (measurementDate.getTime() >= changeDateTime) {
                            dateIndex = i;
                            console.log('SPC 변경점 매칭 완료:', data.data.dates[i], 'at index', i);
                            break;
                        }
                    }
                    
                    // 정확한 매칭이 없으면 가장 가까운 이전 날짜 찾기
                    if (dateIndex === -1) {
                        let closestIndex = -1;
                        let minTimeDiff = Infinity;
                        
                        for (let i = 0; i < data.data.dates.length; i++) {
                            const measurementDate = new Date(data.data.dates[i]);
                            const timeDiff = Math.abs(measurementDate.getTime() - changeDateTime);
                            
                            if (timeDiff < minTimeDiff) {
                                minTimeDiff = timeDiff;
                                closestIndex = i;
                            }
                        }
                        
                        if (closestIndex >= 0) {
                            dateIndex = closestIndex;
                            console.log('SPC 가장 가까운 날짜 찾음:', data.data.dates[closestIndex], 'at index', closestIndex);
                        }
                    }
                }
                
                if (dateIndex >= 0) {
                    console.log('SPC 변경점 annotation 생성:', dateIndex);
                    changePointAnnotations[`changePoint${index}`] = {
                        type: 'line',
                        xMin: dateIndex,
                        xMax: dateIndex,
                        borderColor: '#dc3545',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        label: {
                            content: '▶',
                            display: true,
                            position: 'start',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            font: {
                                size: 12,
                                weight: 'bold'
                            },
                            padding: 4,
                            borderRadius: 4,
                            yAdjust: -10
                        },
                        click: function(ctx, event) {
                            console.log('변경점 annotation 클릭됨');
                            showChangePointDetails(changePoint);
                            return true;
                        },
                        // 변경점 데이터 저장 (클릭 이벤트용)
                        changePointData: changePoint
                    };
                } else {
                    console.log('SPC에서 해당 날짜의 매칭 위치를 찾을 수 없음:', changeDateStr);
                }
            });
        }

        // 기존 chartOptions에 변경점 annotations 추가
        const extendedChartOptions = {
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                annotation: {
                    annotations: {
                        ...chartOptions.plugins.annotation?.annotations,
                        ...changePointAnnotations
                    }
                }
            }
        };

        // 차트 생성
        controlChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: extendedChartOptions
        });
        
        // Canvas 클릭 이벤트로 변경점 마커 클릭 처리
        if (ctx.canvas) {
            ctx.canvas.addEventListener('click', function(event) {
                const rect = ctx.canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                
                // 차트 영역 내 좌표로 변환
                const canvasPosition = Chart.helpers.getRelativePosition(event, controlChart);
                
                // Annotation 클릭 체크
                if (controlChart.options.plugins.annotation && controlChart.options.plugins.annotation.annotations) {
                    const annotations = controlChart.options.plugins.annotation.annotations;
                    const labels = controlChart.data.labels;
                    
                    Object.values(annotations).forEach(annotation => {
                        if (annotation.changePointData) {
                            // annotation의 x 위치 계산
                            const annotationX = annotation.xMin !== undefined ? 
                                (annotation.xMin / (labels.length - 1)) * controlChart.chartArea.width : null;
                            
                            // 클릭 위치가 annotation 근처인지 확인 (± 20px)
                            if (annotationX !== null && Math.abs(canvasPosition.x - annotationX) <= 20) {
                                console.log('변경점 클릭 감지:', annotation.changePointData);
                                showChangePointDetails(annotation.changePointData);
                            }
                        }
                    });
                }
            });
        }
    }

    // 변경점 상세 정보 표시
    function showChangePointDetails(changePoint) {
        const changeDate = new Date(changePoint.change_date);
        const formattedDate = changeDate.toLocaleDateString('ko-KR');
        
        // 기존 모달과 백드롭 완전히 정리
        const existingModal = document.getElementById('changePointModal');
        if (existingModal) {
            $(existingModal).modal('hide');
            existingModal.remove();
        }
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open').css('padding-right', '');
        
        const modal = `
        <div class="modal fade" id="changePointModal" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-exclamation-triangle text-warning mr-2"></i>
                            변경점 정보
                        </h5>
                        <button type="button" class="close" data-dismiss="modal">
                            <span>&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <strong>변경 날짜:</strong><br>
                                ${formattedDate}
                            </div>
                            <div class="col-md-6">
                                <strong>등록일:</strong><br>
                                ${new Date(changePoint.created_at).toLocaleDateString('ko-KR')}
                            </div>
                        </div>
                        <div class="mt-3">
                            <strong>변경 내용:</strong><br>
                            <div class="border p-2 mt-1" style="background-color: #f8f9fa;">
                                ${changePoint.description}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">닫기</button>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        // 새 모달 추가
        $('body').append(modal);
        
        // 모달 표시
        const modalElement = $('#changePointModal');
        modalElement.modal('show');
        
        // 모달이 완전히 닫힌 후 정리
        modalElement.on('hidden.bs.modal', function () {
            $(this).remove();
            $('.modal-backdrop').remove();
            $('body').removeClass('modal-open').css('padding-right', '');
        });
    }

    // 변경점 표시/숨기기 토글
    function toggleChangePoints() {
        showChangePoints = !showChangePoints;
        
        if (currentMeasurements) {
            // SPC 결과를 다시 업데이트하여 변경점 반영 (X-bar 차트와 R 차트 모두)
            const result = controlChart ? { data: currentMeasurements } : null;
            if (result) {
                updateSpcResults(result);
            }
        }
        
        // 버튼 텍스트 업데이트
        const toggleBtn = document.getElementById('toggle-change-points-btn');
        if (toggleBtn) {
            toggleBtn.innerHTML = showChangePoints ? 
                '<i class="fas fa-eye-slash mr-1"></i> 변경점 숨기기' : 
                '<i class="fas fa-eye mr-1"></i> 변경점 표시';
        }
        
        console.log('변경점 토글:', showChangePoints ? '표시' : '숨김');
    }
    
    // R 차트 생성
    function createRChart(data) {
        // 차트 컨테이너 준비
        document.getElementById('r-chart-container').innerHTML = `
        <canvas id="r-chart"></canvas>
        `;
        
        // 차트 데이터 준비
        const labels = data.data.dates.map(date => date.split('T')[0]);
        
        // 범위 값 계산 (subgroup 범위)
        // 현재 데이터에 범위값이 직접 포함되어 있지 않다면 계산 필요
        // 여기서는 예시로 위치별 최대값-최소값 차이를 범위로 사용
        const rValues = [];
        
        // 위치별 데이터가 있는 경우
        if (data.position_data) {
            const positions = ['top', 'center', 'bottom', 'left', 'right'];
            
            // 각 날짜별로 위치 데이터의 범위(최대-최소) 계산
            for (let i = 0; i < labels.length; i++) {
                let valuesAtPosition = [];
                positions.forEach(pos => {
                    if (data.position_data[pos] && typeof data.position_data[pos][i] === 'number') {
                        valuesAtPosition.push(data.position_data[pos][i]);
                    }
                });
                
                // 위치별 값이 있으면 범위 계산, 없으면 0
                if (valuesAtPosition.length > 1) {
                    const max = Math.max(...valuesAtPosition);
                    const min = Math.min(...valuesAtPosition);
                    rValues.push(max - min);
                } else {
                    // 범위 데이터가 없는 경우 0 또는 null로 처리
                    rValues.push(0);
                }
            }
        } else {
            // 위치별 데이터가 없는 경우, 값 자체가 범위를 나타낸다고 가정
            // 또는 data.data.values를 사용하여 이동 범위(moving range) 계산 가능
            for (let i = 1; i < data.data.values.length; i++) {
                const currentValue = data.data.values[i];
                const prevValue = data.data.values[i-1];
                const range = Math.abs(currentValue - prevValue);
                rValues.push(range);
            }
            
            // 첫 번째 데이터 포인트에 대한 범위 (앞의 데이터가 없으므로 두 번째 범위 값과 동일하게 처리)
            if (rValues.length > 0) {
                rValues.unshift(rValues[0]);
            }
        }
        
        // R 차트의 관리 한계 계산
        // 이 값은 API에서 제공하거나 직접 계산할 수 있음
        const rAvg = rValues.reduce((sum, value) => sum + value, 0) / rValues.length;
        const d2 = 2.326; // k=5 subgroup 크기에 대한 d2 상수 (위치 5개 기준)
        const d3 = 0.864; // k=5에 대한 d3 상수
        const rUcl = rAvg + (3 * rAvg * d3 / d2);
        const rLcl = Math.max(0, rAvg - (3 * rAvg * d3 / d2)); // LCL은 0보다 작을 수 없음
        
        // Chart.js 설정
        const ctx = document.getElementById('r-chart').getContext('2d');
        
        // 기존 차트 파괴
        if (rChart) {
            rChart.destroy();
        }
        
        // 데이터셋 준비
        const datasets = [
            {
                label: 'Range (R)',
                data: rValues,
                borderColor: '#3c8dbc',
                backgroundColor: 'rgba(60, 141, 188, 0.1)',
                fill: false,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            },
            {
                label: 'R-bar',
                data: Array(labels.length).fill(rAvg),
                borderColor: '#28a745',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            },
            {
                label: 'UCL',
                data: Array(labels.length).fill(rUcl),
                borderColor: '#dc3545',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            }
        ];
        
        // LCL이 0보다 크면 추가
        if (rLcl > 0) {
            datasets.push({
                label: 'LCL',
                data: Array(labels.length).fill(rLcl),
                borderColor: '#dc3545',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            });
        }
        
        // R 차트용 변경점 annotations 생성 (X-bar 차트와 동일한 로직 사용)
        const rChangePointAnnotations = {};
        if (currentChangePoints && currentChangePoints.length > 0 && showChangePoints) {
            console.log('R 차트 변경점 처리 시작:', currentChangePoints.length, '개');
            
            currentChangePoints.forEach((changePoint, index) => {
                const changeDate = new Date(changePoint.change_date);
                const changeDateStr = changeDate.toLocaleDateString('ko-KR');
                
                // R 차트도 X-bar 차트와 같은 labels를 사용하므로 동일한 로직 적용
                let dateIndex = -1;
                
                if (data.data.dates && data.data.dates.length > 0) {
                    const changeDateTime = changeDate.getTime();
                    
                    // 실제 측정 날짜와 변경점 날짜 비교
                    for (let i = 0; i < data.data.dates.length; i++) {
                        const measurementDate = new Date(data.data.dates[i]);
                        
                        // 변경점 날짜와 같거나 이후인 첫 번째 측정 날짜 찾기
                        if (measurementDate.getTime() >= changeDateTime) {
                            dateIndex = i;
                            console.log('R 차트 변경점 매칭 완료:', data.data.dates[i], 'at index', i);
                            break;
                        }
                    }
                    
                    // 정확한 매칭이 없으면 가장 가까운 날짜 찾기
                    if (dateIndex === -1) {
                        let closestIndex = -1;
                        let minTimeDiff = Infinity;
                        
                        for (let i = 0; i < data.data.dates.length; i++) {
                            const measurementDate = new Date(data.data.dates[i]);
                            const timeDiff = Math.abs(measurementDate.getTime() - changeDateTime);
                            
                            if (timeDiff < minTimeDiff) {
                                minTimeDiff = timeDiff;
                                closestIndex = i;
                            }
                        }
                        
                        if (closestIndex >= 0) {
                            dateIndex = closestIndex;
                            console.log('R 차트 가장 가까운 날짜 찾음:', data.data.dates[closestIndex], 'at index', closestIndex);
                        }
                    }
                }
                
                if (dateIndex >= 0) {
                    console.log('R 차트 변경점 annotation 생성:', dateIndex);
                    rChangePointAnnotations[`rChangePoint${index}`] = {
                        type: 'line',
                        xMin: dateIndex,
                        xMax: dateIndex,
                        borderColor: '#dc3545',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        label: {
                            content: '▶',
                            display: true,
                            position: 'start',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            font: {
                                size: 12,
                                weight: 'bold'
                            },
                            padding: 4,
                            borderRadius: 4,
                            yAdjust: -10
                        },
                        // 변경점 데이터 저장 (클릭 이벤트용)
                        changePointData: changePoint
                    };
                } else {
                    console.log('R 차트에서 해당 날짜의 매칭 위치를 찾을 수 없음:', changeDateStr);
                }
            });
        }
        
        // 차트 생성
        rChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: generateChartTitle('R차트 분석')
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        position: 'top'
                    },
                    annotation: {
                        annotations: rChangePointAnnotations
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
                            text: '범위 (R)'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
        
        // R 차트 Canvas 클릭 이벤트 추가
        if (ctx.canvas) {
            ctx.canvas.addEventListener('click', function(event) {
                const canvasPosition = Chart.helpers.getRelativePosition(event, rChart);
                
                // Annotation 클릭 체크
                if (rChart.options.plugins.annotation && rChart.options.plugins.annotation.annotations) {
                    const annotations = rChart.options.plugins.annotation.annotations;
                    const chartLabels = rChart.data.labels;
                    
                    Object.values(annotations).forEach(annotation => {
                        if (annotation.changePointData) {
                            // annotation의 x 위치 계산
                            const annotationX = annotation.xMin !== undefined ? 
                                (annotation.xMin / (chartLabels.length - 1)) * rChart.chartArea.width : null;
                            
                            // 클릭 위치가 annotation 근처인지 확인 (± 20px)
                            if (annotationX !== null && Math.abs(canvasPosition.x - annotationX) <= 20) {
                                console.log('R 차트 변경점 클릭 감지:', annotation.changePointData);
                                showChangePointDetails(annotation.changePointData);
                            }
                        }
                    });
                }
            });
        }
    }

    // 관리 한계 테이블 업데이트
    function updateControlLimitsTable(controlLimits) {
        if (!controlLimits) {
            return;
        }
        
        // 테이블 업데이트
        const tableBody = document.querySelector('#control-limits-table tbody');
        
        tableBody.innerHTML = `
        <tr>
            <th>중심선 (CL)</th>
            <td>${controlLimits.cl ? controlLimits.cl.toFixed(3) : '-'}</td>
        </tr>
        <tr>
            <th>상한 관리선 (UCL)</th>
            <td>${controlLimits.ucl ? controlLimits.ucl.toFixed(3) : '-'}</td>
        </tr>
        <tr>
            <th>하한 관리선 (LCL)</th>
            <td>${controlLimits.lcl ? controlLimits.lcl.toFixed(3) : '-'}</td>
        </tr>
        `;
    }
    
    // 공정능력지수 테이블 업데이트 함수 수정
    function updateCapabilityTable(capability) {
        // 테이블 업데이트
        const tableBody = document.querySelector('#capability-table tbody');
        
        // capability가 없거나 필요한 필드가 없는 경우 처리
        if (!capability) {
            tableBody.innerHTML = `
            <tr>
                <th>Cp</th>
                <td>-</td>
            </tr>
            <tr>
                <th>Cpk</th>
                <td>-</td>
            </tr>
            <tr>
                <th>Pp</th>
                <td>-</td>
            </tr>
            <tr>
                <th>Ppk</th>
                <td>-</td>
            </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = `
        <tr>
            <th>Cp</th>
            <td>${capability.cp !== undefined ? capability.cp.toFixed(3) : '-'}</td>
        </tr>
        <tr>
            <th>Cpk</th>
            <td>${capability.cpk !== undefined ? capability.cpk.toFixed(3) : '-'}</td>
        </tr>
        <tr>
            <th>Pp</th>
            <td>${capability.pp !== undefined ? capability.pp.toFixed(3) : '-'}</td>
        </tr>
        <tr>
            <th>Ppk</th>
            <td>${capability.ppk !== undefined ? capability.ppk.toFixed(3) : '-'}</td>
        </tr>
        `;
    }
    
    // SPEC 테이블 업데이트
    function updateSpecTable(spec) {
        if (!spec) {
            return;
        }
        
        // 테이블 업데이트
        const tableBody = document.querySelector('#spec-table tbody');
        
        tableBody.innerHTML = `
        <tr>
            <th>LSL</th>
            <td>${spec.lsl ? spec.lsl.toFixed(3) : '-'}</td>
        </tr>
        <tr>
            <th>USL</th>
            <td>${spec.usl ? spec.usl.toFixed(3) : '-'}</td>
        </tr>
        <tr>
            <th>타겟</th>
            <td>${spec.target ? spec.target.toFixed(3) : '-'}</td>
        </tr>
        `;
    }
    
    // updatePatternsTable 함수에 클릭 이벤트를 추가
    function updatePatternsTable(patterns) {
        // 테이블 업데이트
        const tableBody = document.querySelector('#patterns-table tbody');
        
        if (!patterns || patterns.length === 0) {
            tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">패턴 감지 데이터가 없습니다.</td>
            </tr>
            `;
            return;
        }
        
        let tableHtml = '';
        
        patterns.forEach((pattern, index) => {
            // 위치 대신 LOT NO를 표시 (backend에서 전달한 경우)
            const lotNoDisplay = pattern.lot_no || `LOT ${pattern.position + 1}`;
            
            tableHtml += `
            <tr data-pattern-index="${index}" class="pattern-row" style="cursor: pointer;">
                <td>Rule ${pattern.rule}</td>
                <td>${pattern.description}</td>
                <td>${lotNoDisplay}</td>
                <td>${pattern.value ? pattern.value.toFixed(3) : (pattern.length ? `길이: ${pattern.length}` : '-')}</td>
            </tr>
            `;
        });
        
        tableBody.innerHTML = tableHtml;
        
        // 패턴 행 클릭 이벤트 추가
        document.querySelectorAll('.pattern-row').forEach(row => {
            row.addEventListener('click', function() {
                const patternIndex = parseInt(this.getAttribute('data-pattern-index'));
                highlightPattern(patterns[patternIndex]);
                
                // 선택된 행 강조
                document.querySelectorAll('.pattern-row').forEach(r => r.classList.remove('table-primary'));
                this.classList.add('table-primary');
            });
        });
    }

    // 패턴 강조 함수 추가
    function highlightPattern(pattern) {
        if (!controlChart) return;
        
        // 기존 데이터셋 상태 저장
        const originalDatasets = JSON.parse(JSON.stringify(controlChart.data.datasets));
        
        // 데이터셋 초기화 (기존 강조 제거)
        controlChart.data.datasets = originalDatasets.filter(ds => !ds.patternHighlight);
        
        // 패턴 유형에 따라 강조 방식 결정
        const highlightData = Array(controlChart.data.labels.length).fill(null);
        let positions = [];
        
        switch (pattern.rule) {
            case 1: // 한 점이 관리 한계선을 벗어남
                positions = [pattern.position];
                break;
            case 2: // 9개 연속 점이 중심선의 같은 쪽에 있음
                positions = Array.from({length: 9}, (_, i) => pattern.position + i);
                break;
            case 3: // 6개 연속 점이 증가하거나 감소함
                positions = Array.from({length: 6}, (_, i) => pattern.position + i);
                break;
            case 4: // 14개 연속 점이 교대로 증가/감소함
                positions = Array.from({length: 14}, (_, i) => pattern.position + i);
                break;
            case 5: // 2점 중 2점이 3-시그마 구간의 같은 쪽에 있음 (Zone A)
                positions = Array.from({length: 2}, (_, i) => pattern.position + i);
                break;
            case 6: // 4점 중 4점이 2-시그마 구간의 같은 쪽에 있음 (Zone B)
                positions = Array.from({length: 4}, (_, i) => pattern.position + i);
                break;
            case 7: // 15개 연속 점이 1-시그마 구간 안에 있음 (Zone C)
                positions = Array.from({length: 15}, (_, i) => pattern.position + i);
                break;
            case 8: // 8개 연속 점이 1-시그마 구간 바깥에 있음
                positions = Array.from({length: 8}, (_, i) => pattern.position + i);
                break;
        }
        
        // 유효한 위치만 필터링 (배열 범위를 벗어나는 위치 제거)
        positions = positions.filter(pos => pos >= 0 && pos < controlChart.data.labels.length);
        
        // 강조할 위치 데이터 설정
        positions.forEach(pos => {
            highlightData[pos] = controlChart.data.datasets[0].data[pos];
        });
        
        // 강조 데이터셋 추가
        controlChart.data.datasets.push({
            label: '강조된 패턴',
            data: highlightData,
            borderColor: '#dc3545',
            backgroundColor: '#dc3545',
            pointRadius: 8,
            pointHoverRadius: 10,
            pointStyle: 'circle',
            borderWidth: 3,
            fill: false,
            showLine: false,
            patternHighlight: true
        });
        
        // 패턴 설명 영역 표시
        showPatternExplanation(pattern, positions);
        
        // 차트 업데이트
        controlChart.update();
    }

    // 패턴 설명 영역 표시 함수
    function showPatternExplanation(pattern, positions) {
        // 패턴 설명 컨테이너 찾기 (없으면 생성)
        let patternExplanationEl = document.querySelector('#pattern-explanation');
        
        if (!patternExplanationEl) {
            patternExplanationEl = document.createElement('div');
            patternExplanationEl.id = 'pattern-explanation';
            patternExplanationEl.className = 'alert alert-info mt-3';
            document.querySelector('#control-chart-container').after(patternExplanationEl);
        }
        
        // 시그마 구간 설명 준비
        let zoneExplanation = '';
        switch (pattern.rule) {
            case 5:
                zoneExplanation = '<span class="badge sigma-zone-a">Zone A (2σ-3σ)</span> 구간은 중심선(CL)에서 2-시그마와 3-시그마 사이의 영역입니다.';
                break;
            case 6:
                zoneExplanation = '<span class="badge sigma-zone-b">Zone B (1σ-2σ)</span> 구간은 중심선(CL)에서 1-시그마와 2-시그마 사이의 영역입니다.';
                break;
            case 7:
                zoneExplanation = '<span class="badge sigma-zone-c">Zone C (0-1σ)</span> 구간은 중심선(CL)에서 0-시그마와 1-시그마 사이의 영역입니다.';
                break;
        }
        
        // 패턴 설명 내용 설정
        patternExplanationEl.innerHTML = `
            <h5 class="mb-2">Rule ${pattern.rule} 패턴 설명</h5>
            <p class="mb-1"><strong>${pattern.description}</strong></p>
            <p class="mb-2 small">위치: ${positions.map(p => `포인트 ${p+1}`).join(', ')}</p>
            ${zoneExplanation ? `<p class="mb-0">${zoneExplanation}</p>` : ''}
            <button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="reset-highlight">강조 표시 지우기</button>
        `;
        
        // 강조 표시 지우기 버튼 이벤트
        document.querySelector('#reset-highlight').addEventListener('click', resetPatternHighlight);
    }

    // 패턴 강조 표시 초기화 함수
    function resetPatternHighlight() {
        if (!controlChart) return;
        
        // 강조 데이터셋 제거
        controlChart.data.datasets = controlChart.data.datasets.filter(ds => !ds.patternHighlight);
        
        // 차트 업데이트
        controlChart.update();
        
        // 패턴 설명 영역 제거
        const patternExplanationEl = document.querySelector('#pattern-explanation');
        if (patternExplanationEl) {
            patternExplanationEl.remove();
        }
        
        // 테이블에서 선택된 행 강조 제거
        document.querySelectorAll('.pattern-row').forEach(r => r.classList.remove('table-primary'));
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
        if (dataSection) {
            dataSection.style.display = 'none';
        }
    }

    // 관리도 차트를 다운로드하는 함수
    async function downloadControlChart() {
        if (!controlChart) {
            alert('다운로드할 관리도가 없습니다. 먼저 분석을 실행하세요.');
            return;
        }

        try {
            const canvas = controlChart.canvas;
            const link = document.createElement('a');
            const fileName = generateSpcChartFileName('관리도');

            link.download = fileName;
            link.href = canvas.toDataURL('image/png');

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showNotification('관리도가 다운로드되었습니다.');

        } catch (error) {
            console.error('관리도 다운로드 실패:', error);
            showNotification('관리도 다운로드 중 오류가 발생했습니다.');
        }
    }

    // R차트를 다운로드하는 함수
    async function downloadRChart() {
        if (!rChart) {
            alert('다운로드할 R차트가 없습니다. 먼저 분석을 실행하세요.');
            return;
        }

        try {
            const canvas = rChart.canvas;
            const link = document.createElement('a');
            const fileName = generateSpcChartFileName('R차트');

            link.download = fileName;
            link.href = canvas.toDataURL('image/png');

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showNotification('R차트가 다운로드되었습니다.');

        } catch (error) {
            console.error('R차트 다운로드 실패:', error);
            showNotification('R차트 다운로드 중 오류가 발생했습니다.');
        }
    }

    // SPC 차트 파일명 생성 함수
    function generateSpcChartFileName(chartType) {
        const productGroupSelect = document.getElementById('product-group');
        const processSelect = document.getElementById('process');
        const targetSelect = document.getElementById('target');

        let fileName = `SPC_${chartType}`;

        if (selectedTargetId && productGroupSelect.value && processSelect.value) {
            const productGroupName = productGroupSelect.options[productGroupSelect.selectedIndex]?.text || '';
            const processName = processSelect.options[processSelect.selectedIndex]?.text || '';
            const targetName = targetSelect.options[targetSelect.selectedIndex]?.text || '';

            const cleanName = (name) => name.replace(/[<>:"/\\|?*]/g, '_');

            fileName = `SPC_${chartType}_${cleanName(productGroupName)}_${cleanName(processName)}_${cleanName(targetName)}`;
        }

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 19).replace(/:/g, '-');

        return `${fileName}_${dateStr}.png`;
    }

    // 알림 표시 함수
    function showNotification(message) {
        alert(message);
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
                fetchProcesses(selectedProductGroupId);
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
                fetchTargets(selectedProcessId);
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
            analyzeSpc();
        });

        // 관리도 다운로드 버튼 클릭 이벤트
        document.getElementById('download-control-chart-btn').addEventListener('click', function() {
            downloadControlChart();
        });

        // R차트 다운로드 버튼 클릭 이벤트
        document.getElementById('download-r-chart-btn').addEventListener('click', function() {
            downloadRChart();
        });

        // 차트 데이터 보기 버튼 이벤트
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

        // 변경점 토글 버튼 이벤트 (조건부 추가)
        const toggleChangePointsBtn = document.getElementById('toggle-change-points-btn');
        if (toggleChangePointsBtn) {
            toggleChangePointsBtn.addEventListener('click', toggleChangePoints);
        }

        // 분석 기간 선택 변경 이벤트
        utils.initDateControls({
            periodSelector: '#analysis-period',
            containerSelector: '#custom-date-range',
            startDateSelector: '#start-date',
            endDateSelector: '#end-date'
        });
    }
    
    // Chart.js annotation 플러그인 등록 (v3.x용)
    if (window['chartjs-plugin-annotation']) {
        Chart.register(window['chartjs-plugin-annotation']);
    }

    // 페이지 로드 시 초기화
    $(document).ready(function() {
        initSpcPage();
        setupEventListeners();
    });
})();