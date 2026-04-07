window.addEventListener('DOMContentLoaded', () => { 
    const panels = document.querySelectorAll('.glass-panel.loading');
    panels.forEach((panel, index) => {
        const baseDelay = 300;
        const staggeredDelay = baseDelay + (index * 100); 
        setTimeout(() => {
            panel.classList.remove('loading');
        }, staggeredDelay);
    });
    const saveBtn = document.getElementById('save-btn');
    const mandatoryField = document.getElementById('field-name');
    
    const tableDirtyFlag = document.createElement('input');
    tableDirtyFlag.type = 'hidden';
    tableDirtyFlag.id = 'table-dirty-flag';
    tableDirtyFlag.className = 'dirty-check';
    tableDirtyFlag.value = '0';
    document.body.appendChild(tableDirtyFlag);
    
    let initialState = {};
    function captureState() {
        initialState = {};
        document.querySelectorAll('.dirty-check').forEach(input => {
            initialState[input.id] = input.value;
        });
        ['notes-list', 'supplier-files', 'pricing-body', 'bcc-logs-body'].forEach(id => {
            const el = document.getElementById(id);
            if (el) initialState[id] = el.children.length;
        });
        document.querySelectorAll('.tag-container').forEach(container => {
            initialState[container.id] = container.querySelectorAll('.tag').length;
        });
    }

    window.checkDirty = () => {
        let isDirty = false;
        
        document.querySelectorAll('.dirty-check').forEach(input => {
            if (input.value !== initialState[input.id]) isDirty = true;
        });
        
        ['notes-list', 'supplier-files', 'pricing-body', 'bcc-logs-body'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.children.length !== initialState[id]) isDirty = true;
        });

        document.querySelectorAll('.tag-container').forEach(container => {
            if (container.querySelectorAll('.tag').length !== initialState[container.id]) isDirty = true;
        });

        if (isDirty) {
            saveBtn.classList.add('dirty');
        } else {
            saveBtn.classList.remove('dirty');
        }
    };

    window.handleSave = function() {
        if (!saveBtn.classList.contains('dirty')) return;
        
        saveBtn.classList.add('loading');
        
        setTimeout(() => {
            saveBtn.classList.remove('loading');
            saveBtn.classList.remove('dirty');
            captureState();
            const msg = translationEngine.getValueByPath(translations[translationEngine.currentLang], 'msg.save_success') || "Changes saved successfully!";
            showToast(msg);
        }, 1200);
    };

    function showToast(message) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 50);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    document.querySelectorAll('.dirty-check').forEach(input => {
        input.addEventListener('input', checkDirty);
        input.addEventListener('change', checkDirty);
    });

    function handleTags(containerId, isDropdown = false) {
        const container = document.getElementById(containerId);
        const input = container.querySelector('.tag-input');
        
        if (isDropdown) {
            const dropdown = container.querySelector('.tag-dropdown');
            const items = dropdown.querySelectorAll('.tag-drop-item');

            input.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('open');
                container.style.zIndex = dropdown.classList.contains('open') ? "9999" : "1";
                const panel = container.closest('.glass-panel');
                if (panel) panel.style.zIndex = dropdown.classList.contains('open') ? "5000" : "1";
            });

            items.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const val = item.innerText;
                    const existing = Array.from(container.querySelectorAll('.tag')).map(t => t.innerText.replace('×', '').trim());
                    if (!existing.includes(val)) {
                        const tag = document.createElement('div');
                        tag.className = 'tag';
                        tag.innerHTML = `${val} <svg class="action-btn-wrap" onclick="this.closest('.tag').remove()" data-i18n-title="btn.delete" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                        container.insertBefore(tag, input);
                        if (typeof translationEngine !== 'undefined') translationEngine.translateNewElements(tag);
                        checkDirty();
                    }
                    dropdown.classList.remove('open');
                });
            });
        } else {
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault(); const val = input.value.trim();
                if (val) { const tag = document.createElement('div'); tag.className = 'tag'; tag.innerHTML = `${val} <svg class="action-btn-wrap" onclick="this.closest('.tag').remove()" data-i18n-title="btn.delete" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`; container.insertBefore(tag, input); if (typeof translationEngine !== 'undefined') translationEngine.translateNewElements(tag); input.value = ''; checkDirty(); }
            }});
        }
        container.addEventListener('click', (e) => { const btn = e.target.closest('.tag-remove'); if (btn) { btn.closest('.tag').remove(); checkDirty(); }});
    }
    handleTags('bcc-tags-wrap'); handleTags('spec-tags-wrap', true);

    function initCustomSelect(idOrEl) {
        const wrap = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
        if (!wrap) return;
        const trigger = wrap.querySelector('.custom-select-trigger');
        const valSpan = wrap.querySelector('.curr-val');
        const list = wrap.querySelector('.custom-select-list');
        const options = wrap.querySelectorAll('.custom-select-option');

        if (!trigger || !list) return;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = list.classList.toggle('open');
            wrap.classList.toggle('open', isOpen);
            
            const panel = wrap.closest('.glass-panel');
            wrap.style.zIndex = isOpen ? "100" : "1";
            if (panel) panel.style.zIndex = isOpen ? "10" : "1";
            
            document.querySelectorAll('.custom-select-list').forEach(l => {
                if (l !== list) {
                    l.classList.remove('open');
                    const parentWrap = l.closest('.custom-select-wrap');
                    if (parentWrap) {
                        parentWrap.classList.remove('open');
                        parentWrap.style.zIndex = "1";
                        const parentPanel = parentWrap.closest('.glass-panel');
                        if (parentPanel) parentPanel.style.zIndex = "1";
                    }
                }
            });
        });

        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                if (valSpan) valSpan.innerHTML = opt.innerHTML;
                list.classList.remove('open');
                wrap.classList.remove('open');
                wrap.style.zIndex = "1";
                const panel = wrap.closest('.glass-panel');
                if (panel) panel.style.zIndex = "1";
                
                if (wrap.id === 'select-status') {
                    const pill = valSpan.querySelector('.status-pill');
                    if (pill) pill.style.margin = "0";
                }
                
                const hiddenInput = wrap.querySelector('input.dirty-check');
                if (hiddenInput) {
                    hiddenInput.value = opt.dataset.value || opt.innerText;
                }
                
                checkDirty();
            });
        });
    }

    function initCustomDatePicker(wrapperId) {
        const wrap = document.getElementById(wrapperId);
        if (!wrap) return;
        const trigger = wrap.querySelector('.datepicker-trigger');
        const popup = wrap.querySelector('.datepicker-popup');
        const hiddenInput = wrap.querySelector('.datepicker-input');
        const displayVal = wrap.querySelector('.date-val');
        let viewDate = new Date(hiddenInput.value || new Date());
        let selectedDate = new Date(hiddenInput.value || new Date());

        function renderCalendar() {
            const today = new Date();
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const lang = translationEngine.currentLang;
            const monthNames = translations[lang].date.months;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDayIndex = new Date(year, month, 1).getDay();
            const adjFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

            const weekdays = translations[lang].date.weekdays;
            const weekdaysHTML = weekdays.map(w => `<div class="weekday">${w}</div>`).join('');

            let html = `
                <div class="calendar-header">
                    <span class="calendar-title">${monthNames[month]} ${year}</span>
                    <div class="calendar-nav">
                        <button class="nav-btn prev-mon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>
                        <button class="nav-btn next-mon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>
                    </div>
                </div>
                <div class="calendar-grid">
                    ${weekdaysHTML}
            `;
            for (let i = 0; i < adjFirstDay; i++) html += `<div class="calendar-day other-month"></div>`;
            for (let d = 1; d <= daysInMonth; d++) {
                const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
                const isSel = selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
                const cls = `calendar-day ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''}`;
                html += `<div class="${cls}" data-day="${d}">${d}</div>`;
            }
            popup.innerHTML = html + `</div>`;
            popup.querySelector('.prev-mon').onclick = (e) => { e.stopPropagation(); viewDate.setMonth(viewDate.getMonth() - 1); renderCalendar(); };
            popup.querySelector('.next-mon').onclick = (e) => { e.stopPropagation(); viewDate.setMonth(viewDate.getMonth() + 1); renderCalendar(); };
            popup.querySelectorAll('.calendar-day:not(.other-month)').forEach(dayEl => {
                dayEl.onclick = (e) => {
                    e.stopPropagation();
                    const day = parseInt(dayEl.dataset.day);
                    selectedDate = new Date(year, month, day);
                    hiddenInput.value = selectedDate.toISOString().split('T')[0];
                    displayVal.innerText = `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`;
                    popup.classList.remove('open');
                    wrap.classList.remove('open');
                    if (wrap.closest('.glass-panel')) wrap.closest('.glass-panel').style.zIndex = "1";
                    checkDirty();
                }
            });
        }

        trigger.onclick = (e) => {
            e.stopPropagation();
            const isOpen = popup.classList.contains('open');
            document.querySelectorAll('.datepicker-popup, .custom-select-list').forEach(p => p.classList.remove('open'));
            document.querySelectorAll('.custom-select-wrap, .custom-datepicker-wrap').forEach(w => { 
                w.classList.remove('open'); w.style.zIndex="1"; 
                if (w.closest('.glass-panel')) w.closest('.glass-panel').style.zIndex="1";
            });
            if (!isOpen) { 
                popup.classList.add('open');
                wrap.classList.add('open');
                wrap.style.zIndex = "9999";
                if (wrap.closest('.glass-panel')) wrap.closest('.glass-panel').style.zIndex = "5000";
                renderCalendar(); 
            }
        };

        const btnAddNote = document.getElementById('btn-add-note');
        const noteInput = document.getElementById('new-note-text');
        const notesList = document.getElementById('notes-list');

        if (btnAddNote && noteInput && notesList) {
            btnAddNote.onclick = () => {
                const text = noteInput.value.trim();
                if (!text) return;

                const now = new Date();
                const ts = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
                
                const noteItem = document.createElement('div');
                noteItem.className = 'note-item';
                noteItem.innerHTML = `
                    <div class="note-header">
                        <span class="note-date">${ts}</span>
                        <svg class="action-btn-wrap" onclick="this.parentElement.parentElement.remove(); checkDirty();" data-i18n-title="btn.delete" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>
                    <div class="note-text">${text}</div>
                `;
                
                notesList.prepend(noteItem);
                if (typeof translationEngine !== 'undefined') translationEngine.translateNewElements(noteItem);
                noteInput.value = '';
                checkDirty();
            };
        }

        const btnAddEntry = document.querySelector('[data-i18n="sp.pricing_hist"]').parentElement.querySelector('.nav-btn');
        const pricingBody = document.getElementById('pricing-body');
        if (btnAddEntry && pricingBody) {
            btnAddEntry.onclick = () => {
                const now = new Date();
                const ts = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}`;
                
                const lang = typeof translationEngine !== 'undefined' ? translationEngine.currentLang : 'en';
                const dict = window.translations[lang] || window.translations.en;
                const selProduct = typeof translationEngine !== 'undefined' ? translationEngine.getValueByPath(dict, 'sp.sel_product') || 'Select Product' : 'Select Product';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span class="audit-ts">${ts}</span></td>
                    <td class="product-cell">${selProduct}</td>
                    <td class="stock-cell"><strong>0.0 t</strong></td>
                    <td class="price-cell">0.00</td>
                    <td style="text-align:right;">
                        <div style="display:flex; gap:8px; justify-content:flex-end; align-items:center;">
                            <div class="action-btn-wrap" onclick="window.toggleEditRow(this)">
                                <svg class="edit-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                <svg class="save-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                            </div>
                            <svg class="action-btn-wrap" onclick="this.closest('tr').remove(); checkDirty();" data-i18n-title="btn.delete" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </div>
                    </td>
                `;
                pricingBody.prepend(row);
                if (typeof translationEngine !== 'undefined') translationEngine.translateNewElements(row);
                window.toggleEditRow(row.querySelector('.action-btn-wrap'));
                checkDirty();
            }
        }

        const btnAddLog = document.getElementById('btn-add-log');
        const bccBody = document.getElementById('bcc-logs-body');
        if (btnAddLog && bccBody) {
            btnAddLog.onclick = () => {
                const now = new Date();
                const ts = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}`;
                
                const lang = typeof translationEngine !== 'undefined' ? translationEngine.currentLang : 'en';
                const dict = window.translations[lang] || window.translations.en;
                const newReq = typeof translationEngine !== 'undefined' ? translationEngine.getValueByPath(dict, 'sp.new_req') || 'New Request...' : 'New Request...';
                const selSource = typeof translationEngine !== 'undefined' ? translationEngine.getValueByPath(dict, 'sp.sel_source') || 'Select Source' : 'Select Source';
                const selStatus = typeof translationEngine !== 'undefined' ? translationEngine.getValueByPath(dict, 'sp.sel_status') || 'Select Status' : 'Select Status';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span class="audit-ts">${ts}</span></td>
                    <td class="log-desc-cell" contenteditable="true" style="background:rgba(24,144,255,0.05); border-radius:4px;"><strong>${newReq}</strong></td>
                    <td class="log-source-cell">${selSource}</td>
                    <td class="log-status-cell">${selStatus}</td>
                    <td style="text-align:right;">
                        <div style="display:flex; gap:8px; justify-content:flex-end; align-items:center;">
                            <div class="action-btn-wrap" onclick="window.toggleEditLog(this)">
                                <svg class="edit-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                <svg class="save-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                            </div>
                            <svg class="action-btn-wrap" onclick="this.closest('tr').remove(); checkDirty();" data-i18n-title="btn.delete" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </div>
                    </td>
                `;
                bccBody.prepend(row);
                if (typeof translationEngine !== 'undefined') translationEngine.translateNewElements(row);
                window.toggleEditLog(row.querySelector('.action-btn-wrap'));
                checkDirty();
            }
        }
    }

    window.toggleEditLog = function(btn) {
        const row = btn.closest('tr');
        const isEditing = row.classList.toggle('editing');
        const descCell = row.querySelector('.log-desc-cell');
        const sourceCell = row.querySelector('.log-source-cell');
        const statusCell = row.querySelector('.log-status-cell');

        if (isEditing) {
            const lang = typeof translationEngine !== 'undefined' ? translationEngine.currentLang : 'en';
            const dict = window.translations ? window.translations[lang] || window.translations.en : {};
            const tEngine = typeof translationEngine !== 'undefined' ? translationEngine : null;

            descCell.contentEditable = true;
            
            const curSource = sourceCell.innerText.trim();
            const sources = ['bcc_tool', 'email', 'phone', 'messenger', 'other'];
            const sOpts = sources.map(s => {
                const text = tEngine ? tEngine.getValueByPath(dict, `opt.${s}`) || s : s;
                return `<div class="custom-select-option" data-value="${s}">${text}</div>`;
            }).join('');
            
            sourceCell.innerHTML = `
                <div class="custom-select-wrap custom-select-sm">
                    <div class="glass-input custom-select-trigger" style="margin:0;">
                        <span class="curr-val">${curSource}</span>
                        <svg class="select-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                    <div class="custom-select-list">${sOpts}</div>
                </div>
            `;
            initCustomSelect(sourceCell.querySelector('.custom-select-wrap'));
            
            const curStatus = statusCell.innerText.trim();
            const statuses = ['pending', 'replied'];
            const stOpts = statuses.map(s => {
                const text = tEngine ? tEngine.getValueByPath(dict, `st.${s}`) || s : s;
                const pillType = s === 'replied' ? 'pill-success' : 'pill-warning';
                return `<div class="custom-select-option" data-value="${s}"><span class="status-pill ${pillType}" style="font-size:9px">${text}</span></div>`;
            }).join('');
            
            statusCell.innerHTML = `
                <div class="custom-select-wrap custom-select-sm">
                    <div class="glass-input custom-select-trigger" style="margin:0;">
                        <span class="curr-val">${statusCell.innerHTML}</span>
                        <svg class="select-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                    <div class="custom-select-list">${stOpts}</div>
                </div>
            `;
            initCustomSelect(statusCell.querySelector('.custom-select-wrap'));

        } else {
            descCell.contentEditable = false;
            
            const sVal = sourceCell.querySelector('.curr-val');
            if (sVal) sourceCell.innerText = sVal.innerText;
            
            const stVal = statusCell.querySelector('.curr-val');
            if (stVal) {
                statusCell.innerHTML = stVal.innerHTML;
            }
            const flag = document.getElementById('table-dirty-flag');
            if (flag) flag.value = parseInt(flag.value) + 1;
            checkDirty();
        }
    };

    window.toggleEditRow = function(btn) {
        const row = btn.closest('tr');
        const isEditing = row.classList.toggle('editing');
        const prodCell = row.querySelector('.product-cell');
        const stockCell = row.querySelector('.stock-cell');
        const priceCell = row.querySelector('.price-cell');
        
        const catalog = ['Sheet 10mm', 'Pipe 100x100', 'Rod 16mm', 'I-Beam 200mm', 'Channel 140mm', 'Stainless 5.0mm'];

        if (isEditing) {
            const current = prodCell.innerText.trim();
            const optionsHTML = catalog.map(p => `<div class="custom-select-option" data-value="${p}">${p}</div>`).join('');
            
            prodCell.innerHTML = `
                <div class="custom-select-wrap custom-select-sm">
                    <div class="glass-input custom-select-trigger" style="margin:0;">
                        <span class="curr-val">${current}</span>
                        <svg class="select-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                    <div class="custom-select-list">
                        ${optionsHTML}
                    </div>
                </div>
            `;
            
            initCustomSelect(prodCell.querySelector('.custom-select-wrap'));
            
            stockCell.contentEditable = true;
            priceCell.contentEditable = true;
        } else {
            const val = prodCell.querySelector('.curr-val');
            if (val) prodCell.innerText = val.innerText;
            
            stockCell.contentEditable = false;
            priceCell.contentEditable = false;
            
            const flag = document.getElementById('table-dirty-flag');
            if (flag) flag.value = parseInt(flag.value) + 1;
            checkDirty();
        }
    };

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select-list, .tag-dropdown, .datepicker-popup').forEach(l => l.classList.remove('open'));
        document.querySelectorAll('.custom-select-wrap, .custom-datepicker-wrap').forEach(w => {
            w.classList.remove('open');
            w.style.zIndex = "1";
            const panel = w.closest('.glass-panel');
            if (panel) panel.style.zIndex = "1";
        });
    });

    initCustomSelect('select-currency');
    initCustomSelect('select-payment');
    initCustomSelect('select-rating');
    initCustomSelect('select-min-currency');
    initCustomSelect('select-status');
    initCustomDatePicker('datepicker-contract');

    setTimeout(captureState, 1500);

    document.querySelectorAll('.file-action-btn[download]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            const svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 80" width="100%" height="100%">
      <path fill="#ffffff" fill-rule="evenodd" d="M 4 64 L 4 26 L 2 26 L 2 20 L 16 20 L 16 26 L 12 26 L 12 30 L 32 42 L 32 30 L 52 42 L 52 30 L 72 42 L 72 64 Z M 17 48 L 27 48 L 27 56 L 17 56 Z M 37 48 L 47 48 L 47 56 L 37 56 Z M 57 48 L 67 48 L 67 56 L 57 56 Z" />
      <text x="86" y="60" font-family="Arial" font-size="52" font-weight="800" fill="#ffffff">Flexiron</text>
      <text x="290" y="60" font-family="Arial" font-size="52" font-weight="800" fill="#1890FF">Enterprise</text>
    </svg>`;

            const base64Content = window.btoa(unescape(encodeURIComponent(svgData)));
            const dataUrl = 'data:image/svg+xml;base64,' + base64Content;

            const downloadLink = document.createElement('a');
            downloadLink.href = dataUrl;
            downloadLink.download = 'Flexiron_Logo.svg';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        });
    });

    const fileInput = document.getElementById('file-upload-input');
    const fileList = document.getElementById('supplier-files');

    if (fileInput && fileList) {
        fileInput.addEventListener('change', function(e) {
            Array.from(e.target.files).forEach(file => {
                const url = window.URL.createObjectURL(file);
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <div class="file-info">
                        <svg class="action-btn-wrap" style="color:#1890FF;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span class="file-name">${file.name}</span>
                    </div>
                    <div class="file-actions">
                        <a class="file-action-btn">
                            <svg class="action-btn-wrap" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        </a>
                        <svg class="action-btn-wrap" onclick="this.closest('.file-item').remove(); checkDirty();" data-i18n-title="btn.delete" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>
                `;

                fileItem.querySelector('.file-action-btn').onclick = (e) => {
                    e.preventDefault();

                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const link = document.createElement('a');
                        link.href = event.target.result;
                        link.download = file.name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    };
                    reader.readAsDataURL(file);
                };
                fileList.appendChild(fileItem);
                if (typeof translationEngine !== 'undefined') translationEngine.translateNewElements(fileItem);
                checkDirty();
            });
        });
    }

    const btnAddNote = document.getElementById('btn-add-note');
    const noteText = document.getElementById('new-note-text');
    const notesList = document.getElementById('notes-list');
    
    if (btnAddNote && noteText && notesList) {
        btnAddNote.onclick = function() {
            const val = noteText.value.trim();
            if (!val) return;
            
            const now = new Date().toLocaleString();
            const noteItem = document.createElement('div');
            noteItem.className = 'note-item';
            noteItem.innerHTML = `
                <div class="note-header">
                    <span class="note-date">${now}</span>
                    <svg class="action-btn-wrap" onclick="this.parentElement.parentElement.remove(); checkDirty();" data-i18n-title="btn.delete" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
                <div class="note-text">${val}</div>
            `;
            notesList.insertBefore(noteItem, notesList.firstChild);
            if (typeof translationEngine !== 'undefined') translationEngine.translateNewElements(noteItem);
            noteText.value = '';
            checkDirty();
        };
    }

    setTimeout(() => { document.querySelectorAll('[data-i18n]').forEach(el => el.style.opacity = '1'); }, 100);
});
