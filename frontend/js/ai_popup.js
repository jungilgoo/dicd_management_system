// ai_popup.js - AI 해석 결과를 별도 윈도우 창으로 표시하는 공통 헬퍼
//
// 사용법:
//   const popup = AiPopup.open({
//       type: 'spc',                       // spc | trend | distribution
//       title: 'AI SPC 공정 해석',
//       loadingText: 'AI가 SPC 데이터를 분석하고 있습니다... (약 5~10초 소요)',
//       contextHtml: '제품군: A | 공정: B | 타겟: C'
//   });
//   try {
//       const result = await fetch(...);
//       popup.setResult(htmlString);
//   } catch (e) {
//       popup.setError(e.message);
//   }

(function() {
    const POPUP_FEATURES = 'width=720,height=900,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no';

    function open(options) {
        const opts = options || {};
        const type = opts.type || 'generic';
        const windowName = 'ai_result_' + type;

        // ai_result.html 경로는 호출 페이지(/pages/analysis/*.html) 기준 동일 디렉터리
        const popupWindow = window.open('ai_result.html', windowName, POPUP_FEATURES);

        if (!popupWindow) {
            alert('팝업 차단 기능이 활성화되어 있습니다. AI 해석 창을 띄우려면 팝업을 허용하세요.');
            return null;
        }

        popupWindow.focus();

        // 자식 창 'ready' 신호 수신 시 init 메시지 전송
        let initialized = false;
        let pendingResult = null; // 자식이 ready 되기 전에 결과가 도착한 경우 임시 저장

        function sendInit() {
            try {
                popupWindow.postMessage({
                    type: 'init',
                    title: opts.title || 'AI 해석 결과',
                    loadingText: opts.loadingText || 'AI가 분석하고 있습니다... (약 5~10초 소요)',
                    contextHtml: opts.contextHtml || ''
                }, '*');
                initialized = true;

                if (pendingResult) {
                    popupWindow.postMessage(pendingResult, '*');
                    pendingResult = null;
                }
            } catch (e) {
                console.error('AI 팝업 init 전송 실패:', e);
            }
        }

        function readyHandler(event) {
            const msg = event.data || {};
            if (msg.type === 'ready' && msg.popupName === windowName) {
                sendInit();
            }
        }
        window.addEventListener('message', readyHandler);

        // 자식 창이 닫히면 리스너 정리
        const closeChecker = setInterval(function() {
            if (popupWindow.closed) {
                window.removeEventListener('message', readyHandler);
                clearInterval(closeChecker);
            }
        }, 1000);

        function send(msg) {
            if (popupWindow.closed) return;
            if (initialized) {
                try {
                    popupWindow.postMessage(msg, '*');
                } catch (e) {
                    console.error('AI 팝업 메시지 전송 실패:', e);
                }
            } else {
                // 아직 ready 안 된 경우 보류
                pendingResult = msg;
            }
        }

        return {
            window: popupWindow,
            setResult: function(html) {
                send({ type: 'result', html: html });
            },
            setError: function(message) {
                send({ type: 'error', message: message });
            },
            close: function() {
                if (!popupWindow.closed) popupWindow.close();
            }
        };
    }

    // 마크다운 → HTML 공통 변환기 (3개 페이지에서 중복 제거)
    function markdownToHtml(markdown) {
        let html = markdown
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>\n?)+/g, function(match) {
                return '<ul>' + match + '</ul>';
            })
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        return '<p>' + html + '</p>';
    }

    // 결과 + 프롬프트 보기 토글 HTML 생성
    function buildResultHtml(analysisMarkdown, prompt) {
        let html = markdownToHtml(analysisMarkdown);
        if (prompt) {
            const escaped = prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            html += `
                <hr>
                <button class="btn btn-sm btn-outline-secondary btn-prompt-toggle" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                    <i class="fas fa-code mr-1"></i> 프롬프트 보기
                </button>
                <pre style="display: none; margin-top: 10px; padding: 12px; background: #f4f6f9; border-radius: 4px; font-size: 0.82rem; white-space: pre-wrap; max-height: 500px; overflow-y: auto;">${escaped}</pre>
            `;
        }
        return html;
    }

    window.AiPopup = {
        open: open,
        markdownToHtml: markdownToHtml,
        buildResultHtml: buildResultHtml
    };
})();
