/**
 * 탭 매니저 - 메인 페이지 탭 시스템 관리
 *
 * 기능:
 * - 탭 생성 및 삭제
 * - 최대 10개 탭 제한
 * - Dashboard 탭 고정 (닫기 불가)
 * - 탭 중복 허용 (같은 분석 도구, 다른 설정)
 * - 탭별 독립적인 설정 관리
 */

window.TabManager = (function() {
    // 탭 설정
    const MAX_TABS = 10;
    const FIXED_TAB_ID = 'dashboard';

    // 탭 정보 저장소
    let tabs = [];
    let tabCounter = 0;

    // 탭 타입별 메타데이터
    const tabTypes = {
        'dashboard': {
            title: '대시보드',
            icon: 'fas fa-tachometer-alt',
            url: null,
            closable: false
        },
        'input': {
            title: '데이터 입력',
            icon: 'fas fa-edit',
            url: 'pages/input.html',
            closable: true
        },
        'view': {
            title: '데이터 조회',
            icon: 'fas fa-table',
            url: 'pages/view.html',
            closable: true
        },
        'trend': {
            title: '추이 분석',
            icon: 'fas fa-chart-line',
            url: 'pages/analysis/trend.html',
            closable: true
        },
        'spc': {
            title: 'SPC 분석',
            icon: 'fas fa-chart-area',
            url: 'pages/analysis/spc.html',
            closable: true
        },
        'distribution': {
            title: '분포 분석',
            icon: 'fas fa-chart-bar',
            url: 'pages/analysis/distribution.html',
            closable: true
        },
        'boxplot': {
            title: '박스플롯 분석',
            icon: 'fas fa-box',
            url: 'pages/analysis/boxplot.html',
            closable: true
        },
        'reports': {
            title: '보고서 조회',
            icon: 'fas fa-file-alt',
            url: 'pages/reports/trend_view.html',
            closable: true
        },
        'settings': {
            title: '설정',
            icon: 'fas fa-cog',
            url: 'pages/settings.html',
            closable: true
        },
        'bulk_upload': {
            title: '데이터 일괄 업로드',
            icon: 'fas fa-upload',
            url: 'pages/bulk_upload.html',
            closable: true
        },
        'pr_thickness': {
            title: 'PR Thickness 관리',
            icon: 'fas fa-ruler',
            url: 'pages/pr_thickness.html',
            closable: true
        },
        'change_points': {
            title: '변경점 관리',
            icon: 'fas fa-exchange-alt',
            url: 'pages/change_points.html',
            closable: true
        }
    };

    /**
     * 초기화
     */
    function init() {
        console.log('TabManager 초기화');

        // 대시보드 탭을 tabs 배열에 추가
        tabs.push({
            id: FIXED_TAB_ID,
            type: 'dashboard',
            title: '대시보드',
            settings: null
        });

        // 사이드바 클릭 이벤트 바인딩
        bindSidebarEvents();

        // 탭 카운트 업데이트
        updateTabCount();

        console.log('TabManager 초기화 완료');
    }

    /**
     * 사이드바 클릭 이벤트 바인딩
     */
    function bindSidebarEvents() {
        // 대시보드 클릭
        $('a[href="index.html"]').on('click', function(e) {
            e.preventDefault();
            activateTab(FIXED_TAB_ID);
        });

        // 데이터 입력
        $('a[href="pages/input.html"]').on('click', function(e) {
            e.preventDefault();
            openTab('input');
        });

        // 데이터 조회
        $('a[href="pages/view.html"]').on('click', function(e) {
            e.preventDefault();
            openTab('view');
        });

        // 추이 분석
        $('a[href="pages/analysis/trend.html"]').on('click', function(e) {
            e.preventDefault();
            openTab('trend');
        });

        // SPC 분석
        $('a[href="pages/analysis/spc.html"]').on('click', function(e) {
            e.preventDefault();
            openTab('spc');
        });

        // 분포 분석
        $('a[href="pages/analysis/distribution.html"]').on('click', function(e) {
            e.preventDefault();
            openTab('distribution');
        });

        // 박스플롯 분석
        $('a[href="pages/analysis/boxplot.html"]').on('click', function(e) {
            e.preventDefault();
            openTab('boxplot');
        });

        // 보고서 조회
        $('a[href="pages/reports/trend_view.html"]').on('click', function(e) {
            e.preventDefault();
            openTab('reports');
        });

        // 설정
        $('a[href="pages/settings.html"]').on('click', function(e) {
            e.preventDefault();
            openTab('settings');
        });

        // 데이터 일괄 업로드
        $('a[href="pages/bulk_upload.html"]').on('click', function(e) {
            e.preventDefault();
            openTab('bulk_upload');
        });

        // PR Thickness 관리
        $('a[href="pages/pr_thickness.html"]').on('click', function(e) {
            e.preventDefault();
            openTab('pr_thickness');
        });

        // 변경점 관리
        $('a[href="pages/change_points.html"]').on('click', function(e) {
            e.preventDefault();
            openTab('change_points');
        });
    }

    /**
     * 탭 열기
     * @param {string} type - 탭 타입
     * @param {object} settings - 탭별 설정 (선택사항)
     */
    function openTab(type, settings = null) {
        // 최대 탭 개수 체크
        if (tabs.length >= MAX_TABS) {
            alert(`최대 ${MAX_TABS}개의 탭까지만 열 수 있습니다.`);
            return;
        }

        // 탭 타입 유효성 검사
        if (!tabTypes[type]) {
            console.error('유효하지 않은 탭 타입:', type);
            return;
        }

        // 고유 탭 ID 생성 (탭 중복 허용을 위해 카운터 사용)
        tabCounter++;
        const tabId = `${type}-${tabCounter}`;
        const tabMeta = tabTypes[type];

        // 탭 정보 저장
        const tabInfo = {
            id: tabId,
            type: type,
            title: tabMeta.title,
            settings: settings
        };
        tabs.push(tabInfo);

        // 탭 UI 생성
        createTabUI(tabInfo);

        // 탭 콘텐츠 로드
        loadTabContent(tabInfo);

        // 새 탭 활성화
        activateTab(tabId);

        // 탭 카운트 업데이트
        updateTabCount();

        console.log('탭 열림:', tabInfo);
    }

    /**
     * 탭 UI 생성
     * @param {object} tabInfo - 탭 정보
     */
    function createTabUI(tabInfo) {
        const tabMeta = tabTypes[tabInfo.type];
        const closable = tabMeta.closable;

        // 탭 네비게이션 아이템 생성
        const tabNavItem = `
            <li class="nav-item">
                <a class="nav-link" id="${tabInfo.id}-tab" data-toggle="tab" href="#${tabInfo.id}-content"
                   role="tab" data-tab-id="${tabInfo.id}" data-tab-type="${tabInfo.type}">
                    <i class="${tabMeta.icon}"></i> ${tabInfo.title}
                    ${closable ? `<button class="tab-close-btn" data-tab-id="${tabInfo.id}" title="닫기">
                        <i class="fas fa-times"></i>
                    </button>` : ''}
                </a>
            </li>
        `;

        // 탭 네비게이션에 추가
        $('#main-tabs').append(tabNavItem);

        // 닫기 버튼 이벤트 바인딩
        if (closable) {
            $(`button[data-tab-id="${tabInfo.id}"]`).on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                closeTab(tabInfo.id);
            });
        }
    }

    /**
     * 탭 콘텐츠 로드
     * @param {object} tabInfo - 탭 정보
     */
    function loadTabContent(tabInfo) {
        const tabMeta = tabTypes[tabInfo.type];

        // 탭 콘텐츠 패널 생성
        const tabContentPane = `
            <div class="tab-pane fade" id="${tabInfo.id}-content" role="tabpanel">
                <div class="tab-iframe-container">
                    <iframe src="${tabMeta.url}"
                            id="${tabInfo.id}-iframe"
                            frameborder="0"
                            class="tab-iframe"
                            data-tab-id="${tabInfo.id}">
                    </iframe>
                </div>
            </div>
        `;

        // 탭 콘텐츠에 추가
        $('#main-tab-content').append(tabContentPane);

        // iframe 로드 완료 시 설정 복원
        $(`#${tabInfo.id}-iframe`).on('load', function() {
            restoreTabSettings(tabInfo);
        });
    }

    /**
     * 탭 설정 복원
     * @param {object} tabInfo - 탭 정보
     */
    function restoreTabSettings(tabInfo) {
        if (!tabInfo.settings) {
            return;
        }

        try {
            const iframe = document.getElementById(`${tabInfo.id}-iframe`);
            const iframeWindow = iframe.contentWindow;

            // iframe 내부에 설정 전달
            if (iframeWindow && iframeWindow.restoreSettings) {
                iframeWindow.restoreSettings(tabInfo.settings);
                console.log('탭 설정 복원:', tabInfo.id, tabInfo.settings);
            }
        } catch (error) {
            console.error('탭 설정 복원 실패:', error);
        }
    }

    /**
     * 탭 활성화
     * @param {string} tabId - 탭 ID
     */
    function activateTab(tabId) {
        $(`#${tabId}-tab`).tab('show');
        console.log('탭 활성화:', tabId);
    }

    /**
     * 탭 닫기
     * @param {string} tabId - 탭 ID
     */
    function closeTab(tabId) {
        // 고정 탭은 닫을 수 없음
        if (tabId === FIXED_TAB_ID) {
            return;
        }

        // 탭 정보 찾기
        const tabIndex = tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) {
            return;
        }

        // 현재 활성 탭인지 확인
        const isActive = $(`#${tabId}-tab`).hasClass('active');

        // 탭 제거
        tabs.splice(tabIndex, 1);

        // UI에서 제거
        $(`#${tabId}-tab`).parent().remove();
        $(`#${tabId}-content`).remove();

        // 활성 탭이었다면 다른 탭 활성화
        if (isActive && tabs.length > 0) {
            const nextTab = tabs[tabs.length - 1];
            activateTab(nextTab.id);
        }

        // 탭 카운트 업데이트
        updateTabCount();

        console.log('탭 닫힘:', tabId);
    }

    /**
     * 탭 카운트 업데이트
     */
    function updateTabCount() {
        $('#tab-count').text(tabs.length);
    }

    /**
     * 현재 활성 탭 가져오기
     * @returns {object|null} 활성 탭 정보
     */
    function getActiveTab() {
        const activeTabElement = $('#main-tabs .nav-link.active');
        if (activeTabElement.length === 0) {
            return null;
        }

        const tabId = activeTabElement.data('tab-id');
        return tabs.find(t => t.id === tabId);
    }

    /**
     * 탭 설정 업데이트
     * @param {string} tabId - 탭 ID
     * @param {object} settings - 새 설정
     */
    function updateTabSettings(tabId, settings) {
        const tab = tabs.find(t => t.id === tabId);
        if (tab) {
            tab.settings = settings;
            console.log('탭 설정 업데이트:', tabId, settings);
        }
    }

    /**
     * 모든 탭 가져오기
     * @returns {array} 탭 목록
     */
    function getAllTabs() {
        return [...tabs];
    }

    // Public API
    return {
        init: init,
        openTab: openTab,
        closeTab: closeTab,
        activateTab: activateTab,
        getActiveTab: getActiveTab,
        updateTabSettings: updateTabSettings,
        getAllTabs: getAllTabs
    };
})();

// 문서 로드 완료 시 초기화
$(document).ready(function() {
    TabManager.init();
});
