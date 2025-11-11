// 변경점 관리 JavaScript 모듈

// 전역 변수
let productGroups = [];
let processes = [];
let targets = [];
let changePoints = [];

// DOM이 로드되면 초기화
$(document).ready(function() {
    initializeChangePoints();
});

// 초기화 함수
function initializeChangePoints() {
    loadProductGroups();
    loadChangePoints();
    setupEventHandlers();
}

// 이벤트 핸들러 설정
function setupEventHandlers() {
    // 제품군 선택 변경
    $('#product-group').change(function() {
        const productGroupId = $(this).val();
        if (productGroupId) {
            loadProcesses(productGroupId);
            $('#process').prop('disabled', false);
        } else {
            $('#process').empty().append('<option value="">공정을 선택하세요</option>').prop('disabled', true);
            $('#target').empty().append('<option value="">타겟을 선택하세요</option>').prop('disabled', true);
        }
    });

    // 공정 선택 변경
    $('#process').change(function() {
        const processId = $(this).val();
        if (processId) {
            loadTargets(processId);
            $('#target').prop('disabled', false);
        } else {
            $('#target').empty().append('<option value="">타겟을 선택하세요</option>').prop('disabled', true);
        }
    });

    // 변경점 등록 폼 제출
    $('#change-point-form').submit(function(e) {
        e.preventDefault();
        saveChangePoint();
    });

    // 폼 초기화 버튼
    $('#reset-form-btn').click(function() {
        resetForm();
    });

    // 목록 새로고침 버튼
    $('#refresh-list-btn').click(function() {
        const $btn = $(this);
        const originalHtml = $btn.html();

        console.log('[ChangePoints] 새로고침 버튼 클릭됨');
        console.log('[ChangePoints] 현재 변경점 개수:', changePoints.length);

        // 버튼 비활성화 및 로딩 표시
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> 새로고침 중...');

        loadChangePoints()
            .then(() => {
                // 성공 시 일시적으로 성공 표시
                $btn.html('<i class="fas fa-check mr-1"></i> 완료');
                setTimeout(() => {
                    $btn.prop('disabled', false).html(originalHtml);
                }, 1000);
            })
            .catch((error) => {
                // 에러 시 에러 표시
                console.error('[ChangePoints] 새로고침 실패:', error);
                $btn.html('<i class="fas fa-exclamation-triangle mr-1"></i> 실패');
                setTimeout(() => {
                    $btn.prop('disabled', false).html(originalHtml);
                }, 2000);
            });
    });

    // 수정 모달의 제품군 선택 변경
    $('#edit-product-group').change(function() {
        const productGroupId = $(this).val();
        if (productGroupId) {
            loadProcessesForEdit(productGroupId);
            $('#edit-process').prop('disabled', false);
        } else {
            $('#edit-process').empty().append('<option value="">공정을 선택하세요</option>').prop('disabled', true);
            $('#edit-target').empty().append('<option value="">타겟을 선택하세요</option>').prop('disabled', true);
        }
    });

    // 수정 모달의 공정 선택 변경
    $('#edit-process').change(function() {
        const processId = $(this).val();
        if (processId) {
            loadTargetsForEdit(processId);
            $('#edit-target').prop('disabled', false);
        } else {
            $('#edit-target').empty().append('<option value="">타겟을 선택하세요</option>').prop('disabled', true);
        }
    });

    // 변경점 수정 버튼
    $('#update-change-point-btn').click(function() {
        updateChangePoint();
    });

    // 변경점 삭제 버튼
    $('#delete-change-point-btn').click(function() {
        deleteChangePoint();
    });
}

// 제품군 목록 로드
async function loadProductGroups() {
    try {
        const response = await api.getProductGroups();
        productGroups = response;
        
        const productGroupSelect = $('#product-group');
        const editProductGroupSelect = $('#edit-product-group');
        
        productGroupSelect.empty().append('<option value="">제품군을 선택하세요</option>');
        editProductGroupSelect.empty().append('<option value="">제품군을 선택하세요</option>');
        
        productGroups.forEach(pg => {
            const option = `<option value="${pg.id}">${pg.name}</option>`;
            productGroupSelect.append(option);
            editProductGroupSelect.append(option);
        });
    } catch (error) {
        console.error('제품군 로드 실패:', error);
        showError('제품군을 불러오는데 실패했습니다.');
    }
}

// 공정 목록 로드
async function loadProcesses(productGroupId) {
    try {
        const response = await api.getProcesses(productGroupId);
        processes = response;
        
        const processSelect = $('#process');
        processSelect.empty().append('<option value="">공정을 선택하세요</option>');
        
        processes.forEach(process => {
            processSelect.append(`<option value="${process.id}">${process.name}</option>`);
        });
    } catch (error) {
        console.error('공정 로드 실패:', error);
        showError('공정을 불러오는데 실패했습니다.');
    }
}

// 타겟 목록 로드
async function loadTargets(processId) {
    try {
        const response = await api.getTargets(processId);
        targets = response;
        
        const targetSelect = $('#target');
        targetSelect.empty().append('<option value="">타겟을 선택하세요</option>');
        
        targets.forEach(target => {
            targetSelect.append(`<option value="${target.id}">${target.name}</option>`);
        });
    } catch (error) {
        console.error('타겟 로드 실패:', error);
        showError('타겟을 불러오는데 실패했습니다.');
    }
}

// 수정 모달용 공정 로드
async function loadProcessesForEdit(productGroupId) {
    try {
        const response = await api.getProcesses(productGroupId);
        const editProcessSelect = $('#edit-process');
        editProcessSelect.empty().append('<option value="">공정을 선택하세요</option>');
        
        response.forEach(process => {
            editProcessSelect.append(`<option value="${process.id}">${process.name}</option>`);
        });
    } catch (error) {
        console.error('공정 로드 실패:', error);
        showError('공정을 불러오는데 실패했습니다.');
    }
}

// 수정 모달용 타겟 로드
async function loadTargetsForEdit(processId) {
    try {
        const response = await api.getTargets(processId);
        const editTargetSelect = $('#edit-target');
        editTargetSelect.empty().append('<option value="">타겟을 선택하세요</option>');
        
        response.forEach(target => {
            editTargetSelect.append(`<option value="${target.id}">${target.name}</option>`);
        });
    } catch (error) {
        console.error('타겟 로드 실패:', error);
        showError('타겟을 불러오는데 실패했습니다.');
    }
}

// 변경점 목록 로드
async function loadChangePoints() {
    try {
        showLoadingInTable();
        const response = await api.get(`${api.endpoints.CHANGE_POINTS}/with-details`);

        if (!response) {
            throw new Error('응답 데이터가 없습니다');
        }

        changePoints = response;
        console.log(`[ChangePoints] 변경점 ${changePoints.length}개 로드 완료`);
        renderChangePointsTable();

    } catch (error) {
        console.error('[ChangePoints] 변경점 목록 로드 실패:', error);
        showError(`변경점 목록을 불러오는데 실패했습니다: ${error.message}`);
        showEmptyTable();
        throw error; // Promise rejection을 위해 에러 전파
    }
}

// 변경점 저장
async function saveChangePoint() {
    try {
        const formData = new FormData(document.getElementById('change-point-form'));
        
        // 날짜를 datetime 형식으로 변환 (시간은 00:00:00으로 설정)
        const dateValue = formData.get('change_date');
        const changeDateTime = dateValue ? `${dateValue}T00:00:00` : null;
        
        const data = {
            product_group_id: parseInt(formData.get('product_group_id')),
            process_id: parseInt(formData.get('process_id')),
            target_id: parseInt(formData.get('target_id')),
            change_date: changeDateTime,
            description: formData.get('description')
        };

        // 유효성 검사
        if (!data.product_group_id || !data.process_id || !data.target_id || !data.change_date || !data.description) {
            showError('모든 필수 항목을 입력해주세요.');
            return;
        }

        await api.post(api.endpoints.CHANGE_POINTS, data);
        showSuccess('변경점이 성공적으로 등록되었습니다.');
        resetForm();
        loadChangePoints();
    } catch (error) {
        console.error('변경점 저장 실패:', error);
        showError('변경점 저장에 실패했습니다.');
    }
}

// 변경점 수정
async function updateChangePoint() {
    try {
        const changePointId = $('#edit-change-point-id').val();
        const formData = new FormData(document.getElementById('edit-change-point-form'));
        
        // 날짜를 datetime 형식으로 변환
        const dateValue = formData.get('change_date');
        const changeDateTime = dateValue ? `${dateValue}T00:00:00` : null;
        
        const data = {
            product_group_id: parseInt(formData.get('product_group_id')) || null,
            process_id: parseInt(formData.get('process_id')) || null,
            target_id: parseInt(formData.get('target_id')) || null,
            change_date: changeDateTime,
            description: formData.get('description') || null
        };

        await api.put(`${api.endpoints.CHANGE_POINTS}/${changePointId}`, data);
        showSuccess('변경점이 성공적으로 수정되었습니다.');
        $('#edit-change-point-modal').modal('hide');
        loadChangePoints();
    } catch (error) {
        console.error('변경점 수정 실패:', error);
        showError('변경점 수정에 실패했습니다.');
    }
}

// 변경점 삭제
async function deleteChangePoint() {
    if (!confirm('정말로 이 변경점을 삭제하시겠습니까?')) {
        return;
    }

    try {
        const changePointId = $('#edit-change-point-id').val();
        await api.delete(`${api.endpoints.CHANGE_POINTS}/${changePointId}`);
        showSuccess('변경점이 성공적으로 삭제되었습니다.');
        $('#edit-change-point-modal').modal('hide');
        loadChangePoints();
    } catch (error) {
        console.error('변경점 삭제 실패:', error);
        showError('변경점 삭제에 실패했습니다.');
    }
}

// 변경점 테이블 렌더링
function renderChangePointsTable() {
    const tbody = $('#change-points-tbody');
    tbody.empty();

    if (changePoints.length === 0) {
        showEmptyTable();
        return;
    }

    changePoints.forEach((cp, index) => {
        const changeDate = new Date(cp.change_date).toLocaleDateString('ko-KR');
        const createdAt = new Date(cp.created_at).toLocaleString('ko-KR');
        const shortDescription = cp.description.length > 50 ? 
            cp.description.substring(0, 50) + '...' : cp.description;

        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>${cp.product_group_name}</td>
                <td>${cp.process_name}</td>
                <td>${cp.target_name}</td>
                <td>${changeDate}</td>
                <td title="${cp.description}">${shortDescription}</td>
                <td>${createdAt}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editChangePoint(${cp.id})">
                        <i class="fas fa-edit"></i> 수정
                    </button>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
}

// 변경점 편집 모달 열기
async function editChangePoint(changePointId) {
    try {
        const changePoint = changePoints.find(cp => cp.id === changePointId);
        if (!changePoint) {
            showError('변경점을 찾을 수 없습니다.');
            return;
        }

        // 모달 데이터 설정
        $('#edit-change-point-id').val(changePoint.id);
        $('#edit-product-group').val(changePoint.product_group_id);
        
        // 공정 목록 로드 후 선택
        await loadProcessesForEdit(changePoint.product_group_id);
        $('#edit-process').prop('disabled', false).val(changePoint.process_id);
        
        // 타겟 목록 로드 후 선택
        await loadTargetsForEdit(changePoint.process_id);
        $('#edit-target').prop('disabled', false).val(changePoint.target_id);
        
        // 날짜와 설명 설정
        const changeDate = new Date(changePoint.change_date);
        const formattedDate = changeDate.toISOString().slice(0, 10); // YYYY-MM-DD 형식만
        $('#edit-change-date').val(formattedDate);
        $('#edit-description').val(changePoint.description);

        // 모달 열기
        $('#edit-change-point-modal').modal('show');
    } catch (error) {
        console.error('변경점 편집 모달 열기 실패:', error);
        showError('변경점 정보를 불러오는데 실패했습니다.');
    }
}

// 폼 초기화
function resetForm() {
    $('#change-point-form')[0].reset();
    $('#process').empty().append('<option value="">공정을 선택하세요</option>').prop('disabled', true);
    $('#target').empty().append('<option value="">타겟을 선택하세요</option>').prop('disabled', true);
}

// 로딩 표시
function showLoadingInTable() {
    const tbody = $('#change-points-tbody');
    tbody.empty().append(`
        <tr>
            <td colspan="8" class="text-center text-muted py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">로딩 중...</span>
                </div>
                <p class="mt-2">데이터를 불러오는 중입니다...</p>
            </td>
        </tr>
    `);
}

// 빈 테이블 표시
function showEmptyTable() {
    const tbody = $('#change-points-tbody');
    tbody.empty().append(`
        <tr>
            <td colspan="8" class="text-center text-muted py-4">
                <i class="fas fa-info-circle fa-3x mb-3"></i>
                <p>등록된 변경점이 없습니다.</p>
            </td>
        </tr>
    `);
}

// 성공 메시지 표시
function showSuccess(message) {
    alert(message);
}

// 에러 메시지 표시
function showError(message) {
    alert(message);
}