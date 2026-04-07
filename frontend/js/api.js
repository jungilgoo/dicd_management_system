// iframe 내부에서 부모 윈도우의 PROCESS_TYPE 상속
if (!window.PROCESS_TYPE && window.parent && window.parent.PROCESS_TYPE) {
    window.PROCESS_TYPE = window.parent.PROCESS_TYPE;
}

// API 클래스
class API {
    // 생성자
    constructor(config) {
        this.baseUrl = config.BASE_URL;
        this.endpoints = config.ENDPOINTS;

        // 캐시 저장소 추가
        this.cache = {
            data: {},
            timeout: 300000 // 5분 캐시 타임아웃
        };
    }
    
    // 캐시 키 생성 메서드
    getCacheKey(endpoint, params = {}) {
        return `${endpoint}:${JSON.stringify(params)}`;
    }

    // 캐시된 데이터 가져오기
    getCachedData(endpoint, params = {}) {
        const key = this.getCacheKey(endpoint, params);
        const cachedItem = this.cache.data[key];
        
        if (cachedItem && (Date.now() - cachedItem.timestamp) < this.cache.timeout) {
            return cachedItem.data;
        }
        
        return null;
    }

    // 데이터 캐싱
    setCachedData(endpoint, params = {}, data) {
        const key = this.getCacheKey(endpoint, params);
        this.cache.data[key] = {
            data,
            timestamp: Date.now()
        };
    }

    // 캐시 무효화 (특정 엔드포인트의 모든 캐시 삭제)
    clearCache(endpoint = null) {
        if (endpoint) {
            // 특정 엔드포인트 캐시만 삭제
            Object.keys(this.cache.data).forEach(key => {
                if (key.startsWith(endpoint + ':')) {
                    delete this.cache.data[key];
                }
            });
        } else {
            // 모든 캐시 삭제
            this.cache.data = {};
        }
    }

    // GET 요청 (수정된 버전)
    async get(endpoint, params = {}) {
        // 캐시에서 먼저 확인
        const cachedData = this.getCachedData(endpoint, params);
        if (cachedData) {
            return cachedData;
        }
        
        // URL 쿼리 파라미터 생성
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                queryParams.append(key, params[key]);
            }
        });
        
        // URL 구성
        const url = `${this.baseUrl}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const err = new Error(`HTTP error! Status: ${response.status}`);
                err.status = response.status;
                throw err;
            }
            const data = await response.json();

            // 데이터 캐싱
            this.setCachedData(endpoint, params, data);

            return data;
        } catch (error) {
            // 404는 "데이터 없음" 정상 흐름이 많으므로 콘솔 노이즈 방지
            if (error && error.status !== 404) {
                console.error('API GET 요청 오류:', error);
            }
            throw error;
        }
    }
    
    // POST 요청
    async post(endpoint, data) {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            console.log('POST 요청 URL:', url);
            console.log('POST 요청 데이터:', data);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            console.log('응답 상태:', response.status);
            console.log('응답 헤더:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                // 에러 응답 본문 읽기 (JSON/텍스트 모두 지원)
                let errorMessage = `HTTP error! Status: ${response.status}`;
                try {
                    const rawText = await response.text();
                    try {
                        const errorData = JSON.parse(rawText);
                        console.error('POST 에러 응답:', errorData);
                        if (errorData && errorData.detail) {
                            if (Array.isArray(errorData.detail)) {
                                const details = errorData.detail.map(d => {
                                    const loc = Array.isArray(d.loc) ? d.loc.join('.') : d.loc;
                                    return `${loc}: ${d.msg}`;
                                }).join(' | ');
                                errorMessage += ` - ${details}`;
                            } else if (typeof errorData.detail === 'object') {
                                errorMessage += ` - ${JSON.stringify(errorData.detail)}`;
                            } else {
                                errorMessage += ` - ${String(errorData.detail)}`;
                            }
                        } else if (rawText) {
                            errorMessage += ` - ${rawText}`;
                        }
                    } catch {
                        if (rawText) {
                            errorMessage += ` - ${rawText}`;
                        }
                    }
                } catch (_) {}
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            console.log('응답 데이터:', result);

            // POST 성공 시 해당 엔드포인트 캐시 무효화
            this.clearCache(endpoint);

            return result;
        } catch (error) {
            console.error('API POST 요청 오류:', error);
            console.error('오류 타입:', error.name);
            console.error('오류 메시지:', error.message);
            throw error;
        }
    }
    
    // PUT 요청
    async put(endpoint, data) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();

            // PUT 성공 시 기본 엔드포인트 캐시 무효화 (/api/specs/123 → /api/specs)
            const baseEndpoint = endpoint.split('/').slice(0, 3).join('/'); // /api/specs
            this.clearCache(baseEndpoint);

            return result;
        } catch (error) {
            console.error('API PUT 요청 오류:', error);
            throw error;
        }
    }
    
    // PATCH 요청
    async patch(endpoint, data) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();

            const baseEndpoint = endpoint.split('/').slice(0, 3).join('/');
            this.clearCache(baseEndpoint);

            return result;
        } catch (error) {
            console.error('API PATCH 요청 오류:', error);
            throw error;
        }
    }

    // DELETE 요청
    async delete(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();

            // DELETE 성공 시 기본 엔드포인트 캐시 무효화 (/api/specs/123 → /api/specs)
            const baseEndpoint = endpoint.split('/').slice(0, 3).join('/'); // /api/specs
            this.clearCache(baseEndpoint);

            return result;
        } catch (error) {
            console.error('API DELETE 요청 오류:', error);
            throw error;
        }
    }
    
    // 제품군 관련 메서드
    async getProductGroups() {
        return this.get(this.endpoints.PRODUCT_GROUPS);
    }
    
    // 공정 관련 메서드
    async getProcesses(productGroupId = null) {
        const params = productGroupId ? { product_group_id: productGroupId } : {};
        return this.get(this.endpoints.PROCESSES, params);
    }
    
    // 타겟 관련 메서드
    async getTargets(processId = null, processType = null) {
        const params = {};
        if (processId) params.process_id = processId;
        // window.PROCESS_TYPE이 설정되어 있으면 사용, 아니면 'PHOTO' 기본값
        params.process_type = processType || window.PROCESS_TYPE || 'PHOTO';
        return this.get(this.endpoints.TARGETS, params);
    }

    async getTarget(targetId) {
        return this.get(`${this.endpoints.TARGETS}/${targetId}`);
    }

    // 장비 관련 메서드
    async getEquipments(processType = null) {
        const params = {};
        // window.PROCESS_TYPE이 설정되어 있으면 사용, 아니면 'PHOTO' 기본값
        params.process_type = processType || window.PROCESS_TYPE || 'PHOTO';
        return this.get(this.endpoints.EQUIPMENTS, params);
    }
    
    // 타입별 장비 조회 메서드
    async getEquipmentsByType(type) {
        return this.get(`${this.endpoints.EQUIPMENTS}/by-type/${type}`);
    }
    
    // 측정 데이터 관련 메서드
    async getMeasurements(params = {}) {
        const response = await this.get(this.endpoints.MEASUREMENTS, params);
        // 새 응답 형식 {items, total_count}에서 배열만 반환 (기존 호환)
        if (response && response.items) {
            return response.items;
        }
        return response;
    }

    async getMeasurementsPaginated(params = {}) {
        const response = await this.get(this.endpoints.MEASUREMENTS, params);
        // {items: [...], total_count: N} 전체 반환
        if (response && response.items) {
            return response;
        }
        return { items: response || [], total_count: (response || []).length };
    }
    
    async createMeasurement(data) {
        return this.post(this.endpoints.MEASUREMENTS, data);
    }
    
    // SPEC 관련 메서드
    async getSpecs(targetId = null, isActive = null) {
        const params = {};
        if (targetId !== null) params.target_id = targetId;
        if (isActive !== null) params.is_active = isActive;
        return this.get(this.endpoints.SPECS, params);
    }
    
    async getActiveSpec(targetId) {
        return this.get(`${this.endpoints.SPECS}/target/${targetId}/active`);
    }
    
    // SPC 관련 메서드
    async analyzeSpc(targetId, params = { days: 30 }) {
        // params가 숫자인 경우 days로 처리 (기존 호환성 유지)
        if (typeof params === 'number') {
            params = { days: params };
        }
        return this.get(`${this.endpoints.SPC}/analyze/${targetId}`, params);
    }
    
    // 통계 관련 메서드
    async getTargetStatistics(targetId, params) {
        // params가 숫자인 경우 days로 처리 (이전 버전 호환성)
        if (typeof params === 'number') {
            params = { days: params };
        }
        return this.get(`${this.endpoints.STATISTICS}/target/${targetId}`, params);
    }

    async getBulkTargetStatistics(targetIds, days) {
        return this.post(`${this.endpoints.STATISTICS}/targets/bulk`, {
            target_ids: targetIds,
            days: days
        });
    }
    
    // 보고서 관련 메서드
    async getReports(params = {}) {
        return this.get(this.endpoints.REPORTS, params);
    }
    
    // 새 메서드 추가
    checkDuplicateMeasurement(targetId, lotNo, waferNo) {
        return this.get(`${this.endpoints.DUPLICATE_CHECK}`, {
            target_id: targetId,
            lot_no: lotNo,
            wafer_no: waferNo
        });
    }
    

    async createSpec(data) {
        return this.post(this.endpoints.SPECS, data);
    }

    async updateSpec(specId, data) {
        return this.put(`${this.endpoints.SPECS}/${specId}`, data);
    }

    async activateSpec(specId) {
        return this.put(`${this.endpoints.SPECS}/${specId}/activate`, {});
    }

    async deleteSpec(specId) {
        return this.delete(`${this.endpoints.SPECS}/${specId}`);
    }

    // 타겟 관련 메서드 추가
    async createTarget(data) {
        return this.post(this.endpoints.TARGETS, data);
    }

    async updateTarget(targetId, data) {
        return this.put(`${this.endpoints.TARGETS}/${targetId}`, data);
    }

    async deleteTarget(targetId) {
        return this.delete(`${this.endpoints.TARGETS}/${targetId}`);
    }

    // 제품군 관련 추가 메서드
    async createProductGroup(data) {
        return this.post(this.endpoints.PRODUCT_GROUPS, data);
    }

    async updateProductGroup(productGroupId, data) {
        return this.put(`${this.endpoints.PRODUCT_GROUPS}/${productGroupId}`, data);
    }

    async deleteProductGroup(productGroupId) {
        return this.delete(`${this.endpoints.PRODUCT_GROUPS}/${productGroupId}`);
    }

    // 공정 관련 추가 메서드
    async createProcess(data) {
        return this.post(this.endpoints.PROCESSES, data);
    }

    async updateProcess(processId, data) {
        return this.put(`${this.endpoints.PROCESSES}/${processId}`, data);
    }

    async deleteProcess(processId) {
        return this.delete(`${this.endpoints.PROCESSES}/${processId}`);
    }

    // 분포 분석 메서드
    async analyzeDistribution(targetId, params = { days: 30 }) {
        // /api가 중복되므로 기본 URL에서 /api를 제거한 URL 사용
        const baseUrl = this.baseUrl.replace('/api', '');
        const url = `${baseUrl}/api${this.endpoints.DISTRIBUTION}/analyze/${targetId}`;
        
        try {
            // URL 쿼리 파라미터 생성
            const queryParams = new URLSearchParams();
            if (params.days) {
                queryParams.append('days', params.days);
            }
            if (params.start_date) {
                queryParams.append('start_date', params.start_date);
            }
            if (params.end_date) {
                queryParams.append('end_date', params.end_date);
            }
            
            const response = await fetch(`${url}?${queryParams.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('분포 분석 API 요청 오류:', error);
            throw error;
        }
    }
    
    // 박스플롯 분석용 메서드
    async getBoxplotData(targetId, groupBy, params = { days: 30 }) {
        // 호환성을 위해 숫자 타입 처리
        if (typeof params === 'number') {
            params = { days: params };
        }
        
        // group_by 파라미터가 없으면 추가
        if (!params.group_by) {
            params.group_by = groupBy;
        }
        
        return this.get(`${this.endpoints.BOXPLOT}/${targetId}`, params);
    }

    // PR Thickness 관련 메서드
    // 장비 설정 관련
    async getPRThicknessEquipments() {
        return this.get(`${this.endpoints.PR_THICKNESS}/equipments`);
    }

    async createPRThicknessEquipment(data) {
        return this.post(`${this.endpoints.PR_THICKNESS}/equipments`, data);
    }

    async updatePRThicknessEquipment(equipmentId, data) {
        return this.put(`${this.endpoints.PR_THICKNESS}/equipments/${equipmentId}`, data);
    }

    async deletePRThicknessEquipment(equipmentId) {
        return this.delete(`${this.endpoints.PR_THICKNESS}/equipments/${equipmentId}`);
    }

    async bulkUpsertPRThicknessEquipments(settings) {
        return this.post(`${this.endpoints.PR_THICKNESS}/equipments/bulk`, settings);
    }

    async initializePRThicknessEquipments() {
        return this.post(`${this.endpoints.PR_THICKNESS}/initialize`, {});
    }

    // 측정 데이터 관련
    async createPRThicknessMeasurements(data) {
        return this.post(`${this.endpoints.PR_THICKNESS}/measurements`, data);
    }

    async getPRThicknessData(params = {}) {
        return this.get(`${this.endpoints.PR_THICKNESS}/measurements`, params);
    }

    async getPRThicknessMeasurement(measurementId) {
        return this.get(`${this.endpoints.PR_THICKNESS}/measurements/${measurementId}`);
    }

    async updatePRThicknessMeasurement(measurementId, data) {
        return this.put(`${this.endpoints.PR_THICKNESS}/measurements/${measurementId}`, data);
    }

    async deletePRThicknessMeasurement(measurementId) {
        return this.delete(`${this.endpoints.PR_THICKNESS}/measurements/${measurementId}`);
    }

    // 차트 데이터 관련
    async getPRThicknessChartData(params = {}) {
        return this.get(`${this.endpoints.PR_THICKNESS}/chart-data`, params);
    }

    // 통계 데이터 관련
    async getPRThicknessStatistics() {
        return this.get(`${this.endpoints.PR_THICKNESS}/statistics`);
    }

    // Particle 관련 메서드
    // 장비 설정 관련
    async getParticleEquipments() {
        return this.get(`${this.endpoints.PARTICLE}/equipments`);
    }

    async createParticleEquipment(data) {
        return this.post(`${this.endpoints.PARTICLE}/equipments`, data);
    }

    async updateParticleEquipment(equipmentId, data) {
        return this.put(`${this.endpoints.PARTICLE}/equipments/${equipmentId}`, data);
    }

    async deleteParticleEquipment(equipmentId) {
        return this.delete(`${this.endpoints.PARTICLE}/equipments/${equipmentId}`);
    }

    async bulkUpsertParticleEquipments(settings) {
        return this.post(`${this.endpoints.PARTICLE}/equipments/bulk`, settings);
    }

    async initializeParticleEquipments() {
        return this.post(`${this.endpoints.PARTICLE}/initialize`, {});
    }

    // 측정 데이터 관련
    async createParticleMeasurements(data) {
        return this.post(`${this.endpoints.PARTICLE}/measurements`, data);
    }

    async getParticleData(params = {}) {
        return this.get(`${this.endpoints.PARTICLE}/measurements`, params);
    }

    async getParticleMeasurement(measurementId) {
        return this.get(`${this.endpoints.PARTICLE}/measurements/${measurementId}`);
    }

    async updateParticleMeasurement(measurementId, data) {
        return this.put(`${this.endpoints.PARTICLE}/measurements/${measurementId}`, data);
    }

    async deleteParticleMeasurement(measurementId) {
        return this.delete(`${this.endpoints.PARTICLE}/measurements/${measurementId}`);
    }

    // 차트 데이터 관련
    async getParticleChartData(params = {}) {
        return this.get(`${this.endpoints.PARTICLE}/chart-data`, params);
    }

    // 통계 데이터 관련
    async getParticleStatistics() {
        return this.get(`${this.endpoints.PARTICLE}/statistics`);
    }
}

// API 인스턴스 생성
const api = new API(API_CONFIG);