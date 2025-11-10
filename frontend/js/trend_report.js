// 선택된 타겟 목록을 관리하는 클래스
class TargetManager {
    constructor() {
        this.targets = [];
        this.loadFromLocalStorage();
    }
    
    // 로컬 스토리지에서 선택된 타겟 불러오기
    loadFromLocalStorage() {
        const savedTargets = localStorage.getItem('trend_report_targets');
        if (savedTargets) {
            try {
                this.targets = JSON.parse(savedTargets);
            } catch (e) {
                console.error('로컬 스토리지에서 타겟 불러오기 오류:', e);
                this.targets = [];
            }
        }
    }
    
    // 로컬 스토리지에 선택된 타겟 저장
    saveToLocalStorage() {
        localStorage.setItem('trend_report_targets', JSON.stringify(this.targets));
    }
    
    // 타겟 추가
    addTarget(target) {
        // 이미 존재하는 타겟인지 확인
        const exists = this.targets.some(t => t.targetId === target.targetId);
        
        if (!exists) {
            this.targets.push(target);
            this.saveToLocalStorage();
            return true;
        }
        
        return false;
    }
    
    // 타겟 제거
    removeTarget(targetId) {
        const initialLength = this.targets.length;
        this.targets = this.targets.filter(t => t.targetId !== targetId);
        
        if (initialLength !== this.targets.length) {
            this.saveToLocalStorage();
            return true;
        }
        
        return false;
    }
    
    // 모든 타겟 가져오기
    getAllTargets() {
        return [...this.targets];
    }
    
    // 타겟 ID로 타겟 찾기
    getTargetById(targetId) {
        return this.targets.find(t => t.targetId === targetId);
    }
    
    // 타겟 존재 여부 확인
    hasTargets() {
        return this.targets.length > 0;
    }
    
    // 모든 타겟 제거
    clearTargets() {
        this.targets = [];
        this.saveToLocalStorage();
    }
}

// 차트 관리 클래스
class ChartManager {
    constructor() {
        this.charts = {};
        this.currentDataLength = 0;
        this.chartColors = [
            '#3490dc', '#38c172', '#e3342f', '#f6993f', '#9561e2',
            '#f66d9b', '#6cb2eb', '#4dc0b5', '#f7fafc', '#718096'
        ];
    }
    
    // 차트 생성
    createChart(targetInfo, data, specData) {
        const chartId = `chart-${targetInfo.targetId}`;
        
        // 이미 존재하는 차트인 경우 업데이트
        if (this.charts[chartId]) {
            this.updateChart(targetInfo.targetId, data, specData);
            return;
        }
        
        // 차트 컨테이너 생성
        const chartsContainer = document.getElementById('charts-container');
        const chartCard = document.createElement('div');
        chartCard.className = 'card chart-card';
        chartCard.id = `chart-card-${targetInfo.targetId}`;
        
        // 차트 제목 및 헤더 생성
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        cardHeader.innerHTML = `
            <h3 class="card-title">${targetInfo.productGroupName} - ${targetInfo.processName} - ${targetInfo.targetName}</h3>
            <div class="card-tools">
                <button type="button" class="btn btn-tool" data-card-widget="collapse">
                    <i class="fas fa-minus"></i>
                </button>
                <button type="button" class="btn btn-tool remove-chart" data-target-id="${targetInfo.targetId}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // 차트 본문 생성
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body p-0';
        
        // Cp 배지 생성 (완전히 대체)
        const cpBadge = document.createElement('div');
        cpBadge.className = 'cp-badge badge badge-light';

        // 데이터 포인트 확인 - 실제 측정 데이터가 있는지 확인
        const hasValidData = data && data.length >= 2;

        if (!hasValidData) {
            // 데이터가 없거나 불충분한 경우
            cpBadge.textContent = 'Cp: N/A';
            cpBadge.classList.add('bg-secondary');
        } else {
            // 데이터가 충분하고 SPEC 정보가 있는 경우에만 Cp 값 표시
            if (specData && specData.process_capability && specData.process_capability.cp !== null && specData.process_capability.cp !== undefined) {
                const cpValue = specData.process_capability.cp;
                let cpColor = 'bg-secondary';
                
                if (cpValue < 0.67) cpColor = 'bg-danger';
                else if (cpValue < 1.00) cpColor = 'bg-warning';
                else if (cpValue < 1.33) cpColor = 'bg-info';
                else cpColor = 'bg-success';
                
                cpBadge.textContent = `Cp: ${cpValue.toFixed(2)}`;
                cpBadge.classList.add(cpColor);
            } else {
                cpBadge.textContent = 'Cp: N/A';
                cpBadge.classList.add('bg-secondary');
            }
        }
        
        // 차트 캔버스 생성
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        const canvas = document.createElement('canvas');
        canvas.id = chartId;
        
        // 요소 조립
        chartContainer.appendChild(cpBadge);
        chartContainer.appendChild(canvas);
        cardBody.appendChild(chartContainer);
        chartCard.appendChild(cardHeader);
        chartCard.appendChild(cardBody);
        chartsContainer.appendChild(chartCard);
        
        // 차트 생성
        const ctx = canvas.getContext('2d');
        const chartData = this.prepareChartData(data, specData);
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: this.getChartOptions(specData)
        });
        
        // 차트 저장
        this.charts[chartId] = {
            chart: chart,
            targetId: targetInfo.targetId,
            element: chartCard
        };
        
        // 차트 삭제 이벤트 리스너 추가
        const removeButton = chartCard.querySelector('.remove-chart');
        removeButton.addEventListener('click', (e) => {
            const targetId = parseInt(e.currentTarget.getAttribute('data-target-id'));
            this.removeChart(targetId);
            targetManager.removeTarget(targetId);
            updateSelectedTargetsDisplay();
        });
        
        // 빈 차트 메시지 숨기기
        document.getElementById('empty-charts-message').style.display = 'none';
    }
    
    prepareChartData(data, specData) {
        // 데이터를 시간순으로 정렬
        const sortedData = [...data].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        // 현재 날짜 구하기
        const now = new Date();
        // 1주일 전 날짜 계산
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        
        // 시퀀스 기반으로 데이터 포인트 생성
        const values = sortedData.map((item, index) => {
            const itemDate = new Date(item.created_at);
            const isRecent = itemDate >= oneWeekAgo; // 최근 1주일 데이터인지 확인

            return {
                x: index,  // 인덱스를 X값으로 사용
                y: item.avg_value,
                created_at: item.created_at,
                lot_no: item.lot_no || '',
                wafer_no: item.wafer_no || '',
                // 최근 1주일 데이터는 스타일 속성 추가
                pointRadius: isRecent ? 3 : 2,       // 최근 데이터는 큰 점, 이전 데이터는 작은 점
                pointBackgroundColor: isRecent ? 'rgba(52, 144, 220, 1)' : 'rgba(52, 144, 220, 0.5)',
                pointBorderColor: isRecent ? 'rgba(52, 144, 220, 1)' : 'rgba(52, 144, 220, 0.5)',
                pointHoverRadius: isRecent ? 6 : 4,
                // 선 스타일도 조정
                borderWidth: isRecent ? 3 : 1.5,
                borderColor: isRecent ? 'rgba(52, 144, 220, 1)' : 'rgba(52, 144, 220, 0.5)'
            };
        });

        // 데이터 길이 저장 (X축 범위 설정에 사용)
        this.currentDataLength = values.length;

        const chartData = {
            datasets: [
                {
                    label: '측정값',
                    data: values,
                    borderColor: 'rgba(52, 144, 220, 0.5)', // 기본 선 색상
                    backgroundColor: 'rgba(52, 144, 220, 0.1)',
                    borderWidth: 1.5, // 기본 선 두께
                    // 각 데이터 포인트마다 다른 스타일 적용을 위한 설정
                    pointRadius: values.map(v => v.pointRadius),
                    pointBackgroundColor: values.map(v => v.pointBackgroundColor),
                    pointBorderColor: values.map(v => v.pointBorderColor),
                    pointHoverRadius: values.map(v => v.pointHoverRadius),
                    // 선 스타일에 segment 옵션 사용
                    segment: {
                        borderColor: ctx => {
                            // 이 부분은 Chart.js의 segment 옵션을 사용하여 
                            // 현재 데이터 포인트의 borderColor 속성에 접근합니다
                            if (ctx.p1.raw && ctx.p1.raw.borderColor) {
                                return ctx.p1.raw.borderColor;
                            }
                            return 'rgba(52, 144, 220, 0.5)'; // 기본값
                        },
                        borderWidth: ctx => {
                            // 이 부분은 Chart.js의 segment 옵션을 사용하여 
                            // 현재 데이터 포인트의 borderWidth 속성에 접근합니다
                            if (ctx.p1.raw && ctx.p1.raw.borderWidth) {
                                return ctx.p1.raw.borderWidth;
                            }
                            return 1.5; // 기본값
                        }
                    },
                    fill: false,
                    tension: 0.1
                }
            ]
        };
        
        // SPEC 라인 추가
        if (specData) {
            // USL 라인
            if (specData.usl !== undefined) {
                chartData.datasets.push({
                    label: 'USL',
                    data: values.map((v, i) => ({ x: i, y: specData.usl })),
                    borderColor: 'rgba(231, 76, 60, 0.8)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                });
            }
            
            // LSL 라인
            if (specData.lsl !== undefined) {
                chartData.datasets.push({
                    label: 'LSL',
                    data: values.map((v, i) => ({ x: i, y: specData.lsl })),
                    borderColor: 'rgba(231, 76, 60, 0.8)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                });
            }
            
            // TARGET 라인
            if (specData.lsl !== undefined && specData.usl !== undefined) {
                const target = (specData.lsl + specData.usl) / 2;
                chartData.datasets.push({
                    label: 'TARGET',
                    data: values.map((v, i) => ({ x: i, y: target })),
                    borderColor: 'rgba(52, 152, 219, 0.8)',
                    borderWidth: 2,
                    borderDash: [2, 2],
                    pointRadius: 0,
                    fill: false
                });
            }
        }
        
        return chartData;
    }

    getChartOptions(specData) {
        let min, max;

        if (specData && specData.lsl !== undefined && specData.usl !== undefined) {
            // SPEC 범위(LSL~USL)에 0.1씩 여유를 추가
            min = specData.lsl - 0.1;
            max = specData.usl + 0.1;
        } else {
            // SPEC 정보가 없는 경우에는 기존 방식대로 동작
            if (specData) {
                if (specData.usl !== undefined) {
                    max = specData.usl * 1.1;
                }
                
                if (specData.lsl !== undefined) {
                    min = specData.lsl * 0.9;
                }
            }
        }
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    filter: function(tooltipItem) {
                        // 측정값 데이터셋(인덱스 0)만 표시하고 USL, LSL, TARGET(인덱스 1 이상) 데이터셋은 제외
                        return tooltipItem.datasetIndex === 0;
                    },
                    callbacks: {
                        title: function(tooltipItems) {
                            if (tooltipItems.length > 0 && tooltipItems[0].raw.created_at) {
                                return new Date(tooltipItems[0].raw.created_at).toLocaleString();
                            }
                            return '';
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(3);
                            }
                            return label;
                        },
                        afterLabel: function(context) {
                            const dataPoint = context.raw;
                            let labels = [];
                            
                            if (dataPoint.lot_no) {
                                labels.push(`Lot No: ${dataPoint.lot_no}`);
                            }
                            if (dataPoint.wafer_no) {
                                labels.push(`Wafer No: ${dataPoint.wafer_no}`);
                            }
                            
                            return labels;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: this.currentDataLength > 0 ? this.currentDataLength - 1 : 0,
                    grid: {
                        display: false
                    },
                    ticks: {
                        // 시작과 끝 날짜만 표시
                        callback: function(value, index, values) {
                            // 첫 번째와 마지막 틱만 표시
                            if (index === 0 || index === values.length - 1) {
                                const dataset = this.chart.data.datasets[0];
                                if (dataset && dataset.data) {
                                    // 첫 번째 틱은 시작 날짜, 마지막 틱은 끝 날짜
                                    if (index === 0 && dataset.data.length > 0) {
                                        return new Date(dataset.data[0].created_at).toLocaleDateString();
                                    } else if (index === values.length - 1 && dataset.data.length > 0) {
                                        const lastIdx = dataset.data.length - 1;
                                        return new Date(dataset.data[lastIdx].created_at).toLocaleDateString();
                                    }
                                }
                            }
                            return '';  // 다른 틱은 빈 문자열 반환하여 표시하지 않음
                        }
                    }
                },
                y: {
                    min: min,
                    max: max,
                    ticks: {
                        precision: 3
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        };
    }
    
    // 차트 업데이트
    updateChart(targetId, data, specData) {
        const chartId = `chart-${targetId}`;
        
        if (this.charts[chartId]) {
            const chartData = this.prepareChartData(data, specData);
            this.charts[chartId].chart.data = chartData;
            this.charts[chartId].chart.update();
            
            // Cp 뱃지 업데이트
            const chartCard = document.getElementById(`chart-card-${targetId}`);
            if (chartCard) {
                const cpBadge = chartCard.querySelector('.cp-badge');
                if (cpBadge) {
                    // 기존 배경색 클래스 제거
                    cpBadge.classList.remove('bg-danger', 'bg-warning', 'bg-info', 'bg-success', 'bg-secondary');
                    
                    // 데이터 포인트 확인 - 실제 측정 데이터가 있는지 확인
                    const hasValidData = data && data.length >= 2;
                    
                    if (!hasValidData) {
                        // 데이터가 없거나 불충분한 경우
                        cpBadge.textContent = 'Cp: N/A';
                        cpBadge.classList.add('bg-secondary');
                    } else {
                        // 데이터가 충분하고 SPEC 정보가 있는 경우에만 Cp 값 표시
                        if (specData && specData.process_capability && specData.process_capability.cp !== null && specData.process_capability.cp !== undefined) {
                            const cpValue = specData.process_capability.cp;
                            let cpColor = 'bg-secondary';
                            
                            if (cpValue < 0.67) cpColor = 'bg-danger';
                            else if (cpValue < 1.00) cpColor = 'bg-warning';
                            else if (cpValue < 1.33) cpColor = 'bg-info';
                            else cpColor = 'bg-success';
                            
                            cpBadge.textContent = `Cp: ${cpValue.toFixed(2)}`;
                            cpBadge.classList.add(cpColor);
                        } else {
                            cpBadge.textContent = 'Cp: N/A';
                            cpBadge.classList.add('bg-secondary');
                        }
                    }
                }
            }
        }
    }
    
    // 차트 제거
    removeChart(targetId) {
        const chartId = `chart-${targetId}`;
        
        if (this.charts[chartId]) {
            // 차트 객체 파괴
            this.charts[chartId].chart.destroy();
            
            // DOM에서 차트 카드 제거
            const chartCard = document.getElementById(`chart-card-${targetId}`);
            if (chartCard) {
                chartCard.remove();
            }
            
            // 차트 객체 참조 제거
            delete this.charts[chartId];
            
            // 차트가 없는 경우 빈 메시지 표시
            if (Object.keys(this.charts).length === 0) {
                document.getElementById('empty-charts-message').style.display = 'block';
            }
            
            return true;
        }
        
        return false;
    }
    
    // 모든 차트 제거
    removeAllCharts() {
        for (const chartId in this.charts) {
            const targetId = this.charts[chartId].targetId;
            this.removeChart(targetId);
        }
    }
    
    // PDF로 차트 내보내기
    async exportToPDF() {
        // 차트가 없는 경우
        if (Object.keys(this.charts).length === 0) {
            alert('내보낼 차트가 없습니다.');
            return;
        }
        
        try {
            // 로딩 표시
            document.getElementById('loading-indicator').style.display = 'block';
            
            // jsPDF 초기화
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('l', 'mm', 'a4'); // 가로 방향으로 변경
            
            // 페이지 설정
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = {
                top: 8,     // 상단 여백 축소
                bottom: 5,  // 하단 여백 축소
                left: 12,   // 좌측 여백
                right: 12   // 우측 여백
            };
            
            // 날짜 범위 가져오기
            const dateRange = document.getElementById('date-range').value;
            
            // 제목 추가 - 여백 최소화
            pdf.setFontSize(16); // 제목 크기 약간 축소
            pdf.text(`DICD Monitoring (${dateRange})`, pageWidth / 2, margin.top + 5, { align: 'center' });
            
            // 차트 배치를 위한 설정 - 더 큰 차트
            const titleSpace = 12; // 제목 공간 축소
            const chartWidth = (pageWidth - margin.left - margin.right - 8) / 2; // 2열, 중간 간격만 8mm
            const chartHeight = (pageHeight - margin.top - margin.bottom - titleSpace - 10) / 3; // 3행, 간격 5mm씩
            
            const chartIds = Object.keys(this.charts);
            
            // 차트 개수에 따라 필요한 페이지 수 계산
            const chartsPerPage = 6; // 3x2 그리드
            const totalPages = Math.ceil(chartIds.length / chartsPerPage);
            
            for (let page = 0; page < totalPages; page++) {
                // 첫 페이지가 아니면 새 페이지 추가
                if (page > 0) {
                    pdf.addPage();
                    // 새 페이지에도 제목 추가
                    pdf.setFontSize(16);
                    pdf.text(`DICD Monitoring (${dateRange})`, pageWidth / 2, margin.top + 5, { align: 'center' });
                }
                
                // 현재 페이지의 차트 개수 (마지막 페이지는 남은 차트 수)
                const chartsOnPage = Math.min(chartsPerPage, chartIds.length - page * chartsPerPage);
                
                // 페이지 내 차트 위치 계산 및 추가
                for (let i = 0; i < chartsOnPage; i++) {
                    const chartId = chartIds[page * chartsPerPage + i];
                    const chartInfo = this.charts[chartId];
                    
                    // 행과 열 계산 (3x2 그리드)
                    const row = Math.floor(i / 2); // 0, 0, 1, 1, 2, 2
                    const col = i % 2; // 0, 1, 0, 1, 0, 1
                    
                    // 현재 차트의 x, y 좌표 계산 - 정확한 그리드 위치, 간격 최소화
                    const x = margin.left + col * (chartWidth + 8); // 중간 간격만 8mm로 설정
                    const y = margin.top + titleSpace + row * (chartHeight + 5); // 행 간격 5mm로 축소
                    
                    // 차트 제목 가져오기
                    const targetInfo = targetManager.getTargetById(chartInfo.targetId);
                    
                    // Cp 값 가져오기 (있는 경우)
                    let cpValue = '';
                    const chartCard = document.getElementById(`chart-card-${chartInfo.targetId}`);
                    if (chartCard) {
                        const cpBadge = chartCard.querySelector('.cp-badge');
                        if (cpBadge) {
                            cpValue = cpBadge.textContent;
                        }
                    }
                    
                    // 차트 제목 생성: 제품군_STEP_TARGET(Cp:Cp값)
                    const chartTitle = `${targetInfo.productGroupName}_${targetInfo.processName}_${targetInfo.targetName} (${cpValue})`;
                    
                    // 차트 제목 추가 - 차트와 더 가깝게
                    pdf.setFontSize(8); // 글꼴 크기 축소
                    pdf.text(chartTitle, x + chartWidth/2, y - 2, { align: 'center' });
                    
                    // 차트 캔버스를 이미지로 변환
                    const canvas = document.getElementById(chartId);
                    
                    // 차트 비율을 조정하여 Y축 길이 늘리기
                    // 원본 크기의 비율을 계산하되 높이를 약간 늘림
                    const originalAspectRatio = canvas.width / canvas.height;
                    // Y축을 늘리려면 가로세로 비율을 약간 줄임 (0.85를 곱해 세로를 약 15% 늘림)
                    const adjustedAspectRatio = originalAspectRatio * 0.85;
                    
                    // 조정된 비율로 이미지 크기 계산
                    let imgWidth = chartWidth;
                    let imgHeight = imgWidth / adjustedAspectRatio; // 높이가 더 커짐
                    
                    // 높이가 할당된 공간을 초과하면 조정
                    if (imgHeight > chartHeight) {
                        imgHeight = chartHeight;
                        imgWidth = imgHeight * adjustedAspectRatio;
                    }
                    
                    // 중앙 정렬을 위한 오프셋 계산
                    const xOffset = (chartWidth - imgWidth) / 2;
                    
                    // 캔버스를 이미지로 변환
                    const chartImage = canvas.toDataURL('image/png', 1.0);
                    
                    // 차트 주변에 얇은 경계선 그리기
                    pdf.setDrawColor(230, 230, 230); // 더 연한 회색 테두리
                    pdf.setLineWidth(0.1); // 더 얇은 선
                    pdf.rect(x, y, chartWidth, chartHeight);
                    
                    // 차트 이미지 추가 (정확한 위치와 크기로)
                    pdf.addImage(chartImage, 'PNG', x + xOffset, y, imgWidth, imgHeight);
                }
            }
            
            // PDF 저장
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            pdf.save(`DICD_Monitoring_${dateStr}.pdf`);
            
        } catch (error) {
            console.error('PDF 내보내기 오류:', error);
            alert('PDF 내보내기 중 오류가 발생했습니다.');
        } finally {
            // 로딩 숨기기
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }
}

// 데이터 로더 클래스
class DataLoader {
    constructor() {
        this.cache = {};
        this.cacheTimeout = 5 * 60 * 1000; // 5분 캐시
    }
    
    // 캐시 키 생성
    getCacheKey(targetId, startDate, endDate) {
        return `${targetId}_${startDate}_${endDate}`;
    }
    
    // 측정 데이터 로드
    async loadMeasurementData(targetId, startDate, endDate) {
        try {
            const cacheKey = this.getCacheKey(targetId, startDate, endDate);
            
            // 캐시 확인
            if (this.cache[cacheKey] && 
                (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTimeout) {
                return this.cache[cacheKey].data;
            }
            
            // 데이터 가져오기
            const params = {
                target_id: targetId
            };
            
            // 날짜 범위 처리
            if (startDate && endDate) {
                params.start_date = startDate;
                params.end_date = endDate;
                
                // days 계산 (백엔드가 days 파라미터를 사용하는 경우를 위해)
                const start = new Date(startDate);
                const end = new Date(endDate);
                const today = new Date();
                
                const diffTime = Math.abs(today - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                params.days = diffDays + 1; // 오늘을 포함하기 위해 +1
            }
            
            const response = await api.getMeasurements(params);
            
            // 날짜 필터링 (백엔드가 직접 필터링을 지원하지 않는 경우)
            let filteredResponse = response;
            
            if (startDate && endDate) {
                const startDateTime = new Date(startDate).getTime();
                const endDateTime = new Date(endDate).getTime() + 86400000; // 끝 날짜를 포함하기 위해 하루 추가
                
                filteredResponse = response.filter(item => {
                    const itemDate = new Date(item.created_at).getTime();
                    return itemDate >= startDateTime && itemDate <= endDateTime;
                });
            }
            
            // 데이터 캐싱
            this.cache[cacheKey] = {
                data: filteredResponse,
                timestamp: Date.now()
            };
            
            return filteredResponse;
        } catch (error) {
            console.error('측정 데이터 로드 오류:', error);
            throw error;
        }
    }
    
    // Spec 데이터 로드
    async loadSpecData(targetId, startDate, endDate) {
        try {
            const cacheKey = `spec_${targetId}_${startDate}_${endDate}`;
            
            // 캐시 확인
            if (this.cache[cacheKey] && 
                (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTimeout) {
                return this.cache[cacheKey].data;
            }
            
            // 활성 SPEC 가져오기
            const response = await api.getActiveSpec(targetId);
            
            // SPEC이 있는 경우에만 통계 정보 가져오기
            if (response) {
                try {
                    // SPC API를 사용하여 동일한 방식으로 Cp 계산
                    let apiParams = {};
                    
                    if (startDate && endDate) {
                        apiParams.start_date = startDate;
                        apiParams.end_date = endDate;
                    } else {
                        apiParams.days = 30; // 기본값
                    }
                    
                    // SPC 분석 API 호출 (SPC와 동일한 방식)
                    const spcResult = await api.analyzeSpc(targetId, apiParams);
                    
                    // 통계 데이터와 SPEC 정보 합치기
                    const specData = {
                        lsl: response.lsl,
                        usl: response.usl,
                        process_capability: spcResult.process_capability || null
                    };
                    
                    // 데이터 캐싱
                    this.cache[cacheKey] = {
                        data: specData,
                        timestamp: Date.now()
                    };
                    
                    return specData;
                } catch (spcError) {
                    console.error('SPC 데이터 로드 오류:', spcError);
                    
                    // 기본 SPEC 정보만 반환
                    const specData = {
                        lsl: response.lsl,
                        usl: response.usl
                    };
                    
                    // 데이터 캐싱
                    this.cache[cacheKey] = {
                        data: specData,
                        timestamp: Date.now()
                    };
                    
                    return specData;
                }
            }
            
            return null;
        } catch (error) {
            console.error('SPEC 데이터 로드 오류:', error);
            // 오류가 발생해도 null 반환하여 차트 생성은 계속 진행
            return null;
        }
    }
    
    // 캐시 무효화
    invalidateCache() {
        this.cache = {};
    }
}

// 전역 인스턴스
const targetManager = new TargetManager();
const chartManager = new ChartManager();
const dataLoader = new DataLoader();

// DOM 요소 참조
let productGroupSelect;
let processSelect;
let targetSelect;

// 초기화 함수
async function initialize() {
    // DOM 요소 참조 초기화
    productGroupSelect = document.querySelector('#target1-product-group');
    processSelect = document.querySelector('#target1-process');
    targetSelect = document.querySelector('#target1-target');
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    // 날짜 선택기 초기화
    initializeDateRangePicker();
    
    // 제품군 데이터 로드
    await loadProductGroups();
    
    // 선택된 타겟 표시 업데이트
    updateSelectedTargetsDisplay();
    
    // 저장된 타겟이 있으면 차트 로드
    if (targetManager.hasTargets()) {
        loadAllCharts();
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    
    // 빠른 날짜 선택 버튼 클릭
    document.querySelectorAll('[data-range]').forEach(button => {
        button.addEventListener('click', (e) => {
            const days = parseInt(e.currentTarget.getAttribute('data-range'));
            const endDate = moment();
            const startDate = moment().subtract(days - 1, 'days');
            
            // DateRangePicker 인스턴스 가져오기
            const picker = $('#date-range').data('daterangepicker');
            
            // 날짜 범위 설정
            picker.setStartDate(startDate);
            picker.setEndDate(endDate);
            
            // 입력 필드 업데이트
            document.getElementById('date-range').value = 
                `${startDate.format('YYYY-MM-DD')} - ${endDate.format('YYYY-MM-DD')}`;
            
            // 데이터 갱신
            refreshAllCharts();
        });
    });
    
    // 새로고침 버튼 클릭
    document.getElementById('refresh-btn').addEventListener('click', () => {
        refreshAllCharts();
    });
    
    // PDF 내보내기 버튼 클릭
    document.getElementById('export-pdf-btn').addEventListener('click', () => {
        chartManager.exportToPDF();
    });
    
    // 타겟 추가 버튼 클릭 (모달 열기)
    document.getElementById('add-targets-btn').addEventListener('click', () => {
        $('#add-targets-modal').modal('show');
    });

    // 타겟 저장 버튼 클릭
    document.getElementById('save-targets-btn').addEventListener('click', () => {
        handleSaveTargetsFromModal();
    });
}



// 모달에서 선택한 타겟 저장을 처리하는 새 함수
function handleSaveTargetsFromModal() {
    // 기존 타겟 모두 제거
    targetManager.clearTargets();
    
    // 체크된 타겟 가져오기
    const checkedCheckboxes = document.querySelectorAll('#targets-checklist-body input[type="checkbox"]:checked');
    
    // 각 체크된 체크박스에 대해
    checkedCheckboxes.forEach(checkbox => {
        const targetData = {
            productGroupId: parseInt(checkbox.getAttribute('data-product-group-id')),
            productGroupName: checkbox.getAttribute('data-product-group-name'),
            processId: parseInt(checkbox.getAttribute('data-process-id')),
            processName: checkbox.getAttribute('data-process-name'),
            targetId: parseInt(checkbox.getAttribute('data-target-id')),
            targetName: checkbox.getAttribute('data-target-name')
        };
        
        // 타겟 관리자에 타겟 추가
        targetManager.addTarget(targetData);
    });
    
    // 모달 닫기
    $('#add-targets-modal').modal('hide');
    
    // 선택된 타겟 표시 업데이트
    updateSelectedTargetsDisplay();
    
    // 모든 차트 새로 로드
    refreshAllCharts();
}

function initializeDateRangePicker() {
    const endDate = moment();
    const startDate = moment().subtract(30, 'days');
    
    // 날짜 선택기 초기화
    $('#date-range').daterangepicker({
        startDate: startDate,
        endDate: endDate,
        locale: {
            format: 'YYYY-MM-DD',
            applyLabel: '적용',
            cancelLabel: '취소',
            customRangeLabel: '사용자 지정'
        },
        ranges: {
            '오늘': [moment(), moment()],
            '어제': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
            '최근 7일': [moment().subtract(6, 'days'), moment()],
            '최근 30일': [moment().subtract(29, 'days'), moment()],
            '이번 달': [moment().startOf('month'), moment().endOf('month')],
            '지난 달': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    });
    
    // 초기 값 설정
    document.getElementById('date-range').value = 
        `${startDate.format('YYYY-MM-DD')} - ${endDate.format('YYYY-MM-DD')}`;
    
    // 날짜 변경 이벤트
    $('#date-range').on('apply.daterangepicker', function(ev, picker) {
        console.log('Date range changed:', picker.startDate.format('YYYY-MM-DD'), picker.endDate.format('YYYY-MM-DD'));
        refreshAllCharts();
    });
 }
 
 // 제품군 데이터 로드
async function loadProductGroups() {
    try {
        // 제품군 데이터 가져오기
        const productGroups = await api.getProductGroups();
        
        // 모달이 열릴 때 데이터를 사용할 수 있도록 전역 변수에 저장
        window.cachedProductGroups = productGroups;
        
        // 선택된 타겟 표시 업데이트만 수행하고 DOM 조작은 하지 않음
        console.log('제품군 데이터 로드 완료:', productGroups.length);
    } catch (error) {
        console.error('제품군 로드 오류:', error);
        alert('제품군 데이터를 로드하는 중 오류가 발생했습니다.');
    }
}
 
 // 공정 데이터 로드
 async function loadProcesses(productGroupId) {
    if (!productGroupId) return;
    
    try {
        const processes = await api.getProcesses(productGroupId);
        
        // 옵션 초기화
        processSelect.innerHTML = '<option value="">공정 선택</option>';
        
        // 옵션 추가
        processes.forEach(process => {
            const option = document.createElement('option');
            option.value = process.id;
            option.textContent = process.name;
            processSelect.appendChild(option);
        });
    } catch (error) {
        console.error('공정 로드 오류:', error);
        alert('공정 데이터를 로드하는 중 오류가 발생했습니다.');
    }
 }
 
 // 타겟 데이터 로드
 async function loadTargets(processId) {
    if (!processId) return;
    
    try {
        const targets = await api.getTargets(processId);
        
        // 옵션 초기화
        targetSelect.innerHTML = '<option value="">타겟 선택</option>';
        
        // 옵션 추가
        targets.forEach(target => {
            const option = document.createElement('option');
            option.value = target.id;
            option.textContent = target.name;
            targetSelect.appendChild(option);
        });
    } catch (error) {
        console.error('타겟 로드 오류:', error);
        alert('타겟 데이터를 로드하는 중 오류가 발생했습니다.');
    }
 }
 
 // 모달에서 타겟 추가 (단일 함수로 통합)
 function addTargetToSelectedTable() {
    // 값 가져오기
    const productGroupId = productGroupSelect.value;
    const processId = processSelect.value;
    const targetId = targetSelect.value;
    
    if (!productGroupId || !processId || !targetId) {
        return;
    }
    
    // 텍스트 가져오기
    const productGroupName = productGroupSelect.options[productGroupSelect.selectedIndex].text;
    const processName = processSelect.options[processSelect.selectedIndex].text;
    const targetName = targetSelect.options[targetSelect.selectedIndex].text;
    
    // 타겟 데이터 생성
    const targetData = {
        productGroupId: parseInt(productGroupId),
        productGroupName,
        processId: parseInt(processId),
        processName,
        targetId: parseInt(targetId),
        targetName
    };
    
    // 이미 테이블에 있는지 확인
    const tableBody = document.querySelector('#selected-targets-table tbody');
    const existingRow = tableBody.querySelector(`tr[data-target-id="${targetId}"]`);
    
    if (existingRow) {
        alert('이미 선택된 타겟입니다.');
        return;
    }
    
    // 타겟 목록에 추가
    targetManager.addTarget(targetData);
    
    // 테이블에 행 추가
    const newRow = document.createElement('tr');
    newRow.setAttribute('data-target-id', targetData.targetId);
    
    // 행 내용 추가
    newRow.innerHTML = `
        <td>${targetData.productGroupName}</td>
        <td>${targetData.processName}</td>
        <td>${targetData.targetName}</td>
        <td class="text-center">
            <button class="btn btn-sm btn-danger remove-target-row" data-target-id="${targetData.targetId}">
                <i class="fas fa-trash-alt"></i> 제거
            </button>
        </td>
    `;
    
    // "선택된 타겟 없음" 행 제거
    const noTargetsRow = document.getElementById('no-selected-targets-row');
    if (noTargetsRow) {
        noTargetsRow.remove();
    }
    
    // 테이블에 행 추가
    tableBody.appendChild(newRow);
    
    // 제거 버튼 이벤트 리스너 추가
    const removeButton = newRow.querySelector('.remove-target-row');
    removeButton.addEventListener('click', () => {
        const targetId = parseInt(removeButton.getAttribute('data-target-id'));
        targetManager.removeTarget(targetId);
        newRow.remove();
        
        // 행이 없으면 "선택된 타겟 없음" 메시지 추가
        if (tableBody.children.length === 0) {
            tableBody.innerHTML = `
                <tr id="no-selected-targets-row">
                    <td colspan="4" class="text-center">선택된 타겟이 없습니다.</td>
                </tr>
            `;
        }
    });
    
    // 선택 초기화
    targetSelect.value = '';
    document.getElementById('add-target-btn').disabled = true;
 }
 
 // 선택된 타겟 표시 업데이트
 function updateSelectedTargetsDisplay() {
    const selectedTargetsContainer = document.getElementById('selected-targets');
    const noTargetsMessage = document.getElementById('no-targets-message');
    
    // 선택된 타겟 가져오기
    const targets = targetManager.getAllTargets();
    
    if (targets.length === 0) {
        // 타겟이 없는 경우 메시지 표시
        noTargetsMessage.style.display = 'block';
        selectedTargetsContainer.innerHTML = '';
        selectedTargetsContainer.appendChild(noTargetsMessage);
        return;
    }
    
    // 타겟이 있는 경우 메시지 숨김
    noTargetsMessage.style.display = 'none';
    
    // 기존 뱃지 제거 (메시지 제외)
    Array.from(selectedTargetsContainer.children).forEach(child => {
        if (child !== noTargetsMessage) {
            child.remove();
        }
    });
    
    // 타겟 뱃지 추가
    targets.forEach(target => {
        const badge = document.createElement('div');
        badge.className = 'target-badge';
        badge.setAttribute('data-target-id', target.targetId);
        badge.innerHTML = `
            ${target.productGroupName} - ${target.processName} - ${target.targetName}
            <button type="button" class="close" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        `;
        
        // 제거 버튼 이벤트 리스너
        const closeButton = badge.querySelector('.close');
        closeButton.addEventListener('click', () => {
            const targetId = parseInt(badge.getAttribute('data-target-id'));
            targetManager.removeTarget(targetId);
            chartManager.removeChart(targetId);
            badge.remove();
            
            // 타겟이 없는 경우 메시지 표시
            if (targetManager.getAllTargets().length === 0) {
                noTargetsMessage.style.display = 'block';
                selectedTargetsContainer.appendChild(noTargetsMessage);
            }
        });
        
        selectedTargetsContainer.appendChild(badge);
    });
 }
 
// 모달이 열릴 때 모든 타겟 목록 로드
$('#add-targets-modal').on('show.bs.modal', async function() {
    // 모달 다이얼로그 높이 최적화
    const modalDialog = this.querySelector('.modal-dialog');
    modalDialog.style.maxHeight = '90vh'; // viewport 높이의 90%
    
    const modalBody = this.querySelector('.modal-body');
    modalBody.style.maxHeight = 'calc(90vh - 130px)'; // 헤더와 푸터 공간 고려하여 조정
    modalBody.style.overflowY = 'auto'; // 수직 스크롤 활성화
    
    // 전체 선택 체크박스 초기화
    $('#check-all').prop('checked', false);

    const targetChecklistBody = document.getElementById('targets-checklist-body');
    targetChecklistBody.innerHTML = '<tr><td colspan="4" class="text-center"><i class="fas fa-spinner fa-spin mr-2"></i>데이터를 불러오는 중...</td></tr>';
    
    // 테이블 컨테이너의 최대 높이를 늘리고 행 간격 축소
    const tableResponsive = document.querySelector('.table-responsive');
    if (tableResponsive) {
        tableResponsive.style.maxHeight = '500px';
    }
    
    try {
        // 캐시된 제품군 데이터가 없으면 새로 가져오기
        if (!window.cachedProductGroups) {
            window.cachedProductGroups = await api.getProductGroups();
        }
        
        const productGroups = window.cachedProductGroups;
        
        // 빈 테이블 표시
        targetChecklistBody.innerHTML = '';
        
        // 테이블에 압축 클래스 추가
        const targetsChecklist = document.querySelector('#targets-checklist');
        if (targetsChecklist) {
            targetsChecklist.classList.add('table-sm');
        }
        
        // 선택된 타겟 ID 목록 (기존에 선택된 타겟 확인용)
        const selectedTargetIds = targetManager.getAllTargets().map(t => t.targetId);
        
        // 각 제품군에 대해
        for (const productGroup of productGroups) {
            try {
                // 각 제품군의 공정 로드
                const processes = await api.getProcesses(productGroup.id);
                
                // 각 공정에 대해
                for (const process of processes) {
                    try {
                        // 각 공정의 타겟 로드
                        const targets = await api.getTargets(process.id);
                        
                        // 각 타겟에 대해 행 추가
                        for (const target of targets) {
                            const isChecked = selectedTargetIds.includes(target.id);
                            
                            const row = document.createElement('tr');
                            row.style.lineHeight = '1.2'; // 행 높이 축소
                            row.innerHTML = `
                                <td class="text-center py-1"> <!-- padding-y 축소 -->
                                    <div class="icheck-primary">
                                        <input type="checkbox" id="target-check-${target.id}" 
                                            class="target-checkbox"
                                            data-product-group-id="${productGroup.id}"
                                            data-product-group-name="${productGroup.name}"
                                            data-process-id="${process.id}"
                                            data-process-name="${process.name}"
                                            data-target-id="${target.id}"
                                            data-target-name="${target.name}"
                                            ${isChecked ? 'checked' : ''}>
                                        <label for="target-check-${target.id}"></label>
                                    </div>
                                </td>
                                <td class="py-1">${productGroup.name}</td> <!-- padding-y 축소 -->
                                <td class="py-1">${process.name}</td> <!-- padding-y 축소 -->
                                <td class="py-1">${target.name}</td> <!-- padding-y 축소 -->
                            `;
                            
                            targetChecklistBody.appendChild(row);
                        }
                    } catch (targetError) {
                        console.error(`공정 ID ${process.id}에 대한 타겟 로드 오류:`, targetError);
                        // 개별 공정 오류는 전체 로딩을 중단하지 않음
                    }
                }
            } catch (processError) {
                console.error(`제품군 ID ${productGroup.id}에 대한 공정 로드 오류:`, processError);
                // 개별 제품군 오류는 전체 로딩을 중단하지 않음
            }
        }
        
        // 선택된 타겟 수 업데이트
        updateSelectedTargetsCount();
        
        // 검색 필터 이벤트 리스너 추가
        setupTargetSearchFilter();
        
        // 테이블이 비어있는지 확인
        if (targetChecklistBody.children.length === 0) {
            targetChecklistBody.innerHTML = '<tr><td colspan="4" class="text-center text-warning">표시할 타겟이 없습니다.</td></tr>';
        }
        
    } catch (error) {
        console.error('타겟 목록 로드 오류:', error);
        targetChecklistBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">데이터를 불러오는 중 오류가 발생했습니다.</td></tr>';
    }
});
 
// 체크박스 이벤트 처리
$(document).on('change', '#check-all', function() {
    // 전체 선택 체크박스 클릭 시 모든 체크박스에 같은 상태 적용
    $('#targets-checklist-body input[type="checkbox"]').prop('checked', $(this).prop('checked'));
    
    // 선택된 타겟 수 업데이트
    updateSelectedTargetsCount();
});

$(document).on('change', '#targets-checklist-body input[type="checkbox"]', function() {
    // 선택된 타겟 수 업데이트
    updateSelectedTargetsCount();
    
    // 모든 체크박스가 선택되었는지 확인하여 '전체 선택' 체크박스 상태 업데이트
    const allCheckboxes = $('#targets-checklist-body input[type="checkbox"]').length;
    const checkedCheckboxes = $('#targets-checklist-body input[type="checkbox"]:checked').length;
    $('#check-all').prop('checked', allCheckboxes === checkedCheckboxes);
});
 
 // 선택된 타겟 수 업데이트 함수
 function updateSelectedTargetsCount() {
    const count = $('#targets-checklist-body input[type="checkbox"]:checked').length;
    $('#selected-targets-count').text(count);
 }
 
 // 검색 필터 설정
 function setupTargetSearchFilter() {
    const searchInput = document.getElementById('target-search');
    
    // 전체 선택 체크박스 이벤트 처리 - 완전히 새롭게 구현
    document.addEventListener('DOMContentLoaded', function() {
        // 전체 선택 체크박스에 직접 이벤트 리스너 추가
        $(document).on('click', '#check-all', function() {
            // 모든 개별 체크박스에 같은 체크 상태 적용
            $('#targets-checklist-body input[type="checkbox"]').prop('checked', this.checked);
            
            // 선택된 타겟 수 업데이트
            updateSelectedTargetsCount();
        });
        
        // 개별 체크박스 변경 이벤트
        $(document).on('change', '#targets-checklist-body input[type="checkbox"]', function() {
            // 전체 체크박스 상태 업데이트
            updateCheckAllStatus();
            
            // 선택된 타겟 수 업데이트
            updateSelectedTargetsCount();
        });
    });

    // 전체 선택 체크박스 상태 업데이트 함수
    function updateCheckAllStatus() {
        const totalCheckboxes = $('#targets-checklist-body input[type="checkbox"]').length;
        const checkedCount = $('#targets-checklist-body input[type="checkbox"]:checked').length;
        
        // 모든 체크박스가 체크되어 있으면 전체 선택도 체크
        $('#check-all').prop('checked', totalCheckboxes > 0 && checkedCount === totalCheckboxes);
    }

    // 모달이 열릴 때 이벤트에 추가
    $('#add-targets-modal').on('shown.bs.modal', function() {
        // 모달이 완전히 표시된 후 체크박스 상태 초기화
        setTimeout(function() {
            // 1. 전체 선택 체크박스 초기화
            $('#check-all').prop('checked', false);
            
            // 2. 선택된 타겟 ID 목록 가져오기
            const selectedTargetIds = targetManager.getAllTargets().map(t => t.targetId);
            
            // 3. 타겟 체크박스 상태 설정
            $('#targets-checklist-body input[type="checkbox"]').each(function() {
                const targetId = parseInt($(this).attr('data-target-id'));
                $(this).prop('checked', selectedTargetIds.includes(targetId));
            });
            
            // 4. 전체 선택 상태 업데이트
            updateCheckAllStatus();
            
            // 5. 선택된 타겟 수 업데이트
            updateSelectedTargetsCount();
        }, 100);
    });
}

// 단일 차트 로드
async function loadChart(targetInfo, startDate, endDate) {
    try {
        // 측정 데이터 로드 - 날짜 범위 명시적 전달
        const measurements = await dataLoader.loadMeasurementData(targetInfo.targetId, startDate, endDate);
        
        // SPEC 데이터 로드 - 날짜 범위 전달
        const specData = await dataLoader.loadSpecData(targetInfo.targetId, startDate, endDate);
        
        // 데이터가 없는 경우 빈 차트 표시
        if (!measurements || measurements.length === 0) {
            console.warn(`타겟 ID ${targetInfo.targetId}에 대한 측정 데이터가 없습니다. (${startDate} ~ ${endDate})`);
        }
        
        // 차트 생성
        chartManager.createChart(targetInfo, measurements || [], specData);
    } catch (error) {
        console.error(`차트 로드 오류 (타겟 ID: ${targetInfo.targetId}):`, error);
    }
}
 
 // 모든 차트 로드
 async function loadAllCharts() {
    try {
        const targets = targetManager.getAllTargets();
        
        if (targets.length === 0) {
            document.getElementById('empty-charts-message').style.display = 'block';
            return;
        }
        
        // 현재 선택된 날짜 범위 가져오기
        const dateRangeValue = document.getElementById('date-range').value;
        const [startDateStr, endDateStr] = dateRangeValue.split(' - ');
        
        // 로딩 표시
        document.getElementById('loading-indicator').style.display = 'block';
        
        // 모든 차트 로드
        for (const target of targets) {
            await loadChart(target, startDateStr, endDateStr);
        }
    } catch (error) {
        console.error('차트 로드 오류:', error);
        alert('차트를 로드하는 중 오류가 발생했습니다.');
    } finally {
        // 로딩 숨기기
        document.getElementById('loading-indicator').style.display = 'none';
    }
 }
 
 // 모든 차트 새로고침
 async function refreshAllCharts() {
    try {
        // 모든 차트 제거
        chartManager.removeAllCharts();
        
        // 데이터 캐시 무효화
        dataLoader.invalidateCache();
        
        // 모든 타겟에 대해 차트 새로 생성
        await loadAllCharts();
    } catch (error) {
        console.error('차트 새로고침 오류:', error);
    }
 }
 

 // 페이지 로드 시 초기화
$(document).ready(function() {
    initialize();
});