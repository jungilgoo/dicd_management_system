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
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            
            // 데이터 캐싱
            this.setCachedData(endpoint, params, data);
            
            return data;
        } catch (error) {
            console.error('API GET 요청 오류:', error);
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
            
            return await response.json();
        } catch (error) {
            console.error('API PUT 요청 오류:', error);
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
            
            return await response.json();
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
    async getTargets(processId = null) {
        const params = processId ? { process_id: processId } : {};
        return this.get(this.endpoints.TARGETS, params);
    }
    
    // 장비 관련 메서드
    async getEquipments() {
        return this.get(this.endpoints.EQUIPMENTS);
    }
    
    // 타입별 장비 조회 메서드
    async getEquipmentsByType(type) {
        return this.get(`${this.endpoints.EQUIPMENTS}/by-type/${type}`);
    }
    
    // 측정 데이터 관련 메서드
    async getMeasurements(params = {}) {
        return this.get(this.endpoints.MEASUREMENTS, params);
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
}

// API 인스턴스 생성
const api = new API(API_CONFIG);