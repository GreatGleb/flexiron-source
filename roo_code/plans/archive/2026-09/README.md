# Архив планов — закрыты в сентябре 2026

Раскладка — по источнику, как в [2026-08](../2026-08/README.md).

| Каталог | Откуда | Файлов |
|---|---|---|
| `root/` | корень репозитория | 2 |

## `root/` — записки разового употребления из корня

Оба файла нарушали правило «все файлы Roo Code живут в `roo_code/`» просто потому, что
были написаны до него. Оба — снимки одной и той же работы (currency snapshot + FIFO cost),
и оба отработали.

### `session-summary-and-next-prompt.md` (12.08.2026)

Снимок незаконченной сессии со списком «осталось доделать» из шести пунктов и готовым
промптом для следующего чата. Промпт указывает на windows-путь
`c:/Users/great/Documents/bussiness/flexiron_enterprise` — машины уже нет.

Все шесть пунктов найдены в коде на 07.09.2026:

| Пункт | Где сделано |
|---|---|
| 1. `'EUR'` → `settings.constants.defaultCurrency` | `useOrderCreate.ts:43`, `useWarehouseBatchCreate.ts:42`; хардкода `'EUR'` в обоих нет |
| 2. FIFO cost вместо `product.price` | `AddOrderItemsModal.vue:243` — `unitPrice` из `selectedItemsCosts`; вхождений `EUR` в файле 0 |
| 3. `avgCostPrice` / `currency` в моках товаров | `services/mocks/products.ts` — 123 вхождения `avgCostPrice` |
| 4. валюта поставщика в карточке товара | `ProductCardPage.vue:652` |
| 5. pre-fill `receivedCurrencyId` из LinkedSupplier | `useWarehouseBatchCreate.ts:213-228` |
| 6. `currency` в mock-движениях | `services/mocks/warehouse.ts:634` |

Исходный план работы — [`orders/currency-fix-and-fifo-plan.md`](../../orders/currency-fix-and-fifo-plan.md),
он остаётся вне архива как живой документ (его шапка фиксирует отмену валютного курса).

Ссылку на этот файл держал архивный
[`2026-08/roo_code/products/uom-restructure-completion-plan.md`](../2026-08/roo_code/products/uom-restructure-completion-plan.md);
при переносе относительный путь в нём переписан и проверен резолвом.

### `MANUAL_CHECKLIST.md` (30.06.2026)

Ручной чек-лист приёмки под ту же фичу: 23 раздела, 191 строка, все пункты так и остались
`[ ]` — им ни разу не воспользовались. Ссылок на файл не было ниоткуда. Роль ручного
чек-листа с тех пор занял машинный цикл проверок из
[`verify.md`](../../../skills/verify.md).
