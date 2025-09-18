// 데이터 입력 페이지 모듈
(function() {
    // 전역 변수
    let selectedProductGroupId = null;
    let selectedProcessId = null;
    let selectedTargetId = null;
    let currentSpec = null;
    
    // 페이지 초기화
    async function initInputPage() {
        // 제품군 버튼 로드
        await loadProductGroups();
        
        // 장비 목록 로드
        await loadEquipments();
        
        // 이벤트 리스너 설정
        setupEventListeners();
    }
    
    // 제품군 버튼 로드
    async function loadProductGroups() {
        try {
            const productGroups = await api.getProductGroups();
            
            if (!productGroups || productGroups.length === 0) {
                document.getElementById('product-group-buttons').innerHTML = '<p class="text-danger">제품군 정보가 없습니다.</p>';
                return;
            }
            
            let buttonsHtml = '';
            productGroups.forEach(productGroup => {
                buttonsHtml += `
                <button type="button" class="btn btn-outline-primary product-group-btn" data-id="${productGroup.id}">
                    ${productGroup.name}
                </button>
                `;
            });
            
            document.getElementById('product-group-buttons').innerHTML = buttonsHtml;
            
            // 제품군 버튼 클릭 이벤트 설정
            document.querySelectorAll('.product-group-btn').forEach(button => {
                button.addEventListener('click', function() {
                    // 이전 선택 초기화
                    document.querySelectorAll('.product-group-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // 현재 버튼 활성화
                    this.classList.add('active');
                    
                    // 선택된 제품군 ID 저장
                    selectedProductGroupId = this.dataset.id;
                    
                    // 공정 버튼 로드
                    loadProcesses(selectedProductGroupId);
                    
                    // 타겟 선택 초기화
                    document.getElementById('target-buttons').innerHTML = '<p class="text-muted">공정을 먼저 선택하세요.</p>';
                    selectedTargetId = null;
                    
                    // SPEC 정보 초기화
                    resetSpecInfo();
                });
            });
            
        } catch (error) {
            console.error('제품군 로드 실패:', error);
            document.getElementById('product-group-buttons').innerHTML = '<p class="text-danger">제품군 정보를 불러오는 중 오류가 발생했습니다.</p>';
        }
    }
    
    // 공정 버튼 로드
    async function loadProcesses(productGroupId) {
        try {
            // 버튼 영역 로딩 표시
            document.getElementById('process-buttons').innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">로딩 중...</span>
                </div>
            </div>
            `;
            
            const processes = await api.getProcesses(productGroupId);
            
            if (!processes || processes.length === 0) {
                document.getElementById('process-buttons').innerHTML = '<p class="text-danger">해당 제품군에 공정 정보가 없습니다.</p>';
                return;
            }
            
            let buttonsHtml = '';
            processes.forEach(process => {
                buttonsHtml += `
                <button type="button" class="btn btn-outline-info process-btn" data-id="${process.id}">
                    ${process.name}
                </button>
                `;
            });
            
            document.getElementById('process-buttons').innerHTML = buttonsHtml;
            
            // 공정 버튼 클릭 이벤트 설정
            document.querySelectorAll('.process-btn').forEach(button => {
                button.addEventListener('click', function() {
                    // 이전 선택 초기화
                    document.querySelectorAll('.process-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // 현재 버튼 활성화
                    this.classList.add('active');
                    
                    // 선택된 공정 ID 저장
                    selectedProcessId = this.dataset.id;
                    
                    // 타겟 버튼 로드
                    loadTargets(selectedProcessId);
                    
                    // SPEC 정보 초기화
                    resetSpecInfo();
                });
            });
            
        } catch (error) {
            console.error('공정 로드 실패:', error);
            document.getElementById('process-buttons').innerHTML = '<p class="text-danger">공정 정보를 불러오는 중 오류가 발생했습니다.</p>';
        }
    }
    
    // 타겟 버튼 로드
    async function loadTargets(processId) {
        try {
            // 버튼 영역 로딩 표시
            document.getElementById('target-buttons').innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">로딩 중...</span>
                </div>
            </div>
            `;
            
            const targets = await api.getTargets(processId);
            
            if (!targets || targets.length === 0) {
                document.getElementById('target-buttons').innerHTML = '<p class="text-danger">해당 공정에 타겟 정보가 없습니다.</p>';
                return;
            }
            
            let buttonsHtml = '';
            targets.forEach(target => {
                buttonsHtml += `
                <button type="button" class="btn btn-outline-success target-btn" data-id="${target.id}">
                    ${target.name}
                </button>
                `;
            });
            
            document.getElementById('target-buttons').innerHTML = buttonsHtml;
            
            // 타겟 버튼 클릭 이벤트 설정
            document.querySelectorAll('.target-btn').forEach(button => {
                button.addEventListener('click', function() {
                    // 이전 선택 초기화
                    document.querySelectorAll('.target-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // 현재 버튼 활성화
                    this.classList.add('active');
                    
                    // 선택된 타겟 ID 저장
                    selectedTargetId = this.dataset.id;
                    
                    // SPEC 정보 로드
                    loadSpecInfo(selectedTargetId);
                });
            });
            
        } catch (error) {
            console.error('타겟 로드 실패:', error);
            document.getElementById('target-buttons').innerHTML = '<p class="text-danger">타겟 정보를 불러오는 중 오류가 발생했습니다.</p>';
        }
    }
    
    // SPEC 정보 로드
    async function loadSpecInfo(targetId) {
        try {
            // SPEC 영역 로딩 표시
            document.getElementById('spec-info').innerHTML = `
            <i class="fas fa-spinner fa-spin mr-1"></i> SPEC 정보를 불러오는 중...
            `;
            
            // 활성 SPEC 정보 가져오기
            try {
                currentSpec = await api.getActiveSpec(targetId);
                
                if (currentSpec) {
                    document.getElementById('spec-info').innerHTML = `
                    <i class="fas fa-info-circle mr-1"></i> SPEC 정보: LSL = ${currentSpec.lsl.toFixed(3)}, USL = ${currentSpec.usl.toFixed(3)}
                    <br>
                    <small class="text-muted">타겟에 대한 활성 SPEC이 설정되어 있습니다. 측정값이 SPEC 범위를 벗어나면 경고가 표시됩니다.</small>
                    `;
                    document.getElementById('spec-info').classList.remove('alert-info', 'alert-danger');
                    document.getElementById('spec-info').classList.add('alert-success');
                } else {
                    document.getElementById('spec-info').innerHTML = `
                    <i class="fas fa-exclamation-triangle mr-1"></i> 이 타겟에 설정된 SPEC 정보가 없습니다.
                    <br>
                    <small class="text-muted">SPEC 설정 없이 측정 데이터를 입력할 수 있지만, SPEC 검사가 수행되지 않습니다.</small>
                    `;
                    document.getElementById('spec-info').classList.remove('alert-info', 'alert-success');
                    document.getElementById('spec-info').classList.add('alert-warning');
                    currentSpec = null;
                }
            } catch (error) {
                console.warn(`타겟 ID ${targetId}에 대한 활성 SPEC이 없습니다.`);
                document.getElementById('spec-info').innerHTML = `
                <i class="fas fa-exclamation-triangle mr-1"></i> 이 타겟에 설정된 SPEC 정보가 없습니다.
                <br>
                <small class="text-muted">SPEC 설정 없이 측정 데이터를 입력할 수 있지만, SPEC 검사가 수행되지 않습니다.</small>
                `;
                document.getElementById('spec-info').classList.remove('alert-info', 'alert-success');
                document.getElementById('spec-info').classList.add('alert-warning');
                currentSpec = null;
            }
            
        } catch (error) {
            console.error('SPEC 정보 로드 실패:', error);
            document.getElementById('spec-info').innerHTML = `
            <i class="fas fa-exclamation-circle mr-1"></i> SPEC 정보를 불러오는 중 오류가 발생했습니다.
            `;
            document.getElementById('spec-info').classList.remove('alert-info', 'alert-success', 'alert-warning');
            document.getElementById('spec-info').classList.add('alert-danger');
            currentSpec = null;
        }
    }
    
    // SPEC 정보 초기화
    function resetSpecInfo() {
        document.getElementById('spec-info').innerHTML = `
        <i class="fas fa-info-circle mr-1"></i> 제품군, 공정, 타겟을 선택하면 SPEC 정보가 표시됩니다.
        `;
        document.getElementById('spec-info').classList.remove('alert-success', 'alert-danger', 'alert-warning');
        document.getElementById('spec-info').classList.add('alert-info');
        currentSpec = null;
    }
    
    // 장비 목록 로드
    async function loadEquipments() {
        try {
            // DOM에 장비 컨테이너가 존재하는지 확인
            const coatingContainer = document.getElementById('coating-equipment-buttons');
            const exposureContainer = document.getElementById('exposure-equipment-buttons');
            const developmentContainer = document.getElementById('development-equipment-buttons');
            
            // API 호출
            const response = await fetch(`${API_CONFIG.BASE_URL}/equipments`);
            
            let equipments = [];
            if (response.ok) {
                equipments = await response.json();
            } else {
                throw new Error('장비 정보를 가져오는데 실패했습니다.');
            }
            
            // 활성화된 장비만 필터링
            const activeEquipments = equipments.filter(eq => eq.is_active);
            
            // 코팅 장비 처리
            if (coatingContainer) {
                const coatingEquipments = activeEquipments.filter(eq => eq.type === "코팅");
                renderEquipmentGrid(coatingContainer, coatingEquipments);
            }
            
            // 노광 장비 처리
            if (exposureContainer) {
                const exposureEquipments = activeEquipments.filter(eq => eq.type === "노광");
                renderEquipmentGrid(exposureContainer, exposureEquipments);
            }
            
            // 현상 장비 처리
            if (developmentContainer) {
                const developmentEquipments = activeEquipments.filter(eq => eq.type === "현상");
                renderEquipmentGrid(developmentContainer, developmentEquipments);
            }
            
        } catch (error) {
            console.error("장비 목록 로드 실패:", error);
            
            // 오류 발생 시 빈 컨테이너 처리
            if (coatingContainer) renderEquipmentGrid(coatingContainer, []);
            if (exposureContainer) renderEquipmentGrid(exposureContainer, []);
            if (developmentContainer) renderEquipmentGrid(developmentContainer, []);
        }
    }

// 장비 그리드 렌더링 함수 (개선된 버전)
    function renderEquipmentGrid(container, equipments) {
        if (!container) return;
        
        // 컨테이너 초기화
        container.innerHTML = '';
        
        if (!equipments || equipments.length === 0) {
            container.innerHTML = '<div class="empty-cell">장비 없음</div>';
            return;
        }
        
        // 열 수 계산 (장비 수에 따라 조정)
        const count = equipments.length;
        let cols = 4; // 기본 4열
        
        if (count <= 4) cols = 2;
        else if (count <= 6) cols = 3;
        
        // 행 수 계산
        const rows = Math.ceil(count / cols);
        
        // 그리드 스타일 설정
        container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        container.style.gridAutoRows = "minmax(30px, auto)";
        
        // 장비 버튼 생성
        equipments.forEach(equipment => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-outline-primary equipment-btn';
            button.dataset.type = equipment.type === "코팅" ? "coating" : 
                            equipment.type === "노광" ? "exposure" : "development";
            button.dataset.id = equipment.id;
            button.textContent = equipment.name;
            
            container.appendChild(button);
        });
        
        // 남은 셀 채우기
        const totalCells = rows * cols;
        for (let i = count; i < totalCells; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'empty-cell';
            container.appendChild(emptyCell);
        }
        
        // 장비 버튼 클릭 이벤트 설정
        container.querySelectorAll('.equipment-btn').forEach(button => {
            button.addEventListener('click', function() {
                const type = this.dataset.type;
                
                // 같은 컨테이너의 다른 버튼들 비활성화
                container.querySelectorAll('.equipment-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // 현재 버튼 활성화
                this.classList.add('active');
                
                // 해당 타입의 hidden input에 ID 설정
                document.getElementById(`${type}-equipment`).value = this.dataset.id;
            });
        });
    }

    
    // 측정값 검사
    function validateMeasurementValues() {
        if (!currentSpec) {
            return true; // SPEC이 없으면 검사를 건너뜀
        }
        
        const valueInputs = document.querySelectorAll('.measurement-value');
        let allValid = true;
        
        valueInputs.forEach(input => {
            const value = parseFloat(input.value);
            
            // 값이 SPEC 범위를 벗어나는지 확인
            if (value < currentSpec.lsl || value > currentSpec.usl) {
                input.classList.add('is-invalid');
                
                // 기존 피드백 제거
                const nextSibling = input.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('invalid-feedback')) {
                    nextSibling.remove();
                }
                
                // 오류 메시지 추가
                const feedback = document.createElement('div');
                feedback.classList.add('invalid-feedback');
                feedback.textContent = `SPEC 범위(${currentSpec.lsl.toFixed(3)} ~ ${currentSpec.usl.toFixed(3)})를 벗어났습니다.`;
                input.parentNode.appendChild(feedback);
                
                allValid = false;
            } else {
                input.classList.remove('is-invalid');
                
                // 기존 피드백 제거
                const nextSibling = input.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('invalid-feedback')) {
                    nextSibling.remove();
                }
            }
        });
        
        return allValid;
    }
    
    // 이벤트 리스너 설정
    function setupEventListeners() {
        document.getElementById('measurement-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // 모든 필수 입력 항목 확인
            if (!selectedTargetId) {
                alert('제품군, 공정, 타겟을 선택해주세요.');
                return;
            }
            
            // 측정값 검사
            if (!validateMeasurementValues()) {
                if (!confirm('측정값이 SPEC 범위를 벗어났습니다. 계속 진행하시겠습니까?')) {
                    return;
                }
            }
            
            // 폼 데이터 수집
            const formData = {
                target_id: selectedTargetId,
                coating_equipment_id: document.getElementById('coating-equipment').value || null,
                exposure_equipment_id: document.getElementById('exposure-equipment').value || null,
                development_equipment_id: document.getElementById('development-equipment').value || null,
                device: document.getElementById('device').value,
                lot_no: document.getElementById('lot-no').value,
                wafer_no: document.getElementById('wafer-no').value,
                exposure_time: document.getElementById('exposure-time').value || null,
                value_top: parseFloat(document.getElementById('value-top').value),
                value_center: parseFloat(document.getElementById('value-center').value),
                value_bottom: parseFloat(document.getElementById('value-bottom').value),
                value_left: parseFloat(document.getElementById('value-left').value),
                value_right: parseFloat(document.getElementById('value-right').value),
                author: document.getElementById('author').value
            };
            
            try {
                // 중복 체크
                const checkResult = await api.checkDuplicateMeasurement(
                    selectedTargetId,
                    formData.lot_no,
                    formData.wafer_no
                );
                
                if (checkResult.isDuplicate) {
                    // 중복 데이터가 있을 경우 사용자에게 확인
                    if (!confirm('이미 동일한 타겟에 대한 LOT NO와 WAFER NO를 가진 측정 데이터가 존재합니다. 그래도 저장하시겠습니까?')) {
                        return; // 저장 취소
                    }
                }
                
                // 제출 버튼 비활성화
                const submitBtn = document.getElementById('submit-btn');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 저장 중...';
                
                // API 호출
                const result = await api.createMeasurement(formData);
                
                // 성공 메시지
                alert('측정 데이터가 성공적으로 저장되었습니다.');
                
                // 폼 초기화 (작성자 정보 유지)
                const authorValue = document.getElementById('author').value;
                document.getElementById('measurement-form').reset();
                // 작성자 정보 복원
                document.getElementById('author').value = authorValue;
                
                // 제출 버튼 활성화
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save mr-1"></i> 저장';
                
            } catch (error) {
                console.error('측정 데이터 저장 실패:', error);
                alert('측정 데이터 저장 중 오류가 발생했습니다.');
                
                // 제출 버튼 활성화
                const submitBtn = document.getElementById('submit-btn');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save mr-1"></i> 저장';
            }
        });
    
        
        // 측정값 입력 필드에 SPEC 검증 이벤트 추가
        document.querySelectorAll('.measurement-value').forEach(input => {
            input.addEventListener('input', function(e) {
                // 소수점이 있는 경우
                let value = this.value;
                
                if (value.includes('.')) {
                    const parts = value.split('.');
                    // 소수점 뒤 부분이 3자리 초과인 경우 잘라냄
                    if (parts[1].length > 3) {
                        this.value = `${parts[0]}.${parts[1].substring(0, 3)}`;
                    }
                }
                
                // SPEC 검증 추가
                // SPEC이 없으면 검사를 건너뜀
                if (!currentSpec) {
                    this.classList.remove('spec-exceeded');
                    return;
                }
                
                const numValue = parseFloat(this.value);
                
                // 값이 없거나 NaN인 경우 검증 건너뜀
                if (this.value === '' || isNaN(numValue)) {
                    this.classList.remove('spec-exceeded');
                    return;
                }
                
                // SPEC 범위 체크
                if (numValue < currentSpec.lsl || numValue > currentSpec.usl) {
                    // 시각적 표시를 위한 클래스 추가
                    this.classList.add('spec-exceeded');
                    console.log('SPEC 초과: ' + numValue); // 디버깅용
                } else {
                    // 클래스 제거
                    this.classList.remove('spec-exceeded');
                }
            });
        });
    }
    
    // 작성자 관리 기능 (모달 창 사용)
    function initAuthorManagement() {
        // 로컬 스토리지에서 작성자 목록 불러오기
        const loadAuthors = () => {
            const authors = localStorage.getItem('authors');
            return authors ? JSON.parse(authors) : ['관리자']; // 기본값 설정
        };

        // 작성자 목록 저장
        const saveAuthors = (authors) => {
            localStorage.setItem('authors', JSON.stringify(authors));
        };

        // 작성자 드롭다운 업데이트
        const updateAuthorDropdown = () => {
            const authors = loadAuthors();
            const authorSelect = document.getElementById('author');
            
            // 기존 옵션 제거 (첫 번째 항목 제외)
            while (authorSelect.options.length > 1) {
                authorSelect.remove(1);
            }
            
            // 작성자 옵션 추가
            authors.forEach(author => {
                const option = document.createElement('option');
                option.value = author;
                option.textContent = author;
                authorSelect.appendChild(option);
            });
        };

        // 작성자 목록 업데이트 (모달 창)
        const updateAuthorList = () => {
            const authors = loadAuthors();
            const authorList = document.getElementById('author-list');
            
            // 목록 초기화
            authorList.innerHTML = '';
            
            // 작성자 목록 생성
            authors.forEach(author => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.textContent = author;
                
                // 삭제 버튼
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-sm btn-outline-danger';
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.onclick = function() {
                    removeAuthor(author);
                };
                
                li.appendChild(deleteBtn);
                authorList.appendChild(li);
            });
        };

        // 작성자 추가
        const addAuthor = (newAuthor) => {
            if (!newAuthor || newAuthor.trim() === '') {
                return false;
            }
            
            // 중복 확인
            const authors = loadAuthors();
            if (authors.includes(newAuthor.trim())) {
                alert('이미 존재하는 작성자입니다.');
                return false;
            }
            
            // 새 작성자 추가
            authors.push(newAuthor.trim());
            saveAuthors(authors);
            
            // UI 업데이트
            updateAuthorDropdown();
            updateAuthorList();
            
            return true;
        };

        // 작성자 제거
        const removeAuthor = (authorToRemove) => {
            const authors = loadAuthors();
            
            // 최소 한 명의 작성자는 유지
            if (authors.length <= 1) {
                alert('최소 한 명의 작성자는 유지해야 합니다.');
                return false;
            }
            
            // 작성자 삭제
            const updatedAuthors = authors.filter(author => author !== authorToRemove);
            saveAuthors(updatedAuthors);
            
            // UI 업데이트
            updateAuthorDropdown();
            updateAuthorList();
            
            return true;
        };

        // 추가/관리 버튼 이벤트 (인라인)
        document.getElementById('add-author-btn').addEventListener('click', () => {
            $('#author-modal').modal('show');
        });

        // 모달 창에서 추가 버튼 이벤트
        document.getElementById('add-author-modal-btn').addEventListener('click', () => {
            const newAuthorInput = document.getElementById('new-author');
            const newAuthor = newAuthorInput.value;
            
            if (addAuthor(newAuthor)) {
                newAuthorInput.value = ''; // 입력 필드 초기화
                // 새로 추가된 작성자 선택
                const authorSelect = document.getElementById('author');
                authorSelect.value = newAuthor.trim();
            }
        });

        // 모달 창이 표시될 때 이벤트
        $('#author-modal').on('shown.bs.modal', function () {
            document.getElementById('new-author').focus();
            updateAuthorList();
        });

        // 모달 창에서 엔터 키 처리
        document.getElementById('new-author').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('add-author-modal-btn').click();
            }
        });

        // 초기 드롭다운 설정
        updateAuthorDropdown();
    }

    // 페이지 로드 시 작성자 관리 초기화
    document.addEventListener('DOMContentLoaded', function() {
        initAuthorManagement();
    });

    // 페이지 로드 시 초기화
    document.addEventListener('DOMContentLoaded', initInputPage);
})();
