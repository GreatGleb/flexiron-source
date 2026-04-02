/**
 * Flexiron ERP - Sidebar & UI Logic
 * Standardized responsive behavior for all admin modules.
 */

document.addEventListener('DOMContentLoaded', () => {
    const shell = document.querySelector('.shell');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const closeBtn = document.getElementById('sidebar-close');
    
    if (!shell) return;

    // 1. Finalize sidebar state after high-speed load (anti-flicker check)
    if (document.documentElement.classList.contains('sidebar-no-animation')) {
        shell.classList.add('sidebar-collapsed');
        // Wait for render to finish before allowing future animations
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.classList.remove('sidebar-no-animation');
            });
        });
    }

    // 2. Sidebar Toggle Logic (860px threshold)
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 860) {
                // Mobile/Tablet: Toggle drawer
                shell.classList.toggle('sidebar-active');
            } else {
                // Desktop: Toggle push/collapse
                shell.classList.toggle('sidebar-collapsed');
                localStorage.setItem('sidebar-collapsed', shell.classList.contains('sidebar-collapsed'));
            }
        });
    }

    // 3. Close Sidebar (Close button)
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            shell.classList.remove('sidebar-active');
            shell.classList.remove('sidebar-collapsed');
        });
    }

    // 4. Close sidebar on Backdrop click (mobile only)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 860 && shell.classList.contains('sidebar-active')) {
            const isClickInsideSidebar = e.target.closest('.sidebar');
            const isClickOnToggle = e.target.closest('#sidebar-toggle');
            
            if (!isClickInsideSidebar && !isClickOnToggle) {
                shell.classList.remove('sidebar-active');
            }
        }
    });

    // 5. Sidebar Navigation Link Logic
    document.addEventListener('click', e => {
        const link = e.target.closest('.nav-link, .settings-link');
        if (!link) return;
        
        // Auto-close drawer on mobile link click
        if (window.innerWidth <= 860) {
            shell.classList.remove('sidebar-active');
        }

        // Synchronize title with clicked link (using i18n keys)
        const i18nSpan = link.querySelector('[data-i18n]');
        if (i18nSpan) {
            const key = i18nSpan.getAttribute('data-i18n');
            const target = document.querySelector('.page-title span');
            if (target) {
                target.setAttribute('data-i18n', key);
                // Trigger translation engine sync if present
                if (window.translationEngine) {
                    translationEngine.setLanguage(translationEngine.currentLang);
                }
            }
        }
    });
});
