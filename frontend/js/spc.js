// SPC 분석 페이지 모듈
(function() {
    'use strict';

    // Chart.js annotation 플러그인 우선 등록
    try {
        if (typeof Chart !== 'undefined' && typeof window.chartjsPluginAnnotation !== 'undefined') {
            Chart.register(window.chartjsPluginAnnotation);
            console.log('[SPC] Annotation 플러그인 등록 완료');
        } else {
            console.warn('[SPC] Annotation 플러그인을 찾을 수 없습니다. Chart:', typeof Chart, 'Plugin:', typeof window.chartjsPluginAnnotation);
        }
    } catch (error) {
        console.error('[SPC] Annotation 플러그인 등록 실패:', error);
    }

    // SPEC 구간별 배열 생성 헬퍼
    function buildSegmentedArray(specSegments, length, field) {
        const arr = new Array(length).fill(null);
        if (!specSegments || specSegments.length === 0) return arr;
        specSegments.forEach(seg => {
            if (seg[field] == null) return;
            for (let i = seg.start_index; i <= Math.min(seg.end_index, length - 1); i++) {
                arr[i] = seg[field];
            }
        });
        return arr;
    }

    // 전역 변수
    let controlChart = null;
    let selectedProductGroupId = null;
    let selectedProcessId = null;
    let selectedTargetId = null;
    let rChart = null; // 추가: R 차트 변수
    let currentMeasurements = null; // 추가: 현재 측정 데이터
    let currentChangePoints = null; // 변경점 데이터
    let showChangePoints = true; // 변경점 표시 여부
    let currentSpcResult = null; // 공정팀 양식 다운로드용 SPC 분석 결과
    let currentAlarms = null; // SPC 알람 데이터
    
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
            
            const targets = await api.getTargets(processId, window.PROCESS_TYPE);
            
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
                process_type: window.PROCESS_TYPE || 'PHOTO',
                ...apiParams
            };
            const measurementsResult = await api.getMeasurements(measureParams);
            // SPC 차트는 created_at asc 순서로 표시하므로, getMeasurements(desc) 결과를 역순 정렬
            currentMeasurements = Array.isArray(measurementsResult) ? [...measurementsResult].reverse() : measurementsResult;
            
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

            // SPC 알람 데이터 로드
            try {
                const processType = window.PROCESS_TYPE || 'PHOTO';
                currentAlarms = await api.get(`/spc-alarms/?target_id=${selectedTargetId}&process_type=${processType}&status=&limit=500`);
            } catch (alarmErr) {
                console.warn('SPC 알람 로드 실패 (무시):', alarmErr);
                currentAlarms = null;
            }

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
            currentSpcResult = null;
            clearChartDataTable();
        }
    }
    
    // SPC 분석 결과 업데이트
    function updateSpcResults(result) {
        currentSpcResult = result; // 공정팀 양식 다운로드용 저장
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

        // 공정능력지수 진단 실행
        const diagnosisResults = diagnoseCapabilityIndices(result.process_capability);
        showCapabilityDiagnosis(diagnosisResults);

        // SPEC 테이블 업데이트
        updateSpecTable(result.spec);
        
        // 패턴 감지 결과 업데이트
        updatePatternsTable(result.patterns);

        // 위치별 패턴 감지 결과 업데이트
        updatePositionPatternsTable(result.position_patterns);

        // AI 해석 버튼 표시
        const aiBtn = document.getElementById('ai-analysis-btn');
        if (aiBtn) {
            aiBtn.style.display = 'inline-block';
        }
        // 이전 AI 분석 결과 숨기기
        const aiCard = document.getElementById('ai-analysis-card');
        if (aiCard) {
            aiCard.style.display = 'none';
        }
    }

    // 차트 제목 생성 함수
    function generateChartTitle() {
        const productGroupSelect = document.getElementById('product-group');
        const processSelect = document.getElementById('process');
        const targetSelect = document.getElementById('target');
        const periodSelect = document.getElementById('analysis-period');

        let title = '';

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

            title = `제품군:${productGroupName}, 공정:${processName}, 타겟:${targetName}, 기간:${periodText}`;
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
        
        // ETCH 공정은 FICD, PHOTO 공정은 DICD
        const cdType = window.PROCESS_TYPE === 'ETCH' ? 'FICD' : 'DICD';

        // 데이터셋 준비
        const datasets = [
            {
                label: 'X Bar',
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
                    text: generateChartTitle()
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        filter: function(tooltipItem) {
                            const label = tooltipItem.dataset.label;
                            return label !== 'CL' && label !== 'UCL' && label !== 'LCL' &&
                                   label !== 'USL' && label !== 'LSL' && label !== '타겟' &&
                                   label !== '알람(Critical)' && label !== '알람(Warning)';
                        },
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;

                            if (label === 'X Bar' && sigma !== null) {
                                let zoneInfo = '';
                                if (value > zone_a_upper || value < zone_a_lower) {
                                    zoneInfo = ' (Zone A)';
                                } else if (value > zone_b_upper || value < zone_b_lower) {
                                    zoneInfo = ' (Zone B)';
                                } else {
                                    zoneInfo = ' (Zone C)';
                                }
                                return `${label}: ${value.toFixed(3)}${zoneInfo}`;
                            }

                            return `${label}: ${value.toFixed(3)}`;
                        },
                        footer: function(tooltipItems) {
                            if (!tooltipItems || tooltipItems.length === 0) return '';
                            if (!currentMeasurements || currentMeasurements.length === 0) return '';

                            const dataIndex = tooltipItems[0].dataIndex;
                            const measurement = currentMeasurements[dataIndex];

                            if (!measurement) return '';

                            const device = measurement.device || '-';
                            const lotNo = measurement.lot_no || '-';
                            const exposureTime = measurement.exposure_time || '-';

                            return [
                                '─────────────',
                                `DEVICE: ${device}`,
                                `LOT NO: ${lotNo}`,
                                `Exposure Time: ${exposureTime}`
                            ];
                        }
                    }
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'LOT NO'
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
                        text: `${cdType} 값`
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
            
            // 시그마 구간이 계산된 경우에만 시그마 구간 표시 추가
            if (sigma !== null) {
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
        
        // SPEC 추가 (구간 분리 지원)
        if (data.spec_segments && data.spec_segments.length > 0) {
            // 구간별 SPEC 배열 생성
            datasets.push({
                label: 'USL',
                data: buildSegmentedArray(data.spec_segments, labels.length, 'usl'),
                borderColor: '#3366ff',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                borderDash: [5, 5],
                spanGaps: false
            });
            datasets.push({
                label: 'LSL',
                data: buildSegmentedArray(data.spec_segments, labels.length, 'lsl'),
                borderColor: '#3366ff',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                borderDash: [5, 5],
                spanGaps: false
            });
            datasets.push({
                label: '타겟',
                data: buildSegmentedArray(data.spec_segments, labels.length, 'target'),
                borderColor: '#ff9900',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                spanGaps: false
            });
        } else if (data.spec) {
            // 폴백: 기존 방식 (단일 SPEC)
            const usl = data.spec.usl;
            const lsl = data.spec.lsl;
            const target = data.spec.target || ((usl + lsl) / 2);

            datasets.push({
                label: 'USL',
                data: Array(labels.length).fill(usl),
                borderColor: '#3366ff',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                borderDash: [5, 5]
            });
            datasets.push({
                label: 'LSL',
                data: Array(labels.length).fill(lsl),
                borderColor: '#3366ff',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                borderDash: [5, 5]
            });
            datasets.push({
                label: '타겟',
                data: Array(labels.length).fill(target),
                borderColor: '#ff9900',
                borderWidth: 1,
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
        
        // SPC 알람 마커 표시
        if (currentAlarms && currentAlarms.length > 0 && currentMeasurements && currentMeasurements.length > 0) {
            // measurement_id → 차트 인덱스 매핑
            const measurementIdToIndex = {};
            currentMeasurements.forEach((m, idx) => {
                measurementIdToIndex[m.id] = idx;
            });

            const criticalData = Array(values.length).fill(null);
            const warningData = Array(values.length).fill(null);
            let hasCritical = false;
            let hasWarning = false;

            currentAlarms.forEach(alarm => {
                const idx = measurementIdToIndex[alarm.measurement_id];
                if (idx === undefined) return;

                if (alarm.severity === 'CRITICAL') {
                    criticalData[idx] = values[idx];
                    hasCritical = true;
                } else if (alarm.severity === 'WARNING' && criticalData[idx] === null) {
                    warningData[idx] = values[idx];
                    hasWarning = true;
                }
            });

            if (hasCritical) {
                datasets.push({
                    label: '알람(Critical)',
                    data: criticalData,
                    borderColor: '#dc3545',
                    backgroundColor: '#dc3545',
                    pointRadius: 7,
                    pointHoverRadius: 9,
                    pointStyle: 'triangle',
                    fill: false,
                    showLine: false
                });
            }
            if (hasWarning) {
                datasets.push({
                    label: '알람(Warning)',
                    data: warningData,
                    borderColor: '#ff8c00',
                    backgroundColor: '#ff8c00',
                    pointRadius: 7,
                    pointHoverRadius: 9,
                    pointStyle: 'triangle',
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
        
        // R 차트 이상점 표시 (UCL 초과 직접 감지)
        const rOutlierData = Array(rValues.length).fill(null);
        let hasROutlier = false;
        rValues.forEach((v, i) => {
            if (v > rUcl) {
                rOutlierData[i] = v;
                hasROutlier = true;
            }
        });
        if (hasROutlier) {
            datasets.push({
                label: '이상점',
                data: rOutlierData,
                borderColor: '#dc3545',
                backgroundColor: '#dc3545',
                pointRadius: 6,
                pointHoverRadius: 8,
                pointStyle: 'circle',
                fill: false,
                showLine: false
            });
        }

        // R 차트 알람 마커 표시 (R_CHART 유형만)
        if (currentAlarms && currentAlarms.length > 0 && currentMeasurements && currentMeasurements.length > 0) {
            const measurementIdToIndex = {};
            currentMeasurements.forEach((m, idx) => {
                measurementIdToIndex[m.id] = idx;
            });

            const rAlarmData = Array(rValues.length).fill(null);
            let hasRAlarm = false;

            currentAlarms.forEach(alarm => {
                if (alarm.alarm_type !== 'R_CHART') return;
                const idx = measurementIdToIndex[alarm.measurement_id];
                if (idx === undefined) return;
                rAlarmData[idx] = rValues[idx];
                hasRAlarm = true;
            });

            if (hasRAlarm) {
                datasets.push({
                    label: '알람(R차트)',
                    data: rAlarmData,
                    borderColor: '#dc3545',
                    backgroundColor: '#dc3545',
                    pointRadius: 7,
                    pointHoverRadius: 9,
                    pointStyle: 'triangle',
                    fill: false,
                    showLine: false
                });
            }
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
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            // USL, LSL, Target 기준선 제외
                            filter: function(tooltipItem) {
                                const label = tooltipItem.dataset.label;
                                return label !== 'USL' && label !== 'LSL' && label !== 'Target' &&
                                       label !== '알람(R차트)';
                            },
                            // 각 데이터셋의 값만 표시
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                return `${label}: ${value.toFixed(3)}`;
                            },
                            // 하단에 DEVICE, LOT NO, Exposure Time 정보 한 번만 표시
                            footer: function(tooltipItems) {
                                if (!tooltipItems || tooltipItems.length === 0) return '';
                                if (!currentMeasurements || currentMeasurements.length === 0) return '';

                                const dataIndex = tooltipItems[0].dataIndex;
                                const measurement = currentMeasurements[dataIndex];

                                if (!measurement) return '';

                                const device = measurement.device || '-';
                                const lotNo = measurement.lot_no || '-';
                                const exposureTime = measurement.exposure_time || '-';

                                return [
                                    '─────────────',
                                    `DEVICE: ${device}`,
                                    `LOT NO: ${lotNo}`,
                                    `Exposure Time: ${exposureTime}`
                                ];
                            }
                        }
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
                        },
                        ticks: {
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

    // ===== 공정능력지수 진단 =====

    // 진단 임계값
    const RATIO_THRESHOLD = 1.3;
    const APPROX_RATIO = 1.15;
    const LOW_CAPABILITY = 1.0;
    const GOOD_CAPABILITY = 1.33;

    // 진단 데이터 사전
    const capabilityDiagnosisRules = {
        1: {
            name: 'Cp ≫ Cpk',
            summary: '산포는 충분히 작지만 공정 평균이 규격 중심에서 벗어나 있음',
            icon: 'fas fa-arrows-alt-h',
            alertClass: 'diagnosis-warning',
            causes: [
                '설비 셋업 시 목표값 설정이 규격 중심과 불일치',
                '공구/금형 마모로 인한 평균 드리프트',
                '원자재 로트 변경 후 평균 이동',
                '측정 장비의 편향(bias) 또는 캘리브레이션 오류',
                '작업자가 의도적으로 한쪽 규격한계를 피해 치우쳐 운영'
            ],
            action: '공정 평균을 규격 중심으로 조정 (상대적으로 쉬운 개선)'
        },
        2: {
            name: 'Cp ≈ Cpk 이지만 둘 다 낮음',
            summary: '평균은 중심에 있으나 산포 자체가 너무 큼',
            icon: 'fas fa-expand-arrows-alt',
            alertClass: 'diagnosis-danger',
            causes: [
                '설비 정밀도 부족 (기계 자체의 반복성/재현성 부족)',
                '원자재 특성의 산포가 큼',
                'Gage R&R 불량 — 측정 시스템 변동이 공정 변동에 혼입',
                '작업 조건(온도, 압력, 속도 등)의 제어가 불충분',
                '공정 파라미터 최적화가 안 된 상태'
            ],
            action: '산포 자체를 줄여야 하므로 근본적인 공정 개선 필요 (DOE, 설비 개조 등)'
        },
        3: {
            name: 'Cp ≫ Pp',
            summary: '단기(군내) 산포는 작지만 장기(전체) 산포가 큼 — 군간 변동이 큰 상태',
            icon: 'fas fa-chart-line',
            alertClass: 'diagnosis-danger',
            causes: [
                '시간에 따른 공정 평균의 이동 (교대 간 작업자 차이, 주간/야간 환경 차이, 원자재 로트 간 차이)',
                '설비 상태 변동 (웜업 전후 차이, 정기 보전 전후 성능 차이, 공구 교체 주기에 따른 변동)',
                '셋업 간 변동 (매 셋업마다 미세하게 다른 조건, 여러 캐비티/스핀들 간 차이)',
                '과잉 조정(over-adjustment) — 불필요한 공정 조정이 오히려 변동을 증가시킴'
            ],
            action: '군간 변동의 원인(시간, 로트, 교대, 설비 등)을 층별 분석하여 특정하고 제거'
        },
        4: {
            name: 'Cpk ≫ Ppk',
            summary: '단기적으로는 능력이 좋지만 장기적으로 치우침과 산포가 모두 불안정',
            icon: 'fas fa-wave-square',
            alertClass: 'diagnosis-warning',
            causes: [
                '공정 평균이 시간에 따라 표류(drift)하면서 규격 중심에서 점점 벗어남',
                '교대/로트/계절별로 평균 위치가 다름',
                '설비 마모가 진행되면서 평균이 한쪽으로 이동',
                'SPC 관리가 형식적이어서 이상 징후를 적시에 조치하지 못함'
            ],
            action: '장기적 평균 이동 원인 추적 및 공정 안정화'
        },
        5: {
            name: 'Pp ≫ Ppk',
            summary: '장기 산포는 규격 대비 충분하지만 장기적으로 평균이 치우쳐 있음',
            icon: 'fas fa-balance-scale-left',
            alertClass: 'diagnosis-warning',
            causes: [
                '공정 목표값 자체가 규격 중심과 다르게 설정됨',
                '비대칭 마모 패턴 (한 방향으로만 마모 진행)',
                '의도적 편향 운영 (예: 한쪽 규격이 더 치명적이라 반대쪽으로 치우쳐 운영)',
                '조건 1(Cp ≫ Cpk)과 유사하되 장기 관점에서의 치우침'
            ],
            action: '평균 재조정, 단 의도적 편향이면 합리적 근거 문서화'
        },
        6: {
            name: 'Cp ≈ Pp, Cpk ≈ Ppk (안정 상태)',
            summary: '군내 변동 ≈ 전체 변동 — 공정이 매우 안정적 (통계적 관리 상태)',
            icon: 'fas fa-check-circle',
            alertClass: 'diagnosis-success',
            causes: [
                '군간 변동이 거의 없음',
                '공정이 잘 관리되고 있는 이상적인 상태',
                '특수 원인이 없고 우연 원인만 존재'
            ],
            action: '현 수준 유지 관리'
        },
        7: {
            name: 'Pp > Cp (비정상)',
            summary: '이론적으로 발생하기 어려운 상황 — 데이터 또는 계산 문제 의심',
            icon: 'fas fa-exclamation-triangle',
            alertClass: 'diagnosis-info',
            causes: [
                '부분군(subgroup) 구성 오류 — 서로 다른 모집단을 하나의 군으로 묶어 군내 변동이 과대 추정됨',
                '부분군 크기(n) 또는 빈도 설정이 부적절',
                '데이터 수집 기간이 너무 짧아 전체 변동이 과소 추정',
                '측정 시스템 문제',
                '계산 공식 적용 오류'
            ],
            action: '부분군 구성 전략(rational subgrouping) 재검토'
        }
    };

    // 공정능력지수 진단 함수
    function diagnoseCapabilityIndices(capability) {
        const results = [];

        if (!capability) return results;

        const { cp, cpk, pp, ppk } = capability;

        // 값 유효성 검사
        if (cp == null || cpk == null || pp == null || ppk == null) return results;
        if (!isFinite(cp) || !isFinite(cpk) || !isFinite(pp) || !isFinite(ppk)) return results;

        // 안전한 비율 계산 헬퍼
        function safeRatio(a, b) {
            if (b <= 0.001) return Infinity;
            return a / b;
        }

        const cpToCpk = safeRatio(cp, cpk);
        const cpkToCp = safeRatio(cpk, cp);
        const cpToPp = safeRatio(cp, pp);
        const ppToCp = safeRatio(pp, cp);
        const cpkToPpk = safeRatio(cpk, ppk);
        const ppToPpk = safeRatio(pp, ppk);

        // 조건 7: Pp > Cp (비정상) - 우선 체크
        if (ppToCp > APPROX_RATIO) {
            const rule = capabilityDiagnosisRules[7];
            results.push({
                rule: 7,
                ...rule,
                details: `Pp=${pp.toFixed(3)}, Cp=${cp.toFixed(3)}, 비율(Pp/Cp)=${ppToCp.toFixed(2)}`
            });
        }

        // 조건 1: Cp >> Cpk (치우침)
        if (cpToCpk > RATIO_THRESHOLD && cp >= LOW_CAPABILITY) {
            const rule = capabilityDiagnosisRules[1];
            results.push({
                rule: 1,
                ...rule,
                details: `Cp=${cp.toFixed(3)}, Cpk=${cpk.toFixed(3)}, 비율(Cp/Cpk)=${cpToCpk.toFixed(2)}`
            });
        }

        // 조건 2: Cp ≈ Cpk 이지만 둘 다 낮음
        if (cpToCpk < APPROX_RATIO && cpkToCp < APPROX_RATIO && cp < LOW_CAPABILITY && cpk < LOW_CAPABILITY) {
            const rule = capabilityDiagnosisRules[2];
            results.push({
                rule: 2,
                ...rule,
                details: `Cp=${cp.toFixed(3)}, Cpk=${cpk.toFixed(3)}`
            });
        }

        // 조건 3: Cp >> Pp (군간 변동)
        if (cpToPp > RATIO_THRESHOLD && cp >= LOW_CAPABILITY) {
            const rule = capabilityDiagnosisRules[3];
            results.push({
                rule: 3,
                ...rule,
                details: `Cp=${cp.toFixed(3)}, Pp=${pp.toFixed(3)}, 비율(Cp/Pp)=${cpToPp.toFixed(2)}`
            });
        }

        // 조건 4: Cpk >> Ppk (장기 불안정)
        if (cpkToPpk > RATIO_THRESHOLD && cpk >= LOW_CAPABILITY) {
            const rule = capabilityDiagnosisRules[4];
            results.push({
                rule: 4,
                ...rule,
                details: `Cpk=${cpk.toFixed(3)}, Ppk=${ppk.toFixed(3)}, 비율(Cpk/Ppk)=${cpkToPpk.toFixed(2)}`
            });
        }

        // 조건 5: Pp >> Ppk (장기 치우침)
        if (ppToPpk > RATIO_THRESHOLD && pp >= LOW_CAPABILITY) {
            const rule = capabilityDiagnosisRules[5];
            results.push({
                rule: 5,
                ...rule,
                details: `Pp=${pp.toFixed(3)}, Ppk=${ppk.toFixed(3)}, 비율(Pp/Ppk)=${ppToPpk.toFixed(2)}`
            });
        }

        // 조건 6: 안정 상태 (Cp ≈ Pp, Cpk ≈ Ppk)
        if (cpToPp < APPROX_RATIO && ppToCp < APPROX_RATIO &&
            cpkToPpk < APPROX_RATIO && safeRatio(ppk, cpk) < APPROX_RATIO &&
            Math.max(cp, cpk, pp, ppk) >= GOOD_CAPABILITY) {
            const rule = capabilityDiagnosisRules[6];
            results.push({
                rule: 6,
                ...rule,
                details: `Cp=${cp.toFixed(3)}, Cpk=${cpk.toFixed(3)}, Pp=${pp.toFixed(3)}, Ppk=${ppk.toFixed(3)}`
            });
        }

        // 심각도순 정렬: danger → warning → info → success
        const severityOrder = { 'diagnosis-danger': 0, 'diagnosis-warning': 1, 'diagnosis-info': 2, 'diagnosis-success': 3 };
        results.sort((a, b) => (severityOrder[a.alertClass] || 99) - (severityOrder[b.alertClass] || 99));

        return results;
    }

    // 공정능력지수 진단 결과 표시 함수
    function showCapabilityDiagnosis(diagnosisResults) {
        const container = document.getElementById('capability-diagnosis');
        if (!container) return;

        if (!diagnosisResults || diagnosisResults.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        let html = '<div class="card"><div class="card-header"><h3 class="card-title"><i class="fas fa-stethoscope mr-1"></i> 공정능력지수 진단</h3></div><div class="card-body">';

        diagnosisResults.forEach(item => {
            const causesHtml = item.causes.map(c => `<li>${c}</li>`).join('');
            html += `
            <div class="capability-diagnosis-item ${item.alertClass}">
                <h6><i class="${item.icon} mr-1"></i> ${item.name}</h6>
                <p class="mb-1">${item.summary}</p>
                <div class="diagnosis-values">${item.details}</div>
                <div class="mt-2 mb-1"><strong>추정 원인:</strong></div>
                <ul>${causesHtml}</ul>
                <div class="diagnosis-action"><i class="fas fa-wrench mr-1"></i> 조치 방향: ${item.action}</div>
            </div>`;
        });

        html += '</div></div>';
        container.innerHTML = html;
        container.style.display = 'block';
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

    // 위치별 패턴 감지 결과 테이블 업데이트
    function updatePositionPatternsTable(positionPatterns) {
        const card = document.getElementById('position-patterns-card');
        const tableBody = document.querySelector('#position-patterns-table tbody');

        if (!card || !tableBody) return;

        // 위치 이름 한글 매핑
        const positionNames = {
            top: '상 (Top)',
            center: '중 (Center)',
            bottom: '하 (Bottom)',
            left: '좌 (Left)',
            right: '우 (Right)'
        };

        if (!positionPatterns || typeof positionPatterns !== 'object') {
            card.style.display = 'none';
            return;
        }

        // 전체 위반 건수 집계
        let totalViolations = 0;
        let tableHtml = '';

        for (const [position, patterns] of Object.entries(positionPatterns)) {
            if (!patterns || patterns.length === 0) continue;
            totalViolations += patterns.length;

            patterns.forEach(pattern => {
                const lotNoDisplay = pattern.lot_no || `LOT ${pattern.position + 1}`;
                tableHtml += `
                <tr>
                    <td><span class="badge badge-info">${positionNames[position] || position}</span></td>
                    <td>Rule ${pattern.rule}</td>
                    <td>${pattern.description}</td>
                    <td>${lotNoDisplay}</td>
                    <td>${pattern.value ? pattern.value.toFixed(3) : (pattern.length ? `길이: ${pattern.length}` : '-')}</td>
                </tr>
                `;
            });
        }

        if (totalViolations === 0) {
            card.style.display = 'none';
            return;
        }

        tableBody.innerHTML = tableHtml;
        card.style.display = 'block';
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

    // Nelson Rules 추정 원인 데이터
    const ruleCauses = {
        1: [
            '설비 고장 또는 갑작스러운 이상 (공구 파손, 금형 손상 등)',
            '원자재 로트 변경으로 인한 급격한 특성 변화',
            '측정 장비 오류 또는 작업자의 조작 실수',
            '셋업(setup) 오류'
        ],
        2: [
            '공정 평균의 이동(shift)이 발생한 상태',
            '원자재 공급업체 변경 또는 로트 간 차이',
            '설비 마모가 점진적으로 진행 (공구 마모, 베어링 열화 등)',
            '작업 환경 변화 (온도, 습도의 지속적 변동)',
            '측정 장비의 편향(bias) 발생'
        ],
        3: [
            '공구나 금형의 점진적 마모',
            '장비 부품의 열화 (필터 막힘, 윤활유 열화 등)',
            '환경 요인의 점진적 변화 (시간에 따른 온도 상승 등)',
            '화학 공정에서 촉매 성능 저하',
            '작업자 피로 누적'
        ],
        4: [
            '두 대의 설비, 두 명의 작업자, 두 개의 원자재 로트가 교대로 투입',
            '과도한 공정 조정(over-adjustment) — 목표값 위아래로 반복 보정',
            '주기적 환경 변화 (주간/야간 온도 차이, 냉각수 온도 변동)',
            '두 개의 측정기를 교대 사용'
        ],
        5: [
            '공정 산포의 증가 징후',
            '두 가지 이상 공정 조건이 혼재 (예: 두 가지 원자재 혼용)',
            '설비 상태가 불안정해지기 시작하는 초기 단계',
            '간헐적인 외부 교란 요인 발생'
        ],
        6: [
            '공정 평균이 서서히 이동 중인 상태',
            'Rule 2(런)로 발전하기 전 단계의 초기 경고 신호',
            '소규모의 원자재 특성 변화',
            '설비 조건(압력, 온도 등)의 미세한 드리프트'
        ],
        7: [
            '부분군(subgroup) 구성 오류 — 서로 다른 모집단의 데이터를 하나의 부분군으로 혼합',
            '관리한계선이 너무 넓게 설정됨',
            '데이터 조작 또는 기록 오류 의심',
            '산포가 실제로 크게 줄었을 경우 (공정 개선 후 관리한계 미갱신)'
        ],
        8: [
            '다수의 설비(기계)에서 나온 제품을 혼합 측정',
            '서로 다른 작업자, 원자재, 금형 캐비티의 결과가 섞임',
            '부분군 내에 체계적인 차이가 존재',
            '과도한 공정 조정(over-control)으로 인해 중심 부근 데이터가 사라짐'
        ]
    };

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

        // 추정 원인 목록 생성
        const causes = ruleCauses[pattern.rule] || [];
        const causesHtml = causes.length > 0 ? `
            <div class="mt-2 mb-2">
                <strong>추정 원인:</strong>
                <ul class="mb-0 mt-1 pl-3">
                    ${causes.map(c => `<li>${c}</li>`).join('')}
                </ul>
            </div>
        ` : '';

        // 패턴 설명 내용 설정
        patternExplanationEl.innerHTML = `
            <h5 class="mb-2">Rule ${pattern.rule} 패턴 설명</h5>
            <p class="mb-1"><strong>${pattern.description}</strong></p>
            <p class="mb-2 small">위치: ${positions.map(p => `포인트 ${p+1}`).join(', ')}</p>
            ${zoneExplanation ? `<p class="mb-0">${zoneExplanation}</p>` : ''}
            ${causesHtml}
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

        // ETCH 공정 여부 확인
        const isEtch = window.PROCESS_TYPE === 'ETCH';

        // 데이터가 있으면 테이블 업데이트
        if (measurements && measurements.length > 0) {
            measurements.forEach(measurement => {
                const date = new Date(measurement.created_at).toLocaleDateString();
                const exposureTimeCell = isEtch ? '' : `<td>${measurement.exposure_time || '-'}</td>`;
                const row = `
                    <tr>
                        <td>${date}</td>
                        <td>${measurement.author || '-'}</td>
                        <td>${measurement.device || '-'}</td>
                        <td>${measurement.lot_no || '-'}</td>
                        ${exposureTimeCell}
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

        // 차트 데이터 보기 버튼 다시 표시
        const showBtn = document.getElementById('show-data-btn');
        if (showBtn) {
            showBtn.style.display = 'inline-block';
        }
    }

    // SPC 차트 통합 다운로드 함수 (관리도 + R차트를 하나의 이미지로)
    async function downloadSpcChart() {
        if (!controlChart && !rChart) {
            alert('다운로드할 차트가 없습니다. 먼저 분석을 실행하세요.');
            return;
        }

        try {
            const controlCanvas = controlChart ? controlChart.canvas : null;
            const rCanvas = rChart ? rChart.canvas : null;

            const gap = 20;
            const totalWidth = Math.max(
                controlCanvas ? controlCanvas.width : 0,
                rCanvas ? rCanvas.width : 0
            );
            const totalHeight =
                (controlCanvas ? controlCanvas.height : 0) +
                gap +
                (rCanvas ? rCanvas.height : 0);

            const mergedCanvas = document.createElement('canvas');
            mergedCanvas.width = totalWidth;
            mergedCanvas.height = totalHeight;
            const ctx = mergedCanvas.getContext('2d');

            // 배경을 흰색으로 채우기
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, totalWidth, totalHeight);

            let yOffset = 0;
            if (controlCanvas) {
                ctx.drawImage(controlCanvas, 0, yOffset);
                yOffset += controlCanvas.height + gap;
            }
            if (rCanvas) {
                ctx.drawImage(rCanvas, 0, yOffset);
            }

            const link = document.createElement('a');
            const fileName = generateSpcChartFileName('SPC관리도');
            link.download = fileName;
            link.href = mergedCanvas.toDataURL('image/png');

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showNotification('SPC 차트가 다운로드되었습니다.');

        } catch (error) {
            console.error('SPC 차트 다운로드 실패:', error);
            showNotification('SPC 차트 다운로드 중 오류가 발생했습니다.');
        }
    }

    // ─────────────────────────────────────────────
    // 공정팀 양식 다운로드
    // ─────────────────────────────────────────────
    function downloadProcessTeamChart() {
        if (!controlChart && !rChart) {
            alert('다운로드할 차트가 없습니다. 먼저 분석을 실행하세요.');
            return;
        }

        // 장기표준편차: σ_long = (USL - LSL) / (6 × Pp)
        const spec = (currentSpcResult && currentSpcResult.spec)              || {};
        const cap  = (currentSpcResult && currentSpcResult.process_capability) || {};
        const ptTarget = (spec.target != null) ? Number(spec.target) : null;
        const ptPp     = (cap.pp      != null && Number(cap.pp) > 0) ? Number(cap.pp) : null;
        const ptUsl    = (spec.usl    != null) ? Number(spec.usl)    : null;
        const ptLsl    = (spec.lsl    != null) ? Number(spec.lsl)    : null;

        let autoUCL = null, autoLCL = null;
        if (ptTarget !== null && ptPp !== null && ptUsl !== null && ptLsl !== null) {
            const sigmaLong = (ptUsl - ptLsl) / (6 * ptPp);
            autoUCL = ptTarget + 3 * sigmaLong;
            autoLCL = ptTarget - 3 * sigmaLong;
        }

        // 모달에 자동 계산 값 설정 후 표시
        const uclInput = document.getElementById('modal-ucl-input');
        const lclInput = document.getElementById('modal-lcl-input');
        uclInput.value = autoUCL !== null ? autoUCL.toFixed(4) : '';
        lclInput.value = autoLCL !== null ? autoLCL.toFixed(4) : '';
        $('#uclLclModal').modal('show');
    }

    async function _executeProcessTeamDownload(newUCL, newLCL) {
        try {

            // 논리 크기: 24cm × 15cm (96dpi 기준 → 907 × 567px)
            // 2배 해상도로 렌더링하여 선명도 향상
            const SCALE       = 2;
            const totalWidth  = 907;
            const totalHeight = 567;
            const TITLE_H    = 42;
            const TBL_HDR_H  = 46;
            const TBL_DATA_H = 28;
            const chartAreaH = totalHeight - TITLE_H - TBL_HDR_H - TBL_DATA_H; // 451px
            const ctrlH = Math.round(chartAreaH * 2 / 3);                      // DICD 2/3 ≈ 301px
            const rH    = chartAreaH - ctrlH;                                   // RANGE 1/3 ≈ 150px

            // 오프스크린 차트는 2배 크기로 렌더링 (Chart.js는 독립 캔버스 사용)
            const ctrlOffCanvas = await ptRenderControlChart(newUCL, newLCL, totalWidth * SCALE, ctrlH * SCALE);
            const rOffCanvas    = await ptRenderRChart(totalWidth * SCALE, rH * SCALE);

            // 최종 캔버스를 2배 크기로 생성 후 scale 적용
            const canvas = document.createElement('canvas');
            canvas.width  = totalWidth  * SCALE;
            canvas.height = totalHeight * SCALE;
            const ctx = canvas.getContext('2d');
            ctx.scale(SCALE, SCALE);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, totalWidth, totalHeight);

            ptDrawTitle(ctx, totalWidth, TITLE_H);
            ptDrawTable(ctx, totalWidth, TITLE_H, TBL_HDR_H, TBL_DATA_H, newUCL, newLCL);

            let yOff = TITLE_H + TBL_HDR_H + TBL_DATA_H;
            if (ctrlOffCanvas) {
                ctx.drawImage(ctrlOffCanvas, 0, yOff, totalWidth, ctrlH);
                yOff += ctrlH;
            }
            if (rOffCanvas) {
                ctx.drawImage(rOffCanvas, 0, yOff, totalWidth, rH);
            }

            // 2배 렌더링 캔버스를 원래 크기(907×567)로 고품질 다운스케일하여 저장
            // → 붙여넣기 시 24×15cm 크기 유지, 선명도는 2배 렌더링 품질 적용
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width  = totalWidth;
            outputCanvas.height = totalHeight;
            const outCtx = outputCanvas.getContext('2d');
            outCtx.imageSmoothingEnabled = true;
            outCtx.imageSmoothingQuality = 'high';
            outCtx.drawImage(canvas, 0, 0, totalWidth, totalHeight);

            const link = document.createElement('a');
            link.download = generateSpcChartFileName('공정팀양식');
            link.href = outputCanvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showNotification('공정팀 양식이 다운로드되었습니다.');
        } catch (error) {
            console.error('공정팀 양식 다운로드 실패:', error);
            showNotification('공정팀 양식 다운로드 중 오류가 발생했습니다.');
        }
    }

    // Chart.js 내부 메타데이터를 제외한 안전한 데이터셋 복사
    function ptSafeCloneDataset(ds) {
        const clone = {};
        const safeKeys = [
            'label', 'type', 'data', 'fill', 'hidden', 'order',
            'borderColor', 'backgroundColor', 'borderWidth',
            'borderDash', 'borderDashOffset',
            'pointRadius', 'pointStyle', 'pointBackgroundColor',
            'pointBorderColor', 'pointBorderWidth', 'pointHoverRadius',
            'tension', 'spanGaps', 'showLine', 'stepped',
            'xAxisID', 'yAxisID'
        ];
        safeKeys.forEach(key => {
            if (ds[key] === undefined) return;
            clone[key] = (key === 'data' || key === 'borderDash') && Array.isArray(ds[key])
                ? ds[key].slice()
                : ds[key];
        });
        return clone;
    }

    // 공정팀 양식용 X-bar 관리도 오프스크린 렌더링 (Promise 방식)
    // CL 제거 + UCL/LCL = Target ± 장기표준편차×3
    function ptRenderControlChart(newUCL, newLCL, width, height) {
        return new Promise(resolve => {
            if (!controlChart) { resolve(null); return; }

            const offCanvas = document.createElement('canvas');
            offCanvas.width  = width  || controlChart.canvas.width;
            offCanvas.height = height || controlChart.canvas.height;

            const ptLimitLabels = ['UCL', 'LCL', 'CL', 'USL', 'LSL', '타겟'];
            const datasets = controlChart.data.datasets
                .filter(ds => ds.label !== 'CL' && !ds.patternHighlight)
                .map(ds => {
                    const clone = ptSafeCloneDataset(ds);
                    if (ds.label === 'UCL' && newUCL !== null) {
                        clone.data = Array(ds.data.length).fill(newUCL);
                    } else if (ds.label === 'LCL' && newLCL !== null) {
                        clone.data = Array(ds.data.length).fill(newLCL);
                    }
                    // 선 굵기 및 포인트 스타일 조정
                    clone.borderWidth      = 2;
                    clone.pointRadius      = ptLimitLabels.includes(ds.label) ? 0 : 4;
                    clone.pointHoverRadius = ptLimitLabels.includes(ds.label) ? 0 : 4;
                    clone.pointStyle       = 'circle';
                    // 데이터 선(관리한계선 제외)은 진한 파란색으로 변경
                    if (!ptLimitLabels.includes(ds.label)) {
                        clone.borderColor       = '#0033CC';
                        clone.backgroundColor   = 'rgba(0,51,204,0.1)';
                    }
                    return clone;
                });

            new Chart(offCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels:   controlChart.data.labels.slice(),
                    datasets: datasets
                },
                options: {
                    animation: { duration: 0, onComplete: () => resolve(offCanvas) },
                    responsive:          false,
                    maintainAspectRatio: false,
                    plugins: {
                        title:      { display: false },
                        legend: {
                            position: 'top',
                            labels: {
                                font: { size: 22 },
                                usePointStyle: true,
                                generateLabels: function(chart) {
                                    const items = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                                    items.forEach((item, i) => {
                                        item.pointStyle = 'line';
                                        const ds = chart.data.datasets[i];
                                        if (ds && ds.borderDash && ds.borderDash.length) {
                                            item.lineDash = ds.borderDash;
                                        }
                                    });
                                    return items;
                                }
                            }
                        },
                        tooltip:    { enabled: false },
                        annotation: { annotations: {} }
                    },
                    scales: {
                        x: {
                            title: { display: false },
                            ticks: { maxRotation: 90, minRotation: 90, autoSkip: true, maxTicksLimit: 30, font: { size: 20 } }
                        },
                        y: { title: { display: false }, ticks: { font: { size: 20 } } }
                    }
                }
            });
        });
    }

    // 공정팀 양식용 R 관리도 오프스크린 렌더링 (Promise 방식)
    function ptRenderRChart(width, height) {
        return new Promise(resolve => {
            if (!rChart) { resolve(null); return; }

            const offCanvas = document.createElement('canvas');
            offCanvas.width  = width  || rChart.canvas.width;
            offCanvas.height = height || rChart.canvas.height;

            const rLimitLabels = ['UCL', 'LCL', 'CL', 'USL', 'LSL', '타겟', 'R-bar'];
            const datasets = rChart.data.datasets.map(ds => {
                const clone = ptSafeCloneDataset(ds);
                // 선 굵기 및 포인트 스타일 조정
                clone.borderWidth      = 2;
                clone.pointRadius      = 0;
                clone.pointHoverRadius = 0;
                clone.pointStyle       = 'circle';
                // 데이터 선(관리한계선 제외)은 진한 파란색으로 변경
                if (!rLimitLabels.includes(ds.label)) {
                    clone.borderColor       = '#0033CC';
                    clone.backgroundColor   = 'rgba(0,51,204,0.1)';
                }
                return clone;
            });

            new Chart(offCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels:   rChart.data.labels.slice(),
                    datasets: datasets
                },
                options: {
                    animation: { duration: 0, onComplete: () => resolve(offCanvas) },
                    responsive:          false,
                    maintainAspectRatio: false,
                    plugins: {
                        title:      { display: false },
                        legend: {
                            position: 'top',
                            labels: {
                                font: { size: 22 },
                                usePointStyle: true,
                                generateLabels: function(chart) {
                                    const items = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                                    items.forEach((item, i) => {
                                        item.pointStyle = 'line';
                                        const ds = chart.data.datasets[i];
                                        if (ds && ds.borderDash && ds.borderDash.length) {
                                            item.lineDash = ds.borderDash;
                                        }
                                    });
                                    return items;
                                }
                            }
                        },
                        tooltip:    { enabled: false },
                        annotation: { annotations: {} }
                    },
                    scales: {
                        x: {
                            title: { display: false },
                            ticks: { maxRotation: 90, minRotation: 90, autoSkip: true, maxTicksLimit: 30, font: { size: 20 } }
                        },
                        y: { title: { display: false }, beginAtZero: true, ticks: { font: { size: 20 } } }
                    }
                }
            });
        });
    }

    // 공정팀 양식용 공정명+타겟 레이블 생성 (예: "PLY 7.5㎛")
    // 공정명: 공정 드롭다운 선택 텍스트
    // 타겟: spec.target → (usl+lsl)/2 → 타겟 드롭다운 텍스트 순으로 fallback
    function ptGetStepLabel() {
        // 공정명 읽기
        let processName = '';
        const processEl = document.getElementById('process');
        if (processEl && processEl.selectedIndex >= 0) {
            const text = (processEl.options[processEl.selectedIndex].text || '').trim();
            if (text && text !== '공정 선택') processName = text;
        }

        // 타겟 숫자 읽기
        const spec = (currentSpcResult && currentSpcResult.spec) || {};
        let targetStr = '';
        if (spec.target != null) {
            targetStr = `${Number(spec.target).toFixed(1)}㎛`;
        } else if (spec.usl != null && spec.lsl != null) {
            targetStr = `${((Number(spec.usl) + Number(spec.lsl)) / 2).toFixed(1)}㎛`;
        } else {
            const targetEl = document.getElementById('target');
            if (targetEl && targetEl.selectedIndex >= 0) {
                const text = (targetEl.options[targetEl.selectedIndex].text || '').trim();
                if (text && text !== '타겟 선택') {
                    const match = text.match(/[\d.]+/);
                    if (match) targetStr = `${parseFloat(match[0]).toFixed(1)}㎛`;
                }
            }
        }

        if (processName && targetStr) return `${processName} ${targetStr}`;
        if (processName) return processName;
        if (targetStr) return targetStr;
        return '-';
    }

    // 제목 영역 그리기 (파란 배경 + 흰 글씨)
    function ptDrawTitle(ctx, width, height) {
        ctx.fillStyle = '#190082';
        ctx.fillRect(0, 0, width, height);

        const stepLabel = ptGetStepLabel();
        const cdType    = window.PROCESS_TYPE === 'ETCH' ? 'FICD' : 'DICD';

        let dateRange = '';
        if (currentSpcResult && currentSpcResult.data && currentSpcResult.data.dates && currentSpcResult.data.dates.length > 0) {
            const sorted = [...currentSpcResult.data.dates]
                .map(d => new Date(d))
                .sort((a, b) => a - b);
            const fmt = (d) => {
                const yy = String(d.getFullYear()).slice(2);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yy}년${mm}월${dd}일`;
            };
            dateRange = ` [${fmt(sorted[0])} ~ ${fmt(sorted[sorted.length - 1])}]`;
        }

        ctx.fillStyle    = '#ffffff';
        ctx.font         = 'bold 16px Arial';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${stepLabel} ${cdType} CONTROL CHART${dateRange}`, width / 2, height / 2);
    }

    // 정보 테이블 그리기 (헤더 + 데이터 행)
    function ptDrawTable(ctx, totalWidth, startY, hdrH, dataH, newUCL, newLCL) {
        const spec = (currentSpcResult && currentSpcResult.spec)              || {};
        const cl   = (currentSpcResult && currentSpcResult.control_limits)    || {};
        const cap  = (currentSpcResult && currentSpcResult.process_capability) || {};

        const f2 = (v) => (v !== undefined && v !== null) ? Number(v).toFixed(2) : '-';
        const stepLabel = ptGetStepLabel();

        // UCL/LCL: 차트에 그려진 값(장기표준편차 기반)을 우선 사용, 없으면 원래 관리한계
        const uclVal = (newUCL !== null && newUCL !== undefined) ? newUCL : cl.ucl;
        const lclVal = (newLCL !== null && newLCL !== undefined) ? newLCL : cl.lcl;

        // 열 정의: [헤더텍스트, 너비비율, Spec그룹여부, UCL/LCL강조여부, 데이터값]
        const cols = [
            { lbl: 'PROCESS',             pct: 0.090, isSpec: false, hl: false, val: stepLabel           },
            { lbl: 'Machine NO.',          pct: 0.100, isSpec: false, hl: false, val: 'S-9200'           },
            { lbl: 'Control Item',         pct: 0.090, isSpec: false, hl: false, val: window.PROCESS_TYPE === 'ETCH' ? 'FI CD' : 'DI CD' },
            { lbl: 'USL',                  pct: 0.045, isSpec: true,  hl: false, val: f2(spec.usl)       },
            { lbl: 'UCL',                  pct: 0.050, isSpec: true,  hl: true,  val: f2(uclVal)         },
            { lbl: 'Target',               pct: 0.055, isSpec: true,  hl: false, val: f2(spec.target)    },
            { lbl: 'LCL',                  pct: 0.050, isSpec: true,  hl: true,  val: f2(lclVal)         },
            { lbl: 'LSL',                  pct: 0.045, isSpec: true,  hl: false, val: f2(spec.lsl)       },
            { lbl: 'Cp',                   pct: 0.050, isSpec: false, hl: false, val: f2(cap.cp)         },
            { lbl: 'Cpk',                  pct: 0.050, isSpec: false, hl: false, val: f2(cap.cpk)        },
            { lbl: 'Pp',                   pct: 0.050, isSpec: false, hl: false, val: f2(cap.pp)         },
            { lbl: 'Ppk',                  pct: 0.050, isSpec: false, hl: false, val: f2(cap.ppk)        },
            { lbl: 'Measure\ncycle&Point', pct: 0.110, isSpec: false, hl: false, val: '5P/1W/1LOT'       },
            { lbl: 'Record&Manager',       pct: 0.115, isSpec: false, hl: false, val: 'Worker&Process Eng\'r' },
        ];

        // 픽셀 좌표 계산
        let xCursor = 0;
        cols.forEach((col, i) => {
            col.x = xCursor;
            col.w = (i < cols.length - 1)
                ? Math.floor(totalWidth * col.pct)
                : totalWidth - xCursor;
            xCursor += col.w;
        });

        const hdrY  = startY;
        const dataY = startY + hdrH;
        const halfH = hdrH / 2;

        // ── 배경 ──
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, hdrY, totalWidth, hdrH + dataH);

        // UCL / LCL 열 강조 (회색)
        // isSpec 열은 Spec 병합 영역(상단 halfH)을 침범하지 않도록 halfH 아래부터만 음영 적용
        cols.filter(c => c.hl).forEach(col => {
            ctx.fillStyle = '#cccccc';
            const shadingY = col.isSpec ? hdrY + halfH : hdrY;
            const shadingH = col.isSpec ? hdrH - halfH + dataH : hdrH + dataH;
            ctx.fillRect(col.x, shadingY, col.w, shadingH);
        });

        // ── "Spec [μm]" 합쳐진 상단 레이블 ──
        const specCols = cols.filter(c => c.isSpec);
        if (specCols.length > 0) {
            const specX = specCols[0].x;
            const specW = specCols.reduce((s, c) => s + c.w, 0);

            ctx.fillStyle    = '#000000';
            ctx.font         = 'bold 11px Arial';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Spec [μm]', specX + specW / 2, hdrY + halfH / 2);

            // Spec 영역 내부 가로선
            ctx.strokeStyle = '#999999';
            ctx.lineWidth   = 0.5;
            ctx.beginPath();
            ctx.moveTo(specX, hdrY + halfH);
            ctx.lineTo(specX + specW, hdrY + halfH);
            ctx.stroke();
        }

        // ── 헤더 텍스트 ──
        ctx.font      = 'bold 11px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        cols.forEach(col => {
            const lines = col.lbl.split('\n');
            if (col.isSpec) {
                // Spec 열: 하단 절반 중앙
                ctx.textBaseline = 'middle';
                ctx.fillText(lines[0], col.x + col.w / 2, hdrY + halfH + halfH / 2);
            } else {
                // 일반 열: 전체 높이 중앙 (다중 줄 지원)
                ctx.textBaseline = 'middle';
                const lineH = 13;
                const offsetY = hdrY + hdrH / 2 - ((lines.length - 1) * lineH) / 2;
                lines.forEach((line, i) => {
                    ctx.fillText(line, col.x + col.w / 2, offsetY + i * lineH);
                });
            }
        });

        // ── 데이터 텍스트 ──
        ctx.font      = '11px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        cols.forEach(col => {
            ctx.textBaseline = 'middle';
            const lines  = (col.val || '-').split('\n');
            const lineH  = 11;
            const offsetY = dataY + dataH / 2 - ((lines.length - 1) * lineH) / 2;
            lines.forEach((line, i) => {
                ctx.fillText(line, col.x + col.w / 2, offsetY + i * lineH);
            });
        });

        // ── 테두리 ──
        ctx.strokeStyle = '#555555';
        ctx.lineWidth   = 1;

        // 전체 외곽
        ctx.strokeRect(0, hdrY, totalWidth, hdrH + dataH);

        // 헤더-데이터 구분선
        ctx.beginPath();
        ctx.moveTo(0, dataY);
        ctx.lineTo(totalWidth, dataY);
        ctx.stroke();

        // 열 구분 세로선
        // Spec 내부 열(이전 열도 Spec)은 상단 "Spec[μm]" 병합 영역을 침범하지 않도록
        // hdrY+halfH 부터만 선을 그려 셀 병합 효과를 표현
        cols.forEach((col, i) => {
            if (col.x > 0) {
                const prevCol = cols[i - 1];
                const isInternalSpec = col.isSpec && prevCol && prevCol.isSpec;
                const lineStartY = isInternalSpec ? hdrY + halfH : hdrY;
                ctx.beginPath();
                ctx.moveTo(col.x, lineStartY);
                ctx.lineTo(col.x, dataY + dataH);
                ctx.stroke();
            }
        });
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

        // SPC 차트 통합 다운로드 버튼 클릭 이벤트
        document.getElementById('download-spc-chart-btn').addEventListener('click', function() {
            downloadSpcChart();
        });

        // 공정팀 양식 다운로드 버튼 클릭 이벤트 (모달로 UCL/LCL 확인)
        document.getElementById('download-process-team-chart-btn').addEventListener('click', function() {
            downloadProcessTeamChart();
        });

        // 모달 확인 버튼 클릭 이벤트
        document.getElementById('modal-download-confirm-btn').addEventListener('click', function() {
            const uclVal = parseFloat(document.getElementById('modal-ucl-input').value);
            const lclVal = parseFloat(document.getElementById('modal-lcl-input').value);
            const newUCL = isNaN(uclVal) ? null : uclVal;
            const newLCL = isNaN(lclVal) ? null : lclVal;
            $('#uclLclModal').modal('hide');
            _executeProcessTeamDownload(newUCL, newLCL);
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
    
    // Chart.js annotation 플러그인 등록 (v3.x용) - 백업
    // 이미 IIFE 시작 부분에서 등록했으므로 여기서는 재확인만 수행
    try {
        if (typeof Chart !== 'undefined' && typeof window.chartjsPluginAnnotation !== 'undefined') {
            Chart.register(window.chartjsPluginAnnotation);
            console.log('[SPC] Annotation 플러그인 재등록 확인');
        } else {
            console.warn('[SPC] Annotation 플러그인 미등록 상태');
        }
    } catch (error) {
        // 이미 등록된 경우 에러 발생 가능 (무시)
        console.log('[SPC] Annotation 플러그인 이미 등록됨');
    }

    // 탭에서 전달받은 설정 복원 함수
    window.restoreSettings = function(settings) {
        if (!settings) {
            return;
        }

        // DOM이 완전히 로드되고 initSpcPage가 완료될 때까지 대기
        function waitForInitialization() {
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 50;
                const checkInterval = 100;

                function check() {
                    attempts++;
                    const productGroupSelect = document.getElementById('product-group');

                    if (productGroupSelect && productGroupSelect.options.length > 1) {
                        resolve();
                    } else if (attempts < maxAttempts) {
                        setTimeout(check, checkInterval);
                    } else {
                        resolve();
                    }
                }

                check();
            });
        }

        // 초기화 대기 후 설정 적용
        waitForInitialization().then(() => {
            // 기간 설정 복원
            if (settings.periodDays) {
                const periodSelect = document.getElementById('analysis-period');
                if (periodSelect) {
                    periodSelect.value = settings.periodDays.toString();
                }
            }

            // 제품군, 공정, 타겟 선택 및 SPC 분석 실행
            if (settings.targetId || settings.targetName) {
                const targetInfo = {
                    targetId: settings.targetId,
                    productGroup: settings.productGroup,
                    process: settings.process,
                    targetName: settings.targetName
                };

                // 제품군 선택
                const productGroupSelect = document.getElementById('product-group');
                for (let i = 0; i < productGroupSelect.options.length; i++) {
                    if (productGroupSelect.options[i].text === targetInfo.productGroup) {
                        productGroupSelect.selectedIndex = i;
                        selectedProductGroupId = productGroupSelect.value;
                        break;
                    }
                }

                if (!selectedProductGroupId) {
                    return;
                }

                // 공정 목록 로드 후 선택
                fetchProcesses(selectedProductGroupId).then(() => {
                    const processSelect = document.getElementById('process');

                    for (let i = 0; i < processSelect.options.length; i++) {
                        if (processSelect.options[i].text === targetInfo.process) {
                            processSelect.selectedIndex = i;
                            selectedProcessId = processSelect.value;
                            break;
                        }
                    }

                    if (!selectedProcessId) {
                        return;
                    }

                    // 타겟 목록 로드 후 선택
                    fetchTargets(selectedProcessId).then(() => {
                        const targetSelect = document.getElementById('target');

                        for (let i = 0; i < targetSelect.options.length; i++) {
                            if (targetSelect.options[i].text === targetInfo.targetName) {
                                targetSelect.selectedIndex = i;
                                selectedTargetId = targetSelect.value;
                                break;
                            }
                        }

                        // 타겟 ID가 직접 제공된 경우에는 직접 설정
                        if (!selectedTargetId && targetInfo.targetId) {
                            selectedTargetId = targetInfo.targetId;
                        }

                        // 타겟이 선택되었으면 SPC 분석 실행
                        if (selectedTargetId) {
                            analyzeSpc();
                        }
                    }).catch(error => {
                        console.error('타겟 목록 로드 실패:', error);
                    });
                }).catch(error => {
                    console.error('공정 목록 로드 실패:', error);
                });
            }
        });
    };

    // 페이지 로드 시 초기화
    $(document).ready(function() {
        initSpcPage();
        setupEventListeners();
    });

    // AI 분석 요청 함수 (글로벌 스코프에 노출)
    window.requestAiAnalysis = async function() {
        if (!currentSpcResult) {
            alert('먼저 SPC 분석을 실행하세요.');
            return;
        }

        const aiBtn = document.getElementById('ai-analysis-btn');
        const aiCard = document.getElementById('ai-analysis-card');
        const aiContent = document.getElementById('ai-analysis-content');

        // 버튼 로딩 상태
        const originalBtnHtml = aiBtn.innerHTML;
        aiBtn.disabled = true;
        aiBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> AI 분석 중...';

        // 결과 카드 표시 (로딩)
        aiCard.style.display = 'block';
        aiContent.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-purple" role="status" style="color: #6f42c1 !important;">
                    <span class="sr-only">AI 분석 중...</span>
                </div>
                <p class="mt-2 text-muted">AI가 SPC 데이터를 분석하고 있습니다... (약 5~10초 소요)</p>
            </div>
        `;

        // 컨텍스트 정보 수집
        const productGroupSelect = document.getElementById('product-group');
        const processSelect = document.getElementById('process');
        const targetSelect = document.getElementById('target');
        const productGroup = productGroupSelect ? productGroupSelect.options[productGroupSelect.selectedIndex]?.text || '' : '';
        const process = processSelect ? processSelect.options[processSelect.selectedIndex]?.text || '' : '';
        const target = targetSelect ? targetSelect.options[targetSelect.selectedIndex]?.text || '' : '';

        try {
            const response = await fetch('/api/ai/analyze/spc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    spc_data: currentSpcResult,
                    product_group: productGroup,
                    process: process,
                    target: target
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.analysis) {
                // Markdown을 HTML로 간단 변환
                let html = convertMarkdownToHtml(result.analysis);

                // 프롬프트 보기 토글 추가
                if (result.prompt) {
                    html += `
                        <hr>
                        <button class="btn btn-sm btn-outline-secondary" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                            <i class="fas fa-code mr-1"></i> 프롬프트 보기
                        </button>
                        <pre style="display: none; margin-top: 10px; padding: 12px; background: #f4f6f9; border-radius: 4px; font-size: 0.82rem; white-space: pre-wrap; max-height: 400px; overflow-y: auto;">${result.prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                    `;
                }

                aiContent.innerHTML = html;
            } else {
                throw new Error(result.error || 'AI 분석 결과를 받지 못했습니다.');
            }
        } catch (error) {
            console.error('AI 분석 실패:', error);
            aiContent.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle mr-1"></i>
                    <strong>AI 분석 실패:</strong> ${error.message}
                </div>
            `;
        } finally {
            // 버튼 복원
            aiBtn.disabled = false;
            aiBtn.innerHTML = originalBtnHtml;
        }
    };

    // 간단한 Markdown → HTML 변환
    function convertMarkdownToHtml(markdown) {
        let html = markdown
            // ## 헤더
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            // **볼드**
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // - 리스트
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            // 연속 li를 ul로 감싸기
            .replace(/(<li>.*<\/li>\n?)+/g, function(match) {
                return '<ul>' + match + '</ul>';
            })
            // 줄바꿈
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        return '<p>' + html + '</p>';
    }

})();