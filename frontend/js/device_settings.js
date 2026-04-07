// DEVICE 관리 탭 모듈
(function () {
    let allDevices = [];          // 전체 DEVICE 목록 (API 응답)
    let similarPairs = [];        // 유사 DEVICE 쌍
    let initialized = false;
    let loaded = false;

    const LOW_FREQ_THRESHOLD = 2; // 빈도 낮음 기준 (이하)

    function processType() {
        return window.PROCESS_TYPE || 'PHOTO';
    }

    // ===== 데이터 로드 =====
    async function loadDevices() {
        const tbody = document.getElementById('device-list');
        const simBody = document.getElementById('similar-device-list');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center">로딩 중...</td></tr>';
        if (simBody) simBody.innerHTML = '<tr><td colspan="3" class="text-center">로딩 중...</td></tr>';

        try {
            const pt = processType();
            const [devices, similar] = await Promise.all([
                api.get(`/devices/?process_type=${encodeURIComponent(pt)}`),
                api.get(`/devices/similar?process_type=${encodeURIComponent(pt)}&max_distance=2`),
            ]);
            allDevices = Array.isArray(devices) ? devices : [];
            similarPairs = Array.isArray(similar) ? similar : [];
            loaded = true;
            renderDeviceTable();
            renderSimilarTable();
        } catch (e) {
            console.error('DEVICE 로드 실패:', e);
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">로드 실패: ${e.message}</td></tr>`;
            if (simBody) simBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">로드 실패</td></tr>`;
        }
    }

    // ===== 렌더링 =====
    function formatDate(s) {
        if (!s) return '-';
        return s.substring(0, 10);
    }

    function renderDeviceTable() {
        const tbody = document.getElementById('device-list');
        if (!tbody) return;

        const keyword = (document.getElementById('device-search').value || '').trim().toUpperCase();
        const onlyLow = document.getElementById('device-only-low').checked;

        const rows = allDevices.filter(d => {
            if (onlyLow && d.count > LOW_FREQ_THRESHOLD) return false;
            if (keyword && !d.device.toUpperCase().includes(keyword)) return false;
            return true;
        });

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">데이터 없음</td></tr>';
            updateCheckAllState();
            return;
        }

        tbody.innerHTML = rows.map(d => {
            const lowClass = d.count <= LOW_FREQ_THRESHOLD ? 'table-warning' : '';
            const safeDevice = escapeHtml(d.device);
            return `
                <tr class="${lowClass}">
                    <td><input type="checkbox" class="device-check" value="${safeDevice}"></td>
                    <td><code>${safeDevice}</code></td>
                    <td class="text-right">${d.count}</td>
                    <td>${formatDate(d.first_used)}</td>
                    <td>${formatDate(d.last_used)}</td>
                </tr>
            `;
        }).join('');

        // 체크박스 이벤트
        tbody.querySelectorAll('.device-check').forEach(cb => {
            cb.addEventListener('change', updateCheckAllState);
        });
        updateCheckAllState();
    }

    function renderSimilarTable() {
        const tbody = document.getElementById('similar-device-list');
        if (!tbody) return;

        if (similarPairs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">유사 DEVICE 없음</td></tr>';
            return;
        }

        tbody.innerHTML = similarPairs.map((p, idx) => `
            <tr>
                <td><code class="text-danger">${escapeHtml(p.suspect)}</code> <span class="text-muted small">(${p.suspect_count})</span></td>
                <td><code class="text-success">${escapeHtml(p.standard)}</code> <span class="text-muted small">(${p.standard_count})</span></td>
                <td>
                    <button type="button" class="btn btn-xs btn-outline-primary similar-merge-btn" data-idx="${idx}" title="의심을 표준으로 병합">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.similar-merge-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                const pair = similarPairs[idx];
                if (!pair) return;
                openMergeModal([pair.suspect], pair.standard);
            });
        });
    }

    function updateCheckAllState() {
        const all = document.getElementById('device-check-all');
        if (!all) return;
        const checks = document.querySelectorAll('#device-list .device-check');
        const checked = document.querySelectorAll('#device-list .device-check:checked');
        all.checked = checks.length > 0 && checks.length === checked.length;
        all.indeterminate = checked.length > 0 && checked.length < checks.length;
    }

    function getSelectedDevices() {
        return Array.from(document.querySelectorAll('#device-list .device-check:checked')).map(cb => cb.value);
    }

    // ===== 모달 / 작업 =====
    function openMergeModal(fromDevices, toDevice) {
        if (!fromDevices || fromDevices.length === 0) {
            alert('변경할 DEVICE를 선택하세요.');
            return;
        }
        const list = document.getElementById('device-merge-from-list');
        list.innerHTML = fromDevices.map(d => `<div><code>${escapeHtml(d)}</code></div>`).join('');
        document.getElementById('device-merge-to').value = toDevice || '';
        $('#device-merge-modal').modal('show');

        // 확인 버튼 핸들러를 한번만 바인드
        const btn = document.getElementById('device-merge-confirm-btn');
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', async () => {
            const to = document.getElementById('device-merge-to').value.trim();
            if (!to) {
                alert('변경할 DEVICE 값을 입력하세요.');
                return;
            }
            try {
                const result = await api.post('/devices/merge', {
                    from_devices: fromDevices,
                    to_device: to,
                    process_type: processType(),
                });
                alert(`${result.updated_count}건의 측정 데이터가 변경되었습니다.`);
                $('#device-merge-modal').modal('hide');
                await loadDevices();
            } catch (e) {
                alert('DEVICE 변경 실패: ' + e.message);
            }
        });
    }

    async function deleteSelectedDevices() {
        const selected = getSelectedDevices();
        if (selected.length === 0) {
            alert('삭제할 DEVICE를 선택하세요.');
            return;
        }
        if (!confirm(`선택한 ${selected.length}개 DEVICE의 모든 측정 데이터를 삭제합니다.\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?`)) {
            return;
        }
        try {
            const result = await api.post('/devices/delete', {
                devices: selected,
                process_type: processType(),
            });
            alert(`${result.deleted_count}건의 측정 데이터가 삭제되었습니다.`);
            await loadDevices();
        } catch (e) {
            alert('DEVICE 삭제 실패: ' + e.message);
        }
    }

    // ===== 유틸 =====
    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ===== 이벤트 바인딩 =====
    function bindEvents() {
        if (initialized) return;
        initialized = true;

        document.getElementById('device-refresh-btn').addEventListener('click', loadDevices);
        document.getElementById('device-search').addEventListener('input', renderDeviceTable);
        document.getElementById('device-only-low').addEventListener('change', renderDeviceTable);

        document.getElementById('device-check-all').addEventListener('change', function () {
            const checked = this.checked;
            document.querySelectorAll('#device-list .device-check').forEach(cb => { cb.checked = checked; });
        });

        document.getElementById('device-merge-btn').addEventListener('click', () => {
            const selected = getSelectedDevices();
            if (selected.length === 0) {
                alert('변경할 DEVICE를 선택하세요.');
                return;
            }
            openMergeModal(selected, '');
        });

        document.getElementById('device-delete-btn').addEventListener('click', deleteSelectedDevices);

        // 탭 활성화 시 첫 로드
        $('a[data-toggle="tab"][href="#device-settings"]').on('shown.bs.tab', function () {
            if (!loaded) loadDevices();
        });
    }

    document.addEventListener('DOMContentLoaded', bindEvents);
})();
