// 설정 페이지 모듈
(function() {
    // 전역 변수
    let selectedProductGroupId = null;
    let selectedProcessId = null;
    let selectedTargetId = null;
    let currentSpecs = [];
    let isEditMode = false;
    let editingSpecId = null;
    
    // 페이지 초기화
    async function initSettingsPage() {
        // 제품군 옵션 로드
        await loadProductGroups();
        
        // 제품군 및 공정 관리 이벤트 설정
        setupProductProcessEvents();
        
        // 장비 관리 초기화
        await initEquipmentManagement();
        
        // 탭 활성화 이벤트 설정
        setupTabEvents();
        
        // 이벤트 리스너 설정
        setupEventListeners();
    }
    
    // 제품군 옵션 로드
    async function loadProductGroups() {
        try {
            const productGroups = await api.getProductGroups();
            
            if (!productGroups || productGroups.length === 0) {
                console.error('제품군 정보가 없습니다.');
                return;
            }
            
            let options = '<option value="">제품군 선택</option>';
            productGroups.forEach(productGroup => {
                options += `<option value="${productGroup.id}">${productGroup.name}</option>`;
            });
            
            // 제품군 드롭다운 업데이트
            document.getElementById('spec-product-group').innerHTML = options;
            document.getElementById('new-target-product-group').innerHTML = options;
        } catch (error) {
            console.error('제품군 로드 실패:', error);
        }
    }
    
    // 공정 옵션 로드
    async function loadProcesses(productGroupId) {
        try {
            document.getElementById('spec-process').innerHTML = '<option value="">로딩 중...</option>';
            document.getElementById('spec-process').disabled = true;
            
            const processes = await api.getProcesses(productGroupId);
            
            if (!processes || processes.length === 0) {
                document.getElementById('spec-process').innerHTML = '<option value="">공정 없음</option>';
                document.getElementById('spec-process').disabled = true;
                return;
            }
            
            let options = '<option value="">공정 선택</option>';
            processes.forEach(process => {
                options += `<option value="${process.id}">${process.name}</option>`;
            });
            
            // 공정 드롭다운 업데이트
            document.getElementById('spec-process').innerHTML = options;
            document.getElementById('spec-process').disabled = false;
            
            // 새 타겟 모달의 공정 드롭다운도 업데이트
            if (document.getElementById('new-target-product-group').value === productGroupId) {
                document.getElementById('new-target-process').innerHTML = options;
                document.getElementById('new-target-process').disabled = false;
            }
        } catch (error) {
            console.error('공정 로드 실패:', error);
            document.getElementById('spec-process').innerHTML = '<option value="">오류 발생</option>';
            document.getElementById('spec-process').disabled = true;
        }
    }
    
    // 타겟 옵션 로드
    async function loadTargets(processId) {
        try {
            document.getElementById('spec-target').innerHTML = '<option value="">로딩 중...</option>';
            document.getElementById('spec-target').disabled = true;
            
            const targets = await api.getTargets(processId);
            
            if (!targets || targets.length === 0) {
                document.getElementById('spec-target').innerHTML = '<option value="">타겟 없음</option>';
                document.getElementById('spec-target').disabled = true;
                return;
            }
            
            let options = '<option value="">타겟 선택</option>';
            targets.forEach(target => {
                options += `<option value="${target.id}">${target.name}</option>`;
            });
            
            // 타겟 드롭다운 업데이트
            document.getElementById('spec-target').innerHTML = options;
            document.getElementById('spec-target').disabled = false;
        } catch (error) {
            console.error('타겟 로드 실패:', error);
            document.getElementById('spec-target').innerHTML = '<option value="">오류 발생</option>';
            document.getElementById('spec-target').disabled = true;
        }
    }
    
    // SPEC 정보 로드
    async function loadSpecInfo(targetId) {
        try {
            // 로딩 표시
            document.getElementById('spec-content').innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">로딩 중...</span>
                </div>
                <p class="mt-3">SPEC 정보를 불러오는 중...</p>
            </div>
            `;
            
            // SPEC 정보 가져오기
            const specs = await api.getSpecs(targetId);
            currentSpecs = specs;
            
            if (!specs || specs.length === 0) {
                document.getElementById('spec-content').innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-exclamation-circle fa-2x text-warning mb-3"></i>
                    <p>이 타겟에 설정된 SPEC 정보가 없습니다.</p>
                    <button type="button" class="btn btn-primary mt-3" id="no-spec-add-btn">
                        <i class="fas fa-plus mr-1"></i> 새 SPEC 추가
                    </button>
                </div>
                `;
                
                // 새 SPEC 추가 버튼 이벤트 설정
                document.getElementById('no-spec-add-btn').addEventListener('click', function() {
                    openSpecModal();
                });
                
                return;
            }
            
            // SPEC 목록 표시
            let specListHtml = `
            <div class="table-responsive">
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>LSL</th>
                            <th>USL</th>
                            <th>LCL</th>
                            <th>UCL</th>
                            <th>활성화 상태</th>
                            <th>변경 사유</th>
                            <th>등록일</th>
                            <th>작업</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            specs.forEach(spec => {
                const isActive = spec.is_active;

                specListHtml += `
                <tr>
                    <td>${spec.lsl.toFixed(3)}</td>
                    <td>${spec.usl.toFixed(3)}</td>
                    <td>${spec.lcl.toFixed(3)}</td>
                    <td>${spec.ucl.toFixed(3)}</td>
                    <td>${isActive ? '<span class="badge badge-success">활성</span>' : '<span class="badge badge-secondary">비활성</span>'}</td>
                    <td>${spec.reason || '-'}</td>
                    <td>${new Date(spec.created_at).toLocaleDateString()}</td>
                    <td>
                        <div class="btn-group">
                            <button type="button" class="btn btn-sm btn-info edit-spec-btn" data-id="${spec.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${!isActive ? `
                            <button type="button" class="btn btn-sm btn-success activate-spec-btn" data-id="${spec.id}">
                                <i class="fas fa-check"></i>
                            </button>
                            ` : ''}
                            <button type="button" class="btn btn-sm btn-danger delete-spec-btn" data-id="${spec.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
                `;
            });
            
            specListHtml += `
                    </tbody>
                </table>
            </div>
            `;
            
            document.getElementById('spec-content').innerHTML = specListHtml;
            
            // 버튼 이벤트 설정
            document.querySelectorAll('.edit-spec-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const specId = this.dataset.id;
                    const spec = currentSpecs.find(s => s.id.toString() === specId);
                    if (spec) {
                        openSpecModal(spec);
                    }
                });
            });
            
            document.querySelectorAll('.activate-spec-btn').forEach(button => {
                button.addEventListener('click', async function() {
                    const specId = this.dataset.id;
                    if (confirm('이 SPEC을 활성화하시겠습니까? 다른 SPEC은 자동으로 비활성화됩니다.')) {
                        await activateSpec(specId);
                    }
                });
            });
            
            document.querySelectorAll('.delete-spec-btn').forEach(button => {
                button.addEventListener('click', async function() {
                    const specId = this.dataset.id;
                    const spec = currentSpecs.find(s => s.id.toString() === specId);
                    
                    let confirmMessage = '이 SPEC을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.';
                    if (spec.is_active) {
                        confirmMessage = '경고: 이 SPEC은 현재 활성화되어 있습니다. 삭제하면 이 타겟에 대한 SPEC이 없어질 수 있습니다. 계속하시겠습니까?';
                    }
                    
                    if (confirm(confirmMessage)) {
                        await deleteSpec(specId);
                    }
                });
            });
            
        } catch (error) {
            console.error('SPEC 정보 로드 실패:', error);
            document.getElementById('spec-content').innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle fa-2x text-danger mb-3"></i>
                <p>SPEC 정보를 불러오는 중 오류가 발생했습니다.</p>
            </div>
            `;
        }
    }
    
    // SPEC 모달 열기
    function openSpecModal(spec) {
        // 모달 제목 설정
        if (spec) {
            document.getElementById('spec-modal-title').textContent = 'SPEC 수정';
            isEditMode = true;
            editingSpecId = spec.id;
        } else {
            document.getElementById('spec-modal-title').textContent = '새 SPEC 추가';
            isEditMode = false;
            editingSpecId = null;
        }
        
        // 폼 초기화
        document.getElementById('spec-form').reset();

        // 수정 모드인 경우 기존 값 설정
        if (spec) {
            document.getElementById('spec-lsl').value = spec.lsl;
            document.getElementById('spec-usl').value = spec.usl;
            document.getElementById('spec-lcl').value = spec.lcl;
            document.getElementById('spec-ucl').value = spec.ucl;
            document.getElementById('spec-reason').value = spec.reason || '';
        }

        // 모달 표시
        $('#spec-modal').modal('show');
    }
    
    // SPEC 저장
    async function saveSpec() {
        // 폼 유효성 검사
        const lsl = parseFloat(document.getElementById('spec-lsl').value);
        const usl = parseFloat(document.getElementById('spec-usl').value);
        const lcl = parseFloat(document.getElementById('spec-lcl').value);
        const ucl = parseFloat(document.getElementById('spec-ucl').value);
        const reason = document.getElementById('spec-reason').value;

        if (isNaN(lsl) || isNaN(usl) || isNaN(lcl) || isNaN(ucl)) {
            alert('모든 값을 올바르게 입력하세요.');
            return;
        }

        if (lsl >= usl) {
            alert('LSL은 USL보다 작아야 합니다.');
            return;
        }

        if (lcl >= ucl) {
            alert('LCL은 UCL보다 작아야 합니다.');
            return;
        }

        try {
            // 저장 버튼 비활성화
            document.getElementById('save-spec-btn').disabled = true;
            document.getElementById('save-spec-btn').innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 저장 중...';

            // API 요청 데이터
            const specData = {
                target_id: selectedTargetId,
                lsl: lsl,
                usl: usl,
                lcl: lcl,
                ucl: ucl,
                reason: reason
            };
            
            if (isEditMode && editingSpecId) {
                // 기존 SPEC 수정
                await api.updateSpec(editingSpecId, specData);
            } else {
                // 새 SPEC 추가
                await api.createSpec(specData);
            }

            // SPEC 정보 다시 로드 (모달 닫기 전에 실행)
            await loadSpecInfo(selectedTargetId);

            // 모달 닫기
            $('#spec-modal').modal('hide');

            // 성공 메시지
            alert(isEditMode ? 'SPEC이 성공적으로 수정되었습니다.' : 'SPEC이 성공적으로 추가되었습니다.');
            
        } catch (error) {
            console.error('SPEC 저장 실패:', error);
            alert('SPEC 저장 중 오류가 발생했습니다.');
        } finally {
            // 저장 버튼 초기화
            document.getElementById('save-spec-btn').disabled = false;
            document.getElementById('save-spec-btn').innerHTML = '저장';
        }
    }
    
    // SPEC 활성화
    async function activateSpec(specId) {
        try {
            // API 호출
            await api.activateSpec(specId);
            
            // SPEC 정보 다시 로드
            await loadSpecInfo(selectedTargetId);
            
            // 성공 메시지
            alert('SPEC이 성공적으로 활성화되었습니다.');
            
        } catch (error) {
            console.error('SPEC 활성화 실패:', error);
            alert('SPEC 활성화 중 오류가 발생했습니다.');
        }
    }
    
    // SPEC 삭제
    async function deleteSpec(specId) {
        try {
            // API 호출
            await api.deleteSpec(specId);
            
            // SPEC 정보 다시 로드
            await loadSpecInfo(selectedTargetId);
            
            // 성공 메시지
            alert('SPEC이 성공적으로 삭제되었습니다.');
            
        } catch (error) {
            console.error('SPEC 삭제 실패:', error);
            alert('SPEC 삭제 중 오류가 발생했습니다.');
        }
    }
    
    // 새 타겟 저장
    async function saveTarget() {
        // 폼 유효성 검사
        const processId = document.getElementById('new-target-process').value;
        const name = document.getElementById('new-target-name').value.trim();
        const description = document.getElementById('new-target-description').value.trim();
        
        if (!processId || !name) {
            alert('공정과 타겟 이름을 입력해 주세요.');
            return;
        }
        
        try {
            // 저장 버튼 비활성화
            document.getElementById('save-target-btn').disabled = true;
            document.getElementById('save-target-btn').innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 저장 중...';
            
            // API 요청 데이터
            const targetData = {
                process_id: parseInt(processId),
                name: name,
                description: description || null
            };
            
            // 새 타겟 추가
            const newTarget = await api.createTarget(targetData);
            
            // 모달 닫기
            $('#target-modal').modal('hide');
            
            // 타겟 목록 다시 로드
            await loadTargets(processId);
            
            // 새로 생성된 타겟 선택
            document.getElementById('spec-target').value = newTarget.id;
            selectedTargetId = newTarget.id;
            
            // SPEC 정보 로드 (비어있을 것으로 예상)
            await loadSpecInfo(newTarget.id);
            
            // 성공 메시지
            alert('타겟이 성공적으로 추가되었습니다. 이제 이 타겟에 대한 SPEC을 설정할 수 있습니다.');
            
        } catch (error) {
            console.error('타겟 저장 실패:', error);
            alert('타겟 저장 중 오류가 발생했습니다.');
        } finally {
            // 저장 버튼 초기화
            document.getElementById('save-target-btn').disabled = false;
            document.getElementById('save-target-btn').innerHTML = '저장';
        }
    }
    // 타겟 삭제
    async function deleteTarget(targetId) {
        // 삭제 전 확인
        const confirmMessage = '이 타겟을 삭제하시겠습니까? 이 타겟에 연결된 모든 SPEC 및 측정 데이터도 삭제됩니다.';
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        try {
            // API 호출
            await api.deleteTarget(targetId);
            
            // 타겟 목록 다시 로드
            await loadTargets(selectedProcessId);
            
            // 선택 초기화
            selectedTargetId = null;
            document.getElementById('spec-target').value = '';
            
            // SPEC 내용 초기화
            document.getElementById('spec-content').innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-info-circle fa-2x text-info mb-3"></i>
                <p>타겟을 선택하면 해당 타겟의 SPEC 정보가 여기에 표시됩니다.</p>
            </div>
            `;
            
            // 타겟 삭제 버튼 비활성화
            document.getElementById('delete-target-btn').disabled = true;
            
            // 성공 메시지
            alert('타겟이 성공적으로 삭제되었습니다.');
            
        } catch (error) {
            console.error('타겟 삭제 실패:', error);
            alert('타겟 삭제 중 오류가 발생했습니다. 해당 타겟에 연결된 측정 데이터가 있을 수 있습니다.');
        }
    }

    // 이벤트 리스너 설정
    function setupEventListeners() {
        // 제품군 선택 변경 이벤트
        document.getElementById('spec-product-group').addEventListener('change', function() {
            selectedProductGroupId = this.value;
            selectedProcessId = null;
            selectedTargetId = null;
            
            if (selectedProductGroupId) {
                loadProcesses(selectedProductGroupId);
            } else {
                document.getElementById('spec-process').innerHTML = '<option value="">공정 선택</option>';
                document.getElementById('spec-process').disabled = true;
                document.getElementById('spec-target').innerHTML = '<option value="">타겟 선택</option>';
                document.getElementById('spec-target').disabled = true;
            }
            
            // SPEC 내용 초기화
            document.getElementById('spec-content').innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-info-circle fa-2x text-info mb-3"></i>
                <p>타겟을 선택하면 해당 타겟의 SPEC 정보가 여기에 표시됩니다.</p>
            </div>
            `;
        });
        
        // 공정 선택 변경 이벤트
        document.getElementById('spec-process').addEventListener('change', function() {
            selectedProcessId = this.value;
            selectedTargetId = null;
            
            if (selectedProcessId) {
                loadTargets(selectedProcessId);
            } else {
                document.getElementById('spec-target').innerHTML = '<option value="">타겟 선택</option>';
                document.getElementById('spec-target').disabled = true;
            }
            
            // SPEC 내용 초기화
            document.getElementById('spec-content').innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-info-circle fa-2x text-info mb-3"></i>
                <p>타겟을 선택하면 해당 타겟의 SPEC 정보가 여기에 표시됩니다.</p>
            </div>
            `;
        });
        
        // 타겟 선택 변경 이벤트
        document.getElementById('spec-target').addEventListener('change', function() {
            selectedTargetId = this.value;
            
            // 타겟 삭제 버튼 상태 업데이트
            const deleteTargetBtn = document.getElementById('delete-target-btn');
            if (selectedTargetId) {
                deleteTargetBtn.disabled = false;
            } else {
                deleteTargetBtn.disabled = true;
            }
            
            if (selectedTargetId) {
                loadSpecInfo(selectedTargetId);
            } else {
                // SPEC 내용 초기화
                document.getElementById('spec-content').innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-info-circle fa-2x text-info mb-3"></i>
                    <p>타겟을 선택하면 해당 타겟의 SPEC 정보가 여기에 표시됩니다.</p>
                </div>
                `;
            }
        });
        
        // SPEC 추가 버튼 클릭 이벤트
        document.getElementById('add-spec-btn').addEventListener('click', function() {
            if (!selectedTargetId) {
                alert('먼저 타겟을 선택해 주세요.');
                return;
            }
            
            openSpecModal();
        });
        
        // SPEC 저장 버튼 클릭 이벤트
        document.getElementById('save-spec-btn').addEventListener('click', function() {
            saveSpec();
        });
        
        // SPEC 모달 폼 제출 이벤트 (엔터 키)
        document.getElementById('spec-form').addEventListener('submit', function(e) {
            e.preventDefault();
            saveSpec();
        });
        
        // 타겟 추가 버튼 클릭 이벤트
        document.getElementById('add-target-btn').addEventListener('click', function() {
            // 제품군 선택 확인
            if (!selectedProductGroupId) {
                alert('먼저 제품군을 선택해 주세요.');
                return;
            }
            
            // 공정 선택 확인
            if (!selectedProcessId) {
                alert('먼저 공정을 선택해 주세요.');
                return;
            }
            
            // 새 타겟 모달의 제품군과 공정 선택 드롭다운 설정
            document.getElementById('new-target-product-group').value = selectedProductGroupId;
            
            // 공정 드롭다운 업데이트
            loadProcesses(selectedProductGroupId).then(() => {
                document.getElementById('new-target-process').value = selectedProcessId;
                
                // 모달 폼 초기화
                document.getElementById('target-form').reset();
                
                // 모달 표시
                $('#target-modal').modal('show');
            });
        });
        
        // 새 타겟 모달 제품군 선택 변경 이벤트
        document.getElementById('new-target-product-group').addEventListener('change', function() {
            const productGroupId = this.value;
            
            if (productGroupId) {
                loadProcesses(productGroupId);
            } else {
                document.getElementById('new-target-process').innerHTML = '<option value="">공정 선택</option>';
                document.getElementById('new-target-process').disabled = true;
            }
        });
        
        // 타겟 저장 버튼 클릭 이벤트
        document.getElementById('save-target-btn').addEventListener('click', function() {
            saveTarget();
        });
        
        // 타겟 모달 폼 제출 이벤트 (엔터 키)
        document.getElementById('target-form').addEventListener('submit', function(e) {
            e.preventDefault();
            saveTarget();
        });
        
        // 타겟 삭제 버튼 클릭 이벤트
        document.getElementById('delete-target-btn').addEventListener('click', function() {
            if (!selectedTargetId) {
                alert('삭제할 타겟을 선택해 주세요.');
                return;
            }
            
            deleteTarget(selectedTargetId);
        });
    }

    // 제품군 및 공정 관리 기능

    // 전역 변수
    let editingProductGroupId = null;
    let editingProcessId = null;
    let selectedProductGroupForProcess = null;

    // 제품군 목록 로드
    async function loadProductGroupList() {
        try {
            const productGroups = await api.getProductGroups();
            
            if (!productGroups || productGroups.length === 0) {
                document.getElementById('product-group-list').innerHTML = '<tr><td colspan="3" class="text-center">제품군 정보가 없습니다.</td></tr>';
                return;
            }
            
            let tableHtml = '';
            productGroups.forEach(pg => {
                tableHtml += `
                <tr>
                    <td>${pg.name}</td>
                    <td>${pg.description || '-'}</td>
                    <td>
                        <div class="btn-group">
                            <button type="button" class="btn btn-sm btn-info edit-product-group-btn" data-id="${pg.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-danger delete-product-group-btn" data-id="${pg.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
                `;
            });
            
            document.getElementById('product-group-list').innerHTML = tableHtml;
            
            // 버튼 이벤트 설정
            document.querySelectorAll('.edit-product-group-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const productGroupId = this.dataset.id;
                    const productGroup = productGroups.find(pg => pg.id.toString() === productGroupId);
                    if (productGroup) {
                        openProductGroupModal(productGroup);
                    }
                });
            });
            
            document.querySelectorAll('.delete-product-group-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const productGroupId = this.dataset.id;
                    const productGroup = productGroups.find(pg => pg.id.toString() === productGroupId);
                    if (productGroup) {
                        deleteProductGroup(productGroup.id, productGroup.name);
                    }
                });
            });
            
            // 제품군 필터 드롭다운 업데이트
            updateProductGroupFilter(productGroups);
            
            // 공정 모달의 제품군 드롭다운 업데이트
            updateProcessModalProductGroups(productGroups);
            
        } catch (error) {
            console.error('제품군 목록 로드 실패:', error);
            document.getElementById('product-group-list').innerHTML = '<tr><td colspan="3" class="text-center text-danger">제품군 정보를 불러오는 중 오류가 발생했습니다.</td></tr>';
        }
    }

    // 제품군 필터 드롭다운 업데이트
    function updateProductGroupFilter(productGroups) {
        const filterSelect = document.getElementById('product-group-filter');
        
        let options = '<option value="">제품군 선택</option>';
        if (productGroups && productGroups.length > 0) {
            productGroups.forEach(pg => {
                options += `<option value="${pg.id}">${pg.name}</option>`;
            });
        }
        
        filterSelect.innerHTML = options;
    }

    // 공정 모달의 제품군 드롭다운 업데이트
    function updateProcessModalProductGroups(productGroups) {
        const processProductGroupSelect = document.getElementById('process-product-group');
        
        let options = '<option value="">제품군 선택</option>';
        if (productGroups && productGroups.length > 0) {
            productGroups.forEach(pg => {
                options += `<option value="${pg.id}">${pg.name}</option>`;
            });
        }
        
        processProductGroupSelect.innerHTML = options;
    }

    // 제품군 모달 열기
    function openProductGroupModal(productGroup = null) {
        // 모달 제목 설정
        if (productGroup) {
            document.getElementById('product-group-modal-title').textContent = '제품군 수정';
            editingProductGroupId = productGroup.id;
        } else {
            document.getElementById('product-group-modal-title').textContent = '새 제품군 추가';
            editingProductGroupId = null;
        }
        
        // 폼 초기화
        document.getElementById('product-group-form').reset();
        
        // 수정 모드인 경우 기존 값 설정
        if (productGroup) {
            document.getElementById('product-group-id').value = productGroup.id;
            document.getElementById('product-group-name').value = productGroup.name;
            document.getElementById('product-group-description').value = productGroup.description || '';
        }
        
        // 모달 표시
        $('#product-group-modal').modal('show');
    }

    // 제품군 저장
    async function saveProductGroup() {
        // 폼 유효성 검사
        const name = document.getElementById('product-group-name').value.trim();
        const description = document.getElementById('product-group-description').value.trim();
        
        if (!name) {
            alert('제품군 이름을 입력해 주세요.');
            return;
        }
        
        try {
            // 저장 버튼 비활성화
            document.getElementById('save-product-group-btn').disabled = true;
            document.getElementById('save-product-group-btn').innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 저장 중...';
            
            // API 요청 데이터
            const productGroupData = {
                name: name,
                description: description || null
            };
            
            if (editingProductGroupId) {
                // 기존 제품군 수정
                await api.updateProductGroup(editingProductGroupId, productGroupData);
            } else {
                // 새 제품군 추가
                await api.createProductGroup(productGroupData);
            }
            
            // 모달 닫기
            $('#product-group-modal').modal('hide');
            
            // 제품군 목록 다시 로드
            await loadProductGroupList();
            
            // 성공 메시지
            alert(editingProductGroupId ? '제품군이 성공적으로 수정되었습니다.' : '제품군이 성공적으로 추가되었습니다.');
            
        } catch (error) {
            console.error('제품군 저장 실패:', error);
            alert('제품군 저장 중 오류가 발생했습니다.');
        } finally {
            // 저장 버튼 초기화
            document.getElementById('save-product-group-btn').disabled = false;
            document.getElementById('save-product-group-btn').innerHTML = '저장';
        }
    }

    // 제품군 삭제
    async function deleteProductGroup(productGroupId, productGroupName) {
        // 삭제 전 확인
        const confirmMessage = `제품군 "${productGroupName}"을(를) 삭제하시겠습니까? 이 제품군에 연결된 모든 공정, 타겟, SPEC, 측정 데이터도 삭제됩니다.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        try {
            // API 호출
            await api.deleteProductGroup(productGroupId);
            
            // 제품군 목록 다시 로드
            await loadProductGroupList();
            
            // 공정 목록 초기화
            document.getElementById('process-list').innerHTML = '<tr><td colspan="3" class="text-center">제품군을 선택하세요</td></tr>';
            
            // 성공 메시지
            alert('제품군이 성공적으로 삭제되었습니다.');
            
        } catch (error) {
            console.error('제품군 삭제 실패:', error);
            alert('제품군 삭제 중 오류가 발생했습니다. 해당 제품군에 연결된 공정이 있을 수 있습니다.');
        }
    }

    // 공정 목록 로드
    async function loadProcessList(productGroupId) {
        try {
            // 선택된 제품군 ID 저장
            selectedProductGroupForProcess = productGroupId;
            
            // 새 공정 추가 버튼 활성화/비활성화
            document.getElementById('add-process-btn').disabled = !productGroupId;
            
            if (!productGroupId) {
                document.getElementById('process-list').innerHTML = '<tr><td colspan="3" class="text-center">제품군을 선택하세요</td></tr>';
                return;
            }
            
            // 로딩 표시
            document.getElementById('process-list').innerHTML = '<tr><td colspan="3" class="text-center">로딩 중...</td></tr>';
            
            const processes = await api.getProcesses(productGroupId);
            
            if (!processes || processes.length === 0) {
                document.getElementById('process-list').innerHTML = '<tr><td colspan="3" class="text-center">이 제품군에 공정 정보가 없습니다.</td></tr>';
                return;
            }
            
            let tableHtml = '';
            processes.forEach(process => {
                tableHtml += `
                <tr>
                    <td>${process.name}</td>
                    <td>${process.description || '-'}</td>
                    <td>
                        <div class="btn-group">
                            <button type="button" class="btn btn-sm btn-info edit-process-btn" data-id="${process.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-danger delete-process-btn" data-id="${process.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
                `;
            });
            
            document.getElementById('process-list').innerHTML = tableHtml;
            
            // 버튼 이벤트 설정
            document.querySelectorAll('.edit-process-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const processId = this.dataset.id;
                    const process = processes.find(p => p.id.toString() === processId);
                    if (process) {
                        openProcessModal(process);
                    }
                });
            });
            
            document.querySelectorAll('.delete-process-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const processId = this.dataset.id;
                    const process = processes.find(p => p.id.toString() === processId);
                    if (process) {
                        deleteProcess(process.id, process.name);
                    }
                });
            });
            
        } catch (error) {
            console.error('공정 목록 로드 실패:', error);
            document.getElementById('process-list').innerHTML = '<tr><td colspan="3" class="text-center text-danger">공정 정보를 불러오는 중 오류가 발생했습니다.</td></tr>';
        }
    }

    // 공정 모달 열기
    function openProcessModal(process = null) {
        // 모달 제목 설정
        if (process) {
            document.getElementById('process-modal-title').textContent = '공정 수정';
            editingProcessId = process.id;
        } else {
            document.getElementById('process-modal-title').textContent = '새 공정 추가';
            editingProcessId = null;
        }
        
        // 폼 초기화
        document.getElementById('process-form').reset();
        
        // 수정 모드인 경우 기존 값 설정
        if (process) {
            document.getElementById('process-id').value = process.id;
            document.getElementById('process-product-group').value = process.product_group_id;
            document.getElementById('process-name').value = process.name;
            document.getElementById('process-description').value = process.description || '';
        } else if (selectedProductGroupForProcess) {
            // 새 공정 추가 시 현재 선택된 제품군 설정
            document.getElementById('process-product-group').value = selectedProductGroupForProcess;
        }
        
        // 모달 표시
        $('#process-modal').modal('show');
    }

    // 공정 저장
    async function saveProcess() {
        // 폼 유효성 검사
        const productGroupId = document.getElementById('process-product-group').value;
        const name = document.getElementById('process-name').value.trim();
        const description = document.getElementById('process-description').value.trim();
        
        if (!productGroupId || !name) {
            alert('제품군과 공정 이름을 입력해 주세요.');
            return;
        }
        
        try {
            // 저장 버튼 비활성화
            document.getElementById('save-process-btn').disabled = true;
            document.getElementById('save-process-btn').innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 저장 중...';
            
            // API 요청 데이터
            const processData = {
                product_group_id: parseInt(productGroupId),
                name: name,
                description: description || null
            };
            
            if (editingProcessId) {
                // 기존 공정 수정
                await api.updateProcess(editingProcessId, processData);
            } else {
                // 새 공정 추가
                await api.createProcess(processData);
            }
            
            // 모달 닫기
            $('#process-modal').modal('hide');
            
            // 공정 목록 다시 로드
            await loadProcessList(productGroupId);
            
            // 성공 메시지
            alert(editingProcessId ? '공정이 성공적으로 수정되었습니다.' : '공정이 성공적으로 추가되었습니다.');
            
        } catch (error) {
            console.error('공정 저장 실패:', error);
            alert('공정 저장 중 오류가 발생했습니다.');
        } finally {
            // 저장 버튼 초기화
            document.getElementById('save-process-btn').disabled = false;
            document.getElementById('save-process-btn').innerHTML = '저장';
        }
    }

    // 공정 삭제
    async function deleteProcess(processId, processName) {
        // 삭제 전 확인
        const confirmMessage = `공정 "${processName}"을(를) 삭제하시겠습니까? 이 공정에 연결된 모든 타겟, SPEC, 측정 데이터도 삭제됩니다.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        try {
            // API 호출
            await api.deleteProcess(processId);
            
            // 공정 목록 다시 로드
            await loadProcessList(selectedProductGroupForProcess);
            
            // 성공 메시지
            alert('공정이 성공적으로 삭제되었습니다.');
            
        } catch (error) {
            console.error('공정 삭제 실패:', error);
            alert('공정 삭제 중 오류가 발생했습니다. 해당 공정에 연결된 타겟이 있을 수 있습니다.');
        }
    }

// 장비 관리 초기화
async function initEquipmentManagement() {
    // 장비 목록 로드
    await loadEquipments();
    
    // 이벤트 리스너 설정
    document.getElementById('add-equipment-btn').addEventListener('click', () => {
        openEquipmentModal();
    });
    
    document.getElementById('save-equipment-btn').addEventListener('click', saveEquipment);
}

// 장비 목록 로드
async function loadEquipments(typeId = '') {
    try {
        // 타입 필터 제거 - 모든 장비 가져오기
        let url = `${API_CONFIG.BASE_URL}/equipments`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('장비 정보를 불러오는 데 실패했습니다.');
        }
        
        const equipments = await response.json();
        
        // 장비 테이블 업데이트
        updateEquipmentTable(equipments);
        
        return equipments;
    } catch (error) {
        console.error('장비 로드 실패:', error);
        document.getElementById('equipment-list').innerHTML = 
            '<tr><td colspan="5" class="text-danger">장비 정보를 불러오는 중 오류가 발생했습니다.</td></tr>';
        return [];
    }
}

// 장비 테이블 업데이트
function updateEquipmentTable(equipments) {
    const tableBody = document.getElementById('equipment-list');
    
    if (!equipments || equipments.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">등록된 장비가 없습니다.</td></tr>';
        return;
    }
    
    let html = '';
    equipments.forEach(equipment => {
        html += `
        <tr>
            <td>${equipment.name}</td>
            <td>${equipment.type}</td>
            <td>${equipment.description || ''}</td>
            <td>
                <span class="badge badge-${equipment.is_active ? 'success' : 'secondary'}">
                    ${equipment.is_active ? '활성' : '비활성'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-info edit-equipment-btn" data-id="${equipment.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-equipment-btn" data-id="${equipment.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    
    // 편집 버튼 이벤트
    document.querySelectorAll('.edit-equipment-btn').forEach(button => {
        button.addEventListener('click', function() {
            const equipmentId = this.dataset.id;
            const equipment = equipments.find(e => e.id == equipmentId);
            if (equipment) {
                openEquipmentModal(equipment);
            }
        });
    });
    
    // 삭제 버튼 이벤트
    document.querySelectorAll('.delete-equipment-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const equipmentId = this.dataset.id;
            const equipment = equipments.find(e => e.id == equipmentId);
            if (equipment && confirm(`정말 "${equipment.name}" 장비를 삭제하시겠습니까?`)) {
                await deleteEquipment(equipmentId);
            }
        });
    });
}

// 장비 모달 열기
function openEquipmentModal(equipment = null) {
    // 모달 타이틀 설정
    document.getElementById('equipment-modal-title').textContent = 
        equipment ? '장비 편집' : '새 장비 추가';
    
    // 폼 필드 초기화
    document.getElementById('equipment-id').value = equipment ? equipment.id : '';
    document.getElementById('equipment-name').value = equipment ? equipment.name : '';
    document.getElementById('equipment-description').value = equipment ? equipment.description || '' : '';
    document.getElementById('equipment-active').checked = equipment ? equipment.is_active : true;
    
    // 장비 타입 설정
    const typeSelect = document.getElementById('equipment-type');
    if (equipment && equipment.type) {
        typeSelect.value = equipment.type;
    } else {
        typeSelect.selectedIndex = 0;
    }
    
    // 모달 표시
    $('#equipment-modal').modal('show');
}

// 장비 저장
async function saveEquipment() {
    const equipmentId = document.getElementById('equipment-id').value;
    const equipmentName = document.getElementById('equipment-name').value;
    const equipmentType = document.getElementById('equipment-type').value;
    const equipmentDesc = document.getElementById('equipment-description').value;
    const isActive = document.getElementById('equipment-active').checked;
    
    if (!equipmentName.trim()) {
        alert('장비 이름을 입력하세요.');
        return;
    }
    
    if (!equipmentType) {
        alert('장비 타입을 선택하세요.');
        return;
    }
    
    try {
        const data = {
            name: equipmentName,
            type: equipmentType, // 서버에서는 type_id로 처리
            description: equipmentDesc,
            is_active: isActive
        };
        
        let response;
		if (equipmentId) {
            // 기존 장비 수정
			response = await fetch(`${API_CONFIG.BASE_URL}/equipments/${equipmentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } else {
            // 새 장비 추가
			response = await fetch(`${API_CONFIG.BASE_URL}/equipments/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        }
        
		if (!response.ok) {
			let msg = '장비 저장에 실패했습니다.';
			try {
				const err = await response.json();
				if (err && err.detail) msg += `\n서버 메시지: ${err.detail}`;
			} catch (_) {}
			throw new Error(msg);
		}
        
        // 성공 메시지
        alert(equipmentId ? '장비가 수정되었습니다.' : '새 장비가 추가되었습니다.');
        
        // 모달 닫기
        $('#equipment-modal').modal('hide');
        
        // 장비 목록 새로고침
        await loadEquipments();
        
        // PR Thickness 페이지가 열려있으면 장비 목록 새로고침 알림
        notifyPrThicknessPageUpdate();
        
	} catch (error) {
		console.error('장비 저장 실패:', error);
		alert(error.message || '장비 저장 중 오류가 발생했습니다.');
	}
}

// 장비 삭제
async function deleteEquipment(equipmentId) {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/equipments/${equipmentId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('장비 삭제에 실패했습니다.');
        }
        
        // 성공 메시지
        alert('장비가 삭제되었습니다.');
        
        // 장비 목록 새로고침
        await loadEquipments();
        
        // PR Thickness 페이지가 열려있으면 장비 목록 새로고침 알림
        notifyPrThicknessPageUpdate();
        
    } catch (error) {
        console.error('장비 삭제 실패:', error);
        alert('장비 삭제 중 오류가 발생했습니다.');
    }
}

// PR Thickness 페이지 업데이트 알림 함수
function notifyPrThicknessPageUpdate() {
    // localStorage를 통해 다른 탭/창에 알림
    localStorage.setItem('equipmentUpdated', Date.now().toString());
    
    console.log('장비 목록이 업데이트되었습니다. PR Thickness 페이지를 새로고침해주세요.');
}



    // 제품군 및 공정 관리 탭 이벤트 설정
    function setupProductProcessEvents() {
        // 제품군 추가 버튼 클릭 이벤트
        document.getElementById('add-product-group-btn').addEventListener('click', function() {
            openProductGroupModal();
        });
        
        // 제품군 저장 버튼 클릭 이벤트
        document.getElementById('save-product-group-btn').addEventListener('click', function() {
            saveProductGroup();
        });
        
        // 제품군 모달 폼 제출 이벤트 (엔터 키)
        document.getElementById('product-group-form').addEventListener('submit', function(e) {
            e.preventDefault();
            saveProductGroup();
        });
        
        // 제품군 필터 변경 이벤트
        document.getElementById('product-group-filter').addEventListener('change', function() {
            const productGroupId = this.value;
            loadProcessList(productGroupId);
        });
        
        // 공정 추가 버튼 클릭 이벤트
        document.getElementById('add-process-btn').addEventListener('click', function() {
            if (!selectedProductGroupForProcess) {
                alert('먼저 제품군을 선택해 주세요.');
                return;
            }
            
            openProcessModal();
        });
        
        // 공정 저장 버튼 클릭 이벤트
        document.getElementById('save-process-btn').addEventListener('click', function() {
            saveProcess();
        });
        
        // 공정 모달 폼 제출 이벤트 (엔터 키)
        document.getElementById('process-form').addEventListener('submit', function(e) {
            e.preventDefault();
            saveProcess();
        });
        
        // 제품군/공정 탭이 활성화될 때 데이터 로드
        $('a[data-toggle="tab"][href="#product-process-settings"]').on('shown.bs.tab', function(e) {
            loadProductGroupList();
        });
    }
    
    // 탭 활성화 이벤트 설정
    function setupTabEvents() {
        // 장비 관리 탭이 활성화될 때 장비 목록 로드
        $('a[data-toggle="tab"][href="#equipment-settings"]').on('shown.bs.tab', function(e) {
            console.log('장비 관리 탭이 활성화되었습니다.');
            loadEquipments();
        });
    }
    
    // 페이지 로드 시 초기화
    document.addEventListener('DOMContentLoaded', initSettingsPage);
})();