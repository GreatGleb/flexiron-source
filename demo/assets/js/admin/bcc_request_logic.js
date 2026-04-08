window.addEventListener('DOMContentLoaded', () => {
    // ============================================
    // DATA
    // ============================================
    const state = {
        categories: [
            {
                id: 'sheets',
                name: 'Sheets',
                nameKey: 'bcc.cat_sheets',
                supplierCount: 12,
                products: [
                    { id: 'sheet-2mm', name: 'Sheet 2mm', nameKey: 'bcc.prod_sheet_2mm', suppliers: ['sup-001', 'sup-002', 'sup-004', 'sup-005'] },
                    { id: 'sheet-3mm', name: 'Sheet 3mm', nameKey: 'bcc.prod_sheet_3mm', suppliers: ['sup-001', 'sup-002'] },
                    { id: 'sheet-5mm', name: 'Sheet 5mm', nameKey: 'bcc.prod_sheet_5mm', suppliers: ['sup-001', 'sup-004'] },
                    { id: 'sheet-10mm', name: 'Sheet 10mm', nameKey: 'bcc.prod_sheet_10mm', suppliers: ['sup-002', 'sup-005'] }
                ]
            },
            {
                id: 'lintels',
                name: 'Lintels',
                nameKey: 'bcc.cat_lintels',
                supplierCount: 8,
                products: [
                    { id: 'lintel-100', name: 'Lintel 100x100', nameKey: 'bcc.prod_lintel_100', suppliers: ['sup-003'] },
                    { id: 'lintel-150', name: 'Lintel 150x150', nameKey: 'bcc.prod_lintel_150', suppliers: ['sup-003'] }
                ]
            },
            {
                id: 'beams',
                name: 'Beams',
                nameKey: 'bcc.cat_beams',
                supplierCount: 5,
                products: [
                    { id: 'beam-i20', name: 'I-Beam 20', nameKey: 'bcc.prod_beam_i20', suppliers: ['sup-002', 'sup-004'] },
                    { id: 'beam-i30', name: 'I-Beam 30', nameKey: 'bcc.prod_beam_i30', suppliers: ['sup-002'] },
                    { id: 'beam-heb', name: 'HEB Beam', nameKey: 'bcc.prod_beam_heb', suppliers: ['sup-004'] }
                ]
            },
            {
                id: 'pipes',
                name: 'Pipes',
                nameKey: 'bcc.cat_pipes',
                supplierCount: 15,
                products: [
                    { id: 'pipe-50', name: 'Pipe 50mm', nameKey: 'bcc.prod_pipe_50', suppliers: ['sup-001', 'sup-004'] },
                    { id: 'pipe-100', name: 'Pipe 100mm', nameKey: 'bcc.prod_pipe_100', suppliers: ['sup-001'] },
                    { id: 'pipe-150', name: 'Pipe 150mm', nameKey: 'bcc.prod_pipe_150', suppliers: ['sup-004'] }
                ]
            },
            {
                id: 'rebars',
                name: 'Rebars',
                nameKey: 'bcc.cat_rebars',
                supplierCount: 10,
                products: [
                    { id: 'rebar-12', name: 'Rebar 12mm', nameKey: 'bcc.prod_rebar_12', suppliers: ['sup-003', 'sup-005'] },
                    { id: 'rebar-16', name: 'Rebar 16mm', nameKey: 'bcc.prod_rebar_16', suppliers: ['sup-003', 'sup-005'] },
                    { id: 'rebar-20', name: 'Rebar 20mm', nameKey: 'bcc.prod_rebar_20', suppliers: ['sup-005'] }
                ]
            }
        ],
        selectedCategories: [],
        selectedProducts: [],
        recipients: [],
        emailTemplate: {
            subject: 'Price Request for Metal - InBox LT',
            body: 'Hello!\n\nPlease provide current prices for the following items:\n\n\nBest regards,\nInBox LT Team',
            attachments: []
        },
        // Event-sourcing style: each row = one product + one supplier
        // requestId groups rows, changes create new rows with same requestId
        requestHistory: [
            // Request 001 - Sheet 2mm to 3 suppliers
            { id: 'evt-001', requestId: 'req-001', date: '2026-04-05', supplierId: 'sup-001', supplierName: 'MetalProm LLC', productId: 'sheet-2mm', productNameKey: 'bcc.prod_sheet_2mm', status: 'sent' },
            { id: 'evt-002', requestId: 'req-001', date: '2026-04-05', supplierId: 'sup-002', supplierName: 'SteelWorks Inc', productId: 'sheet-2mm', productNameKey: 'bcc.prod_sheet_2mm', status: 'sent' },
            { id: 'evt-003', requestId: 'req-001', date: '2026-04-05', supplierId: 'sup-004', supplierName: 'NordMetal Ltd', productId: 'sheet-2mm', productNameKey: 'bcc.prod_sheet_2mm', status: 'sent' },
            // Request 002 - I-Beam 20 with responses
            { id: 'evt-004', requestId: 'req-002', date: '2026-04-02', supplierId: 'sup-002', supplierName: 'SteelWorks Inc', productId: 'beam-i20', productNameKey: 'bcc.prod_beam_i20', status: 'sent' },
            { id: 'evt-005', requestId: 'req-002', date: '2026-04-02', supplierId: 'sup-004', supplierName: 'NordMetal Ltd', productId: 'beam-i20', productNameKey: 'bcc.prod_beam_i20', status: 'sent' },
            { id: 'evt-006', requestId: 'req-002', date: '2026-04-04', supplierId: 'sup-002', supplierName: 'SteelWorks Inc', productId: 'beam-i20', productNameKey: 'bcc.prod_beam_i20', status: 'responded', price: 85000, unit: 'ton' },
            { id: 'evt-007', requestId: 'req-002', date: '2026-04-06', supplierId: 'sup-004', supplierName: 'NordMetal Ltd', productId: 'beam-i20', productNameKey: 'bcc.prod_beam_i20', status: 'no_response' }
        ],
        responseModal: {
            isOpen: false,
            requestId: null,
            supplierId: null,
            supplierName: '',
            categories: [],
            price: '',
            unit: 'kg'
        }
    };

    // Mock suppliers data
    const suppliersDB = [
        { id: 'sup-001', name: 'MetalProm LLC', email: 'info@metalprom.ru', categories: ['sheets', 'pipes'] },
        { id: 'sup-002', name: 'SteelWorks Inc', email: 'sales@steelworks.com', categories: ['sheets', 'beams'] },
        { id: 'sup-003', name: 'IronBridge Corp', email: 'tender@ironbridge.net', categories: ['lintels', 'rebars'] },
        { id: 'sup-004', name: 'NordMetal Ltd', email: 'prices@nordmetal.eu', categories: ['pipes', 'beams', 'sheets'] },
        { id: 'sup-005', name: 'UralSteel JSC', email: 'export@uralsteel.ru', categories: ['rebars', 'sheets'] }
    ];

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const panels = document.querySelectorAll('.glass-panel.loading');
    const sendBtn = document.getElementById('send-bcc-btn');
    const categoryTree = document.getElementById('category-tree');
    const categorySelect = document.getElementById('category-select');
    const recipientsList = document.getElementById('recipients-list');
    const historyTable = document.getElementById('history-table');
    const responseModal = document.getElementById('accept-response-modal');
    const responseModalOverlay = document.getElementById('accept-response-modal-overlay');

    // ============================================
    // TRANSLATION HELPER
    // ============================================
    function getTranslation(key) {
        const lang = (typeof translationEngine !== 'undefined') ? translationEngine.currentLang : 'en';
        if (typeof translations !== 'undefined' && translations[lang]) {
            const value = (typeof translationEngine !== 'undefined') 
                ? translationEngine.getValueByPath(translations[lang], key)
                : key.split('.').reduce((obj, k) => obj && obj[k], translations[lang]);
            if (value) return value;
        }
        return key;
    }

    function getTranslatedName(item) {
        if (item.nameKey) {
            const translated = getTranslation(item.nameKey);
            if (translated !== item.nameKey) return translated;
        }
        return item.name;
    }

    // ============================================
    // INIT - Loading animation
    // ============================================
    panels.forEach((panel, index) => {
        const baseDelay = 300;
        const staggeredDelay = baseDelay + (index * 100);
        setTimeout(() => {
            panel.classList.remove('loading');
        }, staggeredDelay);
    });

    // ============================================
    // MULTI-SELECT CATEGORIES (fallback)
    // ============================================
    function initMultiSelect() {
        const wrap = categorySelect;
        if (!wrap) return;

        const trigger = wrap.querySelector('.custom-select-trigger');
        const tagsContainer = wrap.querySelector('.multi-select-tags');
        const list = wrap.querySelector('.multi-select-list');

        // Populate options with products grouped by category
        let optionsHtml = '';
        state.categories.forEach(cat => {
            optionsHtml += `<div class="multi-select-group">
                <div class="multi-select-group-label">${getTranslatedName(cat)}</div>`;
            cat.products.forEach(prod => {
                optionsHtml += `<label class="multi-select-option">
                    <input type="checkbox" value="${prod.id}" data-name="${getTranslatedName(prod)}" data-category="${cat.id}">
                    <span>${getTranslatedName(prod)}</span>
                </label>`;
            });
            optionsHtml += `</div>`;
        });
        list.innerHTML = optionsHtml;

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = list.classList.toggle('open');
            wrap.classList.toggle('open', isOpen);
            wrap.style.zIndex = isOpen ? "100" : "1";
            const panel = wrap.closest('.glass-panel');
            if (panel) panel.style.zIndex = isOpen ? "10" : "1";
        });

        // Handle checkbox changes
        list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                updateSelectedProducts();
                renderProductTags();
                loadRecipients();
                updateEmailTemplate();
            });
        });

        // Click outside to close
        document.addEventListener('click', () => {
            list.classList.remove('open');
            wrap.classList.remove('open');
            wrap.style.zIndex = "1";
            const panel = wrap.closest('.glass-panel');
            if (panel) panel.style.zIndex = "1";
        });
    }

    function updateSelectedProducts() {
        if (!categorySelect) return;
        const checkboxes = categorySelect.querySelectorAll('input[type="checkbox"]:checked');
        state.selectedProducts = Array.from(checkboxes).map(cb => cb.value);
    }

    function renderProductTags() {
        if (!categorySelect) return;
        const tagsContainer = categorySelect.querySelector('.multi-select-tags');
        if (!tagsContainer) return;
        
        if (state.selectedProducts.length === 0) {
            tagsContainer.innerHTML = `<span class="multi-select-placeholder" data-i18n="bcc.select_products" style="opacity:1;">${getTranslation('bcc.select_products')}</span>`;
            return;
        }
        
        tagsContainer.innerHTML = state.selectedProducts.map(prodId => {
            let prodName = '';
            for (const cat of state.categories) {
                const prod = cat.products.find(p => p.id === prodId);
                if (prod) { prodName = getTranslatedName(prod); break; }
            }
            return `<div class="tag">${prodName}<svg class="tag-remove" onclick="removeProduct('${prodId}')" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>`;
        }).join('');
    }

    window.removeProduct = function(prodId) {
        const cb = categorySelect.querySelector(`input[value="${prodId}"]`);
        if (cb) cb.checked = false;
        updateSelectedProducts();
        renderProductTags();
        loadRecipients();
        updateEmailTemplate();
    };

    function loadRecipientsByCategory() {
        if (state.selectedCategories.length === 0) {
            state.recipients = [];
            renderRecipients();
            updateSupplierCount();
            return;
        }

        state.recipients = suppliersDB
            .filter(s => s.categories.some(c => state.selectedCategories.includes(c)))
            .map(s => ({ ...s, selected: true }));

        renderRecipients();
        updateSupplierCount();
    }

    function updateEmailTemplateByCategory() {
        const bodyInput = document.querySelector('.body-input');
        if (!bodyInput) return;

        const itemsList = state.selectedCategories.map(catId => {
            const cat = state.categories.find(c => c.id === catId);
            return cat ? `  - ${getTranslatedName(cat)}` : '';
        }).filter(Boolean).join('\n');

        const itemsSection = itemsList || 'All categories';

        bodyInput.value = `Hello!

Please provide current prices for the following items:

${itemsSection}

Best regards,
InBox LT Team`;

        state.emailTemplate.body = bodyInput.value;
    }

    // ============================================
    // CATEGORY TREE
    // ============================================
    function initCategoryTree() {
        if (!categoryTree) return;

        categoryTree.innerHTML = state.categories.map(cat => `
            <div class="category-node" data-category="${cat.id}">
                <div class="category-header">
                    <button type="button" class="expand-btn" data-category="${cat.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                    <label class="category-checkbox">
                        <input type="checkbox" data-category="${cat.id}">
                        <span class="category-name">${getTranslatedName(cat)}</span>
                        <span class="category-count">(${cat.supplierCount} ${getTranslation('bcc.suppliers')})</span>
                    </label>
                </div>
                <div class="category-products" data-category="${cat.id}">
                    ${cat.products.map(prod => `
                        <label class="product-checkbox">
                            <input type="checkbox" data-product="${prod.id}" data-category="${cat.id}">
                            <span class="product-name">${getTranslatedName(prod)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Expand/collapse buttons
        categoryTree.querySelectorAll('.expand-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const catId = btn.dataset.category;
                const node = btn.closest('.category-node');
                node.classList.toggle('expanded');
                btn.style.transform = node.classList.contains('expanded') ? 'rotate(90deg)' : '';
            });
        });

        // Category checkboxes
        categoryTree.querySelectorAll('input[data-category]:not([data-product])').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const catId = cb.dataset.category;
                const cat = state.categories.find(c => c.id === catId);
                const productCbs = categoryTree.querySelectorAll(`input[data-product][data-category="${catId}"]`);

                // Check/uncheck all products in category
                productCbs.forEach(pcb => {
                    pcb.checked = cb.checked;
                    toggleProduct(pcb.dataset.product, cb.checked);
                });

                updateSelectedState();
                loadRecipients();
                updateEmailTemplate();
            });
        });

        // Product checkboxes
        categoryTree.querySelectorAll('input[data-product]').forEach(cb => {
            cb.addEventListener('change', () => {
                toggleProduct(cb.dataset.product, cb.checked);
                updateCategoryCheckboxState(cb.dataset.category);
                updateSelectedState();
                loadRecipients();
                updateEmailTemplate();
            });
        });
    }

    function toggleProduct(productId, selected) {
        if (selected) {
            if (!state.selectedProducts.includes(productId)) {
                state.selectedProducts.push(productId);
            }
        } else {
            state.selectedProducts = state.selectedProducts.filter(id => id !== productId);
        }
    }

    function updateCategoryCheckboxState(catId) {
        const cat = state.categories.find(c => c.id === catId);
        const catCb = categoryTree.querySelector(`input[data-category="${catId}"]:not([data-product])`);
        const productCbs = categoryTree.querySelectorAll(`input[data-product][data-category="${catId}"]`);

        const allChecked = Array.from(productCbs).every(cb => cb.checked);
        const someChecked = Array.from(productCbs).some(cb => cb.checked);

        catCb.checked = allChecked;
        catCb.indeterminate = someChecked && !allChecked;

        // Update selectedCategories
        if (allChecked && !state.selectedCategories.includes(catId)) {
            state.selectedCategories.push(catId);
        } else if (!allChecked) {
            state.selectedCategories = state.selectedCategories.filter(id => id !== catId);
        }
    }

    function updateSelectedState() {
        // Update supplier count
        const supplierIds = new Set();
        state.selectedProducts.forEach(prodId => {
            state.categories.forEach(cat => {
                const prod = cat.products.find(p => p.id === prodId);
                if (prod) {
                    prod.suppliers.forEach(supId => supplierIds.add(supId));
                }
            });
        });

        const countEl = document.getElementById('active-supplier-count');
        if (countEl) countEl.textContent = supplierIds.size;

        const badge = document.querySelector('[data-i18n="bcc.categories"]')?.closest('.glass-panel')?.querySelector('.panel-badge');
        if (badge) badge.textContent = `${supplierIds.size} suppliers`;
    }

    function updateEmailTemplate() {
        const bodyInput = document.querySelector('.body-input');
        if (!bodyInput) return;

        // Build items list from selected products
        const itemsList = state.selectedProducts.map(prodId => {
            for (const cat of state.categories) {
                const prod = cat.products.find(p => p.id === prodId);
                if (prod) return `  - ${getTranslatedName(prod)}`;
            }
            return '';
        }).filter(Boolean).join('\n');

        const itemsSection = itemsList || 'All categories';

        bodyInput.value = `Hello!

Please provide current prices for the following items:

${itemsSection}

Best regards,
InBox LT Team`;

        state.emailTemplate.body = bodyInput.value;
    }

    // ============================================
    // RECIPIENTS (CHECKBOX LIST)
    // ============================================
    function loadRecipients() {
        if (state.selectedProducts.length === 0) {
            state.recipients = [];
            renderRecipients();
            updateSupplierCount();
            return;
        }

        // Filter suppliers by selected products
        const supplierIds = new Set();
        state.selectedProducts.forEach(prodId => {
            state.categories.forEach(cat => {
                const prod = cat.products.find(p => p.id === prodId);
                if (prod) {
                    prod.suppliers.forEach(supId => supplierIds.add(supId));
                }
            });
        });

        state.recipients = suppliersDB
            .filter(s => supplierIds.has(s.id))
            .map(s => ({ ...s, selected: true }));

        renderRecipients();
        updateSupplierCount();
    }

    function renderRecipients() {
        const itemsContainer = recipientsList.querySelector('.checkbox-list-items');
        if (!itemsContainer) return;

        if (state.recipients.length === 0) {
            itemsContainer.innerHTML = '<div class="empty-state">Select products to see suppliers</div>';
            return;
        }

        itemsContainer.innerHTML = state.recipients.map(r => `
            <label class="checkbox-item">
                <input type="checkbox" value="${r.id}" ${r.selected ? 'checked' : ''}>
                <span class="checkbox-label">${r.name}</span>
                <span class="checkbox-email">${r.email}</span>
            </label>
        `).join('');

        // Add event listeners
        itemsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const recipient = state.recipients.find(r => r.id === e.target.value);
                if (recipient) recipient.selected = e.target.checked;
                updateSelectedCount();
            });
        });

        updateSelectedCount();
    }

    function updateSupplierCount() {
        const countEl = document.getElementById('active-supplier-count');
        if (countEl) countEl.textContent = state.recipients.length;

        const badge = document.querySelector('[data-i18n="bcc.categories"]')?.closest('.glass-panel')?.querySelector('.panel-badge');
        if (badge) {
            const countSpan = badge.querySelector('.badge-count');
            if (countSpan) countSpan.textContent = state.recipients.length;
        }
    }

    function updateSelectedCount() {
        const selected = state.recipients.filter(r => r.selected).length;
        const countEl = recipientsList.querySelector('.selected-count .count');
        if (countEl) countEl.textContent = selected;

        const badge = document.querySelector('[data-i18n="bcc.recipients"]')?.closest('.glass-panel')?.querySelector('.panel-badge');
        if (badge) {
            const countSpan = badge.querySelector('.badge-count');
            if (countSpan) countSpan.textContent = selected;
        }
    }

    function initCheckboxListControls() {
        const selectAllBtn = recipientsList.querySelector('[data-action="select-all"]');
        const deselectAllBtn = recipientsList.querySelector('[data-action="deselect-all"]');
        const searchInput = recipientsList.querySelector('.search-input');

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                state.recipients.forEach(r => r.selected = true);
                renderRecipients();
            });
        }

        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                state.recipients.forEach(r => r.selected = false);
                renderRecipients();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const items = recipientsList.querySelectorAll('.checkbox-item');
                items.forEach(item => {
                    const name = item.querySelector('.checkbox-label').textContent.toLowerCase();
                    const email = item.querySelector('.checkbox-email').textContent.toLowerCase();
                    const visible = name.includes(query) || email.includes(query);
                    item.style.display = visible ? '' : 'none';
                });
            });
        }
    }

    // ============================================
    // EMAIL TEMPLATE
    // ============================================
    function initEmailTemplate() {
        const subjectInput = document.querySelector('.subject-input');
        const bodyInput = document.querySelector('.body-input');

        if (subjectInput) {
            subjectInput.value = state.emailTemplate.subject;
            subjectInput.addEventListener('input', (e) => {
                state.emailTemplate.subject = e.target.value;
            });
        }

        if (bodyInput) {
            bodyInput.value = state.emailTemplate.body;
            bodyInput.addEventListener('input', (e) => {
                state.emailTemplate.body = e.target.value;
            });
        }

        // Dropzone for attachments
        const dropzone = document.getElementById('attachment-upload');
        if (dropzone) {
            dropzone.addEventListener('change', (e) => {
                Array.from(e.target.files).forEach(file => {
                    state.emailTemplate.attachments.push({
                        name: file.name,
                        size: file.size,
                        file: file
                    });
                });
                renderAttachments();
            });
        }
    }

    // Auto-substitute variables in email content
    function substituteVariables(text) {
        const today = new Date();
        const dateStr = today.toLocaleDateString('en-GB');
        
        // Build items list from selected categories
        const itemsList = state.selectedCategories.map(catId => {
            const cat = state.categories.find(c => c.id === catId);
            return cat ? `  - ${getTranslatedName(cat)}` : '';
        }).filter(Boolean).join('\n');

        return text
            .replace(/\{\{date\}\}/g, dateStr)
            .replace(/\{\{items_list\}\}/g, itemsList || 'All metal categories')
            .replace(/\{\{company_signature\}\}/g, 'InBox LT Team');
    }

    function renderAttachments() {
        const container = document.querySelector('.email-attachments');
        if (!container) return;

        const existingList = container.querySelector('.attachment-list');
        if (existingList) existingList.remove();

        if (state.emailTemplate.attachments.length === 0) return;

        const list = document.createElement('div');
        list.className = 'attachment-list';
        list.innerHTML = state.emailTemplate.attachments.map((att, i) => `
            <div class="attachment-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>${att.name}</span>
                <svg class="action-btn-wrap" onclick="removeAttachment(${i})" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
        `).join('');
        container.appendChild(list);
    }

    window.removeAttachment = function(index) {
        state.emailTemplate.attachments.splice(index, 1);
        renderAttachments();
    };

    // ============================================
    // SEND BCC REQUEST
    // ============================================
    function initSendButton() {
        sendBtn.addEventListener('click', () => {
            if (!validateBeforeSend()) return;

            sendBtn.classList.add('loading');

            // Get final email content with substituted variables
            const subjectInput = document.querySelector('.subject-input');
            const bodyInput = document.querySelector('.body-input');
            const finalSubject = substituteVariables(subjectInput?.value || '');
            const finalBody = substituteVariables(bodyInput?.value || '');

            console.log('Sending BCC Request:', {
                subject: finalSubject,
                body: finalBody,
                recipients: state.recipients.filter(r => r.selected).length,
                attachments: state.emailTemplate.attachments.length
            });

            // Simulate API call
            setTimeout(() => {
                const selectedRecipients = state.recipients.filter(r => r.selected);
                const requestId = `req-${Date.now()}`;
                const today = new Date().toISOString().split('T')[0];
                
                // Get product details for selected products
                const selectedProductDetails = state.selectedProducts.map(prodId => {
                    for (const cat of state.categories) {
                        const prod = cat.products.find(p => p.id === prodId);
                        if (prod) return { id: prod.id, nameKey: prod.nameKey };
                    }
                    return null;
                }).filter(Boolean);

                // Create one row per product per supplier
                let rowIndex = 0;
                selectedProductDetails.forEach(prod => {
                    selectedRecipients.forEach(r => {
                        state.requestHistory.unshift({
                            id: `evt-${Date.now()}-${rowIndex++}`,
                            requestId: requestId,
                            date: today,
                            supplierId: r.id,
                            supplierName: r.name,
                            productId: prod.id,
                            productNameKey: prod.nameKey,
                            status: 'sent'
                        });
                    });
                });

                renderHistoryTable();

                sendBtn.classList.remove('loading');
                showToast(getTranslation('msg.bcc_sent'));

                // Reset form
                resetForm();
            }, 1500);
        });
    }

    function validateBeforeSend() {
        if (state.selectedProducts.length === 0) {
            showToast(getTranslation('msg.select_product'), 'error');
            return false;
        }

        const selectedRecipients = state.recipients.filter(r => r.selected);
        if (selectedRecipients.length === 0) {
            showToast(getTranslation('msg.select_recipient'), 'error');
            return false;
        }

        const subject = document.querySelector('.subject-input')?.value;
        if (!subject || subject.trim() === '') {
            showToast(getTranslation('msg.enter_subject'), 'error');
            return false;
        }

        return true;
    }

    function resetForm() {
        // Clear products
        categorySelect.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        updateSelectedProducts();
        renderProductTags();

        // Clear recipients
        state.recipients = [];
        renderRecipients();
        updateSupplierCount();
    }

    // ============================================
    // HISTORY TABLE (Event-Sourcing Style)
    // Each row = one supplier record
    // Changes create new rows with same requestId
    // ============================================
    function renderHistoryTable() {
        const tbody = historyTable?.querySelector('tbody');
        if (!tbody) return;

        tbody.innerHTML = state.requestHistory.map(evt => `
            <tr data-id="${evt.id}" data-request="${evt.requestId}">
                <td class="date-cell">${formatDate(evt.date)}</td>
                <td class="request-id-cell">
                    <span class="request-id-badge">${evt.requestId.replace('req-', '#')}</span>
                </td>
                <td class="product-cell">${evt.productNameKey ? getTranslation(evt.productNameKey) : (evt.productName || '-')}</td>
                <td class="recipients-cell">${evt.supplierName}</td>
                <td class="status-cell">
                    <span class="status-badge status-${evt.status}">${formatStatus(evt.status)}</span>
                    ${evt.status === 'responded' && evt.price ? 
                        `<span class="response-price">${evt.price} ${evt.unit}</span>` : ''}
                </td>
                <td class="actions-cell">
                    <div style="display: flex; gap: 10px; justify-content: flex-end; align-items: center;">
                    ${evt.status === 'sent' ? `
                        <button type="button" class="action-icon-btn action-success record-response-btn" data-id="${evt.id}" data-i18n-tooltip="bcc.record_response" data-tooltip="${getTranslation('bcc.record_response')}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button type="button" class="action-icon-btn action-danger mark-no-response-btn" data-id="${evt.id}" data-i18n-tooltip="bcc.cancel_request" data-tooltip="${getTranslation('bcc.cancel_request')}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        </button>
                    ` : ''}
                    ${evt.status === 'no_response' ? `
                        <button type="button" class="action-icon-btn action-success record-response-btn" data-id="${evt.id}" data-i18n-tooltip="bcc.record_response" data-tooltip="${getTranslation('bcc.record_response')}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                    ` : ''}
                    ${evt.status === 'responded' ? `
                        <button type="button" class="action-icon-btn action-edit edit-response-btn" data-id="${evt.id}" data-i18n-tooltip="bcc.edit_response" data-tooltip="${getTranslation('bcc.edit_response')}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                    ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        // Add event listeners
        tbody.querySelectorAll('.record-response-btn').forEach(btn => {
            btn.addEventListener('click', () => openResponseModal(btn.dataset.id));
        });

        tbody.querySelectorAll('.mark-no-response-btn').forEach(btn => {
            btn.addEventListener('click', () => markAsNoResponse(btn.dataset.id));
        });

        tbody.querySelectorAll('.edit-response-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = btn.closest('tr');
                const isEditing = btn.classList.toggle('editing');
                
                if (isEditing) {
                    // Change icon to floppy disk (save)
                    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
                    btn.classList.remove('action-edit');
                    btn.classList.add('action-success');
                    btn.dataset.tooltip = getTranslation('btn.save') || 'Save';
                    row.classList.add('row-editing');
                } else {
                    // Save and change back to edit icon
                    openResponseModal(btn.dataset.id);
                    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
                    btn.classList.add('action-edit');
                    btn.classList.remove('action-success');
                    btn.dataset.tooltip = getTranslation('bcc.edit_response') || 'Edit Response';
                    row.classList.remove('row-editing');
                }
            });
        });

        // Add JS tooltips for action buttons
        tbody.querySelectorAll('.action-icon-btn[data-tooltip]').forEach(btn => {
            btn.addEventListener('mouseenter', (e) => showTooltip(btn, btn.dataset.tooltip));
            btn.addEventListener('mouseleave', hideTooltip);
        });
    }

    // JS Tooltip - appends to body to avoid overflow clipping
    let tooltipEl = null;
    function showTooltip(btn, text) {
        if (!text) return;
        
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'js-tooltip';
        tooltipEl.textContent = text;
        tooltipEl.style.cssText = `
            position: fixed;
            padding: 6px 10px;
            background: rgba(30, 34, 40, 0.98);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            color: #fff;
            font-size: 11px;
            font-weight: 500;
            white-space: nowrap;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        document.body.appendChild(tooltipEl);
        
        const rect = btn.getBoundingClientRect();
        tooltipEl.style.left = `${rect.left + rect.width / 2 - tooltipEl.offsetWidth / 2}px`;
        tooltipEl.style.top = `${rect.top - tooltipEl.offsetHeight - 8}px`;
        
        requestAnimationFrame(() => tooltipEl.style.opacity = '1');
    }

    function hideTooltip() {
        if (tooltipEl) {
            tooltipEl.remove();
            tooltipEl = null;
        }
    }

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    }

    function formatStatus(status) {
        const lang = translationEngine.currentLang || 'en';
        const statusKeys = {
            'sent': 'bcc.status_sent',
            'responded': 'bcc.status_responded',
            'no_response': 'bcc.status_no_response'
        };
        const key = statusKeys[status];
        if (key && translations[lang]) {
            const value = translationEngine.getValueByPath(translations[lang], key);
            if (value) return value;
        }
        return status;
    }

    // ============================================
    // RESPONSE ACTIONS (Create new history rows)
    // ============================================
    function markAsNoResponse(eventId) {
        const evt = state.requestHistory.find(e => e.id === eventId);
        if (!evt) return;

        // Create new row with no_response status
        const newEvent = {
            id: `evt-${Date.now()}`,
            requestId: evt.requestId,
            date: new Date().toISOString().split('T')[0],
            supplierId: evt.supplierId,
            supplierName: evt.supplierName,
            productId: evt.productId,
            productNameKey: evt.productNameKey,
            status: 'no_response'
        };

        state.requestHistory.unshift(newEvent);
        renderHistoryTable();
        showToast('Marked as no response');
    }

    function openResponseModal(eventId) {
        const evt = state.requestHistory.find(e => e.id === eventId);
        if (!evt) return;

        state.responseModal = {
            isOpen: true,
            eventId: eventId,
            requestId: evt.requestId,
            supplierId: evt.supplierId,
            supplierName: evt.supplierName,
            productId: evt.productId,
            productNameKey: evt.productNameKey,
            price: evt.price || '',
            unit: evt.unit || 'kg'
        };

        renderResponseModal();
        responseModalOverlay?.classList.add('active');
    }

    function closeResponseModal() {
        state.responseModal.isOpen = false;
        responseModalOverlay?.classList.remove('active');
    }

    function renderResponseModal() {
        const supplierInput = document.getElementById('response-supplier');
        const itemsContainer = document.getElementById('response-items');
        const priceInput = document.getElementById('response-price');
        const unitSelectWrap = document.getElementById('response-price-unit');
        const unitCurrVal = unitSelectWrap?.querySelector('.curr-val');
        const unitHiddenField = document.getElementById('response-price-unit-field');
        
        // Fill supplier name
        if (supplierInput) supplierInput.value = state.responseModal.supplierName;
        
        // Fill product name
        if (itemsContainer) {
            const productName = state.responseModal.productNameKey ? getTranslation(state.responseModal.productNameKey) : (state.responseModal.productName || '-');
            itemsContainer.innerHTML = `<span class="item-tag">${productName}</span>`;
        }
        
        // Fill price
        if (priceInput) priceInput.value = state.responseModal.price || '';
        
        // Update selected state in dropdown options
        if (unitSelectWrap) {
            unitSelectWrap.querySelectorAll('.select-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.value === state.responseModal.unit);
            });
        }
        if (unitCurrVal) unitCurrVal.textContent = state.responseModal.unit;
        if (unitHiddenField) unitHiddenField.value = state.responseModal.unit;
    }

    function initModals() {
        if (!responseModalOverlay) return;

        responseModalOverlay.querySelector('.modal-close-btn')?.addEventListener('click', closeResponseModal);
        responseModalOverlay.querySelector('[data-action="cancel"]')?.addEventListener('click', closeResponseModal);

        responseModalOverlay.querySelector('[data-action="save"]')?.addEventListener('click', () => {
            const priceInput = document.getElementById('response-price');
            const priceValue = priceInput?.value;
            const unitHiddenField = document.getElementById('response-price-unit-field');
            const unitValue = unitHiddenField?.value || 'kg';

            if (!priceValue || parseFloat(priceValue) <= 0) {
                showToast('Please enter a valid price', 'error');
                return;
            }

            // Create new row with responded status
            const newEvent = {
                id: `evt-${Date.now()}`,
                requestId: state.responseModal.requestId,
                date: new Date().toISOString().split('T')[0],
                supplierId: state.responseModal.supplierId,
                supplierName: state.responseModal.supplierName,
                productId: state.responseModal.productId,
                productNameKey: state.responseModal.productNameKey,
                status: 'responded',
                price: parseFloat(priceValue),
                unit: unitValue
            };

            state.requestHistory.unshift(newEvent);

            showToast('Response saved successfully');
            closeResponseModal();
            renderHistoryTable();
        });

        responseModalOverlay.addEventListener('click', (e) => {
            if (e.target === responseModalOverlay) closeResponseModal();
        });
    }

    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================
    function showToast(message, type = 'success') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                ${type === 'success' 
                    ? '<polyline points="20 6 9 17 4 12"/>' 
                    : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
            </svg>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 50);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    // ============================================
    // CUSTOM SELECT SMALL (for modals)
    // ============================================
    function initCustomSelectSm() {
        document.querySelectorAll('.custom-select-sm').forEach(wrap => {
            const trigger = wrap.querySelector('.custom-select-trigger');
            const list = wrap.querySelector('.custom-select-list');
            const currVal = wrap.querySelector('.curr-val');
            const hiddenField = wrap.querySelector('.dirty-check');

            if (!trigger || !list) return;

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = list.classList.toggle('open');
                wrap.classList.toggle('open', isOpen);
            });

            list.querySelectorAll('.select-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    const value = opt.dataset.value;
                    if (currVal) currVal.textContent = value;
                    if (hiddenField) hiddenField.value = value;
                    list.querySelectorAll('.select-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    list.classList.remove('open');
                    wrap.classList.remove('open');
                });
            });
        });

        // Close on outside click
        document.addEventListener('click', () => {
            document.querySelectorAll('.custom-select-sm.open').forEach(wrap => {
                wrap.querySelector('.custom-select-list')?.classList.remove('open');
                wrap.classList.remove('open');
            });
        });
    }

    // ============================================
    // INPUT WITH SUFFIX SELECT
    // ============================================
    function initInputSuffixSelect() {
        document.querySelectorAll('.input-with-suffix').forEach(wrap => {
            const trigger = wrap.querySelector('.input-suffix');
            const list = wrap.querySelector('.custom-select-list');
            const currVal = wrap.querySelector('.curr-val');
            const hiddenField = wrap.querySelectorAll('.dirty-check')[1]; // Second dirty-check is hidden field

            if (!trigger || !list) return;

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = list.classList.toggle('open');
                wrap.classList.toggle('open', isOpen);
            });

            list.querySelectorAll('.select-option, .custom-select-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    const value = opt.dataset.value || opt.textContent;
                    if (currVal) currVal.textContent = value;
                    if (hiddenField) hiddenField.value = value;
                    list.querySelectorAll('.select-option, .custom-select-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    list.classList.remove('open');
                    wrap.classList.remove('open');
                });
            });
        });

        // Close on outside click
        document.addEventListener('click', () => {
            document.querySelectorAll('.input-with-suffix.open').forEach(wrap => {
                wrap.querySelector('.custom-select-list')?.classList.remove('open');
                wrap.classList.remove('open');
            });
        });
    }

    // ============================================
    // INITIALIZE
    // ============================================
    initCategoryTree();
    initMultiSelect();
    initCheckboxListControls();
    initEmailTemplate();
    initSendButton();
    initModals();
    initCustomSelectSm();
    initInputSuffixSelect();
    renderHistoryTable();

    setTimeout(() => {
        document.querySelectorAll('[data-i18n]').forEach(el => el.style.opacity = '1');
    }, 100);

    // ============================================
    // LANGUAGE CHANGE HANDLER
    // ============================================
    function retranslateDynamicContent() {
        // Update category tree text without re-rendering
        categoryTree?.querySelectorAll('.category-node').forEach(node => {
            const catId = node.dataset.category;
            const cat = state.categories.find(c => c.id === catId);
            if (cat) {
                const nameEl = node.querySelector('.category-name');
                if (nameEl) nameEl.textContent = getTranslatedName(cat);
                
                const countEl = node.querySelector('.category-count');
                if (countEl) countEl.textContent = `(${cat.supplierCount} ${getTranslation('bcc.suppliers')})`;
                
                node.querySelectorAll('.product-checkbox').forEach(prodLabel => {
                    const prodId = prodLabel.querySelector('input')?.dataset.product;
                    const prod = cat.products.find(p => p.id === prodId);
                    if (prod) {
                        const prodNameEl = prodLabel.querySelector('.product-name');
                        if (prodNameEl) prodNameEl.textContent = getTranslatedName(prod);
                    }
                });
            }
        });
        
        // Update multi-select dropdown text without re-rendering
        const list = categorySelect?.querySelector('.multi-select-list');
        if (list) {
            list.querySelectorAll('.multi-select-group').forEach(group => {
                const catId = group.querySelector('input')?.dataset.category;
                const cat = state.categories.find(c => c.id === catId);
                if (cat) {
                    const groupLabel = group.querySelector('.multi-select-group-label');
                    if (groupLabel) groupLabel.textContent = getTranslatedName(cat);
                    
                    group.querySelectorAll('.multi-select-option').forEach(opt => {
                        const prodId = opt.querySelector('input')?.value;
                        const prod = cat.products.find(p => p.id === prodId);
                        if (prod) {
                            const spanEl = opt.querySelector('span');
                            if (spanEl) spanEl.textContent = getTranslatedName(prod);
                            const inputEl = opt.querySelector('input');
                            if (inputEl) inputEl.dataset.name = getTranslatedName(prod);
                        }
                    });
                }
            });
        }
        
        // Re-render product tags
        renderProductTags();
        
        // Re-render history table with translated statuses and categories
        renderHistoryTable();
    }

    // Register callback for language changes
    if (typeof translationEngine !== 'undefined') {
        translationEngine.onLanguageChange.push(retranslateDynamicContent);
    }
});
