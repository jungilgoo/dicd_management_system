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

        // SPEC 어노테이션
        const annotations = {};
        if (spec.usl != null) {
            annotations.usl = { type: 'line', yMin: spec.usl, yMax: spec.usl, borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3], label: { display: true, content: `USL: ${spec.usl}`, position: 'end', font: { size: 10 } } };
        }
        if (spec.lsl != null) {
            annotations.lsl = { type: 'line', yMin: spec.lsl, yMax: spec.lsl, borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3], label: { display: true, content: `LSL: ${spec.lsl}`, position: 'end', font: { size: 10 } } };
        }
        if (spec.usl != null && spec.lsl != null) {
            const target = (spec.usl + spec.lsl) / 2;
            annotations.target = { type: 'line', yMin: target, yMax: target, borderColor: 'rgba(0,123,255,0.6)', borderWidth: 1, borderDash: [4, 4], label: { display: true, content: `Target: ${target.toFixed(3)}`, position: 'start', font: { size: 10 } } };
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
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    annotation: { annotations: annotations },
                    tooltip: {
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

        // X-bar 어노테이션
        const xbarAnnotations = {};
        if (cl.cl != null) {
            xbarAnnotations.cl = { type: 'line', yMin: cl.cl, yMax: cl.cl, borderColor: 'rgba(40,167,69,0.8)', borderWidth: 2, borderDash: [4, 4], label: { display: true, content: `CL: ${cl.cl.toFixed(3)}`, position: 'start', font: { size: 9 } } };
        }
        if (cl.ucl != null || spec.ucl != null) {
            const ucl = spec.ucl != null ? spec.ucl : cl.ucl;
            xbarAnnotations.ucl = { type: 'line', yMin: ucl, yMax: ucl, borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3], label: { display: true, content: `UCL: ${ucl.toFixed(3)}`, position: 'end', font: { size: 9 } } };
        }
        if (cl.lcl != null || spec.lcl != null) {
            const lcl = spec.lcl != null ? spec.lcl : cl.lcl;
            xbarAnnotations.lcl = { type: 'line', yMin: lcl, yMax: lcl, borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3], label: { display: true, content: `LCL: ${lcl.toFixed(3)}`, position: 'end', font: { size: 9 } } };
        }
        if (spec.usl != null) {
            xbarAnnotations.usl = { type: 'line', yMin: spec.usl, yMax: spec.usl, borderColor: 'rgba(0,123,255,0.6)', borderWidth: 1, borderDash: [3, 3], label: { display: true, content: `USL: ${spec.usl}`, position: 'end', font: { size: 9 } } };
        }
        if (spec.lsl != null) {
            xbarAnnotations.lsl = { type: 'line', yMin: spec.lsl, yMax: spec.lsl, borderColor: 'rgba(0,123,255,0.6)', borderWidth: 1, borderDash: [3, 3], label: { display: true, content: `LSL: ${spec.lsl}`, position: 'end', font: { size: 9 } } };
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
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    annotation: { annotations: xbarAnnotations },
                    tooltip: {
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
        rAnnotations.rbar = { type: 'line', yMin: rMean, yMax: rMean, borderColor: 'rgba(40,167,69,0.8)', borderWidth: 2, borderDash: [4, 4], label: { display: true, content: `R-bar: ${rMean.toFixed(4)}`, position: 'start', font: { size: 9 } } };
        rAnnotations.rucl = { type: 'line', yMin: rUcl, yMax: rUcl, borderColor: 'rgba(220,53,69,0.8)', borderWidth: 2, borderDash: [6, 3], label: { display: true, content: `UCL: ${rUcl.toFixed(4)}`, position: 'end', font: { size: 9 } } };

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
                plugins: {
                    legend: { display: false },
                    annotation: { annotations: rAnnotations }
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

        let html = '';
        patterns.forEach(p => {
            const ruleNum = p.rule || p.rule_number || '-';
            const desc = ruleDescriptions[ruleNum] || p.description || '-';
            const posInfo = p.position != null ? `포인트 ${p.position + 1}${p.lot_no ? ' (Lot: ' + p.lot_no + ')' : ''}` : '-';
            html += `<tr>
                <td class="nelson-violation">규칙 ${ruleNum}</td>
                <td>${desc}</td>
                <td>${posInfo}</td>
            </tr>`;
        });

        tbody.innerHTML = html;
        container.style.display = 'block';
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
        const binCenters = histogram.bin_centers || [];
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
        document.getElementById('val-normality').innerHTML = distStats.is_normal
            ? '<span class="badge badge-success">정규 분포</span>'
            : '<span class="badge badge-warning">비정규 분포</span>';
        document.getElementById('val-pvalue').textContent = distStats.p_value != null ? distStats.p_value.toFixed(4) : '-';
        document.getElementById('val-skewness').textContent = distStats.skewness != null ? distStats.skewness.toFixed(4) : '-';
        document.getElementById('val-kurtosis').textContent = distStats.kurtosis != null ? distStats.kurtosis.toFixed(4) : '-';

        // 규격 이내 비율
        if (distStats.in_spec_ratio != null) {
            document.getElementById('val-inspec-ratio').textContent = `${(distStats.in_spec_ratio * 100).toFixed(1)}%`;
        } else if (dist.in_spec_ratio != null) {
            document.getElementById('val-inspec-ratio').textContent = `${(dist.in_spec_ratio * 100).toFixed(1)}%`;
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
                el.innerHTML = `${name}<br><small>${pos.avg != null ? pos.avg.toFixed(2) : '-'}</small>`;
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
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 15;
            const contentWidth = pageWidth - margin * 2;

            // 제목
            const pgName = document.getElementById('product-group').selectedOptions[0]?.text || '';
            const procName = document.getElementById('process').selectedOptions[0]?.text || '';
            const targetName = document.getElementById('target').selectedOptions[0]?.text || '';
            const cdType = window.PROCESS_TYPE === 'ETCH' ? 'FICD' : 'DICD';

            pdf.setFontSize(16);
            pdf.text(`${cdType} Detail Report`, margin, 20);
            pdf.setFontSize(11);
            pdf.text(`${pgName} - ${procName} - ${targetName}`, margin, 28);
            pdf.setFontSize(9);
            pdf.setTextColor(100);
            pdf.text(`Period: ${getPeriodText()} | Generated: ${new Date().toLocaleString('ko-KR')}`, margin, 34);
            pdf.setTextColor(0);

            let yPos = 42;

            // 요약 통계 텍스트
            const stats = currentData.stats;
            if (stats) {
                const cap = stats.process_capability || {};
                const overall = stats.overall_statistics || {};
                pdf.setFontSize(10);
                pdf.text(`Cp: ${fmtNum(cap.cp)}  Cpk: ${fmtNum(cap.cpk)}  Pp: ${fmtNum(cap.pp)}  Ppk: ${fmtNum(cap.ppk)}`, margin, yPos);
                yPos += 5;
                pdf.text(`Mean: ${fmtNum(overall.avg)}  StdDev: ${fmtNum(overall.std_dev, 4)}  Range: ${fmtNum(overall.range)}  N: ${stats.sample_count || '-'}`, margin, yPos);
                yPos += 10;
            }

            // 추이 차트 이미지
            if (trendChart) {
                const trendImg = trendChart.toBase64Image();
                pdf.setFontSize(11);
                pdf.text('Trend Chart', margin, yPos);
                yPos += 3;
                pdf.addImage(trendImg, 'PNG', margin, yPos, contentWidth, 60);
                yPos += 65;
            }

            // X-bar 차트
            if (xbarChart) {
                if (yPos + 55 > pageHeight - margin) {
                    pdf.addPage();
                    yPos = margin;
                }
                pdf.setFontSize(11);
                pdf.text('SPC X-bar Chart', margin, yPos);
                yPos += 3;
                const xbarImg = xbarChart.toBase64Image();
                pdf.addImage(xbarImg, 'PNG', margin, yPos, contentWidth, 50);
                yPos += 55;
            }

            // R 차트
            if (rChart) {
                if (yPos + 40 > pageHeight - margin) {
                    pdf.addPage();
                    yPos = margin;
                }
                pdf.setFontSize(11);
                pdf.text('SPC R Chart', margin, yPos);
                yPos += 3;
                const rImg = rChart.toBase64Image();
                pdf.addImage(rImg, 'PNG', margin, yPos, contentWidth, 35);
                yPos += 40;
            }

            // 분포 차트
            if (distributionChart) {
                if (yPos + 55 > pageHeight - margin) {
                    pdf.addPage();
                    yPos = margin;
                }
                pdf.setFontSize(11);
                pdf.text('Distribution', margin, yPos);
                yPos += 3;
                const distImg = distributionChart.toBase64Image();
                pdf.addImage(distImg, 'PNG', margin, yPos, contentWidth, 50);
                yPos += 55;
            }

            // PDF 저장
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
