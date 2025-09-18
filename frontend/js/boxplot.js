// 전역 변수
let boxplotChart = null;

// 페이지 로드 시 초기화
$(document).ready(function() {
    // 제품군 목록 로드
    loadProductGroups();
    setupEventListeners();
    //initDateControls();
    
    /* URL에서 파라미터 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('target_id');
    
    if (targetId) {
        // 타겟 ID가 URL에 있으면 해당 타겟 정보 가져오기
        loadTargetInfo(targetId);
    }*/
});

/* 페이지 초기화
function initBoxplotPage() {
    // URL에서 파라미터 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('target_id');
    
    if (targetId) {
        // 타겟 ID가 URL에 있으면 해당 타겟 정보 가져오기
        loadTargetInfo(targetId);
    }
}*/

// 이벤트 리스너 등록 함수
function setupEventListeners() {
    // 제품군 선택 변경시
    $('#product-group-select').on('change', handleProductGroupChange);
    $('#process-select').on('change', handleProcessChange);
    $('#target-select').on('change', handleTargetChange);
    $('#analyze-btn').on('click', performAnalysis);
    
    // 폼 요소 변경 감지
    $('input[name="group-by"]').on('change', function() {
        if ($('#target-select').val()) {
            $('#analyze-btn').prop('disabled', false);
        }
    });
    
    // 날짜 입력란 초기화
    utils.initDateControls({
        periodSelector: '#days-select',
        containerSelector: '#custom-date-container',
        startDateSelector: '#start-date',
        endDateSelector: '#end-date'
    });

    // 차트 다운로드 버튼 클릭 이벤트
    $('#download-boxplot-chart-btn').on('click', function() {
        downloadBoxplotChart();
    });
}

/* 타겟 정보 가져오기
async function loadTargetInfo(targetId) {
    try {
        // 타겟 정보 가져오기
        const target = await api.get(`${api.endpoints.TARGETS}/${targetId}`);
        if (!target) return;
        
        // 해당 공정 가져오기
        const process = await api.get(`${api.endpoints.PROCESSES}/${target.process_id}`);
        if (!process) return;
        
        // 제품군 목록이 로드될 때까지 기다리기
        await waitForElement('#product-group-select option');
        
        // 제품군 선택
        $('#product-group-select').val(process.product_group_id).trigger('change');
        
        // 공정 목록이 로드될 때까지 기다리기
        await waitForElement('#process-select option[value="' + process.id + '"]');
        
        // 공정 선택
        $('#process-select').val(process.id).trigger('change');
        
        // 타겟 목록이 로드될 때까지 기다리기
        await waitForElement('#target-select option[value="' + target.id + '"]');
        
        // 타겟 선택
        $('#target-select').val(target.id).trigger('change');
        
        // 자동으로 분석 수행
        performAnalysis();
    } catch (error) {
        console.error('타겟 정보 로딩 오류:', error);
        showAlert('타겟 정보를 가져오는데 실패했습니다.', 'danger');
    }
}*/

// 요소가 로드될 때까지 기다리는 함수
function waitForElement(selector) {
    return new Promise(resolve => {
        if ($(selector).length) {
            return resolve();
        }
        
        const observer = new MutationObserver(() => {
            if ($(selector).length) {
                observer.disconnect();
                resolve();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

// 제품군 목록 로드
async function loadProductGroups() {
    try {
        console.log('제품군 목록 로드 시작');
        const productGroups = await api.getProductGroups();
        console.log('제품군 목록:', productGroups);
        
        // 제품군 옵션 생성
        const $select = $('#product-group-select');
        console.log('제품군 select 요소:', $select);
        $select.find('option:not(:first)').remove();
        
        productGroups.forEach(group => {
            $select.append(`<option value="${group.id}">${group.name}</option>`);
        });
        console.log('제품군 옵션 추가 완료');
    } catch (error) {
        console.error('제품군 로딩 오류:', error);
        showAlert('제품군 목록을 가져오는데 실패했습니다.', 'danger');
    }
}

// 제품군 변경 핸들러
async function handleProductGroupChange() {
    const productGroupId = $('#product-group-select').val();
    const $processSelect = $('#process-select');
    const $targetSelect = $('#target-select');
    
    // 공정과 타겟 선택 초기화
    $processSelect.find('option:not(:first)').remove();
    $targetSelect.find('option:not(:first)').remove();
    $processSelect.prop('disabled', !productGroupId);
    $targetSelect.prop('disabled', true);
    $('#analyze-btn').prop('disabled', true);
    
    if (!productGroupId) return;
    
    try {
        const processes = await api.getProcesses(productGroupId);
        
        // 공정 옵션 생성
        processes.forEach(process => {
            $processSelect.append(`<option value="${process.id}">${process.name}</option>`);
        });
        
        if (processes.length === 0) {
            showAlert('선택한 제품군에 공정이 없습니다.', 'warning');
        }
    } catch (error) {
        console.error('공정 로딩 오류:', error);
        showAlert('공정 목록을 가져오는데 실패했습니다.', 'danger');
    }
}

// 공정 변경 핸들러
async function handleProcessChange() {
    const processId = $('#process-select').val();
    const $targetSelect = $('#target-select');
    
    // 타겟 선택 초기화
    $targetSelect.find('option:not(:first)').remove();
    $targetSelect.prop('disabled', !processId);
    $('#analyze-btn').prop('disabled', true);
    
    if (!processId) return;
    
    try {
        const targets = await api.getTargets(processId);
        
        // 타겟 옵션 생성
        targets.forEach(target => {
            $targetSelect.append(`<option value="${target.id}">${target.name}</option>`);
        });
        
        if (targets.length === 0) {
            showAlert('선택한 공정에 타겟이 없습니다.', 'warning');
        }
    } catch (error) {
        console.error('타겟 로딩 오류:', error);
        showAlert('타겟 목록을 가져오는데 실패했습니다.', 'danger');
    }
}

// 타겟 변경 핸들러
function handleTargetChange() {
    const targetId = $('#target-select').val();
    $('#analyze-btn').prop('disabled', !targetId);
}

// 분석 실행 함수 수정
async function performAnalysis() {
    const targetId = $('#target-select').val();
    if (!targetId) return;
    
    const daysSelect = $('#days-select').val();
    const groupBy = $('input[name="group-by"]:checked').val();
    
    try {
        // 로딩 표시
        showLoading();
        
        // 백엔드 API 호출 파라미터 설정
        const dateParams = utils.prepareApiDateParams(
            daysSelect,
            $('#start-date').val(),
            $('#end-date').val()
        );
        
        // group_by 파라미터 추가
        const params = {
            ...dateParams,
            group_by: groupBy
        };
        
        // 박스플롯 API 호출
        const boxplotData = await api.getBoxplotData(targetId, groupBy, params);
        
        // 차트 렌더링
        renderSimpleBoxPlot(boxplotData);
        
        // 통계 테이블 렌더링
        renderStatsTable(boxplotData);
        
        // 로딩 숨기기
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('박스플롯 분석 오류:', error);
        
        let errorMessage = '박스플롯 분석 중 오류가 발생했습니다.';
        if (error.message && error.message.includes('404')) {
            errorMessage = '분석할 충분한 데이터가 없습니다. 필터 조건을 변경해 보세요.';
        }
        
        showAlert(errorMessage, 'danger');
        
        // 차트 컨테이너 비우기
        $('#boxplot-container').html(`
            <p class="text-muted text-center py-5">
                ${errorMessage}
            </p>
        `);
        
        // 통계 테이블 비우기
        $('#stats-table tbody').html(`
            <tr>
                <td colspan="8" class="text-center text-muted">데이터가 없습니다.</td>
            </tr>
        `);
    }
}

// 로딩 표시
function showLoading() {
    $('#boxplot-container').html(`
        <div class="d-flex justify-content-center align-items-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="sr-only">로딩 중...</span>
            </div>
        </div>
    `);
}

// 로딩 숨기기
function hideLoading() {
    // 아무 작업 안함 - 차트 렌더링 시 덮어씌워짐
}

function renderSimpleBoxPlot(data) {
    // 기존 차트 제거
    if (boxplotChart) {
        boxplotChart.destroy();
    }
    
    const $container = $('#boxplot-container');
    $container.empty();
    
    // 데이터가 없는 경우
    if (!data.groups || data.groups.length === 0) {
        $container.html(`
            <p class="text-muted text-center py-5">
                분석할 충분한 데이터가 없습니다. 필터 조건을 변경해 보세요.
            </p>
        `);
        return;
    }
    
    // SVG 기반 박스플롯 직접 그리기
    const svgWidth = $container.width();
    const svgHeight = 400;
    const margin = {top: 50, right: 50, bottom: 50, left: 60};
    const width = svgWidth - margin.left - margin.right;
    const height = svgHeight - margin.top - margin.bottom;
    
    // 데이터 준비
    const groups = data.groups;
    const groupNames = groups.map(g => g.name);
    
    // 최소, 최대값 찾기
    let minY = Math.min(...groups.map(g => g.whisker_min));
    let maxY = Math.max(...groups.map(g => g.whisker_max));
    
    // SPEC 값을 고려하여 Y축 범위 조정
    if (data.spec) {
        if (data.spec.lsl !== undefined) minY = Math.min(minY, data.spec.lsl);
        if (data.spec.usl !== undefined) maxY = Math.max(maxY, data.spec.usl);
    }
    
    // 여백 추가 (10%)
    const padding = (maxY - minY) * 0.1;
    minY -= padding;
    maxY += padding;
    
    // SVG 생성
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", svgWidth);
    svg.setAttribute("height", svgHeight);

    // 제목 추가
    const titleElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    titleElement.setAttribute("x", svgWidth / 2);
    titleElement.setAttribute("y", "25");
    titleElement.setAttribute("text-anchor", "middle");
    titleElement.setAttribute("font-size", "16");
    titleElement.setAttribute("font-weight", "bold");
    titleElement.setAttribute("fill", "#333");
    titleElement.textContent = generateBoxplotTitle();
    svg.appendChild(titleElement);

    // 그룹별 X 위치 계산
    const xScale = width / groups.length;
    const boxWidth = xScale * 0.6;
    
    // Y 축 스케일 계산
    const yScale = height / (maxY - minY);
    
    // 각 그룹별로 박스플롯 그리기
    groups.forEach((group, i) => {
        const x = margin.left + (i + 0.5) * xScale;
        
        // 박스 및 위스커 Y 좌표 계산
        const yMin = margin.top + height - (group.whisker_min - minY) * yScale;
        const yQ1 = margin.top + height - (group.q1 - minY) * yScale;
        const yMedian = margin.top + height - (group.median - minY) * yScale;
        const yQ3 = margin.top + height - (group.q3 - minY) * yScale;
        const yMax = margin.top + height - (group.whisker_max - minY) * yScale;
        
        // 색상 인덱스 (순환)
        const colorIndex = i % 5;
        const colors = [
            {fill: 'rgba(54, 162, 235, 0.5)', stroke: 'rgba(54, 162, 235, 1)'},
            {fill: 'rgba(255, 99, 132, 0.5)', stroke: 'rgba(255, 99, 132, 1)'},
            {fill: 'rgba(75, 192, 192, 0.5)', stroke: 'rgba(75, 192, 192, 1)'},
            {fill: 'rgba(255, 206, 86, 0.5)', stroke: 'rgba(255, 206, 86, 1)'},
            {fill: 'rgba(153, 102, 255, 0.5)', stroke: 'rgba(153, 102, 255, 1)'}
        ];
        
        // Q1-Q3 박스 그리기
        const box = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        box.setAttribute("x", x - boxWidth/2);
        box.setAttribute("y", yQ3);
        box.setAttribute("width", boxWidth);
        box.setAttribute("height", yQ1 - yQ3);
        box.setAttribute("fill", colors[colorIndex].fill);
        box.setAttribute("stroke", colors[colorIndex].stroke);
        box.setAttribute("stroke-width", "2");
        svg.appendChild(box);
        
        // 중앙값 선 그리기
        const medianLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        medianLine.setAttribute("x1", x - boxWidth/2);
        medianLine.setAttribute("y1", yMedian);
        medianLine.setAttribute("x2", x + boxWidth/2);
        medianLine.setAttribute("y2", yMedian);
        medianLine.setAttribute("stroke", colors[colorIndex].stroke);
        medianLine.setAttribute("stroke-width", "2");
        svg.appendChild(medianLine);
        
        // 위스커 상단 선 (Q3 -> 최대값)
        const whiskerTop = document.createElementNS("http://www.w3.org/2000/svg", "line");
        whiskerTop.setAttribute("x1", x);
        whiskerTop.setAttribute("y1", yQ3);
        whiskerTop.setAttribute("x2", x);
        whiskerTop.setAttribute("y2", yMax);
        whiskerTop.setAttribute("stroke", colors[colorIndex].stroke);
        whiskerTop.setAttribute("stroke-width", "1");
        svg.appendChild(whiskerTop);
        
        // 위스커 하단 선 (Q1 -> 최소값)
        const whiskerBottom = document.createElementNS("http://www.w3.org/2000/svg", "line");
        whiskerBottom.setAttribute("x1", x);
        whiskerBottom.setAttribute("y1", yQ1);
        whiskerBottom.setAttribute("x2", x);
        whiskerBottom.setAttribute("y2", yMin);
        whiskerBottom.setAttribute("stroke", colors[colorIndex].stroke);
        whiskerBottom.setAttribute("stroke-width", "1");
        svg.appendChild(whiskerBottom);
        
        // 위스커 상단 가로선
        const whiskerTopCap = document.createElementNS("http://www.w3.org/2000/svg", "line");
        whiskerTopCap.setAttribute("x1", x - boxWidth/4);
        whiskerTopCap.setAttribute("y1", yMax);
        whiskerTopCap.setAttribute("x2", x + boxWidth/4);
        whiskerTopCap.setAttribute("y2", yMax);
        whiskerTopCap.setAttribute("stroke", colors[colorIndex].stroke);
        whiskerTopCap.setAttribute("stroke-width", "1");
        svg.appendChild(whiskerTopCap);
        
        // 위스커 하단 가로선
        const whiskerBottomCap = document.createElementNS("http://www.w3.org/2000/svg", "line");
        whiskerBottomCap.setAttribute("x1", x - boxWidth/4);
        whiskerBottomCap.setAttribute("y1", yMin);
        whiskerBottomCap.setAttribute("x2", x + boxWidth/4);
        whiskerBottomCap.setAttribute("y2", yMin);
        whiskerBottomCap.setAttribute("stroke", colors[colorIndex].stroke);
        whiskerBottomCap.setAttribute("stroke-width", "1");
        svg.appendChild(whiskerBottomCap);
        
        // 이상치 그리기
        if (group.outliers && group.outliers.length > 0) {
            group.outliers.forEach(outlier => {
                const yOutlier = margin.top + height - (outlier - minY) * yScale;
                
                const outlierDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                outlierDot.setAttribute("cx", x);
                outlierDot.setAttribute("cy", yOutlier);
                outlierDot.setAttribute("r", "3");
                outlierDot.setAttribute("fill", "rgba(255, 99, 132, 1)");
                outlierDot.setAttribute("stroke", "rgba(255, 99, 132, 1)");
                outlierDot.setAttribute("stroke-width", "1");
                svg.appendChild(outlierDot);
            });
        }
        
        // X축 레이블
        const labelY = margin.top + height + 20;
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", x);
        label.setAttribute("y", labelY);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-size", "12");
        label.textContent = group.name;
        svg.appendChild(label);
    });
    
    // Y축 그리기
    const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    yAxis.setAttribute("x1", margin.left);
    yAxis.setAttribute("y1", margin.top);
    yAxis.setAttribute("x2", margin.left);
    yAxis.setAttribute("y2", margin.top + height);
    yAxis.setAttribute("stroke", "#000");
    yAxis.setAttribute("stroke-width", "1");
    svg.appendChild(yAxis);
    
    // Y축 눈금 및 레이블
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
        const value = minY + (maxY - minY) * (i / yTicks);
        const y = margin.top + height - (value - minY) * yScale;
        
        const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tick.setAttribute("x1", margin.left - 5);
        tick.setAttribute("y1", y);
        tick.setAttribute("x2", margin.left);
        tick.setAttribute("y2", y);
        tick.setAttribute("stroke", "#000");
        tick.setAttribute("stroke-width", "1");
        svg.appendChild(tick);
        
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", margin.left - 10);
        label.setAttribute("y", y + 4);
        label.setAttribute("text-anchor", "end");
        label.setAttribute("font-size", "12");
        label.textContent = value.toFixed(2);
        svg.appendChild(label);
    }
    
    // LSL, USL 라인 추가
    if (data.spec) {
        // USL 라인
        if (data.spec.usl !== undefined) {
            const yUSL = margin.top + height - (data.spec.usl - minY) * yScale;
            
            const uslLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            uslLine.setAttribute("x1", margin.left);
            uslLine.setAttribute("y1", yUSL);
            uslLine.setAttribute("x2", margin.left + width);
            uslLine.setAttribute("y2", yUSL);
            uslLine.setAttribute("stroke", "rgba(0, 123, 255, 0.8)");
            uslLine.setAttribute("stroke-width", "2");
            uslLine.setAttribute("stroke-dasharray", "5,5");
            svg.appendChild(uslLine);
            
            const uslLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            uslLabel.setAttribute("x", margin.left + width + 5);
            uslLabel.setAttribute("y", yUSL + 4);
            uslLabel.setAttribute("text-anchor", "start");
            uslLabel.setAttribute("font-size", "12");
            uslLabel.setAttribute("fill", "rgba(0, 123, 255, 0.8)");
            uslLabel.textContent = `USL (${data.spec.usl})`;
            svg.appendChild(uslLabel);
        }
        
        // LSL 라인
        if (data.spec.lsl !== undefined) {
            const yLSL = margin.top + height - (data.spec.lsl - minY) * yScale;
            
            const lslLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            lslLine.setAttribute("x1", margin.left);
            lslLine.setAttribute("y1", yLSL);
            lslLine.setAttribute("x2", margin.left + width);
            lslLine.setAttribute("y2", yLSL);
            lslLine.setAttribute("stroke", "rgba(0, 123, 255, 0.8)");
            lslLine.setAttribute("stroke-width", "2");
            lslLine.setAttribute("stroke-dasharray", "5,5");
            svg.appendChild(lslLine);
            
            const lslLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            lslLabel.setAttribute("x", margin.left + width + 5);
            lslLabel.setAttribute("y", yLSL + 4);
            lslLabel.setAttribute("text-anchor", "start");
            lslLabel.setAttribute("font-size", "12");
            lslLabel.setAttribute("fill", "rgba(0, 123, 255, 0.8)");
            lslLabel.textContent = `LSL (${data.spec.lsl})`;
            svg.appendChild(lslLabel);
        }
    }
    
    
    // SVG를 컨테이너에 추가
    $container.append(svg);
}

// 통계 테이블 렌더링
function renderStatsTable(data) {
    const $tbody = $('#stats-table tbody');
    $tbody.empty();
    
    if (!data.groups || data.groups.length === 0) {
        $tbody.html(`
            <tr>
                <td colspan="8" class="text-center text-muted">데이터가 없습니다.</td>
            </tr>
        `);
        return;
    }
    
    data.groups.forEach(group => {
        $tbody.append(`
            <tr>
                <td>${group.name}</td>
                <td>${group.count}</td>
                <td>${group.min}</td>
                <td>${group.q1}</td>
                <td>${group.median}</td>
                <td>${group.q3}</td>
                <td>${group.max}</td>
                <td>${group.outliers ? group.outliers.length : 0}</td>
            </tr>
        `);
    });
}

// 경고 표시
function showAlert(message, type = 'warning') {
    // 경고 메시지 출력
    console.log(`[${type}] ${message}`);
    
    // 실제 UI에 경고 메시지를 표시하려면 다음과 같은 코드를 추가할 수 있습니다
    /*
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
    `;
    
    // 경고 메시지를 페이지에 추가
    $('.content-header').after(alertHtml);
    
    // 3초 후 자동으로 경고 메시지 닫기
    setTimeout(() => {
        $('.alert').alert('close');
    }, 3000);
    */
}

// 박스플롯 차트 제목 생성 함수
function generateBoxplotTitle() {
    const productGroupSelect = document.getElementById('product-group-select');
    const processSelect = document.getElementById('process-select');
    const targetSelect = document.getElementById('target-select');
    const daysSelect = document.getElementById('days-select');

    let title = 'DICD 박스플롯분석';

    if (targetSelect && targetSelect.value && productGroupSelect.value && processSelect.value) {
        const productGroupName = productGroupSelect.options[productGroupSelect.selectedIndex]?.text || '';
        const processName = processSelect.options[processSelect.selectedIndex]?.text || '';
        const targetName = targetSelect.options[targetSelect.selectedIndex]?.text || '';

        // 기간 정보 생성
        let periodText = '';
        const periodValue = daysSelect ? daysSelect.value : '';

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

        title = `DICD 박스플롯분석 (제품군:${productGroupName}, 공정:${processName}, 타겟:${targetName}, 기간:${periodText})`;
    }

    return title;
}

// SVG를 Canvas로 변환하여 다운로드하는 함수
async function downloadBoxplotChart() {
    const svgElement = document.querySelector('#boxplot-container svg');

    if (!svgElement) {
        alert('다운로드할 차트가 없습니다. 먼저 분석을 실행하세요.');
        return;
    }

    try {
        // SVG 복사본 생성 (이미 제목이 포함되어 있음)
        const svgClone = svgElement.cloneNode(true);

        // SVG를 문자열로 변환
        const svgData = new XMLSerializer().serializeToString(svgClone);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        // SVG의 크기 설정
        canvas.width = svgClone.getAttribute('width') || 800;
        canvas.height = svgClone.getAttribute('height') || 400;

        // 배경을 흰색으로 설정
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        img.onload = function() {
            ctx.drawImage(img, 0, 0);

            // Canvas를 PNG로 다운로드
            const link = document.createElement('a');
            const fileName = generateBoxplotChartFileName();

            link.download = fileName;
            link.href = canvas.toDataURL('image/png');

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showNotification('박스플롯 차트가 다운로드되었습니다.');
        };

        img.onerror = function() {
            console.error('SVG 변환 실패');
            showNotification('차트 다운로드 중 오류가 발생했습니다.');
        };

        // SVG 데이터를 Data URL로 변환
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const svgUrl = URL.createObjectURL(svgBlob);
        img.src = svgUrl;

    } catch (error) {
        console.error('박스플롯 차트 다운로드 실패:', error);
        showNotification('차트 다운로드 중 오류가 발생했습니다.');
    }
}

// 박스플롯 차트 파일명 생성 함수
function generateBoxplotChartFileName() {
    const productGroupSelect = document.getElementById('product-group-select');
    const processSelect = document.getElementById('process-select');
    const targetSelect = document.getElementById('target-select');

    let fileName = '박스플롯분석';

    if (targetSelect && targetSelect.value && productGroupSelect.value && processSelect.value) {
        const productGroupName = productGroupSelect.options[productGroupSelect.selectedIndex]?.text || '';
        const processName = processSelect.options[processSelect.selectedIndex]?.text || '';
        const targetName = targetSelect.options[targetSelect.selectedIndex]?.text || '';

        const cleanName = (name) => name.replace(/[<>:"/\\|?*]/g, '_');

        fileName = `박스플롯분석_${cleanName(productGroupName)}_${cleanName(processName)}_${cleanName(targetName)}`;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/:/g, '-');

    return `${fileName}_${dateStr}.png`;
}

// 알림 표시 함수
function showNotification(message) {
    alert(message);
}