// 설정 페이지 인증 모듈
(function() {
    // 기본 관리자 비밀번호
    const DEFAULT_PASSWORD = "admin123";  // 기본 비밀번호
    
    // 인증 상태
    let isAuthenticated = false;
    
    // 페이지 초기화
    function initAuth() {
        // 로컬 스토리지에서 비밀번호 확인
        const storedPassword = localStorage.getItem('admin_password');
        
        // 비밀번호가 저장되어 있지 않으면 기본 비밀번호 저장
        if (!storedPassword) {
            localStorage.setItem('admin_password', DEFAULT_PASSWORD);
        }
        
        // 인증 확인
        checkAuth();
        
        // 비밀번호 변경 버튼 이벤트 설정
        document.getElementById('change-password-btn').addEventListener('click', function() {
            $('#auth-modal').modal('hide');
            $('#change-password-modal').modal('show');
        });
        
        // 비밀번호 인증 폼 제출 이벤트
        document.getElementById('auth-form').addEventListener('submit', function(e) {
            e.preventDefault();
            authenticateUser();
        });
        
        // 비밀번호 변경 폼 제출 이벤트
        document.getElementById('change-password-form').addEventListener('submit', function(e) {
            e.preventDefault();
            changePassword();
        });
    }
    
    // 인증 확인
    function checkAuth() {
        // 세션 스토리지에서 인증 상태 확인
        const authStatus = sessionStorage.getItem('settings_authenticated');
        
        if (authStatus === 'true') {
            // 이미 인증됨
            isAuthenticated = true;
            showContent();
        } else {
            // 인증 필요
            hideContent();
            $('#auth-modal').modal({
                backdrop: 'static',  // 배경 클릭으로 닫지 못하게 설정
                keyboard: false      // ESC 키로 닫지 못하게 설정
            });
        }
    }
    
    // 사용자 인증
    function authenticateUser() {
        const passwordInput = document.getElementById('password-input');
        const errorMsg = document.getElementById('auth-error-msg');
        const password = passwordInput.value;
        
        // 저장된 비밀번호 가져오기
        const storedPassword = localStorage.getItem('admin_password');
        
        if (password === storedPassword) {
            // 인증 성공
            isAuthenticated = true;
            sessionStorage.setItem('settings_authenticated', 'true');
            
            // 모달 닫기
            $('#auth-modal').modal('hide');
            
            // 콘텐츠 표시
            showContent();
            
            // 비밀번호 입력 초기화
            passwordInput.value = '';
            errorMsg.style.display = 'none';
        } else {
            // 인증 실패
            errorMsg.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
    
    // 비밀번호 변경
    function changePassword() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const errorMsg = document.getElementById('change-error-msg');
        
        // 저장된 비밀번호 가져오기
        const storedPassword = localStorage.getItem('admin_password');
        
        // 현재 비밀번호 확인
        if (currentPassword !== storedPassword) {
            errorMsg.textContent = '현재 비밀번호가 일치하지 않습니다.';
            errorMsg.style.display = 'block';
            return;
        }
        
        // 새 비밀번호 확인
        if (newPassword.length < 6) {
            errorMsg.textContent = '새 비밀번호는 최소 6자 이상이어야 합니다.';
            errorMsg.style.display = 'block';
            return;
        }
        
        // 새 비밀번호 일치 확인
        if (newPassword !== confirmPassword) {
            errorMsg.textContent = '새 비밀번호와 확인 비밀번호가 일치하지 않습니다.';
            errorMsg.style.display = 'block';
            return;
        }
        
        // 비밀번호 저장
        localStorage.setItem('admin_password', newPassword);
        
        // 성공 메시지
        alert('비밀번호가 성공적으로 변경되었습니다.');
        
        // 모달 닫기
        $('#change-password-modal').modal('hide');
        
        // 폼 초기화
        document.getElementById('change-password-form').reset();
        errorMsg.style.display = 'none';
    }
    
    // 콘텐츠 표시
    function showContent() {
        const contentSection = document.querySelector('.content-wrapper');
        contentSection.style.display = 'block';
    }
    
    // 콘텐츠 숨기기
    function hideContent() {
        const contentSection = document.querySelector('.content-wrapper');
        contentSection.style.display = 'none';
    }
    
    // 로그아웃
    window.logoutSettings = function() {
        isAuthenticated = false;
        sessionStorage.removeItem('settings_authenticated');
        
        // 페이지 새로고침
        window.location.reload();
    }
    
    // 페이지 로드 시 초기화
    document.addEventListener('DOMContentLoaded', initAuth);
})();