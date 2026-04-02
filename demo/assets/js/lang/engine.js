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
                const selectedLang = btn.innerText.toLowerCase().trim();
                if (translations[selectedLang]) {
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
            if (btn.innerText.toLowerCase().trim() === lang) {
                btn.classList.add('active');
            }
        });

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const keyPath = el.getAttribute('data-i18n');
            const value = this.getValueByPath(data, keyPath);
            
            if (value) {
                if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'email' || el.type === 'tel' || el.type === 'password' || el.type === 'search')) {
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
                el.title = value;
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    translationEngine.init();
});
