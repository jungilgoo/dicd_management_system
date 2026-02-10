// 상세 보고서 페이지 모듈
(function() {
    'use strict';

    // Chart.js annotation 플러그인 등록
    try {
        if (typeof Chart !== 'undefined' && typeof window.chartjsPluginAnnotation !== 'undefined') {
            Chart.register(window.chartjsPluginAnnotation);
        }
    } catch (error) {
        console.error('[DetailReport] Annotation 플러그인 등록 실패:', error);
    }

    // 우측 라벨 커스텀 플러그인: annotation 라벨 대신 차트 우측에 직접 텍스트 렌더링
    try {
        if (typeof Chart !== 'undefined') {
            Chart.register({
                id: 'rightLabels',
                afterDraw(chart) {
                    const labels = chart.options.plugins.rightLabels?.labels;
                    if (!labels || !labels.length) return;
                    const { ctx, chartArea, scales: { y } } = chart;
                    if (!y) return;

                    // 픽셀 위치 계산 및 차트 영역 내 필터링
                    const positioned = labels
                        .filter(l => l.value != null)
                        .map(l => ({ ...l, yPx: y.getPixelForValue(l.value) }))
                        .filter(l => l.yPx >= chartArea.top - 10 && l.yPx <= chartArea.bottom + 10)
                        .sort((a, b) => a.yPx - b.yPx);

                    // 겹침 방지: 최소 14px 간격 보장
                    for (let i = 1; i < positioned.length; i++) {
                        if (positioned[i].yPx - positioned[i - 1].yPx < 14) {
                            const overlap = 14 - (positioned[i].yPx - positioned[i - 1].yPx);
                            positioned[i - 1].yPx -= Math.ceil(overlap / 2);
                            positioned[i].yPx += Math.ceil(overlap / 2);
                        }
                    }

                    ctx.save();
                    positioned.forEach(lbl => {
                        ctx.fillStyle = lbl.color || '#666';
                        ctx.font = 'bold ' + (lbl.fontSize || 11) + 'px sans-serif';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(lbl.text, chartArea.right + 8, lbl.yPx);
                    });
                    ctx.restore();
                }
            });
        }
    } catch (error) {
        console.error('[DetailReport] RightLabels 플러그인 등록 실패:', error);
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

    // 마지막 구간의 SPEC 값 가져오기 (우측 라벨용)
    function getLastSegmentValue(specSegments, field) {
        if (!specSegments || specSegments.length === 0) return null;
        for (let i = specSegments.length - 1; i >= 0; i--) {
            if (specSegments[i][field] != null) return specSegments[i][field];
        }
        return null;
    }

    // 상태 변수
    let selectedProductGroupId = null;
    let selectedProcessId = null;
    let selectedTargetId = null;
    let currentData = {};

    // 차트 인스턴스
    let trendChart = null;
    let xbarChart = null;
    let rChart = null;
    let distributionChart = null;

    // API 인스턴스
    let api = null;

    // =============================================
    // 초기화
    // =============================================
    async function initDetailReport() {
        api = new API(API_CONFIG);

        utils.initDateControls({
            periodSelector: '#analysis-period',
            containerSelector: '#custom-date-range',
            startDateSelector: '#start-date',
            endDateSelector: '#end-date'
        });

        await loadProductGroups();
        setupEventListeners();
    }

    // =============================================
    // 캐스케이드 셀렉터
    // =============================================
    async function loadProductGroups() {
        try {
            const productGroups = await api.getProductGroups();
            const select = document.getElementById('product-group');
            if (!productGroups || productGroups.length === 0) {
                select.innerHTML = '<option value="">제품군 정보가 없습니다.</option>';
                return;
            }
            let options = '<option value="">제품군 선택</option>';
            productGroups.forEach(pg => {
                options += `<option value="${pg.id}">${pg.name}</option>`;
            });
            select.innerHTML = options;
        } catch (error) {
            console.error('제품군 로드 실패:', error);
        }
    }

    async function loadProcesses(productGroupId) {
        const select = document.getElementById('process');
        const targetSelect = document.getElementById('target');
        try {
            select.innerHTML = '<option value="">로딩 중...</option>';
            select.disabled = true;
            targetSelect.innerHTML = '<option value="">타겟 선택</option>';
            targetSelect.disabled = true;

            const processes = await api.getProcesses(productGroupId);
            if (processes && processes.length > 0) {
                let options = '<option value="">공정 선택</option>';
                processes.forEach(p => {
                    options += `<option value="${p.id}">${p.name}</option>`;
                });
                select.innerHTML = options;
                select.disabled = false;
            } else {
                select.innerHTML = '<option value="">공정 없음</option>';
            }
        } catch (error) {
            console.error('공정 로드 실패:', error);
            select.innerHTML = '<option value="">공정 로드 실패</option>';
        }
    }

    async function loadTargets(processId) {
        const select = document.getElementById('target');
        try {
            select.innerHTML = '<option value="">로딩 중...</option>';
            select.disabled = true;

            const targets = await api.getTargets(processId, window.PROCESS_TYPE);
            if (targets && targets.length > 0) {
                let options = '<option value="">타겟 선택</option>';
                targets.forEach(t => {
                    options += `<option value="${t.id}">${t.name}</option>`;
                });
                select.innerHTML = options;
                select.disabled = false;
            } else {
                select.innerHTML = '<option value="">타겟 없음</option>';
            }
        } catch (error) {
            console.error('타겟 로드 실패:', error);
            select.innerHTML = '<option value="">타겟 로드 실패</option>';
        }
    }

    // =============================================
    // 이벤트 리스너
    // =============================================
    function setupEventListeners() {
        document.getElementById('product-group').addEventListener('change', function() {
            selectedProductGroupId = this.value;
            selectedProcessId = null;
            selectedTargetId = null;
            document.getElementById('analyze-btn').disabled = true;
            if (this.value) {
                loadProcesses(this.value);
            } else {
                document.getElementById('process').innerHTML = '<option value="">공정 선택</option>';
                document.getElementById('process').disabled = true;
                document.getElementById('target').innerHTML = '<option value="">타겟 선택</option>';
                document.getElementById('target').disabled = true;
            }
        });

        document.getElementById('process').addEventListener('change', function() {
            selectedProcessId = this.value;
            selectedTargetId = null;
            document.getElementById('analyze-btn').disabled = true;
            if (this.value) {
                loadTargets(this.value);
            } else {
                document.getElementById('target').innerHTML = '<option value="">타겟 선택</option>';
                document.getElementById('target').disabled = true;
            }
        });

        document.getElementById('target').addEventListener('change', function() {
            selectedTargetId = this.value;
            document.getElementById('analyze-btn').disabled = !this.value;
        });

        document.getElementById('analyze-btn').addEventListener('click', runDetailAnalysis);
        document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);
    }

    // =============================================
    // 날짜 파라미터 생성
    // =============================================
    function getDateParams() {
        const periodType = document.getElementById('analysis-period').value;
        if (periodType === 'custom') {
            return {
                start_date: document.getElementById('start-date').value,
                end_date: document.getElementById('end-date').value
            };
        }
        return { days: parseInt(periodType) || 30 };
    }

    function getPeriodText() {
        const periodType = document.getElementById('analysis-period').value;
        if (periodType === 'custom') {
            const s = document.getElementById('start-date').value;
            const e = document.getElementById('end-date').value;
            return `${s} ~ ${e}`;
        }
        const map = { '7': '최근 7일', '14': '최근 14일', '30': '최근 30일', '60': '최근 60일', '90': '최근 90일' };
        return map[periodType] || '최근 30일';
    }

    // =============================================
    // 메인 분석 실행
    // =============================================
    async function runDetailAnalysis() {
        if (!selectedTargetId) {
            alert('타겟을 선택하세요.');
            return;
        }

        // UI 상태 전환
        document.getElementById('empty-message').style.display = 'none';
        document.getElementById('loading-indicator').style.display = 'block';
        document.getElementById('report-content').style.display = 'none';

        const dateParams = getDateParams();
        const processType = window.PROCESS_TYPE || 'PHOTO';

        try {
            // 4개 API 병렬 호출
            const [statsResult, spcResult, distResult, measureResult] = await Promise.allSettled([
                api.getTargetStatistics(selectedTargetId, dateParams),
                api.analyzeSpc(selectedTargetId, dateParams),
                api.analyzeDistribution(selectedTargetId, dateParams),
                api.getMeasurements({
                    target_id: selectedTargetId,
                    limit: 500,
                    process_type: processType,
                    ...dateParams
                })
            ]);

            currentData = {
                stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
                spc: spcResult.status === 'fulfilled' ? spcResult.value : null,
                dist: distResult.status === 'fulfilled' ? distResult.value : null,
                measurements: measureResult.status === 'fulfilled' ? measureResult.value : []
            };

            // 각 섹션 렌더링
            renderReportHeader();
            renderSummaryCards();
            renderTrendChart();
            renderSpcCharts();
            renderDistributionSection();
            renderPositionAnalysis();
            renderComprehensiveStats();
            renderMeasurementTable();

            // UI 표시
            document.getElementById('loading-indicator').style.display = 'none';
            document.getElementById('report-content').style.display = 'block';
            document.getElementById('export-pdf-btn').style.display = 'inline-block';

        } catch (error) {
            console.error('분석 실행 실패:', error);
            document.getElementById('loading-indicator').style.display = 'none';
            document.getElementById('empty-message').style.display = 'block';
            document.getElementById('empty-message').innerHTML = `
                <i class="fas fa-exclamation-circle fa-3x mb-3 text-danger"></i>
                <h5>분석 실행 중 오류가 발생했습니다</h5>
                <p class="text-muted">${error.message}</p>
            `;
        }
    }

    // =============================================
    // 섹션 2: 보고서 헤더
    // =============================================
    function renderReportHeader() {
        const pgName = document.getElementById('product-group').selectedOptions[0]?.text || '';
        const procName = document.getElementById('process').selectedOptions[0]?.text || '';
        const targetName = document.getElementById('target').selectedOptions[0]?.text || '';
        const cdType = window.PROCESS_TYPE === 'ETCH' ? 'FICD' : 'DICD';

        document.getElementById('report-title').textContent = `${pgName} - ${procName} - ${targetName} ${cdType} 상세 보고서`;
        document.getElementById('report-period').textContent = `분석 기간: ${getPeriodText()}`;
        document.getElementById('report-generated').textContent = `생성일시: ${new Date().toLocaleString('ko-KR')}`;
    }

    // =============================================
    // 섹션 3: 요약 대시보드 카드
    // =============================================
    function renderSummaryCards() {
        const stats = currentData.stats;
        const measurements = currentData.measurements;

        if (!stats) {
            setCardValues('-', '-', '-', '-', '-', '-', '-', '-', 0);
            return;
        }

        const cap = stats.process_capability || {};
        const overall = stats.overall_statistics || {};
        const spec = stats.spec || {};

        // Cp/Cpk
        const cp = cap.cp != null ? cap.cp : null;
        const cpk = cap.cpk != null ? cap.cpk : null;
        document.getElementById('val-cp').textContent = cp != null ? cp.toFixed(3) : '-';
        document.getElementById('val-cpk').textContent = cpk != null ? cpk.toFixed(3) : '-';
        setCpColor('val-cp', cp);
        setCpColor('val-cpk', cpk);
        setCardBorder('card-cp', cpk != null ? cpk : cp);

        // Pp/Ppk
        const pp = cap.pp != null ? cap.pp : null;
        const ppk = cap.ppk != null ? cap.ppk : null;
        document.getElementById('val-pp').textContent = pp != null ? pp.toFixed(3) : '-';
        document.getElementById('val-ppk').textContent = ppk != null ? ppk.toFixed(3) : '-';
        setCpColor('val-pp', pp);
        setCpColor('val-ppk', ppk);
        setCardBorder('card-pp', ppk != null ? ppk : pp);

        // 기본 통계
        document.getElementById('val-mean').textContent = overall.avg != null ? overall.avg.toFixed(3) : '-';
        document.getElementById('val-std').textContent = overall.std_dev != null ? overall.std_dev.toFixed(4) : '-';
        document.getElementById('val-range').textContent = overall.range != null ? overall.range.toFixed(3) : '-';

        // 품질 현황
        const count = stats.sample_count || (Array.isArray(measurements) ? measurements.length : 0);
        document.getElementById('val-count').textContent = count;

        // 규격 이내 비율 계산
        if (spec && spec.lsl != null && spec.usl != null && Array.isArray(measurements) && measurements.length > 0) {
            const inSpecCount = measurements.filter(m => m.avg_value >= spec.lsl && m.avg_value <= spec.usl).length;
            const ratio = (inSpecCount / measurements.length * 100).toFixed(1);
            document.getElementById('val-inspec').textContent = `${ratio}%`;
        } else {
            document.getElementById('val-inspec').textContent = '-';
        }
    }

    function getCpColorClass(value) {
        if (value == null) return '';
        if (value >= 1.33) return 'cp-excellent';
        if (value >= 1.00) return 'cp-good';
        if (value >= 0.67) return 'cp-marginal';
        return 'cp-poor';
    }

    function setCpColor(elementId, value) {
        const el = document.getElementById(elementId);
        el.className = 'stat-value ' + getCpColorClass(value);
    }

    function setCardBorder(cardId, value) {
        const card = document.getElementById(cardId);
        card.className = 'card summary-card';
        if (value == null) return;
        if (value >= 1.33) card.classList.add('border-success');
        else if (value >= 1.00) card.classList.add('border-info');
        else if (value >= 0.67) card.classList.add('border-warning');
        else card.classList.add('border-danger');
    }

    // =============================================
    // 섹션 4: 추이 차트
    // =============================================
    function renderTrendChart() {
        if (trendChart) { trendChart.destroy(); trendChart = null; }

        const measurements = currentData.measurements;
        const spec = currentData.stats?.spec || {};

        if (!Array.isArray(measurements) || measurements.length === 0) {
            document.getElementById('trend-chart').parentElement.innerHTML =
                '<div class="text-center py-5 text-muted">측정 데이터가 없습니다.</div>';
            return;
        }

        // 시간순 정렬
        const sorted = [...measurements].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const labels = sorted.map(m => {
            const d = new Date(m.created_at);
            return `${d.getMonth()+1}/${d.getDate()}`;
        });
        const avgValues = sorted.map(m => m.avg_value);

        // 규격 이탈 포인트 색상
        const pointColors = sorted.map(m => {
            if (spec.usl != null && m.avg_value > spec.usl) return CHART_COLORS.DANGER;
            if (spec.lsl != null && m.avg_value < spec.lsl) return CHART_COLORS.DANGER;
            return CHART_COLORS.PRIMARY;
        });
        const pointRadius = sorted.map(m => {
            if ((spec.usl != null && m.avg_value > spec.usl) || (spec.lsl != null && m.avg_value < spec.lsl)) return 5;
            return 3;
        });

        // SPEC 라인 (구간 분리 지원)
        const specSegments = currentData.spc?.spec_segments || currentData.stats?.spec_segments || [];
        const trendRightLabels = [];
        const specDatasets = [];

        if (specSegments.length > 0) {
            // 구간별 SPEC 배열로 dataset 추가
            const uslArr = buildSegmentedArray(specSegments, sorted.length, 'usl');
            const lslArr = buildSegmentedArray(specSegments, sorted.length, 'lsl');
            const targetArr = buildSegmentedArray(specSegments, sorted.length, 'target');

            if (uslArr.some(v => v != null)) {
                specDatasets.push({
                    label: 'USL',
                    data: uslArr,
                    borderColor: 'rgba(220,53,69,0.8)',
                    borderWidth: 2,
                    borderDash: [6, 3],
                    pointRadius: 0,
                    fill: false,
                    spanGaps: false
                });
                const lastUsl = getLastSegmentValue(specSegments, 'usl');
                if (lastUsl != null) trendRightLabels.push({ value: lastUsl, text: `USL: ${lastUsl}`, color: 'rgba(220,53,69,0.8)' });
            }
            if (lslArr.some(v => v != null)) {
                specDatasets.push({
                    label: 'LSL',
                    data: lslArr,
                    borderColor: 'rgba(220,53,69,0.8)',
                    borderWidth: 2,
                    borderDash: [6, 3],
                    pointRadius: 0,
                    fill: false,
                    spanGaps: false
                });
                const lastLsl = getLastSegmentValue(specSegments, 'lsl');
                if (lastLsl != null) trendRightLabels.push({ value: lastLsl, text: `LSL: ${lastLsl}`, color: 'rgba(220,53,69,0.8)' });
            }
            if (targetArr.some(v => v != null)) {
                specDatasets.push({
                    label: 'Target',
                    data: targetArr,
                    borderColor: 'rgba(0,123,255,0.6)',
                    borderWidth: 1,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    fill: false,
                    spanGaps: false
                });
                const lastTarget = getLastSegmentValue(specSegments, 'target');
                if (lastTarget != null) trendRightLabels.push({ value: lastTarget, text: `Target: ${lastTarget.toFixed(3)}`, color: 'rgba(0,123,255,0.6)' });
            }
        } else if (spec.usl != null || spec.lsl != null) {
            // 폴백: 기존 단일 SPEC annotation 방식
            if (spec.usl != null) {
                specDatasets.push({
                    label: 'USL', data: Array(sorted.length).fill(spec.usl),
                    borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3], pointRadius: 0, fill: false
                });
                trendRightLabels.push({ value: spec.usl, text: `USL: ${spec.usl}`, color: 'rgba(220,53,69,0.8)' });
            }
            if (spec.lsl != null) {
                specDatasets.push({
                    label: 'LSL', data: Array(sorted.length).fill(spec.lsl),
                    borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3], pointRadius: 0, fill: false
                });
                trendRightLabels.push({ value: spec.lsl, text: `LSL: ${spec.lsl}`, color: 'rgba(220,53,69,0.8)' });
            }
            if (spec.usl != null && spec.lsl != null) {
                const target = (spec.usl + spec.lsl) / 2;
                specDatasets.push({
                    label: 'Target', data: Array(sorted.length).fill(target),
                    borderColor: 'rgba(0,123,255,0.6)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false
                });
                trendRightLabels.push({ value: target, text: `Target: ${target.toFixed(3)}`, color: 'rgba(0,123,255,0.6)' });
            }
        }

        const ctx = document.getElementById('trend-chart').getContext('2d');
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '평균값',
                    data: avgValues,
                    borderColor: CHART_COLORS.PRIMARY,
                    backgroundColor: CHART_COLORS.TRANSPARENT_PRIMARY,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    pointRadius: pointRadius,
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false
                }, ...specDatasets]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 70 } },
                plugins: {
                    legend: { display: false },
                    annotation: { annotations: {} },
                    rightLabels: { labels: trendRightLabels },
                    tooltip: {
                        filter: function(tooltipItem) {
                            const label = tooltipItem.dataset.label;
                            return label === '평균값';
                        },
                        callbacks: {
                            title: function(items) {
                                const idx = items[0].dataIndex;
                                const m = sorted[idx];
                                return new Date(m.created_at).toLocaleDateString('ko-KR');
                            },
                            afterTitle: function(items) {
                                const idx = items[0].dataIndex;
                                const m = sorted[idx];
                                return `Lot: ${m.lot_no || '-'} / Wafer: ${m.wafer_no || '-'}`;
                            },
                            label: function(item) {
                                return `평균: ${item.raw.toFixed(3)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: { title: { display: true, text: '측정값' } },
                    x: { title: { display: true, text: '날짜' } }
                }
            }
        });
    }

    // =============================================
    // 섹션 5: SPC 관리도
    // =============================================
    function renderSpcCharts() {
        if (xbarChart) { xbarChart.destroy(); xbarChart = null; }
        if (rChart) { rChart.destroy(); rChart = null; }

        const spc = currentData.spc;
        if (!spc || !spc.data || !spc.data.values || spc.data.values.length === 0) {
            document.getElementById('xbar-chart').parentElement.innerHTML =
                '<div class="text-center py-3 text-muted">SPC 데이터가 없습니다.</div>';
            document.getElementById('r-chart').parentElement.innerHTML = '';
            document.getElementById('nelson-rules-container').style.display = 'none';
            return;
        }

        const spcData = spc.data; // { values: [], dates: [], lot_nos: [] }
        const cl = spc.control_limits || {};
        const spec = spc.spec || {};
        const values = spcData.values;

        // X-bar 차트 라벨 (날짜)
        const labels = (spcData.dates || []).map(d => {
            if (d) {
                const dt = new Date(d);
                return `${dt.getMonth()+1}/${dt.getDate()}`;
            }
            return '';
        });

        // X-bar: CL은 annotation 유지, UCL/LCL/USL/LSL은 구간 분리 dataset
        const xbarAnnotations = {};
        const xbarRightLabels = [];
        const xbarSpecDatasets = [];
        const spcSegments = spc.spec_segments || [];

        // CL (중심선) - 단일 annotation 유지
        if (cl.cl != null) {
            xbarAnnotations.cl = { type: 'line', yMin: cl.cl, yMax: cl.cl, borderColor: 'rgba(40,167,69,0.8)', borderWidth: 2, borderDash: [4, 4] };
            xbarRightLabels.push({ value: cl.cl, text: `CL: ${cl.cl.toFixed(3)}`, color: 'rgba(40,167,69,0.8)' });
        }

        if (spcSegments.length > 0) {
            // 구간별 UCL/LCL/USL/LSL dataset
            const uclArr = buildSegmentedArray(spcSegments, values.length, 'ucl');
            const lclArr = buildSegmentedArray(spcSegments, values.length, 'lcl');
            const uslArr = buildSegmentedArray(spcSegments, values.length, 'usl');
            const lslArr = buildSegmentedArray(spcSegments, values.length, 'lsl');

            if (uclArr.some(v => v != null)) {
                xbarSpecDatasets.push({ label: 'UCL', data: uclArr, borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3], pointRadius: 0, fill: false, spanGaps: false });
                const lastUcl = getLastSegmentValue(spcSegments, 'ucl');
                if (lastUcl != null) xbarRightLabels.push({ value: lastUcl, text: `UCL: ${lastUcl.toFixed(3)}`, color: 'rgba(220,53,69,0.8)' });
            }
            if (lclArr.some(v => v != null)) {
                xbarSpecDatasets.push({ label: 'LCL', data: lclArr, borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3], pointRadius: 0, fill: false, spanGaps: false });
                const lastLcl = getLastSegmentValue(spcSegments, 'lcl');
                if (lastLcl != null) xbarRightLabels.push({ value: lastLcl, text: `LCL: ${lastLcl.toFixed(3)}`, color: 'rgba(220,53,69,0.8)' });
            }
            if (uslArr.some(v => v != null)) {
                xbarSpecDatasets.push({ label: 'USL', data: uslArr, borderColor: 'rgba(0,123,255,0.6)', borderWidth: 1, borderDash: [3, 3], pointRadius: 0, fill: false, spanGaps: false });
                const lastUsl = getLastSegmentValue(spcSegments, 'usl');
                if (lastUsl != null) xbarRightLabels.push({ value: lastUsl, text: `USL: ${lastUsl}`, color: 'rgba(0,123,255,0.6)' });
            }
            if (lslArr.some(v => v != null)) {
                xbarSpecDatasets.push({ label: 'LSL', data: lslArr, borderColor: 'rgba(0,123,255,0.6)', borderWidth: 1, borderDash: [3, 3], pointRadius: 0, fill: false, spanGaps: false });
                const lastLsl = getLastSegmentValue(spcSegments, 'lsl');
                if (lastLsl != null) xbarRightLabels.push({ value: lastLsl, text: `LSL: ${lastLsl}`, color: 'rgba(0,123,255,0.6)' });
            }
        } else {
            // 폴백: 기존 단일 SPEC annotation
            if (cl.ucl != null || spec.ucl != null) {
                const ucl = spec.ucl != null ? spec.ucl : cl.ucl;
                xbarAnnotations.ucl = { type: 'line', yMin: ucl, yMax: ucl, borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3] };
                xbarRightLabels.push({ value: ucl, text: `UCL: ${ucl.toFixed(3)}`, color: 'rgba(220,53,69,0.8)' });
            }
            if (cl.lcl != null || spec.lcl != null) {
                const lcl = spec.lcl != null ? spec.lcl : cl.lcl;
                xbarAnnotations.lcl = { type: 'line', yMin: lcl, yMax: lcl, borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3] };
                xbarRightLabels.push({ value: lcl, text: `LCL: ${lcl.toFixed(3)}`, color: 'rgba(220,53,69,0.8)' });
            }
            if (spec.usl != null) {
                xbarAnnotations.usl = { type: 'line', yMin: spec.usl, yMax: spec.usl, borderColor: 'rgba(0,123,255,0.6)', borderWidth: 1, borderDash: [3, 3] };
                xbarRightLabels.push({ value: spec.usl, text: `USL: ${spec.usl}`, color: 'rgba(0,123,255,0.6)' });
            }
            if (spec.lsl != null) {
                xbarAnnotations.lsl = { type: 'line', yMin: spec.lsl, yMax: spec.lsl, borderColor: 'rgba(0,123,255,0.6)', borderWidth: 1, borderDash: [3, 3] };
                xbarRightLabels.push({ value: spec.lsl, text: `LSL: ${spec.lsl}`, color: 'rgba(0,123,255,0.6)' });
            }
        }

        // 위반 포인트 색상
        const violationIndices = new Set();
        if (spc.patterns) {
            spc.patterns.forEach(p => {
                if (p.position != null) violationIndices.add(p.position);
            });
        }
        const xbarPointColors = values.map((_, i) => violationIndices.has(i) ? CHART_COLORS.DANGER : CHART_COLORS.PRIMARY);
        const xbarPointRadius = values.map((_, i) => violationIndices.has(i) ? 5 : 2);

        const xbarCtx = document.getElementById('xbar-chart').getContext('2d');
        xbarChart = new Chart(xbarCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '평균값',
                    data: values,
                    borderColor: CHART_COLORS.PRIMARY,
                    pointBackgroundColor: xbarPointColors,
                    pointBorderColor: xbarPointColors,
                    pointRadius: xbarPointRadius,
                    borderWidth: 1.5,
                    tension: 0.1,
                    fill: false
                }, ...xbarSpecDatasets]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 70 } },
                plugins: {
                    legend: { display: false },
                    annotation: { annotations: xbarAnnotations },
                    rightLabels: { labels: xbarRightLabels },
                    tooltip: {
                        filter: function(tooltipItem) {
                            const label = tooltipItem.dataset.label;
                            return label === '평균값';
                        },
                        callbacks: {
                            afterTitle: function(items) {
                                const idx = items[0].dataIndex;
                                const d = data[idx];
                                return d.lot_no ? `Lot: ${d.lot_no}` : '';
                            }
                        }
                    }
                },
                scales: {
                    y: { title: { display: true, text: '평균값' } }
                }
            }
        });

        // R 차트 - measurements에서 range_value 가져오기
        const sortedMeasurements = [...(currentData.measurements || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const ranges = sortedMeasurements.map(m => m.range_value != null ? m.range_value : 0);
        const rMean = ranges.reduce((a, b) => a + b, 0) / ranges.length;
        const rUcl = rMean * 2.114; // D4 상수 (n=5)

        const rAnnotations = {};
        const rRightLabels = [];
        rAnnotations.rbar = { type: 'line', yMin: rMean, yMax: rMean, borderColor: 'rgba(40,167,69,0.8)', borderWidth: 2, borderDash: [4, 4] };
        rRightLabels.push({ value: rMean, text: `R-bar: ${rMean.toFixed(4)}`, color: 'rgba(40,167,69,0.8)' });
        rAnnotations.rucl = { type: 'line', yMin: rUcl, yMax: rUcl, borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3] };
        rRightLabels.push({ value: rUcl, text: `UCL: ${rUcl.toFixed(4)}`, color: 'rgba(220,53,69,0.8)' });

        const rCtx = document.getElementById('r-chart').getContext('2d');
        rChart = new Chart(rCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '범위(R)',
                    data: ranges,
                    borderColor: CHART_COLORS.WARNING,
                    backgroundColor: CHART_COLORS.TRANSPARENT_WARNING,
                    pointRadius: 2,
                    borderWidth: 1.5,
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 70 } },
                plugins: {
                    legend: { display: false },
                    annotation: { annotations: rAnnotations },
                    rightLabels: { labels: rRightLabels }
                },
                scales: {
                    y: { title: { display: true, text: '범위(R)' }, beginAtZero: true }
                }
            }
        });

        // Nelson Rules 위반 표시
        renderNelsonRules(spc.patterns);
    }

    function renderNelsonRules(patterns) {
        const container = document.getElementById('nelson-rules-container');
        const tbody = document.getElementById('nelson-rules-body');

        if (!patterns || patterns.length === 0) {
            container.style.display = 'none';
            return;
        }

        const ruleDescriptions = {
            1: '1개 포인트가 관리 한계선(3σ)을 벗어남',
            2: '9개 연속 포인트가 중심선의 같은 쪽에 위치',
            3: '6개 연속 포인트가 증가 또는 감소',
            4: '14개 연속 포인트가 교대로 증감',
            5: '3개 중 2개가 A구역(2σ~3σ)에 위치',
            6: '5개 중 4개가 B구역(1σ~2σ) 이상에 위치',
            7: '15개 연속 포인트가 C구역(1σ) 이내',
            8: '8개 연속 포인트가 C구역(1σ) 밖에 위치'
        };

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

        let html = '';
        patterns.forEach((p, idx) => {
            const ruleNum = p.rule || p.rule_number || '-';
            const desc = ruleDescriptions[ruleNum] || p.description || '-';
            const posInfo = p.position != null ? `포인트 ${p.position + 1}${p.lot_no ? ' (Lot: ' + p.lot_no + ')' : ''}` : '-';
            const causes = ruleCauses[ruleNum] || [];
            const causesHtml = causes.length > 0
                ? `<ul class="mb-0 mt-1" style="padding-left:18px;">${causes.map(c => `<li>${c}</li>`).join('')}</ul>`
                : '';
            html += `<tr>
                <td class="nelson-violation">
                    <a href="javascript:void(0)" class="nelson-rule-link" data-cause-target="nelson-cause-${idx}" style="color:#007bff;text-decoration:underline;cursor:pointer;font-weight:bold;">Rule ${ruleNum}</a>
                </td>
                <td>${desc}</td>
                <td>${posInfo}</td>
            </tr>
            <tr id="nelson-cause-${idx}" class="nelson-cause-row" style="display:none;">
                <td colspan="3" style="background-color:#fff3cd;border-left:3px solid #ffc107;padding:8px 12px;">
                    <strong>추정 원인:</strong>
                    ${causesHtml}
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
        container.style.display = 'block';

        // Rule 클릭 시 추정 원인 행 토글
        tbody.querySelectorAll('.nelson-rule-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('data-cause-target');
                const causeRow = document.getElementById(targetId);
                if (causeRow) {
                    causeRow.style.display = causeRow.style.display === 'none' ? '' : 'none';
                }
            });
        });
    }

    // =============================================
    // 섹션 6: 분포 분석
    // =============================================
    function renderDistributionSection() {
        if (distributionChart) { distributionChart.destroy(); distributionChart = null; }

        const dist = currentData.dist;
        if (!dist || !dist.histogram) {
            document.getElementById('distribution-chart').parentElement.innerHTML =
                '<div class="text-center py-3 text-muted">분포 데이터가 없습니다.</div>';
            return;
        }

        const histogram = dist.histogram;
        const normalPdf = dist.normal_pdf;
        const spec = dist.spec || currentData.stats?.spec || {};

        // 히스토그램 데이터
        const binCenters = histogram.bins || histogram.bin_centers || [];
        const counts = histogram.counts || [];

        const datasets = [{
            type: 'bar',
            label: '빈도',
            data: counts,
            backgroundColor: 'rgba(60,141,188,0.5)',
            borderColor: 'rgba(60,141,188,0.8)',
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            yAxisID: 'y'
        }];

        // 정규 분포 곡선 오버레이
        if (normalPdf && normalPdf.x && normalPdf.y) {
            // 정규 분포 곡선을 히스토그램 스케일에 맞게 조정
            const maxCount = Math.max(...counts);
            const maxPdf = Math.max(...normalPdf.y);
            const scale = maxPdf > 0 ? maxCount / maxPdf : 1;

            datasets.push({
                type: 'line',
                label: '정규 분포',
                data: normalPdf.x.map((x, i) => ({ x: x, y: normalPdf.y[i] * scale })),
                borderColor: 'rgba(220,53,69,0.8)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: false,
                yAxisID: 'y'
            });
        }

        // SPEC 어노테이션
        const annotations = {};
        if (spec.usl != null) {
            const uslIdx = binCenters.findIndex(b => b >= spec.usl);
            annotations.usl = { type: 'line', xMin: spec.usl, xMax: spec.usl, borderColor: 'rgba(220,53,69,0.9)', borderWidth: 2, borderDash: [6, 3], label: { display: true, content: `USL`, position: 'start', font: { size: 9 } } };
        }
        if (spec.lsl != null) {
            annotations.lsl = { type: 'line', xMin: spec.lsl, xMax: spec.lsl, borderColor: 'rgba(220,53,69,0.9)', borderWidth: 2, borderDash: [6, 3], label: { display: true, content: `LSL`, position: 'start', font: { size: 9 } } };
        }

        const ctx = document.getElementById('distribution-chart').getContext('2d');
        distributionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: binCenters.map(b => b.toFixed(2)),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top' },
                    annotation: { annotations: annotations }
                },
                scales: {
                    x: {
                        title: { display: true, text: '측정값' },
                        type: 'linear',
                        ticks: {
                            callback: function(value) { return value.toFixed(2); }
                        }
                    },
                    y: { title: { display: true, text: '빈도' }, beginAtZero: true }
                }
            }
        });

        // 분포 통계 표시
        const distStats = dist.distribution_stats || dist.statistics || {};
        const normTest = distStats.normality_test || {};
        document.getElementById('val-normality').innerHTML = normTest.is_normal
            ? '<span class="badge badge-success">정규 분포</span>'
            : '<span class="badge badge-warning">비정규 분포</span>';
        document.getElementById('val-pvalue').textContent = normTest.p_value != null ? normTest.p_value.toFixed(4) : '-';
        document.getElementById('val-skewness').textContent = distStats.skewness != null ? distStats.skewness.toFixed(4) : '-';
        document.getElementById('val-kurtosis').textContent = distStats.kurtosis != null ? distStats.kurtosis.toFixed(4) : '-';

        // 규격 이내 비율 (spec 객체 안에 위치)
        const distSpec = dist.spec || {};
        if (distSpec.in_spec_percent != null) {
            document.getElementById('val-inspec-ratio').textContent = `${distSpec.in_spec_percent.toFixed(1)}%`;
        } else if (distSpec.in_spec_ratio != null) {
            document.getElementById('val-inspec-ratio').textContent = `${(distSpec.in_spec_ratio * 100).toFixed(1)}%`;
        } else {
            document.getElementById('val-inspec-ratio').textContent = '-';
        }
    }

    // =============================================
    // 섹션 7: 위치별 분석
    // =============================================
    function renderPositionAnalysis() {
        const stats = currentData.stats;
        const tbody = document.getElementById('position-stats-body');

        if (!stats || !stats.position_statistics) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">위치별 데이터가 없습니다.</td></tr>';
            return;
        }

        const positions = stats.position_statistics;
        const positionNames = {
            top: 'Top', center: 'Center', bottom: 'Bottom', left: 'Left', right: 'Right'
        };

        const posCapability = stats.position_capability || {};

        let html = '';
        for (const [key, name] of Object.entries(positionNames)) {
            const pos = positions[key];
            if (!pos) continue;

            const cap = posCapability[key] || {};

            html += `<tr>
                <td><strong>${name}</strong></td>
                <td>${fmtNum(pos.avg)}</td>
                <td>${fmtNum(pos.std_dev, 4)}</td>
                <td>${fmtNum(pos.min)}</td>
                <td>${fmtNum(pos.max)}</td>
                <td>${fmtNum(pos.range)}</td>
                <td class="${getCpColorClass(cap.cp)}">${fmtNum(cap.cp)}</td>
                <td class="${getCpColorClass(cap.cpk)}">${fmtNum(cap.cpk)}</td>
            </tr>`;
        }

        tbody.innerHTML = html || '<tr><td colspan="8" class="text-center text-muted">데이터 없음</td></tr>';

        // 위치 다이어그램 값 표시
        for (const [key, name] of Object.entries(positionNames)) {
            const pos = positions[key];
            const el = document.getElementById(`pos-${key}`);
            if (el && pos) {
                el.innerHTML = `<div>${name}</div><div style="font-size:0.65rem;font-weight:normal;color:#555;margin-top:1px">${pos.avg != null ? pos.avg.toFixed(2) : '-'}</div>`;
            }
        }
    }

    // =============================================
    // 섹션 8: 종합 통계 테이블
    // =============================================
    function renderComprehensiveStats() {
        const stats = currentData.stats;
        const tbody = document.getElementById('comprehensive-stats-body');

        if (!stats) {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">통계 데이터가 없습니다.</td></tr>';
            return;
        }

        const overall = stats.overall_statistics || {};
        const cap = stats.process_capability || {};
        const spec = stats.spec || {};
        const cl = currentData.spc?.control_limits || {};

        const rows = [
            { header: true, label: '기본 통계' },
            { label: '평균 (Mean)', value: fmtNum(overall.avg) },
            { label: '표준편차 (Std Dev)', value: fmtNum(overall.std_dev, 4) },
            { label: '최소값 (Min)', value: fmtNum(overall.min) },
            { label: '최대값 (Max)', value: fmtNum(overall.max) },
            { label: '범위 (Range)', value: fmtNum(overall.range) },
            { label: '데이터 수', value: stats.sample_count || '-' },
            { header: true, label: '공정 능력 지수' },
            { label: 'Cp (단기)', value: fmtNum(cap.cp), cls: getCpColorClass(cap.cp) },
            { label: 'Cpk (단기)', value: fmtNum(cap.cpk), cls: getCpColorClass(cap.cpk) },
            { label: 'Pp (장기)', value: fmtNum(cap.pp), cls: getCpColorClass(cap.pp) },
            { label: 'Ppk (장기)', value: fmtNum(cap.ppk), cls: getCpColorClass(cap.ppk) },
            { label: 'CPU', value: fmtNum(cap.cpu) },
            { label: 'CPL', value: fmtNum(cap.cpl) },
            { header: true, label: '규격 정보' },
            { label: 'USL (상한 규격)', value: spec.usl != null ? spec.usl : '-' },
            { label: 'LSL (하한 규격)', value: spec.lsl != null ? spec.lsl : '-' },
            { label: 'UCL (상한 관리)', value: cl.ucl != null ? fmtNum(cl.ucl) : '-' },
            { label: 'LCL (하한 관리)', value: cl.lcl != null ? fmtNum(cl.lcl) : '-' }
        ];

        let html = '';
        rows.forEach(row => {
            if (row.header) {
                html += `<tr class="thead-light"><td colspan="2"><strong>${row.label}</strong></td></tr>`;
            } else {
                const cls = row.cls ? ` class="${row.cls}"` : '';
                html += `<tr><td style="width:50%">${row.label}</td><td${cls}><strong>${row.value}</strong></td></tr>`;
            }
        });

        tbody.innerHTML = html;
    }

    // =============================================
    // 섹션 9: 측정 데이터 테이블
    // =============================================
    function renderMeasurementTable() {
        const measurements = currentData.measurements;
        const spec = currentData.stats?.spec || {};
        const tbody = document.getElementById('measurement-data-body');
        const badge = document.getElementById('data-count-badge');

        if (!Array.isArray(measurements) || measurements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">측정 데이터가 없습니다.</td></tr>';
            badge.textContent = '0건';
            return;
        }

        const sorted = [...measurements].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        badge.textContent = `${sorted.length}건`;

        let html = '';
        sorted.forEach(m => {
            const isOos = (spec.usl != null && m.avg_value > spec.usl) || (spec.lsl != null && m.avg_value < spec.lsl);
            const rowClass = isOos ? 'out-of-spec' : '';
            const date = new Date(m.created_at).toLocaleDateString('ko-KR');

            html += `<tr class="${rowClass}">
                <td>${date}</td>
                <td>${m.lot_no || '-'}</td>
                <td>${m.wafer_no || '-'}</td>
                <td>${m.device || '-'}</td>
                <td>${fmtNum(m.value_top)}</td>
                <td>${fmtNum(m.value_center)}</td>
                <td>${fmtNum(m.value_bottom)}</td>
                <td>${fmtNum(m.value_left)}</td>
                <td>${fmtNum(m.value_right)}</td>
                <td><strong>${fmtNum(m.avg_value)}</strong></td>
                <td>${fmtNum(m.range_value)}</td>
            </tr>`;
        });

        tbody.innerHTML = html;
    }

    // =============================================
    // PDF 내보내기
    // =============================================
    async function exportToPDF() {
        const btn = document.getElementById('export-pdf-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 생성 중...';

        try {
            const reportContent = document.getElementById('report-content');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 10;
            const contentWidth = pageWidth - margin * 2;

            // report-content의 직접 자식 요소들 (card, row 등)
            const sections = reportContent.querySelectorAll(':scope > .card, :scope > .row');
            let yPos = margin;
            let firstPage = true;

            for (const section of sections) {
                // 숨겨진 섹션 건너뛰기
                if (section.offsetParent === null || section.style.display === 'none') continue;

                const canvas = await html2canvas(section, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const imgWidth = contentWidth;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                // 페이지에 들어가지 않으면 새 페이지
                if (!firstPage && yPos + imgHeight > pageHeight - margin) {
                    pdf.addPage();
                    yPos = margin;
                }

                pdf.addImage(imgData, 'JPEG', margin, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 3;
                firstPage = false;

                // 현재 페이지 넘치면 다음 페이지 준비
                if (yPos > pageHeight - margin) {
                    pdf.addPage();
                    yPos = margin;
                }
            }

            // PDF 저장
            const targetName = document.getElementById('target').selectedOptions[0]?.text || 'report';
            const cdType = window.PROCESS_TYPE === 'ETCH' ? 'FICD' : 'DICD';
            const fileName = `${cdType}_DetailReport_${targetName}_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error('PDF 생성 실패:', error);
            alert('PDF 생성 중 오류가 발생했습니다.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-pdf mr-1"></i> PDF 내보내기';
        }
    }

    // =============================================
    // 유틸리티
    // =============================================
    function fmtNum(value, decimals) {
        if (value == null || value === '' || isNaN(value)) return '-';
        decimals = decimals != null ? decimals : 3;
        return Number(value).toFixed(decimals);
    }

    // =============================================
    // DOM Ready 시 초기화
    // =============================================
    $(document).ready(function() {
        initDetailReport();
    });

})();
