// 전역 변수
let cpkHeatmapData = [];
let monitoringCharts = [];
let monitoringTargets = [];
let currentPeriodDays = 14; // 기본값은 14일

// 초기화 함수
function initDashboard() {
    // 공정능력지수 히트맵 로드
    loadCpkHeatmap();

    // 모니터링 타겟 로드 및 설정
    initMonitoringTargets();
    
    // 이벤트 리스너 설정
    setupEventListeners();

}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 히트맵 새로고침 버튼 이벤트
    document.getElementById('refresh-heatmap-btn').addEventListener('click', function() {
        loadCpkHeatmap();
    });
    
    // 타겟 설정 버튼 이벤트
    document.getElementById('configure-targets-btn').addEventListener('click', function() {
        openTargetConfigModal();
    });
    
    // 타겟 설정 저장 버튼 이벤트
    document.getElementById('save-target-config-btn').addEventListener('click', function() {
        saveMonitoringTargets();
    });
    
    document.getElementById('period-14d').addEventListener('click', function() {
        setActivePeriodButton(this);
        currentPeriodDays = 14;
        loadCpkHeatmap();
    });
    
    document.getElementById('period-1m').addEventListener('click', function() {
        setActivePeriodButton(this);
        currentPeriodDays = 30;
        loadCpkHeatmap();
    });
    
    document.getElementById('period-3m').addEventListener('click', function() {
        setActivePeriodButton(this);
        currentPeriodDays = 90;
        loadCpkHeatmap();
    });

    // 제품군 선택 이벤트 (타겟 1, 2, 3, 4, 5, 6)
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`target${i}-product-group`).addEventListener('change', function() {
            const productGroupId = this.value;
            loadProcessOptions(i, productGroupId);
        });
        
        document.getElementById(`target${i}-process`).addEventListener('change', function() {
            const processId = this.value;
            loadTargetOptions(i, processId);
        });
    }
}
// 추가할 코드 - 새로운 함수
// 기간 버튼 활성화 상태 설정
function setActivePeriodButton(activeButton) {
    // 모든 기간 버튼에서 활성화 클래스 제거
    document.querySelectorAll('.card-tools .btn-group .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 클릭한 버튼만 활성화 클래스 추가
    activeButton.classList.add('active');
    
    // 기간 표시 텍스트 업데이트
    let periodText = '';
    if (activeButton.id === 'period-14d') periodText = '(최근 14일)';
    else if (activeButton.id === 'period-1m') periodText = '(최근 1개월)';
    else if (activeButton.id === 'period-3m') periodText = '(최근 3개월)';
    
    document.getElementById('cpk-heatmap-period').textContent = periodText;
}

// 기존 loadCpkHeatmap 함수를 아래 코드로 교체
async function loadCpkHeatmap() {
    try {
        const heatmapDays = currentPeriodDays;

        // 로딩 표시
        document.getElementById('cpk-heatmap-container').innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border text-primary" role="status">
                <span class="sr-only">로딩 중...</span>
            </div>
            <p class="mt-2">히트맵 데이터 로드 중...</p>
        </div>
        `;
        
        // 히트맵 데이터 초기화
        cpkHeatmapData = [];
        
        // 제품군 목록 한 번에 가져오기 
        const productGroups = await api.getProductGroups();
        
        // 모든 공정 정보 병렬로 가져오기
        const processPromises = productGroups.map(productGroup => 
            api.getProcesses(productGroup.id).then(processes => 
                ({ productGroup, processes })
            )
        );
        
        const processResults = await Promise.all(processPromises);
        
        // 모든 타겟 정보 병렬로 가져오기 
        const targetPromises = [];
        processResults.forEach(result => {
            result.processes.forEach(process => {
                targetPromises.push(
                    api.getTargets(process.id).then(targets => 
                        ({ 
                            productGroup: result.productGroup, 
                            process, 
                            targets 
                        })
                    )
                );
            });
        });
        
        const targetResults = await Promise.all(targetPromises);
        
        // 각 타겟에 대한 통계 정보 한 번에 요청 (병렬 처리)
        const statisticsPromises = [];
        const targetMap = {};  // 타겟 ID를 키로 하는 맵 (통계 결과와 연결하기 위함)
        
        targetResults.forEach(result => {
            result.targets.forEach(target => {
                // 통계 정보 가져오기 (비동기)
                statisticsPromises.push(
                    api.getTargetStatistics(target.id, currentPeriodDays)
                        .then(stats => ({ targetId: target.id, stats }))
                        .catch(error => {
                            console.warn(`타겟 ${target.id}에 대한 통계 정보를 가져올 수 없습니다.`, error);
                            return { targetId: target.id, stats: null };
                        })
                );
                
                // 타겟 정보 맵에 저장
                targetMap[target.id] = {
                    productGroup: result.productGroup,
                    process: result.process,
                    target
                };
            });
        });
        
        // 모든 통계 정보 요청을 병렬로 처리하고 결과 받기
        const statisticsResults = await Promise.all(statisticsPromises);
        
        // 모든 데이터를 결합하여 히트맵 데이터 생성
        statisticsResults.forEach(({ targetId, stats }) => {
            const targetInfo = targetMap[targetId];
            if (!targetInfo) return;
            
            // 공정능력지수 추출
            let cpk = null;
            if (stats && stats.process_capability && stats.process_capability.cpk !== undefined) {
                cpk = stats.process_capability.cpk;
            }
            
            const sampleCount = stats?.sample_count ?? null;
            
            // 히트맵 데이터에 추가
            cpkHeatmapData.push({
                productGroup: targetInfo.productGroup.name,
                process: targetInfo.process.name,
                target: targetInfo.target.name,
                cpk: cpk,
                sampleCount: sampleCount,
                targetId: targetId
            });
        });
        
        // 히트맵 렌더링
        renderCpkHeatmap();
        
    } catch (error) {
        console.error('공정능력지수 히트맵 로드 실패:', error);
        document.getElementById('cpk-heatmap-container').innerHTML = `
        <div class="alert alert-danger">
            <i class="fas fa-exclamation-circle mr-1"></i> 히트맵 데이터를 불러오는 중 오류가 발생했습니다.
        </div>
        `;
    }
}

// 공정능력지수 히트맵 렌더링
function renderCpkHeatmap() {
    if (!cpkHeatmapData || cpkHeatmapData.length === 0) {
        document.getElementById('cpk-heatmap-container').innerHTML = `
        <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle mr-1"></i> 분석할 데이터가 없습니다.
        </div>
        `;
        return;
    }
    
    // IC별 분류
    const groupedByIC = {};
    cpkHeatmapData.forEach(item => {
        if (!groupedByIC[item.productGroup]) {
            groupedByIC[item.productGroup] = {};
        }
        
        if (!groupedByIC[item.productGroup][item.process]) {
            groupedByIC[item.productGroup][item.process] = [];
        }
        
        groupedByIC[item.productGroup][item.process].push(item);
    });
    
    // IC별 총 타겟 수 계산
    const icTargetCounts = {};
    Object.keys(groupedByIC).forEach(ic => {
        let targetCount = 0;
        Object.keys(groupedByIC[ic]).forEach(process => {
            targetCount += groupedByIC[ic][process].length;
        });
        icTargetCounts[ic] = targetCount;
    });
    
    // 타겟 수에 따라 IC를 분류 (적은 것과 많은 것)
    const smallICs = [];
    const largeICs = [];
    
    // 타겟 수가 적은 IC 분류 (예: DIODE, RF)
    Object.keys(icTargetCounts).forEach(ic => {
        if (ic === 'DIODE' || ic === 'RF' || icTargetCounts[ic] <= 3) {
            smallICs.push(ic);
        } else {
            largeICs.push(ic);
        }
    });
    
    // DocumentFragment 생성 (메모리에서만 존재하는 DOM 조각)
    const fragment = document.createDocumentFragment();
    
    // 최상위 row 생성
    const rowDiv = document.createElement('div');
    rowDiv.className = 'row';
    fragment.appendChild(rowDiv);
    
    // 왼쪽 영역 (타겟 수가 많은 IC)
    const leftCol = document.createElement('div');
    leftCol.className = 'col-md-9';
    rowDiv.appendChild(leftCol);
    
    const leftRowDiv = document.createElement('div');
    leftRowDiv.className = 'row';
    leftCol.appendChild(leftRowDiv);
    
    // 타겟 수가 많은 IC들의 카드 생성
    largeICs.forEach(ic => {
        const colDiv = document.createElement('div');
        colDiv.className = 'col-md-6 mb-2';
        
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card card-outline card-primary h-100';
        colDiv.appendChild(cardDiv);
        
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header py-1';
        cardDiv.appendChild(cardHeader);
        
        const cardTitle = document.createElement('h3');
        cardTitle.className = 'card-title font-weight-bold';
        cardTitle.textContent = ic;
        cardHeader.appendChild(cardTitle);
        
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body p-0';
        cardDiv.appendChild(cardBody);
        
        const treemapContainer = document.createElement('div');
        treemapContainer.className = 'treemap-container';
        cardBody.appendChild(treemapContainer);
        
        // 각 공정별 블록 생성
        Object.keys(groupedByIC[ic]).forEach(process => {
            const targets = groupedByIC[ic][process];
            
            const processBlock = document.createElement('div');
            processBlock.className = 'process-block';
            treemapContainer.appendChild(processBlock);
            
            const processHeader = document.createElement('div');
            processHeader.className = 'process-header';
            processBlock.appendChild(processHeader);
            
            const processName = document.createElement('span');
            processName.className = 'font-weight-bold';
            processName.textContent = process;
            processHeader.appendChild(processName);
            
            const targetContainer = document.createElement('div');
            targetContainer.className = 'target-container';
            processBlock.appendChild(targetContainer);
            
            // 각 타겟별 블록 생성
            targets.forEach(item => {
                // Cpk 상태에 따른 색상 결정
                let bgColor = '';
                let textColor = '';
                let status = '';
                
                if (item.cpk === null) {
                    bgColor = '#e9ecef'; // 회색
                    textColor = '#6c757d'; // 회색 텍스트
                    status = '데이터 없음';
                } else if (item.cpk >= 1.33) {
                    bgColor = '#d4edda'; // 녹색
                    textColor = '#155724'; // 진한 녹색 텍스트
                    status = '우수';
                } else if (item.cpk >= 1.00) {
                    bgColor = '#d1ecf1'; // 파란색
                    textColor = '#0c5460'; // 진한 파란색 텍스트
                    status = '적합';
                } else if (item.cpk >= 0.67) {
                    bgColor = '#fff3cd'; // 노란색
                    textColor = '#856404'; // 진한 노란색 텍스트
                    status = '부적합';
                } else {
                    bgColor = '#f8d7da'; // 빨간색
                    textColor = '#721c24'; // 진한 빨간색 텍스트
                    status = '매우 부적합';
                }
                
                const targetBlock = document.createElement('div');
                targetBlock.className = 'target-block';
                targetBlock.style.backgroundColor = bgColor;
                targetBlock.style.cursor = 'pointer';
                targetBlock.addEventListener('click', function() {
                    openSpcAnalysisTab(item.targetId, item.productGroup, item.process, item.target, currentPeriodDays);
                });
                targetContainer.appendChild(targetBlock);
                
                const targetValue = document.createElement('div');
                targetValue.className = 'target-value';
                targetValue.style.color = textColor;
                targetValue.textContent = item.target;
                targetBlock.appendChild(targetValue);
                
                const cpkValue = document.createElement('div');
                cpkValue.className = 'cpk-value';
                cpkValue.style.color = textColor;
                cpkValue.textContent = item.cpk !== null ? item.cpk.toFixed(3) : '-';
                targetBlock.appendChild(cpkValue);
                
                const statusBadge = document.createElement('div');
                statusBadge.className = 'status-badge';
                statusBadge.style.color = textColor;

                const countText = (item.sampleCount !== null && item.sampleCount !== undefined)
                    ? `(${item.sampleCount})`
                    : '';
                statusBadge.textContent = `${status}${countText}`;
                targetBlock.appendChild(statusBadge);

                /*statusBadge.textContent = status;
                targetBlock.appendChild(statusBadge);*/
            });
        });
        
        leftRowDiv.appendChild(colDiv);
    });
    
    // 오른쪽 영역 (타겟 수가 적은 IC)
    const rightCol = document.createElement('div');
    rightCol.className = 'col-md-3';
    rowDiv.appendChild(rightCol);
    
    // 타겟 수가 적은 IC들의 카드 생성 (세로로 배치)
    smallICs.forEach(ic => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card card-outline card-secondary mb-2';
        rightCol.appendChild(cardDiv);
        
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header py-1 bg-light';
        cardDiv.appendChild(cardHeader);
        
        const cardTitle = document.createElement('h3');
        cardTitle.className = 'card-title font-weight-bold';
        cardTitle.textContent = ic;
        cardHeader.appendChild(cardTitle);
        
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body p-0';
        cardDiv.appendChild(cardBody);
        
        const treemapContainer = document.createElement('div');
        treemapContainer.className = 'small-treemap-container';
        cardBody.appendChild(treemapContainer);
        
        // 각 공정별 블록 생성 (작은 영역)
        Object.keys(groupedByIC[ic]).forEach(process => {
            const targets = groupedByIC[ic][process];
            
            const processBlock = document.createElement('div');
            processBlock.className = 'small-process-block';
            treemapContainer.appendChild(processBlock);
            
            const processHeader = document.createElement('div');
            processHeader.className = 'small-process-header';
            processBlock.appendChild(processHeader);
            
            const processName = document.createElement('span');
            processName.className = 'font-weight-bold';
            processName.textContent = process;
            processHeader.appendChild(processName);
            
            const targetContainer = document.createElement('div');
            targetContainer.className = 'small-target-container';
            processBlock.appendChild(targetContainer);
            
            /* 각 타겟별 블록 생성 (작은 영역)
            targets.forEach(item => {
                // Cpk 상태에 따른 색상 결정
                let bgColor = '';
                let textColor = '';
                
                if (item.cpk === null) {
                    bgColor = '#e9ecef'; // 회색
                    textColor = '#6c757d'; // 회색 텍스트
                } else if (item.cpk >= 1.33) {
                    bgColor = '#d4edda'; // 녹색
                    textColor = '#155724'; // 진한 녹색 텍스트
                } else if (item.cpk >= 1.00) {
                    bgColor = '#d1ecf1'; // 파란색
                    textColor = '#0c5460'; // 진한 파란색 텍스트
                } else if (item.cpk >= 0.67) {
                    bgColor = '#fff3cd'; // 노란색
                    textColor = '#856404'; // 진한 노란색 텍스트
                } else {
                    bgColor = '#f8d7da'; // 빨간색
                    textColor = '#721c24'; // 진한 빨간색 텍스트
                }
                
                const targetBlock = document.createElement('div');
                targetBlock.className = 'small-target-block';
                targetBlock.style.backgroundColor = bgColor;
                targetBlock.style.cursor = 'pointer'; // 커서를 포인터로 변경
                targetBlock.dataset.targetId = item.targetId; // 데이터 속성으로 타겟 ID 저장
                targetBlock.addEventListener('click', function() {
                    navigateToSpcPage(item.targetId, item.productGroup, item.process, item.target);
                });
                targetContainer.appendChild(targetBlock);
                
                const targetValue = document.createElement('div');
                targetValue.className = 'small-target-value';
                targetValue.style.color = textColor;
                targetValue.textContent = item.target;
                targetBlock.appendChild(targetValue);
                
                const cpkValue = document.createElement('div');
                cpkValue.className = 'small-cpk-value';
                cpkValue.style.color = textColor;
                cpkValue.textContent = item.cpk !== null ? item.cpk.toFixed(3) : '-';
                targetBlock.appendChild(cpkValue);
            });*/

            // 각 타겟별 블록 생성 (작은 영역)
            targets.forEach(item => {
                let bgColor = '';
                let textColor = '';
                let status = '';

                if (item.cpk === null) {
                    bgColor = '#e9ecef';
                    textColor = '#6c757d';
                    status = '데이터 없음';
                } else if (item.cpk >= 1.33) {
                    bgColor = '#d4edda';
                    textColor = '#155724';
                    status = '우수';
                } else if (item.cpk >= 1.00) {
                    bgColor = '#d1ecf1';
                    textColor = '#0c5460';
                    status = '적합';
                } else if (item.cpk >= 0.67) {
                    bgColor = '#fff3cd';
                    textColor = '#856404';
                    status = '부적합';
                } else {
                    bgColor = '#f8d7da';
                    textColor = '#721c24';
                    status = '매우 부적합';
                }

                const targetBlock = document.createElement('div');
                targetBlock.className = 'small-target-block';
                targetBlock.style.backgroundColor = bgColor;
                targetBlock.style.cursor = 'pointer';
                targetBlock.addEventListener('click', function() {
                    openSpcAnalysisTab(item.targetId, item.productGroup, item.process, item.target, currentPeriodDays);
                });
                targetContainer.appendChild(targetBlock);

                const targetValue = document.createElement('div');
                targetValue.className = 'small-target-value';
                targetValue.style.color = textColor;
                targetValue.textContent = item.target;
                targetBlock.appendChild(targetValue);

                const cpkValue = document.createElement('div');
                cpkValue.className = 'small-cpk-value';
                cpkValue.style.color = textColor;
                cpkValue.textContent = item.cpk !== null ? item.cpk.toFixed(3) : '-';
                targetBlock.appendChild(cpkValue);

                const statusBadge = document.createElement('div');
                statusBadge.className = 'status-badge';
                statusBadge.style.color = textColor;
                const countText = (item.sampleCount !== null && item.sampleCount !== undefined)
                    ? `(${item.sampleCount})`
                    : '';
                statusBadge.textContent = `${status}${countText}`;
                targetBlock.appendChild(statusBadge);
            });

        });
    });
    
    // 기존 내용 지우고 새로운 내용 추가
    const container = document.getElementById('cpk-heatmap-container');
    container.innerHTML = '';
    container.appendChild(fragment);
}

// 모니터링 타겟 초기화
async function initMonitoringTargets() {
    // 로컬 스토리지에서 저장된 타겟 가져오기
    const savedTargets = localStorage.getItem('monitoring_targets');
    
    if (savedTargets) {
        monitoringTargets = JSON.parse(savedTargets);
        
        // 유효한 타겟이 있으면 차트 로드
        if (monitoringTargets.length > 0) {
            loadMonitoringCharts();
        }
    }
    
    // 제품군 옵션 로드 (설정 모달용)
    await loadProductGroupOptions();
}

// 제품군 옵션 로드 (설정 모달용)
async function loadProductGroupOptions() {
    try {
        const productGroups = await api.getProductGroups();
        
        if (productGroups && productGroups.length > 0) {
            // 각 타겟 선택기에 대해 제품군 옵션 설정
            for (let i = 1; i <= 6; i++) {
                let options = '<option value="">제품군 선택</option>';
                productGroups.forEach(productGroup => {
                    options += `<option value="${productGroup.id}">${productGroup.name}</option>`;
                });
                document.getElementById(`target${i}-product-group`).innerHTML = options;
            }
        }
    } catch (error) {
        console.error('제품군 옵션 로드 실패:', error);
    }
}

// 공정 옵션 로드 (설정 모달용)
async function loadProcessOptions(targetNum, productGroupId) {
    try {
        const processSelect = document.getElementById(`target${targetNum}-process`);
        const targetSelect = document.getElementById(`target${targetNum}-target`);
        
        // 초기화
        processSelect.innerHTML = '<option value="">로딩 중...</option>';
        processSelect.disabled = true;
        targetSelect.innerHTML = '<option value="">타겟 선택</option>';
        targetSelect.disabled = true;
        
        if (!productGroupId) {
            processSelect.innerHTML = '<option value="">공정 선택</option>';
            return;
        }
        
        const processes = await api.getProcesses(productGroupId);
        
        if (processes && processes.length > 0) {
            let options = '<option value="">공정 선택</option>';
            processes.forEach(process => {
                options += `<option value="${process.id}">${process.name}</option>`;
            });
            processSelect.innerHTML = options;
            processSelect.disabled = false;
        } else {
            processSelect.innerHTML = '<option value="">공정 없음</option>';
        }
    } catch (error) {
        console.error(`타겟 ${targetNum} 공정 옵션 로드 실패:`, error);
        document.getElementById(`target${targetNum}-process`).innerHTML = '<option value="">오류 발생</option>';
    }
}

// 타겟 옵션 로드 (설정 모달용)
async function loadTargetOptions(targetNum, processId) {
    try {
        const targetSelect = document.getElementById(`target${targetNum}-target`);
        
        // 초기화
        targetSelect.innerHTML = '<option value="">로딩 중...</option>';
        targetSelect.disabled = true;
        
        if (!processId) {
            targetSelect.innerHTML = '<option value="">타겟 선택</option>';
            return;
        }
        
        const targets = await api.getTargets(processId);
        
        if (targets && targets.length > 0) {
            let options = '<option value="">타겟 선택</option>';
            targets.forEach(target => {
                options += `<option value="${target.id}">${target.name}</option>`;
            });
            targetSelect.innerHTML = options;
            targetSelect.disabled = false;
        } else {
            targetSelect.innerHTML = '<option value="">타겟 없음</option>';
        }
    } catch (error) {
        console.error(`타겟 ${targetNum} 타겟 옵션 로드 실패:`, error);
        document.getElementById(`target${targetNum}-target`).innerHTML = '<option value="">오류 발생</option>';
    }
}

// 타겟 설정 모달 열기
async function openTargetConfigModal() {
    // 현재 설정된 타겟 정보로 모달 필드 설정
    try {
        // 저장된 타겟 정보 로드
        for (let i = 0; i < monitoringTargets.length; i++) {
            const targetConfig = monitoringTargets[i];
            if (targetConfig) {
                const targetNum = i + 1;
                
                // 제품군 선택
                document.getElementById(`target${targetNum}-product-group`).value = targetConfig.productGroupId || '';
                
                // 공정 옵션 로드 후 선택
                if (targetConfig.productGroupId) {
                    await loadProcessOptions(targetNum, targetConfig.productGroupId);
                    document.getElementById(`target${targetNum}-process`).value = targetConfig.processId || '';
                }
                
                // 타겟 옵션 로드 후 선택
                if (targetConfig.processId) {
                    await loadTargetOptions(targetNum, targetConfig.processId);
                    document.getElementById(`target${targetNum}-target`).value = targetConfig.targetId || '';
                }
            }
        }
    } catch (error) {
        console.error('타겟 설정 모달 초기화 실패:', error);
    }
    
    // 모달 표시
    $('#target-config-modal').modal('show');
}

// 모니터링 타겟 저장
async function saveMonitoringTargets() {
    // 현재 선택된 타겟 정보 수집
    const newTargets = [];
    
    for (let i = 1; i <= 6; i++) {
        const productGroupId = document.getElementById(`target${i}-product-group`).value;
        const processId = document.getElementById(`target${i}-process`).value;
        const targetId = document.getElementById(`target${i}-target`).value;
        
        // 모든 필드가 채워진 경우에만 유효한 타겟으로 간주
        if (productGroupId && processId && targetId) {
            // 제품군, 공정, 타겟 이름 가져오기
            const productGroup = await api.get(`${API_CONFIG.ENDPOINTS.PRODUCT_GROUPS}/${productGroupId}`);
            const process = await api.get(`${API_CONFIG.ENDPOINTS.PROCESSES}/${processId}`);
            const target = await api.get(`${API_CONFIG.ENDPOINTS.TARGETS}/${targetId}`);
            
            newTargets.push({
                productGroupId,
                processId,
                targetId,
                productGroupName: productGroup.name,
                processName: process.name,
                targetName: target.name
            });
        }
    }
    
    // 새 타겟 정보 저장
    monitoringTargets = newTargets;
    localStorage.setItem('monitoring_targets', JSON.stringify(monitoringTargets));
    
    // 모달 닫기
    $('#target-config-modal').modal('hide');
    
    // 모니터링 차트 로드
    loadMonitoringCharts();
}

// 모니터링 차트 로드
async function loadMonitoringCharts() {
    try {
        // 모니터링 타겟이 없는 경우 안내 메시지 표시
        if (!monitoringTargets || monitoringTargets.length === 0) {
            document.getElementById('monitoring-charts-container').innerHTML = `
            <div class="col-md-12 text-center py-3">
                <p class="text-muted">모니터링할 타겟이 설정되지 않았습니다. 우측 상단의 '설정' 버튼을 클릭하여 타겟을 설정하세요.</p>
            </div>
            `;
            return;
        }
        
        // 로딩 표시
        document.getElementById('monitoring-charts-container').innerHTML = `
        <div class="col-md-12 text-center py-3">
            <div class="spinner-border text-primary" role="status">
                <span class="sr-only">로딩 중...</span>
            </div>
            <p class="mt-2">모니터링 차트 로드 중...</p>
        </div>
        `;
        
        // 기존 차트 파괴
        for (const chart of monitoringCharts) {
            if (chart) {
                chart.destroy();
            }
        }
        monitoringCharts = [];
        
        // 차트 컨테이너 HTML 준비
        let chartsHtml = '';
        
        // 각 타겟별로 차트 컨테이너 생성 (3x2 레이아웃)
        for (let i = 0; i < monitoringTargets.length; i++) {
            const target = monitoringTargets[i];
            
            // 3x2 레이아웃: 항상 4열 (col-md-4) 사용
            chartsHtml += `
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">${target.productGroupName} - ${target.processName} - ${target.targetName}</h3>
                    </div>
                    <div class="card-body">
                        <canvas id="monitoring-chart-${i}"></canvas>
                    </div>
                </div>
            </div>
            `;
        }
        
        // 차트 컨테이너 업데이트
        document.getElementById('monitoring-charts-container').innerHTML = chartsHtml;
        
        // 각 타겟별로 차트 생성
        for (let i = 0; i < monitoringTargets.length; i++) {
            await createMonitoringChart(i);
        }
        
    } catch (error) {
        console.error('모니터링 차트 로드 실패:', error);
        document.getElementById('monitoring-charts-container').innerHTML = `
        <div class="col-md-12 text-center py-3">
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle mr-1"></i> 모니터링 차트를 불러오는 중 오류가 발생했습니다.
            </div>
        </div>
        `;
    }
}

// 모니터링 차트 생성
async function createMonitoringChart(index) {
    const target = monitoringTargets[index];
    
    try {
        // SPC 분석 데이터 가져오기 (최근 30일)
        const spcResult = await api.analyzeSpc(target.targetId, 30);
        
        // 차트 데이터 준비
        const labels = spcResult.data.dates.map(date => date.split('T')[0]);
        const values = spcResult.data.values;
        
        // 최근 1주일 데이터 식별 (마지막 7개 데이터 포인트)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        // 포인트 스타일 배열 생성 (최근 1주일은 특별한 스타일)
        const pointRadius = [];
        const pointBackgroundColor = [];
        const pointBorderColor = [];
        
        labels.forEach((label, i) => {
            const dataDate = new Date(label);
            if (dataDate >= oneWeekAgo) {
                // 최근 1주일 데이터: 큰 포인트, 빨간색
                pointRadius.push(4);
                pointBackgroundColor.push('rgba(220, 53, 69, 0.8)');
                pointBorderColor.push('#dc3545');
            } else {
                // 이전 데이터: 작은 포인트, 기본 색상
                pointRadius.push(3);
                pointBackgroundColor.push('rgba(60, 141, 188, 0.8)');
                pointBorderColor.push('#3c8dbc');
            }
        });
        
        // 관리 한계 가져오기
        const cl = spcResult.control_limits.cl;
        const ucl = spcResult.control_limits.ucl;
        const lcl = spcResult.control_limits.lcl;
        
        // SPEC 가져오기
        let usl, lsl;
        if (spcResult.spec) {
            usl = spcResult.spec.usl;
            lsl = spcResult.spec.lsl;
        }
        
        // 데이터셋 준비
        const datasets = [
            {
                label: 'DICD 값',
                data: values,
                borderColor: '#3c8dbc',
                backgroundColor: 'rgba(60, 141, 188, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: false,
                pointRadius: pointRadius,
                pointBackgroundColor: pointBackgroundColor,
                pointBorderColor: pointBorderColor,
                pointBorderWidth: 2
            },
            {
                label: 'CL',
                data: Array(labels.length).fill(cl),
                borderColor: '#28a745',
                borderDash: [5, 5],
                borderWidth: 1,
                pointRadius: 0,
                fill: false
            },
            {
                label: 'UCL',
                data: Array(labels.length).fill(ucl),
                borderColor: '#dc3545',
                borderDash: [5, 5],
                borderWidth: 1,
                pointRadius: 0,
                fill: false
            },
            {
                label: 'LCL',
                data: Array(labels.length).fill(lcl),
                borderColor: '#dc3545',
                borderDash: [5, 5],
                borderWidth: 1,
                pointRadius: 0,
                fill: false
            }
        ];
        
        // SPEC 추가
        if (usl && lsl) {
            datasets.push(
                {
                    label: 'USL',
                    data: Array(labels.length).fill(usl),
                    borderColor: '#3366ff',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'LSL',
                    data: Array(labels.length).fill(lsl),
                    borderColor: '#3366ff',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                }
            );
        }
        
        // 차트 생성
        const ctx = document.getElementById(`monitoring-chart-${index}`).getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 10,
                            font: {
                                size: 10
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 5
                        }
                    },
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
        
        // 차트 저장
        monitoringCharts[index] = chart;
        
    } catch (error) {
        console.error(`타겟 ${target.targetId} 모니터링 차트 생성 실패:`, error);
        document.getElementById(`monitoring-chart-${index}`).parentNode.innerHTML = `
        <div class="alert alert-danger">
            <i class="fas fa-exclamation-circle mr-1"></i> 차트 데이터를 불러오는 중 오류가 발생했습니다.
        </div>
        `;
    }
}

// SPC 분석 탭 열기 함수
function openSpcAnalysisTab(targetId, productGroup, process, targetName, periodDays) {
    // TabManager를 사용하여 SPC 분석 탭 열기
    if (window.TabManager) {
        // 설정 정보를 TabManager에 전달
        const settings = {
            targetId: targetId,
            productGroup: productGroup,
            process: process,
            targetName: targetName,
            periodDays: periodDays
        };

        // SPC 탭 열기
        window.TabManager.openTab('spc', settings);
    } else {
        console.warn('TabManager가 없습니다. 탭 시스템이 활성화되지 않았습니다.');
    }
}

// 유틸리티 객체 - 날짜 포맷, 상태 표시 등에 사용
const DASHBOARD_UTILS = {
    // 날짜 포맷 함수
    formatDate: function(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    },

    // 숫자 포맷 함수
    formatNumber: function(value) {
        return value.toFixed(3);
    },

    // 오류 메시지 표시
    showError: function(message) {
        return `<div class="alert alert-danger"><i class="fas fa-exclamation-circle mr-1"></i> ${message}</div>`;
    }
};


// 페이지 로드 시 대시보드 초기화
document.addEventListener('DOMContentLoaded', initDashboard);