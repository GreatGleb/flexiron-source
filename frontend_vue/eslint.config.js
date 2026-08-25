import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import sonarjs from 'eslint-plugin-sonarjs'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  sonarjs.configs.recommended,
  prettierConfig,

  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  {
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        DragEvent: 'readonly',
        Event: 'readonly',
        Node: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        ProgressEvent: 'readonly',
        AbortController: 'readonly',
        navigator: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
    rules: {
      // Allow single-word component names (App.vue, etc.)
      'vue/multi-word-component-names': 'off',

      // v-html is safe for our own translations
      'vue/no-v-html': 'off',

      // Existing JS files don't use TS
      '@typescript-eslint/no-explicit-any': 'warn',

      // Allow unused vars prefixed with _
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  {
    /*
     * sonarjs: пресет включён целиком, а эти правила выключены по факту замера
     * 2026-08-25 — число в комментарии показывает, сколько нарушений было в тот
     * день. Шаг гейта вводится только зелёным (см. verify.md), поэтому пресет
     * нельзя включить «как есть»: 233 нарушения превратили бы линт в фон.
     * Обратно правило включается вместе с починкой, по одному, и число тогда
     * уходит из этого списка. Всё, чего здесь нет, уже работает и держит ноль —
     * включая ради чего пресет и брали: no-duplicated-branches,
     * no-identical-expressions, no-all-duplicated-branches.
     */
    rules: {
      'sonarjs/no-floating-point-equality': 'off', // 61
      'sonarjs/prefer-specific-assertions': 'off', // 51, всё в спеках
      'sonarjs/cognitive-complexity': 'off', // 40
      'sonarjs/no-nested-conditional': 'off', // 24
      'sonarjs/pseudo-random': 'off', // 22, Math.random в моках и фаззерах
      'sonarjs/super-linear-regex': 'off', // 13
      'sonarjs/void-use': 'off', // 4
      'sonarjs/use-type-alias': 'off', // 4
      'sonarjs/no-nested-template-literals': 'off', // 3
      'sonarjs/no-nested-functions': 'off', // 2
      'sonarjs/no-inverted-boolean-check': 'off', // 2
      'sonarjs/no-identical-functions': 'off', // 2 — mocks/warehouse.ts:455 и спека
      'sonarjs/redundant-type-aliases': 'off', // 2
      // 1 срабатывание, ложное: литовское «Slaptažodis» (подпись поля пароля)
      // в i18n/public.js принято за пароль в коде.
      'sonarjs/no-hardcoded-passwords': 'off',
      // дубль правила typescript-eslint, которое уже настроено выше
      'sonarjs/no-unused-vars': 'off',
    },
  },
)
