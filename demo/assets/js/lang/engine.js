const translationEngine = {
    currentLang: 'en',
    
    init: function() {
        if (typeof translations === 'undefined') {
            console.error("Translations dictionary not found.");
            return;
        }

        // 1. Determine the language to use
        const savedLang = localStorage.getItem('flexiron_lang');
        const initialLang = savedLang && translations[savedLang] ? savedLang : 'en';

        // 2. Set the language initially
        this.setLanguage(initialLang);

        // 3. Attach click events to language buttons
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const selectedLang = btn.getAttribute('data-lang');
                if (selectedLang && translations[selectedLang]) {
                    this.setLanguage(selectedLang);
                }
            });
        });

        // 4. Reveal content once the first translation is done
        // We use opacity 1 only after the first pass is complete
        setTimeout(() => {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                el.style.opacity = '1';
                el.style.transition = 'opacity 0.2s ease-in-out';
            });
        }, 30);
    },
    
    setLanguage: function(lang) {
        if (!translations[lang]) return;
        
        this.currentLang = lang;
        localStorage.setItem('flexiron_lang', lang);
        
        const data = translations[lang];

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-lang') === lang) {
                btn.classList.add('active');
            }
        });

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const keyPath = el.getAttribute('data-i18n');
            const value = this.getValueByPath(data, keyPath);
            
            if (value) {
                if ((el.tagName === 'INPUT' && el.type !== 'submit' && el.type !== 'button') || el.tagName === 'TEXTAREA') {
                    el.placeholder = value;
                } else if (el.tagName === 'META') {
                    el.setAttribute('content', value);
                } else {
                    el.innerHTML = value;
                }
                el.style.opacity = '1';
            }
        });

        // 6. Handle title translations separately to avoid overwriting inner HTML
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const keyPath = el.getAttribute('data-i18n-title');
            const value = this.getValueByPath(data, keyPath);
            if (value) {
                // SVG requires a child <title> element for tooltips
                if (el.tagName.toUpperCase() === 'SVG') {
                    let titleEl = el.querySelector('title');
                    if (!titleEl) {
                        titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                        el.insertBefore(titleEl, el.firstChild);
                    }
                    titleEl.textContent = value;
                } else {
                    el.title = value;
                    el.style.opacity = '1';
                }
            }
        });

        // 7. Handle custom tooltips for CSS (::after { content: attr(data-tooltip) })
        document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
            const keyPath = el.getAttribute('data-i18n-tooltip');
            const value = this.getValueByPath(data, keyPath);
            if (value) {
                // Записываем перевод в атрибут, который "видит" CSS
                el.setAttribute('data-tooltip', value);
                el.style.opacity = '1';
            }
        });

        document.documentElement.lang = lang;
    },

    getValueByPath: function(obj, path) {
        const keys = path.split('.');
        let value = obj;
        for (let k of keys) {
            if (value && value[k] !== undefined) {
                value = value[k];
            } else {
                return null;
            }
        }
        return value;
    },

    // Translate dynamically created elements
    translateNewElements: function(root) {
        const data = translations[this.currentLang];
        if (!data) return;

        const scope = root || document;

        scope.querySelectorAll('[data-i18n-title]').forEach(el => {
            const keyPath = el.getAttribute('data-i18n-title');
            const value = this.getValueByPath(data, keyPath);
            if (value) {
                // SVG requires a child <title> element for tooltips
                if (el.tagName.toUpperCase() === 'SVG') {
                    let titleEl = el.querySelector('title');
                    if (!titleEl) {
                        titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                        el.insertBefore(titleEl, el.firstChild);
                    }
                    titleEl.textContent = value;
                } else {
                    el.title = value;
                    el.style.opacity = '1';
                }
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    translationEngine.init();
});
