// SPC 알람 관리 페이지 JS

const PROCESS_TYPE = (window.parent && window.parent.PROCESS_TYPE) || window.PROCESS_TYPE || 'PHOTO';
let currentPage = 0;
const pageSize = 50;
let pendingResolveAlarmId = null;

document.addEventListener('DOMContentLoaded', function() {
    initAlarmPage();
});

function initAlarmPage() {
    // 이벤트 리스너
    document.getElementById('btn-search').addEventListener('click', () => { currentPage = 0; loadAlarms(); });
    document.getElementById('btn-reset').addEventListener('click', resetFilters);

    // 조치완료 모달 확인 버튼
    document.getElementById('btn-resolve-confirm').addEventListener('click', confirmResolve);

    // DateRangePicker 초기화
    $('#filter-daterange').daterangepicker({
        autoUpdateInput: false,
        locale: {
            format: 'YYYY-MM-DD',
            applyLabel: '적용',
            cancelLabel: '초기화',
            daysOfWeek: ['일', '월', '화', '수', '목', '금', '토'],
            monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
        }
    });
    $('#filter-daterange').on('apply.daterangepicker', function(ev, picker) {
        $(this).val(picker.startDate.format('YYYY-MM-DD') + ' ~ ' + picker.endDate.format('YYYY-MM-DD'));
    });
    $('#filter-daterange').on('cancel.daterangepicker', function() {
        $(this).val('');
    });

    // 타겟 목록 로드
    loadTargets();

    // 요약 + 알람 로드
    loadSummary();
    loadAlarms();
}

async function loadTargets() {
    try {
        const processType = PROCESS_TYPE;
        const groups = await api.get('/product-groups/');
        const targetSelect = document.getElementById('filter-target');

        for (const group of groups) {
            const processes = await api.get(`/processes/?product_group_id=${group.id}`);
            for (const process of processes) {
                const targets = await api.get(`/targets/?process_id=${process.id}&process_type=${processType}`);
                for (const target of targets) {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = `${group.name} > ${process.name} > ${target.name}`;
                    targetSelect.appendChild(option);
                }
            }
        }
    } catch (e) {
        console.error('타겟 목록 로드 실패:', e);
    }
}

async function loadSummary() {
    try {
        const processType = PROCESS_TYPE;
        const summary = await api.get(`/spc-alarms/summary?process_type=${processType}`);

        document.getElementById('summary-critical').textContent = summary.critical_count;
        document.getElementById('summary-warning').textContent = summary.warning_count;
        document.getElementById('summary-info').textContent = summary.info_count;
        document.getElementById('summary-total').textContent = summary.total_count;
    } catch (e) {
        console.error('알람 요약 로드 실패:', e);
    }
}

async function loadAlarms() {
    const processType = PROCESS_TYPE;
    const severity = document.getElementById('filter-severity').value;
    const status = document.getElementById('filter-status').value;
    const targetId = document.getElementById('filter-target').value;
    const dateRange = document.getElementById('filter-daterange').value;

    let params = `process_type=${processType}&limit=${pageSize}&offset=${currentPage * pageSize}`;
    if (severity) params += `&severity=${severity}`;
    if (status) params += `&status=${status}`;
    if (targetId) params += `&target_id=${targetId}`;
    if (dateRange) {
        const dates = dateRange.split(' ~ ');
        if (dates.length === 2) {
            params += `&start_date=${dates[0]}&end_date=${dates[1]}`;
        }
    }

    try {
        const alarms = await api.get(`/spc-alarms/?${params}`);
        renderAlarmTable(alarms);
    } catch (e) {
        console.error('알람 목록 로드 실패:', e);
        document.getElementById('alarm-table-body').innerHTML =
            '<tr><td colspan="12" class="text-center text-danger">알람 목록을 불러오는 중 오류가 발생했습니다.</td></tr>';
    }
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
    const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `<div>${date}</div><div class="text-muted" style="font-size:0.85em">${time}</div>`;
}

function renderAlarmTable(alarms) {
    const tbody = document.getElementById('alarm-table-body');
    const countInfo = document.getElementById('alarm-count-info');

    if (!alarms || alarms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-3">알람이 없습니다.</td></tr>';
        countInfo.textContent = '0건';
        return;
    }

    countInfo.textContent = `${alarms.length}건`;

    tbody.innerHTML = alarms.map((alarm, idx) => {
        const severityBadge = alarm.severity === 'CRITICAL'
            ? '<span class="badge badge-danger">Critical</span>'
            : alarm.severity === 'WARNING'
            ? '<span class="badge badge-warning">Warning</span>'
            : '<span class="badge badge-info">Info</span>';

        // 상태: 조치 전/후 색상 구분
        let statusBadge;
        if (alarm.status === 'ACTIVE') {
            statusBadge = '<span class="badge badge-danger">미해결</span>';
        } else if (alarm.status === 'RESOLVED') {
            statusBadge = '<span class="badge badge-success">해결</span>';
        } else if (alarm.status === 'SUPERSEDED') {
            statusBadge = '<span class="badge badge-secondary">대체</span>';
        } else {
            statusBadge = `<span class="badge badge-secondary">${alarm.status}</span>`;
        }

        // 액션: 위=조치완료, 아래=바로가기
        let actionTop = '';
        if (alarm.status === 'ACTIVE') {
            actionTop = `<button class="btn btn-xs btn-danger" onclick="openResolveModal(${alarm.id})"><i class="fas fa-times-circle mr-1"></i>미해결</button>`;
        } else if (alarm.status === 'RESOLVED') {
            const noteTitle = alarm.resolve_note ? ` title="${alarm.resolve_note.replace(/"/g, '&quot;')}"` : '';
            actionTop = `<span class="badge badge-success"${noteTitle}><i class="fas fa-check-circle mr-1"></i>해결</span>`;
        }

        const actionBottom = `<button class="btn btn-xs btn-outline-primary mr-1" title="데이터 조회" onclick="openViewFromAlarm(${alarm.product_group_id}, ${alarm.process_id}, ${alarm.target_id}, '${(alarm.lot_no || '').replace(/'/g, "\\'")}')"><i class="fas fa-search"></i></button><button class="btn btn-xs btn-outline-info" title="SPC 분석" onclick="openSpcFromAlarm(${alarm.target_id}, '${(alarm.product_group_name || '').replace(/'/g, "\\'")}', '${(alarm.process_name || '').replace(/'/g, "\\'")}', '${(alarm.target_name || '').replace(/'/g, "\\'")}')"><i class="fas fa-chart-line"></i></button>`;

        return `<tr>
            <td>${currentPage * pageSize + idx + 1}</td>
            <td>${severityBadge}</td>
            <td>${statusBadge}</td>
            <td>${formatDateTime(alarm.created_at)}</td>
            <td>${alarm.product_group_name || '-'}</td>
            <td>${alarm.process_name || '-'}</td>
            <td>${alarm.target_name || '-'}</td>
            <td>${alarm.device || '-'}</td>
            <td>${alarm.lot_no || '-'}</td>
            <td class="text-truncate" style="max-width:250px; cursor:pointer" title="${alarm.description}" onclick="showAlarmDetail(${alarm.id})">${alarm.description}</td>
            <td>${alarm.value != null ? alarm.value : '-'}</td>
            <td><div class="mb-1">${actionTop}</div><div>${actionBottom}</div></td>
        </tr>`;
    }).join('');
}

// 조치완료 모달 열기
function openResolveModal(alarmId) {
    pendingResolveAlarmId = alarmId;
    document.getElementById('resolve-note').value = '';
    $('#resolve-modal').modal('show');
}

// 조치완료 확인
async function confirmResolve() {
    if (!pendingResolveAlarmId) return;

    const note = document.getElementById('resolve-note').value.trim();
    try {
        await api.patch(`/spc-alarms/${pendingResolveAlarmId}/resolve`, {
            resolve_note: note || null
        });
        $('#resolve-modal').modal('hide');
        pendingResolveAlarmId = null;
        loadAlarms();
        loadSummary();
    } catch (e) {
        alert('조치 완료 처리 실패: ' + e.message);
    }
}

async function showAlarmDetail(alarmId) {
    try {
        const alarm = await api.get(`/spc-alarms/${alarmId}`);
        const body = document.getElementById('alarm-detail-body');

        const statusMap = {
            'ACTIVE': '미해결', 'RESOLVED': '해결', 'SUPERSEDED': '대체됨'
        };

        body.innerHTML = `
            <table class="table table-sm table-bordered">
                <tr><th style="width:120px">알람 ID</th><td>${alarm.id}</td></tr>
                <tr><th>심각도</th><td>${alarm.severity}</td></tr>
                <tr><th>상태</th><td>${statusMap[alarm.status] || alarm.status}</td></tr>
                <tr><th>유형</th><td>${alarm.alarm_type}${alarm.rule_number ? ' (Rule ' + alarm.rule_number + ')' : ''}</td></tr>
                <tr><th>내용</th><td>${alarm.description}</td></tr>
                <tr><th>판정 값</th><td>${alarm.value}</td></tr>
                <tr><th>판정 시점 CL</th><td>${alarm.cl_snapshot != null ? alarm.cl_snapshot : '-'}</td></tr>
                <tr><th>판정 시점 UCL</th><td>${alarm.ucl_snapshot != null ? alarm.ucl_snapshot : '-'}</td></tr>
                <tr><th>판정 시점 LCL</th><td>${alarm.lcl_snapshot != null ? alarm.lcl_snapshot : '-'}</td></tr>
                <tr><th>판정 시점 USL</th><td>${alarm.spec_usl != null ? alarm.spec_usl : '-'}</td></tr>
                <tr><th>판정 시점 LSL</th><td>${alarm.spec_lsl != null ? alarm.spec_lsl : '-'}</td></tr>
                <tr><th>발생 시간</th><td>${alarm.created_at ? new Date(alarm.created_at).toLocaleString('ko-KR') : '-'}</td></tr>
                ${alarm.resolved_by ? `<tr><th>조치 완료</th><td>${alarm.resolved_by} (${new Date(alarm.resolved_at).toLocaleString('ko-KR')})</td></tr>` : ''}
                ${alarm.resolve_note ? `<tr><th>조치 메모</th><td>${alarm.resolve_note}</td></tr>` : ''}
            </table>
        `;

        $('#alarm-detail-modal').modal('show');
    } catch (e) {
        alert('알람 상세 조회 실패: ' + e.message);
    }
}

function openViewFromAlarm(productGroupId, processId, targetId, lotNo) {
    const tabManager = window.parent && window.parent.TabManager ? window.parent.TabManager : window.TabManager;
    if (tabManager && typeof tabManager.openTab === 'function') {
        tabManager.openTab('view', {
            productGroupId: productGroupId,
            processId: processId,
            targetId: targetId,
            lotNo: lotNo
        });
    }
}

function openSpcFromAlarm(targetId, productGroup, process, targetName) {
    const tabManager = window.parent && window.parent.TabManager ? window.parent.TabManager : window.TabManager;
    if (tabManager && typeof tabManager.openTab === 'function') {
        tabManager.openTab('spc', {
            targetId: targetId,
            productGroup: productGroup,
            process: process,
            targetName: targetName
        });
    }
}

function resetFilters() {
    document.getElementById('filter-severity').value = '';
    document.getElementById('filter-status').value = 'ACTIVE';
    document.getElementById('filter-target').value = '';
    document.getElementById('filter-daterange').value = '';
    currentPage = 0;
    loadAlarms();
}
