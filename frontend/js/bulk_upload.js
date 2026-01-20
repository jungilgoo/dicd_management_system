// 데이터 일괄 업로드 페이지 모듈
(function() {
    // 전역 변수
    let selectedProductGroupId = null;
    let selectedProcessId = null;
    let selectedTargetId = null;
    
    // 페이지 초기화
    async function initBulkUploadPage() {
        // 커스텀 파일 입력 초기화
        bsCustomFileInput.init();
        
        // 제품군 옵션 로드
        await loadProductGroups();
        
        // 장비 목록 로드
        await loadEquipments();
        
        // 작성자 목록 로드
        loadAuthors();
        
        // 이벤트 리스너 설정
        setupEventListeners();
    }
    
    // 제품군 옵션 로드
    async function loadProductGroups() {
        try {
            const productGroups = await api.getProductGroups();
            
            if (productGroups && productGroups.length > 0) {
                let options = '<option value="">제품군 선택</option>';
                productGroups.forEach(productGroup => {
                    options += `<option value="${productGroup.id}">${productGroup.name}</option>`;
                });
                document.getElementById('product-group').innerHTML = options;
            } else {
                document.getElementById('product-group').innerHTML = '<option value="">제품군 정보 없음</option>';
            }
        } catch (error) {
            console.error('제품군 로드 실패:', error);
            document.getElementById('product-group').innerHTML = '<option value="">제품군 로드 오류</option>';
        }
    }
    
    // 공정 옵션 로드
    async function loadProcesses(productGroupId) {
        try {
            const processSelect = document.getElementById('process');
            processSelect.innerHTML = '<option value="">로딩 중...</option>';
            processSelect.disabled = true;
            
            // 타겟 선택 초기화
            document.getElementById('target').innerHTML = '<option value="">타겟 선택</option>';
            document.getElementById('target').disabled = true;
            
            // 업로드 버튼 비활성화
            document.getElementById('upload-btn').disabled = true;
            
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
                processSelect.innerHTML = '<option value="">해당 제품군에 공정 없음</option>';
            }
        } catch (error) {
            console.error('공정 로드 실패:', error);
            document.getElementById('process').innerHTML = '<option value="">공정 로드 오류</option>';
        }
    }
    
    // 타겟 옵션 로드
    async function loadTargets(processId) {
        try {
            const targetSelect = document.getElementById('target');
            targetSelect.innerHTML = '<option value="">로딩 중...</option>';
            targetSelect.disabled = true;
            
            // 업로드 버튼 비활성화
            document.getElementById('upload-btn').disabled = true;
            
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
                targetSelect.innerHTML = '<option value="">해당 공정에 타겟 없음</option>';
            }
        } catch (error) {
            console.error('타겟 로드 실패:', error);
            document.getElementById('target').innerHTML = '<option value="">타겟 로드 오류</option>';
        }
    }
    
    // 장비 목록 로드
    async function loadEquipments() {
        try {
            const equipments = await api.getEquipments();
            
            if (equipments && equipments.length > 0) {
                // 코팅 장비 옵션
                const coatingEquipments = equipments.filter(eq => eq.type === '코팅');
                let coatingOptions = '<option value="">선택 안함</option>';
                coatingEquipments.forEach(equipment => {
                    coatingOptions += `<option value="${equipment.id}">${equipment.name}</option>`;
                });
                document.getElementById('coating-equipment').innerHTML = coatingOptions;
                
                // 노광 장비 옵션
                const exposureEquipments = equipments.filter(eq => eq.type === '노광');
                let exposureOptions = '<option value="">선택 안함</option>';
                exposureEquipments.forEach(equipment => {
                    exposureOptions += `<option value="${equipment.id}">${equipment.name}</option>`;
                });
                document.getElementById('exposure-equipment').innerHTML = exposureOptions;
                
                // 현상 장비 옵션
                const developmentEquipments = equipments.filter(eq => eq.type === '현상');
                let developmentOptions = '<option value="">선택 안함</option>';
                developmentEquipments.forEach(equipment => {
                    developmentOptions += `<option value="${equipment.id}">${equipment.name}</option>`;
                });
                document.getElementById('development-equipment').innerHTML = developmentOptions;
            }
        } catch (error) {
            console.error('장비 목록 로드 실패:', error);
        }
    }
    
    // 작성자 목록 로드
    function loadAuthors() {
        // 로컬 스토리지에서 작성자 목록 가져오기
        const authors = JSON.parse(localStorage.getItem('authors') || '["관리자"]');
        
        let options = '<option value="">작성자 선택</option>';
        authors.forEach(author => {
            options += `<option value="${author}">${author}</option>`;
        });
        
        document.getElementById('author').innerHTML = options;
    }
    
    // 이벤트 리스너 설정
    function setupEventListeners() {
        // 제품군 선택 변경 이벤트
        document.getElementById('product-group').addEventListener('change', function() {
            selectedProductGroupId = this.value;
            loadProcesses(selectedProductGroupId);
        });
        
        // 공정 선택 변경 이벤트
        document.getElementById('process').addEventListener('change', function() {
            selectedProcessId = this.value;
            loadTargets(selectedProcessId);
        });
        
        // 타겟 선택 변경 이벤트
        document.getElementById('target').addEventListener('change', function() {
            selectedTargetId = this.value;
            
            // 타겟이 선택되면 업로드 버튼 활성화
            document.getElementById('upload-btn').disabled = !selectedTargetId;
        });
        
        // Excel 템플릿 다운로드 버튼 클릭 이벤트
        document.getElementById('download-excel-template').addEventListener('click', function() {
            downloadTemplate('excel');
        });
        
        // CSV 템플릿 다운로드 버튼 클릭 이벤트
        document.getElementById('download-csv-template').addEventListener('click', function() {
            downloadTemplate('csv');
        });
        
        // 업로드 폼 제출 이벤트
        document.getElementById('upload-form').addEventListener('submit', function(e) {
            e.preventDefault();
            uploadFile();
        });
        
        // 파일 선택 이벤트
        document.getElementById('file-upload').addEventListener('change', function(e) {
            const filePath = e.target.value;
            const fileName = filePath.split('\\').pop(); // Windows 경로에서 파일명만 추출
            const fileSize = this.files[0] ? this.files[0].size : 0;
            
            // 파일 크기 제한 (10MB)
            if (fileSize > 10 * 1024 * 1024) {
                alert('파일 크기가 10MB를 초과합니다. 더 작은 파일을 선택해주세요.');
                this.value = ''; // 파일 선택 초기화
                document.querySelector('.custom-file-label').textContent = '파일 선택...';
            }
        });
    }
    
    // 템플릿 다운로드
    function downloadTemplate(type) {
        try {
            const url = `${API_CONFIG.BASE_URL}/bulk-upload/template/${type}`;
            
            // 새 창에서 다운로드 URL 열기 대신 fetch 사용
            if (type === 'excel') {
                // Excel 템플릿은 fetch를 사용하여 다운로드
                fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }
                        return response.blob();
                    })
                    .then(blob => {
                        // Blob을 사용하여 다운로드 링크 생성
                        const downloadUrl = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = downloadUrl;
                        a.download = 'measurement_upload_template.xlsx';
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(downloadUrl);
                        document.body.removeChild(a);
                    })
                    .catch(error => {
                        console.error('Excel 템플릿 다운로드 실패:', error);
                        alert('Excel 템플릿 다운로드 중 오류가 발생했습니다.');
                    });
            } else {
                // CSV 템플릿은 기존 방식으로 다운로드
                window.location.href = url;
            }
        } catch (error) {
            console.error('템플릿 다운로드 오류:', error);
            alert('템플릿 다운로드 중 오류가 발생했습니다.');
        }
    }
    
    // 파일 업로드
    async function uploadFile() {
        // 파일 및 필수 입력값 확인
        const fileInput = document.getElementById('file-upload');
        const authorSelect = document.getElementById('author');
        
        if (!fileInput.files[0]) {
            alert('업로드할 파일을 선택해주세요.');
            return;
        }
        
        if (!selectedTargetId) {
            alert('타겟을 선택해주세요.');
            return;
        }
        
        if (!authorSelect.value) {
            alert('작성자를 선택해주세요.');
            return;
        }
        
        // FormData 생성
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('target_id', selectedTargetId);
        formData.append('author', authorSelect.value);
        
        // 장비 ID 추가 (선택된 경우에만)
        const coatingEquipmentId = document.getElementById('coating-equipment').value;
        const exposureEquipmentId = document.getElementById('exposure-equipment').value;
        const developmentEquipmentId = document.getElementById('development-equipment').value;
        
        if (coatingEquipmentId) {
            formData.append('coating_equipment_id', coatingEquipmentId);
        }
        
        if (exposureEquipmentId) {
            formData.append('exposure_equipment_id', exposureEquipmentId);
        }
        
        if (developmentEquipmentId) {
            formData.append('development_equipment_id', developmentEquipmentId);
        }
        
        try {
            // 업로드 버튼 비활성화 및 로딩 표시
            const uploadBtn = document.getElementById('upload-btn');
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 업로드 중...';
            
            // 결과 카드 숨기기
            document.getElementById('result-card').style.display = 'none';
            
            // API 호출
            const response = await fetch(`${API_CONFIG.BASE_URL}/bulk-upload`, {
                method: 'POST',
                body: formData
            });
            
            // JSON 응답 파싱
            const result = await response.json();
            
            // 업로드 버튼 복원
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload mr-1"></i> 업로드';
            
            // 결과 표시
            displayResult(result);
            
        } catch (error) {
            console.error('파일 업로드 실패:', error);
            
            // 업로드 버튼 복원
            const uploadBtn = document.getElementById('upload-btn');
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload mr-1"></i> 업로드';
            
            // 오류 메시지 표시
            document.getElementById('result-card').style.display = 'block';
            document.getElementById('upload-result').innerHTML = `
            <div class="alert alert-danger">
                <h5><i class="icon fas fa-ban"></i> 업로드 실패</h5>
                <p>파일 업로드 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}</p>
            </div>
            `;
        }
    }
    
    // 업로드 결과 표시
    function displayResult(result) {
        const resultContainer = document.getElementById('upload-result');
        
        // 결과 카드 표시
        document.getElementById('result-card').style.display = 'block';
        
        if (result.success) {
            // 성공 메시지
            let resultHtml = `
            <div class="alert alert-success">
                <h5><i class="icon fas fa-check"></i> 업로드 성공</h5>
                <p>총 ${result.total_rows}개 행 중 ${result.imported_count}개 행이 성공적으로 업로드되었습니다.</p>
            `;
            
            // 중복 항목이 있는 경우
            if (result.duplicate_count > 0) {
                resultHtml += `<p>중복된 데이터 ${result.duplicate_count}개 항목이 건너뛰어졌습니다.</p>`;
            }
            
            resultHtml += '</div>';
            
            // 오류가 있는 경우
            if (result.errors && result.errors.length > 0) {
                resultHtml += `
                <div class="alert alert-warning">
                    <h5><i class="icon fas fa-exclamation-triangle"></i> 부분적으로 성공 (${result.errors.length}개 오류)</h5>
                    <p>다음 행에서 오류가 발생하여 처리되지 않았습니다:</p>
                    <div class="table-responsive mt-3">
                        <table class="table table-sm table-bordered">
                            <thead>
                                <tr>
                                    <th>행 번호</th>
                                    <th>오류 내용</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                // 최대 20개 오류만 표시
                const displayErrors = result.errors.slice(0, 20);
                displayErrors.forEach(error => {
                    resultHtml += `
                    <tr>
                        <td>${error.row}</td>
                        <td>${error.error}</td>
                    </tr>
                    `;
                });
                
                // 표시되지 않은 오류가 있는 경우
                if (result.errors.length > 20) {
                    resultHtml += `
                    <tr>
                        <td colspan="2" class="text-center">
                            ... 외 ${result.errors.length - 20}개의 오류가 더 있습니다.
                        </td>
                    </tr>
                    `;
                }
                
                resultHtml += `
                            </tbody>
                        </table>
                    </div>
                </div>
                `;
            }
            
            resultContainer.innerHTML = resultHtml;
            
        } else {
            // 실패 메시지
            resultContainer.innerHTML = `
            <div class="alert alert-danger">
                <h5><i class="icon fas fa-ban"></i> 업로드 실패</h5>
                <p>${result.detail || '알 수 없는 오류가 발생했습니다.'}</p>
            </div>
            `;
        }
    }
    
    // 페이지 로드 시 초기화
    document.addEventListener('DOMContentLoaded', initBulkUploadPage);
})();