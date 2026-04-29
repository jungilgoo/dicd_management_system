// SPC 메모 관리 모듈
// 카드 헤더의 메모 버튼/뱃지/알림 바와 메모 모달의 CRUD를 담당.
// 외부 의존성: window.api (api.js), window.PROCESS_TYPE, jQuery (Bootstrap 4 modal)
(function () {
    'use strict';

    const SpcMemos = {
        ctx: {
            productGroupId: null,
            processId: null,
            targetId: null,
            productGroupName: '',
            processName: '',
            targetName: '',
            processType: 'PHOTO'
        },

        // 외부에서 SPC 분석 실행 후 호출
        setContext(ctx) {
            Object.assign(this.ctx, ctx);
            this._refreshSummary();
            const btn = document.getElementById('spc-memo-btn');
            if (btn) {
                if (this.ctx.targetId) {
                    btn.disabled = false;
                    btn.classList.remove('btn-secondary');
                    btn.classList.add('btn-info');
                    btn.title = '메모 보기/추가';
                } else {
                    btn.disabled = true;
                    btn.classList.remove('btn-info');
                    btn.classList.add('btn-secondary');
                    btn.title = '타겟을 선택하면 메모를 관리할 수 있습니다';
                }
            }
        },

        // 카드 헤더 뱃지 + 알림 바 갱신
        async _refreshSummary() {
            const badge = document.getElementById('spc-memo-badge');
            const alertBar = document.getElementById('spc-memo-alert');
            const alertDate = document.getElementById('spc-memo-alert-date');
            const alertTitle = document.getElementById('spc-memo-alert-title');

            if (!this.ctx.targetId) {
                if (badge) badge.textContent = '0';
                if (alertBar) alertBar.style.display = 'none';
                return;
            }

            try {
                const params = {
                    target_id: this.ctx.targetId,
                    product_group_id: this.ctx.productGroupId,
                    process_id: this.ctx.processId,
                    process_type: this.ctx.processType || 'PHOTO'
                };
                const summary = await window.api.get('/spc-memos/summary', params);
                if (badge) badge.textContent = String(summary.count || 0);

                if (alertBar) {
                    if (summary.count > 0 && summary.latest_title) {
                        const dateStr = summary.latest_created_at
                            ? new Date(summary.latest_created_at).toLocaleDateString('ko-KR')
                            : '';
                        if (alertDate) alertDate.textContent = dateStr ? `[${dateStr}] ` : '';
                        if (alertTitle) alertTitle.textContent = summary.latest_title;
                        alertBar.style.display = '';
                    } else {
                        alertBar.style.display = 'none';
                    }
                }
            } catch (err) {
                console.warn('SPC 메모 요약 로드 실패:', err);
                if (badge) badge.textContent = '0';
                if (alertBar) alertBar.style.display = 'none';
            }
        },

        // 모달 열기
        async openModal() {
            if (!this.ctx.targetId) {
                alert('타겟을 먼저 선택하세요.');
                return;
            }

            // 컨텍스트 표시
            const ctxEl = document.getElementById('spc-memo-context');
            if (ctxEl) {
                const parts = [
                    this.ctx.productGroupName,
                    this.ctx.processName,
                    this.ctx.targetName
                ].filter(Boolean);
                ctxEl.textContent = parts.join(' / ');
            }

            // 폼 초기화
            this._resetForm();
            this._hideForm();

            // 모달 표시
            $('#spcMemoModal').modal('show');

            // 목록 로드
            await this._loadList();
        },

        async _loadList() {
            const listEl = document.getElementById('spc-memo-list');
            if (!listEl) return;

            listEl.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-spinner fa-spin"></i> 불러오는 중...
                </div>`;

            try {
                const params = {
                    target_id: this.ctx.targetId,
                    product_group_id: this.ctx.productGroupId,
                    process_id: this.ctx.processId,
                    process_type: this.ctx.processType || 'PHOTO',
                    limit: 200
                };
                // 캐시 우회를 위해 clearCache 후 요청
                if (window.api && window.api.clearCache) {
                    window.api.clearCache('/spc-memos/');
                }
                const memos = await window.api.get('/spc-memos/', params);
                this._renderList(memos);
            } catch (err) {
                console.error('SPC 메모 목록 로드 실패:', err);
                listEl.innerHTML = `
                    <div class="alert alert-danger">메모를 불러오지 못했습니다.</div>`;
            }
        },

        _renderList(memos) {
            const listEl = document.getElementById('spc-memo-list');
            if (!listEl) return;

            if (!memos || memos.length === 0) {
                listEl.innerHTML = `
                    <div class="text-center py-4 text-muted">
                        <i class="far fa-sticky-note mr-1"></i> 등록된 메모가 없습니다.
                    </div>`;
                return;
            }

            const html = memos.map(memo => {
                const dateStr = memo.created_at
                    ? new Date(memo.created_at).toLocaleString('ko-KR')
                    : '';
                const updatedSuffix = memo.updated_at && memo.updated_at !== memo.created_at
                    ? ` (수정: ${new Date(memo.updated_at).toLocaleString('ko-KR')})`
                    : '';
                return `
                    <div class="card mb-2 spc-memo-card" data-memo-id="${memo.id}">
                        <div class="card-body py-2 px-3">
                            <div class="d-flex justify-content-between align-items-start mb-1">
                                <h6 class="mb-0 spc-memo-title-text">${this._escapeHtml(memo.title)}</h6>
                                <small class="text-muted ml-2">${dateStr}${updatedSuffix}</small>
                            </div>
                            <p class="mb-2 spc-memo-content-text" style="white-space:pre-wrap;">${this._escapeHtml(memo.content)}</p>
                            <div class="text-right">
                                <button type="button" class="btn btn-sm btn-outline-secondary spc-memo-edit-btn">
                                    <i class="fas fa-edit"></i> 수정
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-danger spc-memo-delete-btn">
                                    <i class="fas fa-trash"></i> 삭제
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            listEl.innerHTML = html;

            // 카드별 핸들러 바인딩
            listEl.querySelectorAll('.spc-memo-card').forEach(card => {
                const id = parseInt(card.getAttribute('data-memo-id'), 10);
                const memo = memos.find(m => m.id === id);
                if (!memo) return;

                const editBtn = card.querySelector('.spc-memo-edit-btn');
                const delBtn = card.querySelector('.spc-memo-delete-btn');
                if (editBtn) editBtn.addEventListener('click', () => this._beginEdit(memo));
                if (delBtn) delBtn.addEventListener('click', () => this._deleteMemo(memo.id));
            });
        },

        _beginEdit(memo) {
            document.getElementById('spc-memo-edit-id').value = memo.id;
            document.getElementById('spc-memo-title').value = memo.title;
            document.getElementById('spc-memo-content').value = memo.content;
            this._showForm();
            // 폼이 보이도록 스크롤
            const wrapper = document.getElementById('spc-memo-form-wrapper');
            if (wrapper) wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },

        async _deleteMemo(id) {
            if (!confirm('이 메모를 삭제하시겠습니까?')) return;
            try {
                await window.api.delete(`/spc-memos/${id}`);
                await this._loadList();
                await this._refreshSummary();
            } catch (err) {
                console.error('메모 삭제 실패:', err);
                alert('메모 삭제에 실패했습니다.');
            }
        },

        async _saveMemo() {
            const idVal = document.getElementById('spc-memo-edit-id').value;
            const title = document.getElementById('spc-memo-title').value.trim();
            const content = document.getElementById('spc-memo-content').value.trim();

            if (!title) {
                alert('제목을 입력하세요.');
                return;
            }
            if (!content) {
                alert('내용을 입력하세요.');
                return;
            }

            try {
                if (idVal) {
                    // 수정
                    await window.api.put(`/spc-memos/${idVal}`, { title, content });
                } else {
                    // 생성
                    await window.api.post('/spc-memos/', {
                        product_group_id: this.ctx.productGroupId,
                        process_id: this.ctx.processId,
                        target_id: this.ctx.targetId,
                        process_type: this.ctx.processType || 'PHOTO',
                        title,
                        content
                    });
                }
                this._resetForm();
                this._hideForm();
                await this._loadList();
                await this._refreshSummary();
            } catch (err) {
                console.error('메모 저장 실패:', err);
                alert('메모 저장에 실패했습니다.');
            }
        },

        _resetForm() {
            document.getElementById('spc-memo-edit-id').value = '';
            document.getElementById('spc-memo-title').value = '';
            document.getElementById('spc-memo-content').value = '';
        },

        _showForm() {
            const w = document.getElementById('spc-memo-form-wrapper');
            if (w) w.style.display = '';
        },

        _hideForm() {
            const w = document.getElementById('spc-memo-form-wrapper');
            if (w) w.style.display = 'none';
        },

        _escapeHtml(text) {
            if (text == null) return '';
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        },

        // 초기화 - DOM 이벤트 바인딩
        init() {
            const memoBtn = document.getElementById('spc-memo-btn');
            if (memoBtn) {
                memoBtn.addEventListener('click', () => this.openModal());
            }

            const newBtn = document.getElementById('spc-memo-new-btn');
            if (newBtn) {
                newBtn.addEventListener('click', () => {
                    this._resetForm();
                    this._showForm();
                });
            }

            const cancelBtn = document.getElementById('spc-memo-cancel-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this._resetForm();
                    this._hideForm();
                });
            }

            const saveBtn = document.getElementById('spc-memo-save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => this._saveMemo());
            }

            const alertMore = document.getElementById('spc-memo-alert-more');
            if (alertMore) {
                alertMore.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openModal();
                });
            }
        }
    };

    // DOM 로드 후 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => SpcMemos.init());
    } else {
        SpcMemos.init();
    }

    // 외부 노출
    window.SpcMemos = SpcMemos;
})();
