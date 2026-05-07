# Все API эндпойнты фронтенда

**Всего: 28 эндпойнтов**

---

## Продукты (productsService.ts)

```
GET    /api/products                  — список продуктов (с фильтрацией + пагинацией)
GET    /api/products/:id              — один продукт
POST   /api/products                  — создать продукт
PATCH  /api/products/:id              — обновить продукт (только изменённые поля)
DELETE /api/products/:id              — удалить продукт
```

## Категории (categoriesService.ts)

```
GET    /api/categories                — список категорий (с фильтрацией + пагинацией)
GET    /api/categories/:id            — одна категория
POST   /api/categories                — создать категорию
PATCH  /api/categories/:id            — обновить категорию
DELETE /api/categories/:id            — удалить категорию
PUT    /api/categories/:id/fields     — полная замена полей категории
```

## Поставщики (suppliersService.ts)

```
GET    /api/suppliers                 — список поставщиков (с фильтрацией + пагинацией)
GET    /api/suppliers/:id             — карточка поставщика
PATCH  /api/suppliers/:id             — обновить карточку поставщика
PATCH  /api/suppliers/:id/status      — быстрая смена статуса (drag-drop в канбане)
POST   /api/suppliers                 — создать поставщика
DELETE /api/suppliers/:id/audit/:entryIndex — удалить запись аудита
GET    /api/suppliers/export.csv      — экспорт поставщиков в CSV
```

## BCC (bccService.ts)

```
GET    /api/bcc/categories            — список категорий для BCC
GET    /api/bcc/recipients            — получатели для выбранных продуктов
GET    /api/bcc/history               — история BCC-запросов
POST   /api/bcc/send                  — отправить BCC-email (с Idempotency-Key)
POST   /api/bcc/log                   — записать запрос без отправки email
POST   /api/bcc/events/:eventId/response   — принять ответ от поставщика
POST   /api/bcc/events/:eventId/no-response — отметить "нет ответа"
```

## Конфигурация (configService.ts)

```
GET    /api/config/fields             — библиотека полей
PUT    /api/config/fields             — полная замена библиотеки полей
POST   /api/config/fields             — создать поле
PATCH  /api/config/fields/:id         — обновить поле
DELETE /api/config/fields/:id         — удалить поле
GET    /api/config/sections           — секции карточки поставщика
PUT    /api/config/sections           — полная замена секций
POST   /api/config/sections           — создать секцию
PATCH  /api/config/sections/:id       — обновить секцию
DELETE /api/config/sections/:id       — удалить секцию
GET    /api/config/permissions        — матрица прав доступа
PUT    /api/config/permissions        — полная замена прав
```

## Аналитика (analyticsService.ts)

```
GET    /api/analytics/:page           — данные для страницы аналитики
```

## Файлы (uploadsService.ts)

```
POST   /api/uploads                   — загрузка файла (multipart)
```

---

## Данные, которые требуют resolveLabel()

Эти эндпойнты возвращают названия на русском языке. `resolveLabel()` переводит их через `labelLookup.ts` + `admin.ts`:

| Эндпойнт | Поля, требующие перевода |
|----------|------------------------|
| `GET /api/products` | `name`, `categoryName` |
| `GET /api/products/:id` | `name`, `fieldValues[].fieldName`, `fieldValues[].value` |
| `GET /api/categories` | `name`, `parentName` |
| `GET /api/categories/:id` | `name`, `fields[].name` |
| `GET /api/suppliers/:id` | вложенные продукты (`product.name`) |
| `GET /api/bcc/categories` | `name` |
| `GET /api/config/fields` | `name` |
| `GET /api/config/sections` | `name` |
