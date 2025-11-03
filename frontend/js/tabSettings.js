/**
 * 탭 설정 관리 유틸리티
 *
 * 각 분석 페이지(iframe 내부)에서 사용할 설정 저장/복원 기능
 *
 * 사용 방법:
 * 1. 분석 페이지 HTML에 이 스크립트 포함
 * 2. 설정 변경 시 TabSettings.save() 호출
 * 3. 페이지 로드 시 TabSettings.restore() 호출
 */

const TabSettings = (function() {
    const STORAGE_KEY_PREFIX = 'tab_settings_';

    /**
     * 현재 탭 ID 가져오기
     * @returns {string|null} 탭 ID
     */
    function getCurrentTabId() {
        try {
            // iframe 내부에서 실행 중인지 확인
            if (window.parent && window.parent !== window) {
                // iframe의 ID에서 탭 ID 추출
                const frameId = window.frameElement?.id;
                if (frameId) {
                    // 'tabId-iframe' 형식에서 'tabId' 추출
                    return frameId.replace('-iframe', '');
                }
            }
            return null;
        } catch (error) {
            console.error('탭 ID 가져오기 실패:', error);
            return null;
        }
    }

    /**
     * 설정 저장
     * @param {object} settings - 저장할 설정 객체
     */
    function save(settings) {
        const tabId = getCurrentTabId();
        if (!tabId) {
            console.warn('탭 ID를 찾을 수 없어 설정을 저장할 수 없습니다.');
            return;
        }

        try {
            const storageKey = STORAGE_KEY_PREFIX + tabId;
            sessionStorage.setItem(storageKey, JSON.stringify(settings));
            console.log('탭 설정 저장:', tabId, settings);

            // 부모 창의 TabManager에도 알림
            if (window.parent && window.parent.TabManager) {
                window.parent.TabManager.updateTabSettings(tabId, settings);
            }
        } catch (error) {
            console.error('설정 저장 실패:', error);
        }
    }

    /**
     * 설정 복원
     * @returns {object|null} 저장된 설정 또는 null
     */
    function restore() {
        const tabId = getCurrentTabId();
        if (!tabId) {
            console.warn('탭 ID를 찾을 수 없어 설정을 복원할 수 없습니다.');
            return null;
        }

        try {
            const storageKey = STORAGE_KEY_PREFIX + tabId;
            const savedSettings = sessionStorage.getItem(storageKey);

            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                console.log('탭 설정 복원:', tabId, settings);
                return settings;
            }

            return null;
        } catch (error) {
            console.error('설정 복원 실패:', error);
            return null;
        }
    }

    /**
     * 설정 삭제
     */
    function clear() {
        const tabId = getCurrentTabId();
        if (!tabId) {
            return;
        }

        try {
            const storageKey = STORAGE_KEY_PREFIX + tabId;
            sessionStorage.removeItem(storageKey);
            console.log('탭 설정 삭제:', tabId);
        } catch (error) {
            console.error('설정 삭제 실패:', error);
        }
    }

    /**
     * 설정 자동 저장 함수 생성
     *
     * 선택 요소들이 변경될 때 자동으로 설정 저장
     *
     * @param {object} selectors - 저장할 요소들의 선택자 맵핑
     * @example
     * TabSettings.autoSave({
     *   productGroupId: '#product-group',
     *   processId: '#process',
     *   targetId: '#target',
     *   dateRange: '#date-range'
     * });
     */
    function autoSave(selectors) {
        Object.entries(selectors).forEach(([key, selector]) => {
            const element = document.querySelector(selector);
            if (element) {
                element.addEventListener('change', function() {
                    const settings = {};
                    Object.entries(selectors).forEach(([k, s]) => {
                        const el = document.querySelector(s);
                        if (el) {
                            // select 요소면 value와 text 모두 저장
                            if (el.tagName === 'SELECT') {
                                settings[k] = el.value;
                                settings[k + '_text'] = el.options[el.selectedIndex]?.text || '';
                            } else {
                                settings[k] = el.value;
                            }
                        }
                    });
                    save(settings);
                });
            }
        });
    }

    /**
     * 설정 자동 복원 함수
     *
     * 페이지 로드 시 저장된 설정으로 요소들 복원
     *
     * @param {object} selectors - 복원할 요소들의 선택자 맵핑
     * @param {function} callback - 복원 완료 후 실행할 콜백 (선택사항)
     * @returns {object|null} 복원된 설정
     * @example
     * TabSettings.autoRestore({
     *   productGroupId: '#product-group',
     *   processId: '#process',
     *   targetId: '#target',
     *   dateRange: '#date-range'
     * }, function(settings) {
     *   console.log('설정 복원 완료:', settings);
     *   loadAnalysisData(settings.targetId, settings.dateRange);
     * });
     */
    function autoRestore(selectors, callback) {
        const settings = restore();
        if (!settings) {
            return null;
        }

        Object.entries(selectors).forEach(([key, selector]) => {
            const element = document.querySelector(selector);
            if (element && settings[key]) {
                element.value = settings[key];

                // select 요소면 change 이벤트 트리거 (연쇄 로드를 위해)
                if (element.tagName === 'SELECT') {
                    element.dispatchEvent(new Event('change'));
                }
            }
        });

        if (callback && typeof callback === 'function') {
            callback(settings);
        }

        return settings;
    }

    /**
     * 전역 함수로 등록 (부모 창에서 호출 가능)
     */
    window.restoreSettings = function(settings) {
        if (settings) {
            const tabId = getCurrentTabId();
            const storageKey = STORAGE_KEY_PREFIX + tabId;
            sessionStorage.setItem(storageKey, JSON.stringify(settings));
            console.log('외부에서 설정 주입:', settings);

            // 설정 복원 시도
            return restore();
        }
    };

    // Public API
    return {
        save: save,
        restore: restore,
        clear: clear,
        autoSave: autoSave,
        autoRestore: autoRestore,
        getCurrentTabId: getCurrentTabId
    };
})();
