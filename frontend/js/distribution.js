// distribution.js - 분포 분석 페이지 스크립트

// 전역 변수 선언
let distributionChart = null;
let qqPlotChart = null;
let boxplotChart = null;
let positionChart = null;
let currentTarget = null;
let currentData = null;
let selectedPosition = 'center'; // 기본값은 center

// DOM이 로드된 후 실행
$(document).ready(function() {
    initDistributionPage();
    setupEventListeners();
    initDateControls();
});

// 페이지 초기화 함수
function initDistributionPage() {
    // 제품군 목록 가져오기
    fetchProductGroups();
}

// 이벤트 리스너 등록 함수
function setupEventListeners() {
    // 제품군 선택 변경시
    $('#product-group').on('change', function() {
        const productGroupId = $(this).val();
        if (productGroupId) {
            fetchProcesses(productGroupId);
            $('#process').prop('disabled', false).html('<option value="">공정 선택</option>');
            $('#target').prop('disabled', true).html('<option value="">타겟 선택</option>');
        } else {
            $('#process').prop('disabled', true).html('<option value="">공정 선택</option>');
            $('#target').prop('disabled', true).html('<option value="">타겟 선택</option>');
        }
    });
    
    // 공정 선택 변경시
    $('#process').on('change', function() {
        const processId = $(this).val();
        if (processId) {
            fetchTargets(processId);
            $('#target').prop('disabled', false).html('<option value="">타겟 선택</option>');
        } else {
            $('#target').prop('disabled', true).html('<option value="">타겟 선택</option>');
        }
    });
    
    // 분석 실행 버튼 클릭시
    $('#analyze-btn').on('click', function() {
        const targetId = $('#target').val();
        const days = $('#analysis-period').val();
        
        if (!targetId) {
            alert('분석할 타겟을 선택하세요.');
            return;
        }
        
        runDistributionAnalysis(targetId, days);
    });
    
    // 분석 기간 선택 변경시
    utils.initDateControls({
        periodSelector: '#analysis-period',
        containerSelector: '#custom-date-range',
        startDateSelector: '#start-date',
        endDateSelector: '#end-date'
    });

    // 위치 다이어그램에서 위치 선택시
    $('.position-cell').on('click', function() {
        const position = $(this).data('position');

        // 모든 셀에서 활성화 클래스 제거
        $('.position-cell').removeClass('bg-primary text-white');

        // 선택된 셀에 활성화 클래스 추가
        $(this).addClass('bg-primary text-white');

        // 선택된 위치 저장 및 차트 업데이트
        selectedPosition = position;
        updatePositionChart();
    });

    // 차트 다운로드 버튼 클릭 이벤트
    $('#download-distribution-chart-btn').on('click', function() {
        downloadDistributionChart();
    });
}

// 제품군 목록 가져오기
async function fetchProductGroups() {
    try {
        const productGroups = await api.getProductGroups();
        const select = $('#product-group');
        
        select.find('option:not(:first)').remove();
        
        productGroups.forEach(group => {
            select.append(`<option value="${group.id}">${group.name}</option>`);
        });
    } catch (error) {
        console.error('제품군 목록 가져오기 오류:', error);
        alert('제품군 목록을 가져오는 중 오류가 발생했습니다.');
    }
}

// 공정 목록 가져오기
async function fetchProcesses(productGroupId) {
    try {
        const processes = await api.getProcesses(productGroupId);
        const select = $('#process');
        
        select.find('option:not(:first)').remove();
        
        processes.forEach(process => {
            select.append(`<option value="${process.id}">${process.name}</option>`);
        });
    } catch (error) {
        console.error('공정 목록 가져오기 오류:', error);
        alert('공정 목록을 가져오는 중 오류가 발생했습니다.');
    }
}

// 차트 제목 생성 함수
function generateDistributionChartTitle() {
    const productGroupSelect = document.getElementById('product-group');
    const processSelect = document.getElementById('process');
    const targetSelect = document.getElementById('target');
    const periodSelect = document.getElementById('analysis-period');

    let title = 'DICD 분포분석';

    if (currentTarget && productGroupSelect.value && processSelect.value) {
        const productGroupName = productGroupSelect.options[productGroupSelect.selectedIndex]?.text || '';
        const processName = processSelect.options[processSelect.selectedIndex]?.text || '';
        const targetName = targetSelect.options[targetSelect.selectedIndex]?.text || '';

        // 기간 정보 생성
        let periodText = '';
        const periodValue = periodSelect ? periodSelect.value : '';

        if (periodValue === 'custom') {
            const startDate = document.getElementById('start-date')?.value;
            const endDate = document.getElementById('end-date')?.value;
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

        title = `DICD 분포분석 (제품군:${productGroupName}, 공정:${processName}, 타겟:${targetName}, 기간:${periodText})`;
    }

    return title;
}

// 타겟 목록 가져오기
async function fetchTargets(processId) {
    try {
        const targets = await api.getTargets(processId);
        const select = $('#target');
        
        select.find('option:not(:first)').remove();
        
        targets.forEach(target => {
            select.append(`<option value="${target.id}">${target.name}</option>`);
        });
    } catch (error) {
        console.error('타겟 목록 가져오기 오류:', error);
        alert('타겟 목록을 가져오는 중 오류가 발생했습니다.');
    }
}

// runDistributionAnalysis 함수 변경
async function runDistributionAnalysis(targetId, days) {
    // 로딩 표시
    $('#initial-message').hide();
    $('#analysis-result').hide();
    showLoading();
    
    try {
        // 선택된 타겟 이름 저장
        currentTarget = $('#target option:selected').text();
        
        // 사용자 지정 기간 처리
        let analysisParams = utils.prepareApiDateParams(
            days,
            $('#start-date').val(),
            $('#end-date').val()
        );

        // 날짜 범위 계산
        const dateRange = utils.calculateDateRange(
            days === 'custom' ? 'custom' : days,
            $('#start-date').val(),
            $('#end-date').val()
        );

        // 제목 업데이트
        let periodTitle = '';
        if (days === 'custom') {
            periodTitle = `${dateRange.startDate} ~ ${dateRange.endDate} (${dateRange.days}일)`;
        } else {
            periodTitle = `최근 ${days}일`;
        }
        
        // 분포 분석 API 호출
        // API 수정 필요 - 다음과 같이 api.js 파일의 analyzeDistribution 함수 수정 필요
        const data = await api.analyzeDistribution(targetId, analysisParams);
        currentData = data;
        
        // 결과 표시
        hideLoading();
        $('#analysis-result').show();
        
        // 타이틀 업데이트
        updateAnalysisTitle(currentTarget, periodTitle);
        
        // 기존 코드와 동일
        renderDistributionChart(data);
        renderQQPlot(data);
        renderBoxPlot(data);
        updateStatistics(data);
        updateSpecInfo(data);
        
        selectedPosition = 'center';
        $('.position-cell').removeClass('bg-primary text-white');
        $('.position-cell.position-center').addClass('bg-primary text-white');
        updatePositionChart();
        
        updatePositionStatistics(data);
        
    } catch (error) {
        hideLoading();
        $('#initial-message').show();
        console.error('분포 분석 오류:', error);
        alert('분포 분석 중 오류가 발생했습니다.');
    }
}

// 로딩 표시 함수
function showLoading() {
    // 초기 메시지 영역에 로딩 표시
    $('#initial-message .card-body').html(`
        <div class="text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="sr-only">로딩 중...</span>
            </div>
            <h5>분석 중입니다...</h5>
        </div>
    `);
    $('#initial-message').show();
}

// 로딩 숨기기 함수
function hideLoading() {
    $('#initial-message').hide();
    // 초기 메시지 원상복구
    $('#initial-message .card-body').html(`
        <div class="text-center py-5">
            <i class="fas fa-chart-bar fa-5x text-muted mb-3"></i>
            <h5>분석할 타겟을 선택하고 분석 실행 버튼을 클릭하세요.</h5>
            <p class="text-muted">분포 분석을 통해 측정 데이터의 분포 특성과 정규성을 확인할 수 있습니다.</p>
        </div>
    `);
}

// 분석 타이틀 업데이트
// updateAnalysisTitle 함수 변경
function updateAnalysisTitle(targetName, periodText) {
    $('#analysis-title').text(`${targetName} 분포 분석 결과 (${periodText})`);
}

// 분포 차트 렌더링 함수
function renderDistributionChart(data) {
    const ctx = document.getElementById('distribution-chart').getContext('2d');
    
    // 기존 차트 제거
    if (distributionChart) {
        distributionChart.destroy();
    }
    
    // 히스토그램 데이터
    const histogramData = data.histogram;
    
    // 정규분포 PDF 데이터
    const pdfData = data.normal_pdf;
    
    // 데이터 포인트 수에 따른 최적의 bin 개수 계산 (스콧의 규칙 적용)
    // 백엔드에서 계산된 히스토그램 사용하되, 아래 코드는 프론트엔드에서 bin 개수 계산 참고용
    // const n = data.values.length;
    // const optimalBins = Math.ceil(3.5 * Math.pow(n, -1/3) * data.distribution_stats.std_dev);
    
    // SPEC 라인 데이터
    let specAnnotations = [];
    if (data.spec) {
        specAnnotations = [
            {
                type: 'line',
                mode: 'vertical',
                scaleID: 'x',
                value: data.spec.lsl,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    content: `LSL: ${data.spec.lsl}`,
                    enabled: true,
                    position: 'bottom'
                }
            },
            {
                type: 'line',
                mode: 'vertical',
                scaleID: 'x',
                value: data.spec.usl,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    content: `USL: ${data.spec.usl}`,
                    enabled: true,
                    position: 'bottom'
                }
            }
        ];
    }
    
    // 정규분포 커브를 위한 더 부드러운 포인트 생성 (포인트 수 늘리기)
    const curvePoints = 200; // 더 많은 포인트로 부드러운 곡선 생성
    const mean = data.distribution_stats.mean;
    const stdDev = data.distribution_stats.std_dev;
    
    // 표시 범위 계산 (평균 ± 4 시그마)
    const minX = mean - 4 * stdDev;
    const maxX = mean + 4 * stdDev;
    
    // 부드러운 정규분포 곡선을 위한 x, y 값 생성
    const smoothX = [];
    const smoothY = [];
    for (let i = 0; i < curvePoints; i++) {
        const x = minX + (maxX - minX) * (i / (curvePoints - 1));
        smoothX.push(x);
        
        // 정규분포 PDF 계산
        const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * 
                  Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
        smoothY.push(y);
    }
    
    // 정규분포 높이를 히스토그램에 맞게 조정
    const maxHistCount = Math.max(...histogramData.counts);
    const maxPdfValue = Math.max(...smoothY);
    const scaledY = smoothY.map(y => y * (maxHistCount / maxPdfValue));
    
    // 차트 생성
    distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: histogramData.bins,
            datasets: [
                {
                    label: '히스토그램',
                    data: histogramData.counts,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    barPercentage: 0.95, // 막대 사이 간격 감소
                    categoryPercentage: 1.0,
                    order: 1
                },
                {
                    label: '정규분포',
                    data: smoothX.map((x, i) => ({
                        x: x,
                        y: scaledY[i]
                    })),
                    type: 'line',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)', // 약간의 배경색 추가
                    borderWidth: 2,
                    pointRadius: 0, // 점 없애기
                    fill: false,
                    tension: 0.4, // 곡선 부드럽게
                    order: 0,
                    cubicInterpolationMode: 'monotone' // 부드러운 곡선
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                annotation: {
                    annotations: specAnnotations
                },
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: generateDistributionChartTitle()
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '측정값'
                    },
                    type: 'linear', // 연속형 스케일로 변경
                    offset: false, // 더 자연스러운 히스토그램
                    grid: {
                        display: true,
                        drawBorder: true,
                        drawOnChartArea: true,
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '빈도'
                    },
                    beginAtZero: true,
                    grid: {
                        drawBorder: false,
                    }
                }
            }
        }
    });
}

// 정규 확률도(QQ Plot) 렌더링 함수 - 정확한 정규 분위수 계산 및 시각화 개선
function renderQQPlot(data) {
    const ctx = document.getElementById('qq-plot').getContext('2d');
    
    // 기존 차트 제거
    if (qqPlotChart) {
        qqPlotChart.destroy();
    }

    // 데이터 준비
    const values = [...data.values].sort((a, b) => a - b);
    const n = values.length;
    const mean = data.distribution_stats.mean;
    const stdDev = data.distribution_stats.std_dev;

    // 분위수 계산을 위한 보조 함수
    const calculateNormalQuantile = (p) => {
        // Beasley-Springer-Moro 근사법 사용
        const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
        const b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
        const c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209, 
                 0.0276438810333863, 0.0038405729373609, 0.0003951896511919, 
                 0.0000321767881768, 0.0000002888167364, 0.0000003960315187];

        if(p <= 0 || p >= 1) return p < 0.5 ? -Infinity : Infinity;
        
        let u = p - 0.5;
        let r, x;
        
        if(Math.abs(u) < 0.42) {
            r = u * u;
            x = u * (((a[3]*r + a[2])*r + a[1])*r + a[0]) / 
                   ((((b[3]*r + b[2])*r + b[1])*r + b[0])*r + 1);
        } else {
            r = p < 0.5 ? Math.log(-Math.log(p)) : Math.log(-Math.log(1-p));
            x = c[0] + r*(c[1] + r*(c[2] + r*(c[3] + r*(c[4] + r*(c[5] + 
                               r*(c[6] + r*(c[7] + r*c[8])))))));
            if(p < 0.5) x = -x;
        }
        
        return x;
    };

    // QQ 플롯 데이터 생성
    const qqData = [];
    for(let i = 0; i < n; i++) {
        const p = (i + 0.5) / n;  // Hazen 위치 매개변수
        const z = calculateNormalQuantile(p);
        const theoretical = mean + z * stdDev;
        qqData.push({ x: theoretical, y: values[i] });
    }

    // 이상치 식별 (IQR 기반)
    const q1 = values[Math.floor(n * 0.25)];
    const q3 = values[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    // 이상치와 정상 데이터 분리
    const normalData = [];
    const outlierData = [];
    qqData.forEach(point => {
        if(point.y < lowerBound || point.y > upperBound) {
            outlierData.push(point);
        } else {
            normalData.push(point);
        }
    });

        // 회귀선 계산 (전체 데이터 기준)
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        qqData.forEach(point => {
            sumX += point.x;
            sumY += point.y;
            sumXY += point.x * point.y;
            sumX2 += point.x * point.x;
        });
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
    
        // 참조선 데이터 생성
        const minX = Math.min(...qqData.map(d => d.x));
        const maxX = Math.max(...qqData.map(d => d.x));
        const lineData = [
            { x: minX, y: slope * minX + intercept },
            { x: maxX, y: slope * maxX + intercept }
        ];

    // 차트 생성
    qqPlotChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: '정상 데이터',
                    data: normalData,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: '이상치',
                    data: outlierData,
                    backgroundColor: 'rgba(255, 99, 132, 0.7)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: '회귀 참조선',
                    data: lineData,
                    type: 'line',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0 // 직선 유지
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const point = context.dataset.data[context.dataIndex];
                            return `이론값: ${point.x.toFixed(3)}, 실제값: ${point.y.toFixed(3)}`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        filter: item => !item.text.includes('이상적') // 참조선 범례 숨김
                    }
                },
                title: {
                    display: true,
                    text: '정규 확률도 (Q-Q Plot)'
                },
                annotation: {
                    annotations: {
                        line: {
                            type: 'line',
                            borderColor: '#28a745',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            scaleID: 'y',
                            value: mean,
                            label: {
                                content: '이상적 정규분포',
                                position: 'end'
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '이론적 분위수'
                    },
                    grid: {
                        color: (context) => 
                            context.tick.value === mean ? '#28a745' : 'rgba(0,0,0,0.1)',
                        lineWidth: (context) => 
                            context.tick.value === mean ? 2 : 1
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '실제 분위수'
                    },
                    grid: {
                        color: (context) => 
                            context.tick.value === mean ? '#28a745' : 'rgba(0,0,0,0.1)',
                        lineWidth: (context) => 
                            context.tick.value === mean ? 2 : 1
                    }
                }
            }
        }
    });
}

// 박스 플롯 렌더링 함수 수정
function renderBoxPlot(data) {
    const ctx = document.getElementById('boxplot-chart').getContext('2d');
    
    // 기존 차트 제거
    if (boxplotChart) {
        boxplotChart.destroy();
    }
    
    // 데이터 준비
    const values = [...data.values].sort((a, b) => a - b);
    const n = values.length;
    
    // 박스플롯 통계량 계산
    const min = values[0];
    const max = values[n-1];
    const q1 = values[Math.floor(n * 0.25)];
    const median = n % 2 === 0 ? (values[n/2-1] + values[n/2])/2 : values[Math.floor(n/2)];
    const q3 = values[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    
    // 이상치 경계 계산
    const lowerWhisker = Math.max(min, q1 - 1.5 * iqr);
    const upperWhisker = Math.min(max, q3 + 1.5 * iqr);
    
    // 이상치 찾기
    const outliers = values.filter(v => v < lowerWhisker || v > upperWhisker);
    
    // Y축 범위 설정을 위한 값 계산
    // 데이터 범위보다 약간 더 넓게 표시하기 위해 여유 공간 추가
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const padding = (dataMax - dataMin) * 0.1; // 10% 패딩
    
    // SPEC 라인 데이터
    let annotations = [];
    if (data.spec) {
        annotations = [
            {
                type: 'line',
                mode: 'horizontal',
                scaleID: 'y',
                value: data.spec.lsl,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    content: `LSL: ${data.spec.lsl}`,
                    enabled: true,
                    position: 'left'
                }
            },
            {
                type: 'line',
                mode: 'horizontal',
                scaleID: 'y',
                value: data.spec.usl,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    content: `USL: ${data.spec.usl}`,
                    enabled: true,
                    position: 'left'
                }
            }
        ];
    }
    
    // 박스 플롯 데이터를 단순한 형태로 준비
    boxplotChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '이상치',
                data: outliers.map(v => ({ x: 0, y: v })),
                backgroundColor: 'rgba(255, 99, 132, 0.7)',
                borderColor: 'rgba(255, 99, 132, 1)',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'x',
            plugins: {
                annotation: {
                    annotations: annotations
                },
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: '박스 플롯'
                },
                tooltip: {
                    callbacks: {
                        title: function() {
                            return '박스플롯 통계';
                        },
                        label: function(context) {
                            return [
                                `최소값: ${min.toFixed(3)}`,
                                `Q1: ${q1.toFixed(3)}`,
                                `중앙값: ${median.toFixed(3)}`,
                                `Q3: ${q3.toFixed(3)}`,
                                `최대값: ${max.toFixed(3)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: ['측정값 분포'],
                    offset: true, // ← 이게 중요!
                    grid: {
                        display: false
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '측정값'
                    },
                    min: dataMin - padding,
                    max: dataMax + padding,
                    ticks: {
                        stepSize: (dataMax - dataMin) / 10
                    }
                }
            }
        },
        plugins: [{
            id: 'boxplot',
            afterDraw: function(chart) {
                const ctx = chart.ctx;
                const xScale = chart.scales.x;
                const yScale = chart.scales.y;
                
                // x 좌표 계산 (카테고리의 중앙)
                const x = xScale.getPixelForValue('측정값 분포');
                const width = 50; // 박스 너비
                
                // Q1-Q3 박스 그리기
                const yQ1 = yScale.getPixelForValue(q1);
                const yQ3 = yScale.getPixelForValue(q3);
                const boxHeight = yQ1 - yQ3;
                
                // 박스 그리기
                ctx.fillStyle = 'rgba(75, 192, 192, 0.6)';
                ctx.strokeStyle = 'rgba(75, 192, 192, 1)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.rect(x - width/2, yQ3, width, boxHeight);
                ctx.fill();
                ctx.stroke();
                
                // 중앙값 선 그리기
                const yMedian = yScale.getPixelForValue(median);
                ctx.beginPath();
                ctx.moveTo(x - width/2, yMedian);
                ctx.lineTo(x + width/2, yMedian);
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(54, 162, 235, 1)';
                ctx.stroke();
                
                // 위스커(수염) 그리기
                const yMin = yScale.getPixelForValue(lowerWhisker);
                const yMax = yScale.getPixelForValue(upperWhisker);
                
                // 중앙 수직선 (Q1 ~ lowerWhisker)
                ctx.beginPath();
                ctx.moveTo(x, yQ1);
                ctx.lineTo(x, yMin);
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(75, 192, 192, 1)';
                ctx.stroke();
                
                // 중앙 수직선 (Q3 ~ upperWhisker)
                ctx.beginPath();
                ctx.moveTo(x, yQ3);
                ctx.lineTo(x, yMax);
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(75, 192, 192, 1)';
                ctx.stroke();
                
                // lowerWhisker 가로선
                ctx.beginPath();
                ctx.moveTo(x - width/3, yMin);
                ctx.lineTo(x + width/3, yMin);
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(75, 192, 192, 1)';
                ctx.stroke();
                
                // upperWhisker 가로선
                ctx.beginPath();
                ctx.moveTo(x - width/3, yMax);
                ctx.lineTo(x + width/3, yMax);
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(75, 192, 192, 1)';
                ctx.stroke();
                
                // 통계값 텍스트 표시 (옵션)
                ctx.fillStyle = 'black';
                ctx.font = '10px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(`최대: ${max.toFixed(2)}`, x + width/2 + 5, yScale.getPixelForValue(max));
                ctx.fillText(`Q3: ${q3.toFixed(2)}`, x + width/2 + 5, yQ3);
                ctx.fillText(`중앙값: ${median.toFixed(2)}`, x + width/2 + 5, yMedian);
                ctx.fillText(`Q1: ${q1.toFixed(2)}`, x + width/2 + 5, yQ1);
                ctx.fillText(`최소: ${min.toFixed(2)}`, x + width/2 + 5, yScale.getPixelForValue(min));
            }
        }]
    });
}

// 통계 정보 업데이트 함수
function updateStatistics(data) {
    const stats = data.distribution_stats;
    
    $('#sample-count').text(data.sample_count);
    $('#mean-value').text(stats.mean !== null ? stats.mean.toFixed(3) : '-');
    $('#median-value').text(stats.median !== null ? stats.median.toFixed(3) : '-');
    $('#std-dev-value').text(stats.std_dev !== null ? stats.std_dev.toFixed(3) : '-');
    
    // 왜도 업데이트 및 색상 표시
    if (stats.skewness !== null) {
        const skewnessValue = stats.skewness.toFixed(3);
        let skewnessClass = '';
        let skewnessDesc = '';
        
        if (Math.abs(stats.skewness) < 0.5) {
            skewnessClass = 'text-success';
            skewnessDesc = '(정규분포에 가까움)';
        } else if (Math.abs(stats.skewness) < 1.0) {
            skewnessClass = 'text-warning';
            skewnessDesc = stats.skewness > 0 ? '(오른쪽으로 치우침)' : '(왼쪽으로 치우침)';
        } else {
            skewnessClass = 'text-danger';
            skewnessDesc = stats.skewness > 0 ? '(심하게 오른쪽으로 치우침)' : '(심하게 왼쪽으로 치우침)';
        }
        
        $('#skewness-value').html(`<span class="${skewnessClass}">${skewnessValue}</span> ${skewnessDesc}`);
    } else {
        $('#skewness-value').text('-');
    }
    
    // 첨도 업데이트 및 색상 표시
    if (stats.kurtosis !== null) {
        const kurtosisValue = stats.kurtosis.toFixed(3);
        let kurtosisClass = '';
        let kurtosisDesc = '';
        
        if (Math.abs(stats.kurtosis) < 0.5) {
            kurtosisClass = 'text-success';
            kurtosisDesc = '(정규분포에 가까움)';
        } else if (stats.kurtosis > 0) {
            kurtosisClass = 'text-warning';
            kurtosisDesc = '(뾰족한 분포)';
        } else {
            kurtosisClass = 'text-info';
            kurtosisDesc = '(평평한 분포)';
        }
        
        $('#kurtosis-value').html(`<span class="${kurtosisClass}">${kurtosisValue}</span> ${kurtosisDesc}`);
    } else {
        $('#kurtosis-value').text('-');
    }
    
    // 정규성 검정 업데이트
    if (stats.normality_test && stats.normality_test.p_value !== null) {
        const pValue = stats.normality_test.p_value.toFixed(4);
        let normalityClass = stats.normality_test.is_normal ? 'text-success' : 'text-danger';
        let normalityResult = stats.normality_test.is_normal ? '정규분포 (p > 0.05)' : '비정규분포 (p < 0.05)';
        
        $('#normality-test').html(`p-value: <span class="${normalityClass}">${pValue}</span> - ${normalityResult}`);
    } else {
        $('#normality-test').text('-');
    }
}

// SPEC 정보 업데이트 함수
function updateSpecInfo(data) {
    if (data.spec) {
        $('#spec-info-card').show();
        $('#lsl-value').text(data.spec.lsl.toFixed(3));
        $('#usl-value').text(data.spec.usl.toFixed(3));
        
        // 규격 내 비율에 따른 상태 표시
        const inSpecRatio = data.spec.in_spec_ratio;
        let ratioClass = '';
        if (inSpecRatio >= 0.9973) {  // 6 시그마 수준 (99.73%)
            ratioClass = 'text-success';
        } else if (inSpecRatio >= 0.95) {  // 2 시그마 수준 (95%)
            ratioClass = 'text-info';
        } else if (inSpecRatio >= 0.68) {  // 1 시그마 수준 (68%)
            ratioClass = 'text-warning';
        } else {
            ratioClass = 'text-danger';
        }
        
        $('#in-spec-ratio').html(`<span class="${ratioClass}">${data.spec.in_spec_percent.toFixed(2)}%</span>`);
    } else {
        $('#spec-info-card').hide();
    }
}

// 위치별 차트 업데이트 함수
function updatePositionChart() {
    if (!currentData) return;
    
    const ctx = document.getElementById('position-chart').getContext('2d');
    
    // 기존 차트 제거
    if (positionChart) {
        positionChart.destroy();
    }
    
    // 선택된 위치의 분석 데이터
    const positionData = currentData.position_analysis[selectedPosition];
    
    // 히스토그램 데이터
    const histogramData = positionData.histogram;
    
    // 정규분포 PDF 데이터
    const pdfData = positionData.normal_pdf;
    const stats = positionData.stats;
    
    // 정규분포 커브를 위한 더 부드러운 포인트 생성
    const curvePoints = 200; // 더 많은 포인트로 부드러운 곡선 생성
    const mean = stats.mean;
    const stdDev = stats.std_dev;
    
    // 표시 범위 계산 (평균 ± 4 시그마)
    const minX = mean - 4 * stdDev;
    const maxX = mean + 4 * stdDev;
    
    // 부드러운 정규분포 곡선을 위한 x, y 값 생성
    const smoothX = [];
    const smoothY = [];
    for (let i = 0; i < curvePoints; i++) {
        const x = minX + (maxX - minX) * (i / (curvePoints - 1));
        smoothX.push(x);
        
        // 정규분포 PDF 계산
        const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * 
                  Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
        smoothY.push(y);
    }
    
    // 정규분포 높이를 히스토그램에 맞게 조정
    const maxHistCount = Math.max(...histogramData.counts);
    const maxPdfValue = Math.max(...smoothY);
    const scaledY = smoothY.map(y => y * (maxHistCount / maxPdfValue));
    
    // SPEC 라인 데이터
    let specAnnotations = [];
    if (currentData.spec) {
        specAnnotations = [
            {
                type: 'line',
                mode: 'vertical',
                scaleID: 'x',
                value: currentData.spec.lsl,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    content: `LSL: ${currentData.spec.lsl}`,
                    enabled: true,
                    position: 'bottom'
                }
            },
            {
                type: 'line',
                mode: 'vertical',
                scaleID: 'x',
                value: currentData.spec.usl,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    content: `USL: ${currentData.spec.usl}`,
                    enabled: true,
                    position: 'bottom'
                }
            }
        ];
    }
    
    // 위치별 색상 설정
    const positionColors = {
        top: {
            bar: 'rgba(255, 159, 64, 0.6)',
            line: 'rgba(255, 99, 71, 1)'
        },
        center: {
            bar: 'rgba(54, 162, 235, 0.6)',
            line: 'rgba(51, 102, 255, 1)'
        },
        bottom: {
            bar: 'rgba(153, 102, 255, 0.6)',
            line: 'rgba(106, 90, 205, 1)'
        },
        left: {
            bar: 'rgba(75, 192, 192, 0.6)',
            line: 'rgba(60, 179, 113, 1)'
        },
        right: {
            bar: 'rgba(255, 99, 132, 0.6)',
            line: 'rgba(220, 20, 60, 1)'
        }
    };
    
    // 선택된 위치의 색상
    const colors = positionColors[selectedPosition];
    
    // 차트 생성
    positionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: histogramData.bins,
            datasets: [
                {
                    label: '히스토그램',
                    data: histogramData.counts,
                    backgroundColor: colors.bar,
                    borderColor: colors.bar.replace('0.6', '1'),
                    borderWidth: 1,
                    barPercentage: 0.95,
                    categoryPercentage: 1.0,
                    order: 1
                },
                {
                    label: '정규분포',
                    data: smoothX.map((x, i) => ({
                        x: x,
                        y: scaledY[i]
                    })),
                    type: 'line',
                    borderColor: colors.line,
                    backgroundColor: colors.line.replace('1', '0.1'),
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.4,
                    order: 0,
                    cubicInterpolationMode: 'monotone'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(tooltipItems) {
                            const x = tooltipItems[0].parsed.x;
                            return `측정값: ${x.toFixed(3)}`;
                        }
                    }
                },
                annotation: {
                    annotations: specAnnotations
                },
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: `${getPositionName(selectedPosition)} 위치 분포`,
                    font: {
                        size: 16
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '측정값',
                        font: {
                            weight: 'bold'
                        }
                    },
                    type: 'linear',
                    offset: false,
                    grid: {
                        display: true,
                        drawBorder: true,
                        drawOnChartArea: true,
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '빈도',
                        font: {
                            weight: 'bold'
                        }
                    },
                    beginAtZero: true,
                    grid: {
                        drawBorder: false,
                    }
                }
            }
        }
    });
    
    // 시각적 효과 - 선택된 위치 셀 하이라이트
    $('.position-cell').removeClass('bg-primary text-white');
    $(`.position-cell.position-${selectedPosition}`).addClass('bg-primary text-white');
    
    // 현재 선택된 위치의 통계 강조 표시
    $('.position-row').removeClass('table-primary');
    $(`.position-row[data-position="${selectedPosition}"]`).addClass('table-primary');
}

// 위치 이름 한글화 함수
function getPositionName(position) {
    switch (position) {
        case 'top': return '상단';
        case 'center': return '중앙';
        case 'bottom': return '하단';
        case 'left': return '좌측';
        case 'right': return '우측';
        default: return position;
    }
}

// 위치별 통계 테이블 업데이트 함수
function updatePositionStatistics(data) {
    const positions = ['top', 'center', 'bottom', 'left', 'right'];
    const tableBody = $('#position-stats-table');
    
    // 테이블 초기화
    tableBody.empty();
    
    // 각 위치별 통계 정보 추가
    positions.forEach(position => {
        const stats = data.position_analysis[position].stats;
        const positionName = getPositionName(position);
        
        // 정규성 검정 결과 표시
        let normalityText = '-';
        if (stats.normality_test && stats.normality_test.p_value !== null) {
            const pValue = stats.normality_test.p_value.toFixed(4);
            let normalityClass = stats.normality_test.is_normal ? 'text-success' : 'text-danger';
            normalityText = `<span class="${normalityClass}">p=${pValue}</span>`;
        }
        
        // 왜도 클래스 결정
        let skewnessClass = 'text-success';
        if (stats.skewness !== null) {
            if (Math.abs(stats.skewness) >= 1.0) {
                skewnessClass = 'text-danger';
            } else if (Math.abs(stats.skewness) >= 0.5) {
                skewnessClass = 'text-warning';
            }
        }
        
        // 첨도 클래스 결정
        let kurtosisClass = 'text-success';
        if (stats.kurtosis !== null) {
            if (Math.abs(stats.kurtosis) >= 1.0) {
                kurtosisClass = 'text-danger';
            } else if (Math.abs(stats.kurtosis) >= 0.5) {
                kurtosisClass = 'text-warning';
            }
        }
        
        // 행 추가
        const row = `
            <tr data-position="${position}" class="position-row">
                <td><strong>${positionName}</strong></td>
                <td>${stats.mean !== null ? stats.mean.toFixed(3) : '-'}</td>
                <td>${stats.median !== null ? stats.median.toFixed(3) : '-'}</td>
                <td>${stats.std_dev !== null ? stats.std_dev.toFixed(3) : '-'}</td>
                <td class="${skewnessClass}">${stats.skewness !== null ? stats.skewness.toFixed(3) : '-'}</td>
                <td class="${kurtosisClass}">${stats.kurtosis !== null ? stats.kurtosis.toFixed(3) : '-'}</td>
                <td>${normalityText}</td>
            </tr>
        `;
        
        tableBody.append(row);
    });
    
    // 위치 행 클릭 이벤트 - 해당 위치 차트 표시
    $('.position-row').on('click', function() {
        const position = $(this).data('position');
        
        // 모든 행에서 활성화 클래스 제거
        $('.position-row').removeClass('table-primary');
        
        // 선택된 행에 활성화 클래스 추가
        $(this).addClass('table-primary');
        
        // 모든 셀에서 활성화 클래스 제거
        $('.position-cell').removeClass('bg-primary text-white');
        
        // 위치 셀 활성화
        $(`.position-cell.position-${position}`).addClass('bg-primary text-white');

        // 선택된 위치 저장 및 차트 업데이트
        selectedPosition = position;
        updatePositionChart();
    });
}

// 분포 차트를 다운로드하는 함수
async function downloadDistributionChart() {
    if (!distributionChart) {
        alert('다운로드할 차트가 없습니다. 먼저 분석을 실행하세요.');
        return;
    }

    try {
        const canvas = distributionChart.canvas;
        const link = document.createElement('a');
        const fileName = generateDistributionChartFileName();

        link.download = fileName;
        link.href = canvas.toDataURL('image/png');

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('분포 차트가 다운로드되었습니다.');

    } catch (error) {
        console.error('분포 차트 다운로드 실패:', error);
        showNotification('분포 차트 다운로드 중 오류가 발생했습니다.');
    }
}

// 분포 차트 파일명 생성 함수
function generateDistributionChartFileName() {
    const productGroupSelect = document.getElementById('product-group');
    const processSelect = document.getElementById('process');
    const targetSelect = document.getElementById('target');

    let fileName = '분포분석';

    if (currentTarget && productGroupSelect.value && processSelect.value) {
        const productGroupName = productGroupSelect.options[productGroupSelect.selectedIndex]?.text || '';
        const processName = processSelect.options[processSelect.selectedIndex]?.text || '';
        const targetName = targetSelect.options[targetSelect.selectedIndex]?.text || '';

        const cleanName = (name) => name.replace(/[<>:"/\\|?*]/g, '_');

        fileName = `분포분석_${cleanName(productGroupName)}_${cleanName(processName)}_${cleanName(targetName)}`;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/:/g, '-');

    return `${fileName}_${dateStr}.png`;
}

// 알림 표시 함수
function showNotification(message) {
    alert(message);
}