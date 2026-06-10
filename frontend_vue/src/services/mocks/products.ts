import type { Product, ProductListItem, ProductFieldValue, ProductFilters, PriceUnit, LinkedSupplier } from '@/types/product'
import type { PaginatedResponse, PaginationParams } from '@/types/api'
import type { TranslatedString } from '@/types/i18n'
import { mergeTranslatedString, toTranslatedString } from '@/types/i18n'
import { mockGetCategory } from './categories'

// fieldIds from categories.ts STORE:
// cat-2 Sheets: f-2-1 (number), f-2-2 (enum), f-2-3 Width(number), f-2-4 Length(number), f-2-5 Weight per m²(number) + inherited: f-1-1 (text), f-1-2 (text), f-1-3 Density(number)
// cat-4 Pipes:  f-4-1 (number), f-4-2 (number), f-4-3 Length(number), f-4-4 Pipe type(enum), f-4-5 Bend radius(number), f-4-6 Width(mm), f-4-7 Weight per meter(number) + inherited: f-1-1 (text), f-1-2 (text), f-1-3 Density(number)
// cat-5 Consumables: f-5-1 (enum), f-5-2 (boolean), f-5-3 (date)
// cat-6 Equipment:   f-6-1 (text), f-6-2 (number), f-6-3 (email), f-6-4 (file)

export const STORE: Product[] = [
  {
    id: 'prod-001',
    name: { ru: 'Стальной лист 3мм', en: 'Steel Sheet 3mm', lt: 'Plieno lakštas 3mm' },
    categoryId: 'cat-2',
    categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
    sku: 'SS-3-1000',
    description: 'Горячекатаный стальной лист, 1000x2000мм',
    price: 120.50,
    minStock: 50,
    priceUnit: 'EUR/vnt',
    createdAt: '2025-01-15',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10051', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1000, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 23.55, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 115.00, priceUnit: 'EUR/vnt', leadDays: 7 },
      { id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 118.00, priceUnit: 'EUR/vnt', leadDays: 14 },
    ],
    auditLog: [
    {
      timestamp: '2026-04-23 13:17',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '118',
      newValue: '56',
    }
    ],
  },
  {
    id: 'prod-002',
    name: { ru: 'Алюминиевый лист 2мм', en: 'Aluminium Sheet 2mm', lt: 'Aliuminio lakštas 2mm' },
    categoryId: 'cat-2',
    categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
    sku: 'AL-2-500',
    description: null,
    price: 85.00,
    minStock: 20,
    priceUnit: 'EUR/vnt',
    createdAt: '2025-02-20',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'AMg2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'GOST 21631', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 2700, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 500, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 1000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 5.4, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 79.9, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-01-06 06:54',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cut to size',
      newValue: 'Hot-rolled steel sheet',
    }
    ],
  },
  {
    id: 'prod-003',
    name: { ru: 'Стальная труба 60x4', en: 'Steel Pipe 60x4', lt: 'Plieninis vamzdis 60x4' },
    categoryId: 'cat-4',
    categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' },
    sku: 'SP-60-4',
    description: 'Бесшовная круглая стальная труба',
    price: 45.00,
    minStock: 100,
    priceUnit: 'EUR/m',
    createdAt: '2025-03-01',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10210', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 60, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 4, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: null, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 60, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 5.52, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '3', name: { ru: 'Nordic Steel AB', en: 'Nordic Steel AB', lt: 'Nordic Steel AB' }, price: 42.00, priceUnit: 'EUR/m', leadDays: 10 },
    ],
    auditLog: [
    {
      timestamp: '2025-11-14 16:42',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'FO-9937',
      newValue: 'DA-6212',
    }
    ],
  },
  {
    id: 'prod-004',
    name: { ru: 'Стальная труба 100x5', en: 'Steel Pipe 100x5', lt: 'Plieninis vamzdis 100x5' },
    categoryId: 'cat-4',
    categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' },
    sku: 'SP-100-5',
    description: null,
    price: 78.00,
    minStock: null,
    priceUnit: 'EUR/m',
    createdAt: '2025-03-15',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10210', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 100, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 5, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: null, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 100, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 11.71, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 74.88, priceUnit: 'EUR/m', leadDays: 5 },
      { id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 74.1, priceUnit: 'EUR/m', leadDays: 10 },
    ],
    auditLog: [
    {
      timestamp: '2025-10-14 02:15',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '162.62 EUR',
      newValue: '114.69 EUR',
    },
    {
      timestamp: '2026-04-07 23:01',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '37.14 EUR',
      newValue: '207.68 EUR',
    },
    {
      timestamp: '2026-01-30 04:14',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Seamless pipe',
      newValue: 'Galvanized sheet',
    }
    ],
  },
  {
    id: 'prod-005',
    name: { ru: 'Сварочная проволока 1.2мм', en: 'Welding Wire 1.2mm', lt: 'Suvirinimo viela 1.2mm' },
    categoryId: 'cat-5',
    categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' },
    sku: 'WW-1.2',
    description: 'MIG/MAG сварочная проволока с медным покрытием',
    price: 12.50,
    minStock: 200,
    priceUnit: 'EUR/kg',
    createdAt: '2025-04-01',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'kg', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' },
        { ru: 'кг', en: 'kg', lt: 'kg' },
        { ru: 'м', en: 'm', lt: 'm' },
        { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: false, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2027-12-31', inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '3', name: { ru: 'Nordic Steel AB', en: 'Nordic Steel AB', lt: 'Nordic Steel AB' }, price: 11.5, priceUnit: 'EUR/kg', leadDays: 14 },
      { id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 12.13, priceUnit: 'EUR/kg', leadDays: 3 },
    ],
    auditLog: [
    {
      timestamp: '2025-10-26 03:33',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'WL-4259',
      newValue: 'SD-4673',
    },
    {
      timestamp: '2025-10-22 13:28',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Nordic Steel AB',
      newValue: 'Metal Trade LT',
    }
    ],
  },
  {
    id: 'prod-006',
    name: { ru: 'Смазочно-охлаждающая жидкость', en: 'Cutting Oil', lt: 'Pjovimo alyva' },
    categoryId: 'cat-5',
    categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' },
    sku: null,
    description: 'Концентрат СОЖ для металлообработки',
    price: null,
    minStock: 10,
    priceUnit: 'EUR/kg',
    createdAt: '2025-04-10',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'l', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' },
        { ru: 'кг', en: 'kg', lt: 'kg' },
        { ru: 'м', en: 'm', lt: 'm' },
        { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: null, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 11.88, priceUnit: 'EUR/kg', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2026-03-24 21:10',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Nordic Steel AB',
    },
    {
      timestamp: '2026-03-03 18:22',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Equipment',
    },
    {
      timestamp: '2025-10-06 22:52',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cold-rolled steel sheet',
      newValue: 'Seamless pipe',
    }
    ],
  },
  {
    id: 'prod-007',
    name: { ru: 'УШМ 125мм', en: 'Angle Grinder 125mm', lt: 'Kampinis šlifuoklis 125mm' },
    categoryId: 'cat-6',
    categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' },
    sku: 'AG-125',
    description: null,
    price: 89.00,
    minStock: 5,
    priceUnit: 'EUR/vnt',
    createdAt: '2025-05-01',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, fieldType: 'text', value: 'Bosch', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, fieldType: 'number', value: 24, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, fieldType: 'email', value: 'tools@bosch.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, fieldType: 'file', value: ['angle_grinder_125_passport.pdf', 'angle_grinder_125_ce_cert.pdf'], inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 86.33, priceUnit: 'EUR/vnt', leadDays: 3 },
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 83.66, priceUnit: 'EUR/vnt', leadDays: 7 },
    ],
    auditLog: [
    {
      timestamp: '2026-01-28 05:44',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Equipment',
      newValue: 'Consumables',
    }
    ],
  },
  {
    id: 'prod-008',
    name: { ru: 'Оцинкованный лист 1.5мм', en: 'Galvanized Sheet 1.5mm', lt: 'Cinkuotas lakštas 1.5mm' },
    categoryId: 'cat-2',
    categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
    sku: 'GS-1.5',
    description: 'Оцинкованный стальной лист Z275',
    price: 95.00,
    minStock: 30,
    priceUnit: 'EUR/vnt',
    createdAt: '2025-05-15',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S320GD', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10346', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 1.5, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Galvanized', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1250, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2500, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 11.78, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 86.45, priceUnit: 'EUR/vnt', leadDays: 21 },
      { id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 91.2, priceUnit: 'EUR/vnt', leadDays: 5 },
    ],
    auditLog: [
    {
      timestamp: '2026-04-17 18:34',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '183',
      newValue: '177',
    },
    {
      timestamp: '2025-12-01 03:58',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'JQ-3465',
      newValue: 'QL-9721',
    },
    {
      timestamp: '2026-02-26 03:42',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '67',
      newValue: '33',
    }
    ],
  },
  {
    id: 'prod-009',
    name: { ru: 'Материал без категории', en: 'Uncategorized Material', lt: 'Medžiaga be kategorijos' },
    categoryId: null,
    categoryName: null,
    sku: null,
    description: null,
    price: 55.00,
    minStock: null,
    priceUnit: 'EUR/kg',
    createdAt: '2025-06-01',
    fieldValues: [],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 51.7, priceUnit: 'EUR/kg', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2025-12-23 09:27',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '203.14 EUR',
      newValue: '146.46 EUR',
    }
    ],
  },
  // ── cat-2 Sheets ──────────────────────────────────────────────────────────────
  {
    id: 'prod-010',
    name: { ru: 'Стальной лист S355 5мм 1500×3000', en: 'Steel Sheet S355 5mm 1500×3000', lt: 'Plieno lakštas S355 5mm 1500×3000' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'SS-5-1500', price: 195.00, minStock: 30, priceUnit: 'EUR/vnt', createdAt: '2025-01-20',
    description: 'Горячекатаный конструкционный лист для несущих конструкций.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 5, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1500, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 3000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 39.25, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 185.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-02-21 04:36',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '83',
      newValue: '137',
    },
    {
      timestamp: '2026-04-24 13:17',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '87.50 EUR',
      newValue: '31.11 EUR',
    },
    {
      timestamp: '2025-10-02 21:03',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cold-rolled steel sheet',
      newValue: 'Cut to size',
    }
    ],
  },
  {
    id: 'prod-011',
    name: { ru: 'Стальной лист S355 8мм 2000×6000', en: 'Steel Sheet S355 8mm 2000×6000', lt: 'Plieno lakštas S355 8mm 2000×6000' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'SS-8-2000', price: 310.00, minStock: 20, priceUnit: 'EUR/vnt', createdAt: '2025-01-25',
    description: 'Тяжелый горячекатаный лист для машиностроения и строительных рам.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 8, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 2000, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 62.8, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '3', name: { ru: 'Nordic Steel AB', en: 'Nordic Steel AB', lt: 'Nordic Steel AB' }, price: 295.00, priceUnit: 'EUR/vnt', leadDays: 10 },
      { id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 300.70, priceUnit: 'EUR/vnt', leadDays: 14 },
    ],
    auditLog: [
    {
      timestamp: '2025-12-29 12:47',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Seamless pipe',
      newValue: 'Galvanized sheet',
    },
    {
      timestamp: '2025-10-03 15:58',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '198.50 EUR',
      newValue: '162.92 EUR',
    }
    ],
  },
  {
    id: 'prod-012',
    name: { ru: 'Стальной лист S235 2мм 1250×2500', en: 'Steel Sheet S235 2mm 1250×2500', lt: 'Plieno lakštas S235 2mm 1250×2500' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'SS-2-1250', price: 78.00, minStock: 50, priceUnit: 'EUR/vnt', createdAt: '2025-02-01',
    description: 'Hot-rolled structural sheet S235JR, 1250x2500mm.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1250, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2500, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 15.7, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 74.10, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2026-04-02 01:42',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'VZ-9387',
      newValue: 'XK-3285',
    },
    {
      timestamp: '2026-03-06 23:59',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Euro Metal GmbH',
      newValue: 'Steel Plus OÜ',
    }
    ],
  },
  {
    id: 'prod-013',
    name: { ru: 'Стальной лист S235 10мм 1500×3000', en: 'Steel Sheet S235 10mm 1500×3000', lt: 'Plieno lakštas S235 10mm 1500×3000' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'SS-10-1500', price: 280.00, minStock: 15, priceUnit: 'EUR/vnt', createdAt: '2025-02-10',
    description: 'Heavy hot-rolled plate for structural applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 10, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1500, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 3000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 78.5, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 266.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-04-11 06:45',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '110.80 EUR',
      newValue: '117.15 EUR',
    },
    {
      timestamp: '2026-05-08 01:08',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Pipes',
      newValue: 'Equipment',
    },
    {
      timestamp: '2026-04-30 22:07',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Steel Plus OÜ',
    }
    ],
  },
  {
    id: 'prod-014',
    name: { ru: 'Холоднокатаный лист 1мм DC01', en: 'Cold-rolled Sheet 1mm DC01', lt: 'Šaltai valcuotas lakštas 1mm DC01' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'CR-1-DC01', price: 65.00, minStock: 40, priceUnit: 'EUR/vnt', createdAt: '2025-03-05',
    description: 'Cold-rolled sheet DC01 for deep drawing applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'DC01', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10130', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 1, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1000, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 7.85, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 61.75, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2025-10-28 12:04',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'BG-4119',
      newValue: 'AR-9480',
    }
    ],
  },
  {
    id: 'prod-015',
    name: { ru: 'Оцинкованный лист 0.8мм DX51D', en: 'Galvanized Sheet 0.8mm DX51D', lt: 'Cinkuotas lakštas 0.8mm DX51D' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'GS-0.8-DX51D', price: 58.00, minStock: 60, priceUnit: 'EUR/vnt', createdAt: '2025-03-20',
    description: 'Galvanized sheet DX51D+Z275 for roofing and cladding.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'DX51D', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10346', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 0.8, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Galvanized', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1250, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2500, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 6.28, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 52.78, priceUnit: 'EUR/vnt', leadDays: 21 },
      { id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 55.68, priceUnit: 'EUR/vnt', leadDays: 5 },
    ],
    auditLog: [
    {
      timestamp: '2026-05-13 07:52',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Euro Metal GmbH',
      newValue: 'Metal Trade LT',
    },
    {
      timestamp: '2026-05-12 19:16',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Consumables',
      newValue: 'Pipes',
    },
    {
      timestamp: '2026-05-19 05:59',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cut to size',
      newValue: 'Welded pipe',
    }
    ],
  },
  {
    id: 'prod-016',
    name: { ru: 'Стальной лист S355 6мм 2000×4000', en: 'Steel Sheet S355 6mm 2000×4000', lt: 'Plieno lakštas S355 6mm 2000×4000' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'SS-6-2000', price: 245.00, minStock: 25, priceUnit: 'EUR/vnt', createdAt: '2025-04-05',
    description: 'Structural steel plate S355J2 for heavy machinery frames.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355J2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 6, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 2000, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 4000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 47.1, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 232.75, priceUnit: 'EUR/vnt', leadDays: 7 },
      { id: '3', name: { ru: 'Nordic Steel AB', en: 'Nordic Steel AB', lt: 'Nordic Steel AB' }, price: 238.00, priceUnit: 'EUR/vnt', leadDays: 10 },
    ],
    auditLog: [
    {
      timestamp: '2026-05-18 01:12',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Equipment',
    }
    ],
  },
  {
    id: 'prod-017',
    name: { ru: 'Алюминиевый лист 3мм 1200×2400', en: 'Aluminium Sheet 3mm 1200×2400', lt: 'Aliuminio lakštas 3mm 1200×2400' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'AL-3-1200', price: 145.00, minStock: 20, priceUnit: 'EUR/vnt', createdAt: '2025-04-15',
    description: 'Aluminium sheet 5083-H111 for marine and chemical applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: '5083', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 485', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 2700, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1200, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2400, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 8.1, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 137.75, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-01-30 19:36',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Steel Plus OÜ',
    },
    {
      timestamp: '2025-10-05 17:05',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Consumables',
      newValue: 'Pipes',
    },
    {
      timestamp: '2025-12-03 21:27',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'OH-3770',
      newValue: 'LV-8035',
    }
    ],
  },
  {
    id: 'prod-018',
    name: { ru: 'Нержавеющий лист 2мм 304', en: 'Stainless Sheet 2mm 304', lt: 'Nerūdijantis lakštas 2mm 304' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'SS-304-2', price: 210.00, minStock: 15, priceUnit: 'EUR/vnt', createdAt: '2025-05-10',
    description: 'Stainless steel sheet AISI 304, 2B finish, 1000x2000mm.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: '304', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10088', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7900, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1000, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 15.8, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 199.50, priceUnit: 'EUR/vnt', leadDays: 21 },
      { id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 205.80, priceUnit: 'EUR/vnt', leadDays: 10 },
    ],
    auditLog: [
    {
      timestamp: '2026-05-10 22:28',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '192',
      newValue: '163',
    },
    {
      timestamp: '2026-01-10 16:35',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '102',
      newValue: '64',
    }
    ],
  },
  {
    id: 'prod-019',
    name: { ru: 'Медный лист 1мм', en: 'Copper Sheet 1mm', lt: 'Vario lakštas 1mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'CU-1', price: 320.00, minStock: 10, priceUnit: 'EUR/vnt', createdAt: '2025-05-25',
    description: 'Copper sheet C11000, 600x1500mm, for electrical applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'C11000', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 1652', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 8960, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 1, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 600, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 1500, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 8.96, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 304.00, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2026-03-01 16:09',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '190',
      newValue: '11',
    },
    {
      timestamp: '2026-04-02 20:42',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Steel Plus OÜ',
    },
    {
      timestamp: '2026-01-09 02:06',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Euro Metal GmbH',
      newValue: 'Nordic Steel AB',
    }
    ],
  },
  {
    id: 'prod-020',
    name: { ru: 'Титановый лист 2мм Grade 5', en: 'Titanium Sheet 2mm Grade 5', lt: 'Titano lakštas 2mm Grade 5' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'TI-2-G5', price: 890.00, minStock: 5, priceUnit: 'EUR/vnt', createdAt: '2025-06-10',
    description: 'Titanium sheet Ti-6Al-4V (Grade 5), 500x1000mm, for aerospace.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'Ti-6Al-4V', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'ASTM B265', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 4430, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 500, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 1000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 8.86, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 845.50, priceUnit: 'EUR/vnt', leadDays: 30 }],
    auditLog: [
    {
      timestamp: '2025-12-23 16:44',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Consumables',
    },
    {
      timestamp: '2026-01-13 19:13',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Seamless pipe',
      newValue: 'Welded pipe',
    },
    {
      timestamp: '2025-12-16 11:46',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '203.46 EUR',
      newValue: '208.77 EUR',
    }
    ],
  },
  // ── cat-4 Pipes ───────────────────────────────────────────────────────────────
  {
    id: 'prod-021',
    name: { ru: 'Стальная труба 20x2.5', en: 'Steel Pipe 20x2.5', lt: 'Plieninis vamzdis 20x2.5' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'SP-20-2.5', price: 8.50, minStock: 200, priceUnit: 'EUR/m', createdAt: '2025-02-05',
    description: 'Seamless precision steel pipe for hydraulic systems.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'E235', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10305', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 20, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 2.5, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 30, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 20, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 1.08, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Nordic Steel AB', en: 'Nordic Steel AB', lt: 'Nordic Steel AB' }, price: 7.82, priceUnit: 'EUR/m', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2025-12-28 17:22',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Euro Metal GmbH',
      newValue: 'Steel Plus OÜ',
    },
    {
      timestamp: '2026-03-08 06:59',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '166',
      newValue: '68',
    }
    ],
  },
  {
    id: 'prod-022',
    name: { ru: 'Стальная труба 40x3', en: 'Steel Pipe 40x3', lt: 'Plieninis vamzdis 40x3' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'SP-40-3', price: 18.00, minStock: 150, priceUnit: 'EUR/m', createdAt: '2025-02-15',
    description: 'Seamless steel pipe for general engineering.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10210', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 40, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 60, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 40, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 2.74, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 16.92, priceUnit: 'EUR/m', leadDays: 5 },
      { id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 17.28, priceUnit: 'EUR/m', leadDays: 10 },
    ],
    auditLog: [
    {
      timestamp: '2026-03-01 22:31',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Metal Trade LT',
    },
    {
      timestamp: '2026-05-10 19:38',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Steel Plus OÜ',
    },
    {
      timestamp: '2025-11-08 14:57',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Hot-rolled steel sheet',
      newValue: 'Cut to size',
    }
    ],
  },
  {
    id: 'prod-023',
    name: { ru: 'Стальная труба 80x4', en: 'Steel Pipe 80x4', lt: 'Plieninis vamzdis 80x4' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'SP-80-4', price: 55.00, minStock: 80, priceUnit: 'EUR/m', createdAt: '2025-03-10',
    description: 'Structural steel pipe for construction frameworks.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355J2H', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10210', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 80, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 4, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 120, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 80, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 7.49, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 52.25, priceUnit: 'EUR/m', leadDays: 7 },
      { id: '3', name: { ru: 'Nordic Steel AB', en: 'Nordic Steel AB', lt: 'Nordic Steel AB' }, price: 53.35, priceUnit: 'EUR/m', leadDays: 10 },
    ],
    auditLog: [
    {
      timestamp: '2026-01-26 05:32',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Seamless pipe',
      newValue: 'Cold-rolled steel sheet',
    },
    {
      timestamp: '2025-10-27 11:56',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'HI-1697',
      newValue: 'LY-9981',
    },
    {
      timestamp: '2026-02-27 13:31',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Nordic Steel AB',
      newValue: 'Steel Plus OÜ',
    }
    ],
  },
  {
    id: 'prod-024',
    name: { ru: 'Стальная труба 150x6', en: 'Steel Pipe 150x6', lt: 'Plieninis vamzdis 150x6' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'SP-150-6', price: 145.00, minStock: 30, priceUnit: 'EUR/m', createdAt: '2025-04-01',
    description: 'Large-diameter seamless pipe for industrial piping.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10210', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 150, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 6, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 225, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 150, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 21.3, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Nordic Steel AB', en: 'Nordic Steel AB', lt: 'Nordic Steel AB' }, price: 139.20, priceUnit: 'EUR/m', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2026-03-27 16:13',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Nordic Steel AB',
    }
    ],
  },
  {
    id: 'prod-025',
    name: { ru: 'Квадратная труба 40x40x3', en: 'Square Pipe 40x40x3', lt: 'Kvadratinis vamzdis 40x40x3' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'SQ-40-3', price: 22.00, minStock: 100, priceUnit: 'EUR/m', createdAt: '2025-04-20',
    description: 'Cold-formed square hollow section for structural frames.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10219', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 40, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Square', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: null, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 40, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 3.35, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 20.68, priceUnit: 'EUR/m', leadDays: 5 },
      { id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 21.34, priceUnit: 'EUR/m', leadDays: 10 },
    ],
    auditLog: [
    {
      timestamp: '2025-11-25 23:57',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '66',
      newValue: '64',
    }
    ],
  },
  {
    id: 'prod-026',
    name: { ru: 'Прямоугольная труба 80x40x3', en: 'Rectangular Pipe 80x40x3', lt: 'Stačiakampis vamzdis 80x40x3' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'REC-80-40-3', price: 28.00, minStock: 80, priceUnit: 'EUR/m', createdAt: '2025-05-05',
    description: 'Rectangular hollow section for structural applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10219', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 80, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Rectangular', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: null, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 80, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 5.2, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 26.32, priceUnit: 'EUR/m', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-04-10 00:51',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '151',
      newValue: '26',
    }
    ],
  },
  {
    id: 'prod-027',
    name: { ru: 'Нержавеющая труба 30x2 304', en: 'Stainless Pipe 30x2 304', lt: 'Nerūdijantis vamzdis 30x2 304' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'SSP-30-2', price: 35.00, minStock: 60, priceUnit: 'EUR/m', createdAt: '2025-05-20',
    description: 'Stainless steel seamless pipe AISI 304 for food industry.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: '304', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10216-5', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7900, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 30, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 45, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 30, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 1.38, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 33.25, priceUnit: 'EUR/m', leadDays: 21 },
      { id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 33.95, priceUnit: 'EUR/m', leadDays: 10 },
    ],
    auditLog: [
    {
      timestamp: '2026-05-13 21:26',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'KR-8589',
      newValue: 'YM-2889',
    },
    {
      timestamp: '2025-10-12 09:24',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'MF-6446',
      newValue: 'QU-5457',
    },
    {
      timestamp: '2025-10-22 00:07',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Euro Metal GmbH',
    }
    ],
  },
  {
    id: 'prod-028',
    name: { ru: 'Алюминиевая труба 25x2', en: 'Aluminium Pipe 25x2', lt: 'Aliumininis vamzdis 25x2' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'ALP-25-2', price: 12.00, minStock: 100, priceUnit: 'EUR/m', createdAt: '2025-06-05',
    description: 'Aluminium pipe 6060-T6 for lightweight structures.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: '6060', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 755', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 2700, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 25, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 5000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 38, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 25, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 0.4, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 11.28, priceUnit: 'EUR/m', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-02-08 14:33',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Galvanized sheet',
      newValue: 'Hot-rolled steel sheet',
    },
    {
      timestamp: '2026-04-19 00:04',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '70.29 EUR',
      newValue: '61.15 EUR',
    }
    ],
  },
  {
    id: 'prod-029',
    name: { ru: 'Медная труба 15x1', en: 'Copper Pipe 15x1', lt: 'Varinis vamzdis 15x1' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'CUP-15-1', price: 18.50, minStock: 150, priceUnit: 'EUR/m', createdAt: '2025-06-20',
    description: 'Copper pipe for plumbing and HVAC applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'C12200', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 1057', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 8960, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 15, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 1, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 5000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 23, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 15, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 0.39, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 17.39, priceUnit: 'EUR/m', leadDays: 10 },
      { id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 17.95, priceUnit: 'EUR/m', leadDays: 3 },
    ],
    auditLog: [
    {
      timestamp: '2026-04-20 08:27',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Nordic Steel AB',
      newValue: 'Steel Plus OÜ',
    },
    {
      timestamp: '2026-01-02 11:34',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '160',
      newValue: '173',
    }
    ],
  },
  {
    id: 'prod-030',
    name: { ru: 'Титановая труба 50x3 Grade 2', en: 'Titanium Pipe 50x3 Grade 2', lt: 'Titano vamzdis 50x3 Grade 2' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'TIP-50-3', price: 320.00, minStock: 10, priceUnit: 'EUR/m', createdAt: '2025-07-01',
    description: 'Titanium seamless pipe Grade 2 for chemical processing.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'Grade 2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'ASTM B861', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 4430, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 4000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус изгиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 75, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 1.95, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 304.00, priceUnit: 'EUR/m', leadDays: 30 }],
    auditLog: [
    {
      timestamp: '2026-04-26 09:17',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '108',
      newValue: '61',
    }
    ],
  },
  // ── cat-5 Consumables ─────────────────────────────────────────────────────────
  {
    id: 'prod-031',
    name: { ru: 'Электроды сварные 3мм', en: 'Welding Electrodes 3mm', lt: 'Suvirinimo elektrodai 3mm' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'WE-3', price: 8.00, minStock: 500, priceUnit: 'EUR/kg', createdAt: '2025-01-10',
    description: 'Rutile welding electrodes for general purpose welding.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'kg', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' }, { ru: 'кг', en: 'kg', lt: 'kg' }, { ru: 'м', en: 'm', lt: 'm' }, { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: false, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2028-06-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 7.44, priceUnit: 'EUR/kg', leadDays: 3 }],
    auditLog: [
    {
      timestamp: '2025-11-14 21:33',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Consumables',
      newValue: 'Sheets',
    },
    {
      timestamp: '2025-11-15 20:31',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '190.27 EUR',
      newValue: '16.64 EUR',
    }
    ],
  },
  {
    id: 'prod-032',
    name: { ru: 'Электроды сварные 4мм', en: 'Welding Electrodes 4mm', lt: 'Suvirinimo elektrodai 4mm' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'WE-4', price: 7.50, minStock: 500, priceUnit: 'EUR/kg', createdAt: '2025-01-15',
    description: 'Rutile electrodes for heavy section welding.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'kg', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' }, { ru: 'кг', en: 'kg', lt: 'kg' }, { ru: 'м', en: 'm', lt: 'm' }, { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: false, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2028-06-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 6.98, priceUnit: 'EUR/kg', leadDays: 3 },
      { id: '3', name: { ru: 'Nordic Steel AB', en: 'Nordic Steel AB', lt: 'Nordic Steel AB' }, price: 7.28, priceUnit: 'EUR/kg', leadDays: 10 },
    ],
    auditLog: [
    {
      timestamp: '2026-04-29 04:07',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Welded pipe',
      newValue: 'Hot-rolled steel sheet',
    }
    ],
  },
  {
    id: 'prod-033',
    name: { ru: 'Сварочная проволока 0.8мм', en: 'Welding Wire 0.8mm', lt: 'Suvirinimo viela 0.8mm' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'WW-0.8', price: 14.00, minStock: 300, priceUnit: 'EUR/kg', createdAt: '2025-02-01',
    description: 'MIG solid welding wire ER70S-6 for carbon steel.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'kg', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' }, { ru: 'кг', en: 'kg', lt: 'kg' }, { ru: 'м', en: 'm', lt: 'm' }, { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: false, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2028-12-31', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 13.02, priceUnit: 'EUR/kg', leadDays: 3 }],
    auditLog: [
    {
      timestamp: '2026-02-05 17:49',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'HV-7815',
      newValue: 'ZD-6369',
    },
    {
      timestamp: '2025-10-17 13:18',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cut to size',
      newValue: 'Cold-rolled steel sheet',
    },
    {
      timestamp: '2025-10-18 15:32',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '11.51 EUR',
      newValue: '93.80 EUR',
    }
    ],
  },
  {
    id: 'prod-034',
    name: { ru: 'Флюс сварочный', en: 'Welding Flux', lt: 'Suvirinimo fliusas' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'WF-01', price: 5.50, minStock: 200, priceUnit: 'EUR/kg', createdAt: '2025-02-15',
    description: 'Agglomerated welding flux for submerged arc welding.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'kg', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' }, { ru: 'кг', en: 'kg', lt: 'kg' }, { ru: 'м', en: 'm', lt: 'm' }, { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: false, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: null, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 5.12, priceUnit: 'EUR/kg', leadDays: 3 }],
    auditLog: [
    {
      timestamp: '2026-01-27 04:25',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '53.38 EUR',
      newValue: '126.18 EUR',
    },
    {
      timestamp: '2025-12-01 09:54',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '193',
      newValue: '28',
    }
    ],
  },
  {
    id: 'prod-035',
    name: { ru: 'Газ защитный Ar/CO2 80/20', en: 'Shielding Gas Ar/CO2 80/20', lt: 'Apsauginės dujos Ar/CO2 80/20' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'SG-8020', price: 65.00, minStock: 20, priceUnit: 'EUR/vnt', createdAt: '2025-03-01',
    description: 'Mixed shielding gas for MIG/MAG welding of carbon steel.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'pcs', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' }, { ru: 'кг', en: 'kg', lt: 'kg' }, { ru: 'м', en: 'm', lt: 'm' }, { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: null, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 61.75, priceUnit: 'EUR/vnt', leadDays: 10 },
      { id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 63.05, priceUnit: 'EUR/vnt', leadDays: 3 },
    ],
    auditLog: [
    {
      timestamp: '2026-01-21 20:54',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'NM-3288',
      newValue: 'NQ-1560',
    }
    ],
  },
  {
    id: 'prod-036',
    name: { ru: 'Отрезной круг 125x1мм', en: 'Cut-off Wheel 125x1mm', lt: 'Pjovimo diskas 125x1mm' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'CW-125', price: 2.50, minStock: 1000, priceUnit: 'EUR/vnt', createdAt: '2025-03-15',
    description: 'Reinforced cut-off wheel for steel and stainless steel.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'pcs', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' }, { ru: 'кг', en: 'kg', lt: 'kg' }, { ru: 'м', en: 'm', lt: 'm' }, { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: false, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: null, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 2.33, priceUnit: 'EUR/vnt', leadDays: 3 },
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 2.38, priceUnit: 'EUR/vnt', leadDays: 7 },
    ],
    auditLog: [
    {
      timestamp: '2026-02-21 10:37',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Welded pipe',
      newValue: 'Cut to size',
    },
    {
      timestamp: '2025-10-15 22:42',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Welded pipe',
      newValue: 'Cold-rolled steel sheet',
    },
    {
      timestamp: '2026-03-14 11:11',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Nordic Steel AB',
    }
    ],
  },
  {
    id: 'prod-037',
    name: { ru: 'Шлифовальный круг 125мм', en: 'Grinding Wheel 125mm', lt: 'Šlifavimo diskas 125mm' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'GW-125', price: 3.80, minStock: 800, priceUnit: 'EUR/vnt', createdAt: '2025-04-01',
    description: 'Depressed center grinding wheel for metal removal.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'pcs', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' }, { ru: 'кг', en: 'kg', lt: 'kg' }, { ru: 'м', en: 'm', lt: 'm' }, { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: false, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: null, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 3.53, priceUnit: 'EUR/vnt', leadDays: 3 }],
    auditLog: [
    {
      timestamp: '2025-12-16 12:13',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'IW-4709',
      newValue: 'WA-7111',
    },
    {
      timestamp: '2025-12-02 11:37',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Equipment',
      newValue: 'Sheets',
    }
    ],
  },
  {
    id: 'prod-038',
    name: { ru: 'Сверло по металлу 10мм HSS', en: 'HSS Drill Bit 10mm', lt: 'Grąžtas metalui 10mm HSS' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'DB-10-HSS', price: 6.00, minStock: 200, priceUnit: 'EUR/vnt', createdAt: '2025-04-15',
    description: 'High-speed steel twist drill bit for general metal drilling.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'pcs', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' }, { ru: 'кг', en: 'kg', lt: 'kg' }, { ru: 'м', en: 'm', lt: 'm' }, { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: false, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: null, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 5.58, priceUnit: 'EUR/vnt', leadDays: 3 },
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 5.70, priceUnit: 'EUR/vnt', leadDays: 7 },
    ],
    auditLog: [
    {
      timestamp: '2025-11-04 20:52',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '194',
      newValue: '150',
    }
    ],
  },
  {
    id: 'prod-039',
    name: { ru: 'Метчик M10 HSS', en: 'Tap M10 HSS', lt: 'Sriegtuvas M10 HSS' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'TAP-M10', price: 12.00, minStock: 100, priceUnit: 'EUR/vnt', createdAt: '2025-05-01',
    description: 'Hand tap M10x1.5 for threading carbon steel.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'pcs', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' }, { ru: 'кг', en: 'kg', lt: 'kg' }, { ru: 'м', en: 'm', lt: 'm' }, { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: false, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: null, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 11.16, priceUnit: 'EUR/vnt', leadDays: 3 }],
    auditLog: [
    {
      timestamp: '2026-01-23 15:14',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Nordic Steel AB',
    },
    {
      timestamp: '2026-01-06 23:16',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cut to size',
      newValue: 'Cold-rolled steel sheet',
    }
    ],
  },
  {
    id: 'prod-040',
    name: { ru: 'Плашка M10 HSS', en: 'Die M10 HSS', lt: 'Srieginė plokštelė M10 HSS' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'DIE-M10', price: 15.00, minStock: 80, priceUnit: 'EUR/vnt', createdAt: '2025-05-15',
    description: 'Round die M10x1.5 for external threading.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, fieldType: 'enum', value: 'pcs', inherited: false, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' }, { ru: 'кг', en: 'kg', lt: 'kg' }, { ru: 'м', en: 'm', lt: 'm' }, { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, fieldType: 'boolean', value: false, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: null, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 13.95, priceUnit: 'EUR/vnt', leadDays: 3 }],
    auditLog: [
    {
      timestamp: '2026-02-05 06:52',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Pipes',
    }
    ],
  },
  // ── cat-6 Equipment ───────────────────────────────────────────────────────────
  {
    id: 'prod-041',
    name: { ru: 'Сварочный аппарат MIG 250', en: 'MIG Welder 250A', lt: 'MIG suvirinimo aparatas 250A' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'MIG-250', price: 850.00, minStock: 5, priceUnit: 'EUR/vnt', createdAt: '2025-01-20',
    description: 'Professional MIG/MAG welding machine with synergic control.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, fieldType: 'text', value: 'Kemppi', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, fieldType: 'number', value: 36, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, fieldType: 'email', value: 'sales@kemppi.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, fieldType: 'file', value: ['mig250_manual.pdf', 'mig250_ce.pdf'], inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 807.50, priceUnit: 'EUR/vnt', leadDays: 3 },
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 824.50, priceUnit: 'EUR/vnt', leadDays: 7 },
    ],
    auditLog: [
    {
      timestamp: '2025-11-05 00:46',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '86.86 EUR',
      newValue: '131.52 EUR',
    },
    {
      timestamp: '2025-10-05 17:46',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'YR-2706',
      newValue: 'XE-6092',
    },
    {
      timestamp: '2026-03-23 22:18',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '185',
      newValue: '82',
    }
    ],
  },
  {
    id: 'prod-042',
    name: { ru: 'Плазменный резак 40A', en: 'Plasma Cutter 40A', lt: 'Plazminis pjaustytuvas 40A' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'PC-40', price: 1200.00, minStock: 3, priceUnit: 'EUR/vnt', createdAt: '2025-02-01',
    description: 'Portable plasma cutting system with CNC interface.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, fieldType: 'text', value: 'Hypertherm', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, fieldType: 'number', value: 24, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, fieldType: 'email', value: 'support@hypertherm.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, fieldType: 'file', value: ['plasma40_manual.pdf'], inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 1140.00, priceUnit: 'EUR/vnt', leadDays: 3 }],
    auditLog: [
    {
      timestamp: '2025-10-19 20:04',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Galvanized sheet',
      newValue: 'Welded pipe',
    },
    {
      timestamp: '2025-10-26 20:37',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '46',
      newValue: '180',
    }
    ],
  },
  {
    id: 'prod-043',
    name: { ru: 'Токарный станок CNC', en: 'CNC Lathe', lt: 'CNC tekinimo staklės' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'CNC-L-01', price: 25000.00, minStock: 1, priceUnit: 'EUR/vnt', createdAt: '2025-02-15',
    description: 'CNC lathe with 2-meter bed length and live tooling.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, fieldType: 'text', value: 'DMG MORI', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, fieldType: 'number', value: 48, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, fieldType: 'email', value: 'info@dmgmori.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, fieldType: 'file', value: ['cnc_lathe_manual.pdf', 'cnc_lathe_cert.pdf', 'cnc_lathe_datasheet.pdf'], inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 23750.00, priceUnit: 'EUR/vnt', leadDays: 60 }],
    auditLog: [
    {
      timestamp: '2026-04-27 21:01',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'DT-7826',
      newValue: 'NJ-4848',
    }
    ],
  },
  {
    id: 'prod-044',
    name: { ru: 'Фрезерный станок CNC', en: 'CNC Milling Machine', lt: 'CNC frezavimo staklės' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'CNC-M-01', price: 32000.00, minStock: 1, priceUnit: 'EUR/vnt', createdAt: '2025-03-01',
    description: '5-axis CNC milling center with pallet changer.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, fieldType: 'text', value: 'Haas', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, fieldType: 'number', value: 36, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, fieldType: 'email', value: 'sales@haas.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, fieldType: 'file', value: ['cnc_mill_manual.pdf', 'cnc_mill_cert.pdf'], inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 30400.00, priceUnit: 'EUR/vnt', leadDays: 90 }],
    auditLog: [
    {
      timestamp: '2026-04-25 03:45',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'YK-7031',
      newValue: 'FM-2078',
    },
    {
      timestamp: '2026-02-22 08:54',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'YO-1671',
      newValue: 'GP-5289',
    }
    ],
  },
  {
    id: 'prod-045',
    name: { ru: 'Гильотина гидравлическая 3м', en: 'Hydraulic Guillotine 3m', lt: 'Hidraulinė giljotina 3m' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'HG-3000', price: 18500.00, minStock: 1, priceUnit: 'EUR/vnt', createdAt: '2025-03-15',
    description: 'Hydraulic guillotine shear for sheet metal up to 6mm.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, fieldType: 'text', value: 'Baykal', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, fieldType: 'number', value: 24, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, fieldType: 'email', value: 'info@baykal.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, fieldType: 'file', value: ['guillotine_manual.pdf'], inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 17575.00, priceUnit: 'EUR/vnt', leadDays: 45 }],
    auditLog: [
    {
      timestamp: '2026-02-13 04:27',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '137.68 EUR',
      newValue: '50.01 EUR',
    },
    {
      timestamp: '2026-01-10 08:14',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Seamless pipe',
      newValue: 'Cut to size',
    }
    ],
  },
  {
    id: 'prod-046',
    name: { ru: 'Листогибочный пресс 100т', en: 'Press Brake 100T', lt: 'Presinis stabdis 100T' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'PB-100', price: 22000.00, minStock: 1, priceUnit: 'EUR/vnt', createdAt: '2025-04-01',
    description: 'CNC press brake with 3-meter bending length.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, fieldType: 'text', value: 'Trumpf', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, fieldType: 'number', value: 36, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, fieldType: 'email', value: 'info@trumpf.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, fieldType: 'file', value: ['press_brake_manual.pdf', 'press_brake_ce.pdf'], inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 20900.00, priceUnit: 'EUR/vnt', leadDays: 60 }],
    auditLog: [
    {
      timestamp: '2026-03-05 17:56',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Equipment',
    },
    {
      timestamp: '2026-02-10 18:05',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Equipment',
      newValue: 'Consumables',
    },
    {
      timestamp: '2026-01-06 02:08',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cold-rolled steel sheet',
      newValue: 'Hot-rolled steel sheet',
    }
    ],
  },
  {
    id: 'prod-047',
    name: { ru: 'Компрессор винтовой 7.5кВт', en: 'Screw Compressor 7.5kW', lt: 'Sraigtinis kompresorius 7.5kW' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'SC-7.5', price: 4500.00, minStock: 2, priceUnit: 'EUR/vnt', createdAt: '2025-04-15',
    description: 'Industrial screw compressor with integrated dryer.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, fieldType: 'text', value: 'Atlas Copco', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, fieldType: 'number', value: 24, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, fieldType: 'email', value: 'service@atlascopco.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, fieldType: 'file', value: ['compressor_manual.pdf'], inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 4275.00, priceUnit: 'EUR/vnt', leadDays: 3 },
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 4365.00, priceUnit: 'EUR/vnt', leadDays: 7 },
    ],
    auditLog: [
    {
      timestamp: '2026-05-12 05:11',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Nordic Steel AB',
    }
    ],
  },
  {
    id: 'prod-048',
    name: { ru: 'Кран мостовой 10т', en: 'Overhead Crane 10T', lt: 'Kabininis kranas 10T' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'OC-10', price: 45000.00, minStock: 1, priceUnit: 'EUR/vnt', createdAt: '2025-05-01',
    description: 'Double-girder overhead crane with 20m span.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, fieldType: 'text', value: 'Konecranes', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, fieldType: 'number', value: 60, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, fieldType: 'email', value: 'info@konecranes.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, fieldType: 'file', value: ['crane_manual.pdf', 'crane_cert.pdf', 'crane_load_test.pdf'], inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 42750.00, priceUnit: 'EUR/vnt', leadDays: 120 }],
    auditLog: [
    {
      timestamp: '2025-10-26 13:26',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Equipment',
      newValue: 'Pipes',
    },
    {
      timestamp: '2026-05-14 12:23',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Hot-rolled steel sheet',
      newValue: 'Cut to size',
    },
    {
      timestamp: '2026-01-23 21:01',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Metal Trade LT',
    }
    ],
  },
  {
    id: 'prod-049',
    name: { ru: 'Ленточнопильный станок', en: 'Band Saw', lt: 'Juostinis pjūklas' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'BS-400', price: 3200.00, minStock: 2, priceUnit: 'EUR/vnt', createdAt: '2025-05-15',
    description: 'Automatic horizontal band saw for steel profiles.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, fieldType: 'text', value: 'Behringer', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, fieldType: 'number', value: 24, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, fieldType: 'email', value: 'info@behringer.net', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, fieldType: 'file', value: ['bandsaw_manual.pdf'], inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '5', name: { ru: 'ProMetal UAB', en: 'ProMetal UAB', lt: 'ProMetal UAB' }, price: 3040.00, priceUnit: 'EUR/vnt', leadDays: 3 }],
    auditLog: [
    {
      timestamp: '2026-04-13 09:20',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Welded pipe',
      newValue: 'Cut to size',
    },
    {
      timestamp: '2026-04-24 00:00',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Euro Metal GmbH',
    },
    {
      timestamp: '2026-02-02 06:32',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Consumables',
    }
    ],
  },
  {
    id: 'prod-050',
    name: { ru: 'Сварочный робот 6-осевой', en: 'Welding Robot 6-Axis', lt: 'Suvirinimo robotas 6 ašių' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'WR-6', price: 55000.00, minStock: 1, priceUnit: 'EUR/vnt', createdAt: '2025-06-01',
    description: '6-axis welding robot with integrated seam tracking.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, fieldType: 'text', value: 'FANUC', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, fieldType: 'number', value: 36, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, fieldType: 'email', value: 'robotics@fanuc.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, fieldType: 'file', value: ['robot_manual.pdf', 'robot_safety.pdf', 'robot_programming.pdf'], inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 52250.00, priceUnit: 'EUR/vnt', leadDays: 90 }],
    auditLog: [
    {
      timestamp: '2025-11-29 20:55',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Euro Metal GmbH',
      newValue: 'Metal Trade LT',
    }
    ],
  },
  // ── cat-2 Sheets (continued) ──────────────────────────────────────────────────
  {
    id: 'prod-051',
    name: { ru: 'Стальной лист S235 3мм 1500×3000', en: 'Steel Sheet S235 3mm 1500×3000', lt: 'Plieno lakštas S235 3mm 1500×3000' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'SS-3-1500', price: 115.00, minStock: 40, priceUnit: 'EUR/vnt', createdAt: '2025-06-15',
    description: 'General purpose hot-rolled sheet for fabrication.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1500, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 3000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 23.55, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 109.25, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2026-03-10 03:51',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Nordic Steel AB',
    }
    ],
  },
  {
    id: 'prod-052',
    name: { ru: 'Стальной лист S355 12мм 2000×6000', en: 'Steel Sheet S355 12mm 2000×6000', lt: 'Plieno lakštas S355 12mm 2000×6000' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'SS-12-2000', price: 520.00, minStock: 10, priceUnit: 'EUR/vnt', createdAt: '2025-07-01',
    description: 'Heavy plate for structural and mining applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355J2+N', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 12, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 2000, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 94.2, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 494.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2025-11-12 22:42',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '142',
      newValue: '41',
    },
    {
      timestamp: '2026-02-12 21:52',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'IU-7598',
      newValue: 'FP-9269',
    },
    {
      timestamp: '2026-02-15 19:18',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '200',
      newValue: '39',
    }
    ],
  },
  {
    id: 'prod-053',
    name: { ru: 'Нержавеющий лист 1.5мм 316L', en: 'Stainless Sheet 1.5mm 316L', lt: 'Nerūdijantis lakštas 1.5mm 316L' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'SS-316L-1.5', price: 280.00, minStock: 10, priceUnit: 'EUR/vnt', createdAt: '2025-07-15',
    description: 'Stainless steel sheet AISI 316L for chemical environments.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: '316L', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10088', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7980, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 1.5, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1000, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 11.97, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 266.00, priceUnit: 'EUR/vnt', leadDays: 21 },
      { id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 271.60, priceUnit: 'EUR/vnt', leadDays: 10 },
    ],
    auditLog: [
    {
      timestamp: '2026-02-26 12:21',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Hot-rolled steel sheet',
      newValue: 'Seamless pipe',
    }
    ],
  },
  {
    id: 'prod-054',
    name: { ru: 'Алюминиевый лист 5мм 1500×3000', en: 'Aluminium Sheet 5mm 1500×3000', lt: 'Aliuminio lakštas 5mm 1500×3000' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'AL-5-1500', price: 320.00, minStock: 10, priceUnit: 'EUR/vnt', createdAt: '2025-08-01',
    description: 'Aluminium sheet 5083 for marine and transport applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: '5083', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 485', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 2700, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 5, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1500, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 3000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 13.5, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 304.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2025-10-31 16:11',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '176',
      newValue: '78',
    },
    {
      timestamp: '2026-03-25 13:24',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Metal Trade LT',
    }
    ],
  },
  {
    id: 'prod-055',
    name: { ru: 'Латунный лист 2мм', en: 'Brass Sheet 2mm', lt: 'Žalvario lakštas 2mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'BR-2', price: 180.00, minStock: 15, priceUnit: 'EUR/vnt', createdAt: '2025-08-15',
    description: 'Brass sheet CuZn37 for decorative and electrical components.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'CuZn37', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 1652', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 8400, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 600, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 1500, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 16.8, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 171.00, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2025-10-26 03:04',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '30.18 EUR',
      newValue: '161.91 EUR',
    },
    {
      timestamp: '2025-11-14 00:10',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '42',
      newValue: '146',
    },
    {
      timestamp: '2026-04-19 14:10',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '43',
      newValue: '60',
    }
    ],
  },
  {
    id: 'prod-056',
    name: { ru: 'Бронзовый лист 3мм', en: 'Bronze Sheet 3mm', lt: 'Bronzos lakštas 3mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'BRZ-3', price: 250.00, minStock: 10, priceUnit: 'EUR/vnt', createdAt: '2025-09-01',
    description: 'Phosphor bronze sheet for bearings and wear plates.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'CuSn8', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 1652', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 8800, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 500, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 1000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 26.4, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: 237.50, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2026-04-06 03:02',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '65.79 EUR',
      newValue: '30.87 EUR',
    }
    ],
  },
  {
    id: 'prod-057',
    name: { ru: 'Стальной лист S690 6мм', en: 'Steel Sheet S690 6mm', lt: 'Plieno lakštas S690 6mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'SS-690-6', price: 380.00, minStock: 8, priceUnit: 'EUR/vnt', createdAt: '2025-09-15',
    description: 'High-strength steel plate for heavy machinery.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S690QL', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025-6', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 6, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1500, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 3000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 47.1, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 361.00, priceUnit: 'EUR/vnt', leadDays: 21 }],
    auditLog: [
    {
      timestamp: '2026-03-08 09:19',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Pipes',
      newValue: 'Sheets',
    },
    {
      timestamp: '2026-05-06 23:14',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Pipes',
      newValue: 'Sheets',
    },
    {
      timestamp: '2026-01-05 16:13',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '52',
      newValue: '173',
    }
    ],
  },
  {
    id: 'prod-058',
    name: { ru: 'Стальной лист Hardox 450 10мм', en: 'Hardox 450 Sheet 10mm', lt: 'Hardox 450 lakštas 10mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'HX-450-10', price: 650.00, minStock: 5, priceUnit: 'EUR/vnt', createdAt: '2025-10-01',
    description: 'Abrasion-resistant steel plate for wear applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'Hardox 450', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 10, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1500, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 3000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 78.5, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: 617.50, priceUnit: 'EUR/vnt', leadDays: 30 }],
    auditLog: [
    {
      timestamp: '2026-05-10 10:00',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'WT-1466',
      newValue: 'LC-3570',
    },
    {
      timestamp: '2026-01-24 09:13',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Pipes',
    }
    ],
  },
  {
    id: 'prod-059',
    name: { ru: 'Перфорированный лист 2мм', en: 'Perforated Sheet 2mm', lt: 'Perforuotas lakštas 2mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'PERF-2', price: 95.00, minStock: 25, priceUnit: 'EUR/vnt', createdAt: '2025-10-15',
    description: 'Perforated steel sheet with 10mm round holes, 40% open area.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1000, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 9.42, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 90.25, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2026-02-03 10:32',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cold-rolled steel sheet',
      newValue: 'Hot-rolled steel sheet',
    },
    {
      timestamp: '2026-02-26 07:04',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '92.27 EUR',
      newValue: '169.30 EUR',
    },
    {
      timestamp: '2025-10-18 13:51',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '96.68 EUR',
      newValue: '35.49 EUR',
    }
    ],
  },
  {
    id: 'prod-061',
    name: { ru: 'Труба профильная 40x40x2', en: 'Profile Pipe 40x40x2', lt: 'Profilinis vamzdis 40x40x2' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'PP-40-40-2', price: 18.50, minStock: 200, priceUnit: 'EUR/vnt', createdAt: '2025-01-20',
    description: 'Square profile pipe 40x40mm, wall 2mm, for metal structures.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10219', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 40, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Profile', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 60, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 40, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 2.31, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 17.80, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2025-11-10 02:51',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Euro Metal GmbH',
      newValue: 'Nordic Steel AB',
    },
    {
      timestamp: '2025-12-18 16:02',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '47.58 EUR',
      newValue: '188.92 EUR',
    }
    ],
  },
  {
    id: 'prod-062',
    name: { ru: 'Труба профильная 60x40x3', en: 'Profile Pipe 60x40x3', lt: 'Profilinis vamzdis 60x40x3' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'PP-60-40-3', price: 24.80, minStock: 150, priceUnit: 'EUR/vnt', createdAt: '2025-02-10',
    description: 'Rectangular profile pipe 60x40mm, wall 3mm, for structural frames.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355J2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10219', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 60, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Profile', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 90, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 40, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 4.08, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 23.50, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2026-01-21 00:52',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Hot-rolled steel sheet',
      newValue: 'Cold-rolled steel sheet',
    }
    ],
  },
  {
    id: 'prod-063',
    name: { ru: 'Труба круглая 50x3', en: 'Round Pipe 50x3', lt: 'Apvalus vamzdis 50x3' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'RP-50-3', price: 14.20, minStock: 300, priceUnit: 'EUR/vnt', createdAt: '2025-02-15',
    description: 'Seamless round pipe 50mm diameter, wall 3mm, for hydraulic systems.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'E235', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10216', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 75, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 3.48, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 13.50, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2026-01-06 06:49',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Welded pipe',
      newValue: 'Hot-rolled steel sheet',
    },
    {
      timestamp: '2025-12-21 00:16',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'LU-7170',
      newValue: 'LS-8179',
    }
    ],
  },
  {
    id: 'prod-064',
    name: { ru: 'Труба круглая 76x4', en: 'Round Pipe 76x4', lt: 'Apvalus vamzdis 76x4' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'RP-76-4', price: 22.00, minStock: 200, priceUnit: 'EUR/vnt', createdAt: '2025-03-01',
    description: 'Seamless round pipe 76mm diameter, wall 4mm, for high-pressure applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'E355', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10216', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 76, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 4, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 114, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 76, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 7.10, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 21.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-02-10 09:15',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Euro Metal GmbH',
      newValue: 'Steel Plus OÜ',
    },
    {
      timestamp: '2026-04-23 01:28',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '62',
      newValue: '190',
    },
    {
      timestamp: '2026-01-24 20:51',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '17',
      newValue: '54',
    }
    ],
  },
  {
    id: 'prod-065',
    name: { ru: 'Труба водогазопроводная 1"', en: 'Gas Pipe 1"', lt: 'Dujų vamzdis 1"' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'GP-1', price: 8.90, minStock: 500, priceUnit: 'EUR/vnt', createdAt: '2025-03-10',
    description: 'Galvanized gas pipe 1 inch, threaded ends, for gas distribution.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10255', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 33.7, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 3.25, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 33.7, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 2.44, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 8.50, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2026-05-03 01:58',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Equipment',
      newValue: 'Pipes',
    },
    {
      timestamp: '2025-11-13 06:45',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'HN-1177',
      newValue: 'HS-5101',
    }
    ],
  },
  {
    id: 'prod-060',
    name: { ru: 'Рифленый лист 4мм', en: 'Chequer Plate 4mm', lt: 'Rifliuotas lakštas 4mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'CP-4', price: 160.00, minStock: 20, priceUnit: 'EUR/vnt', createdAt: '2025-11-01',
    description: 'Chequer plate with diamond pattern for flooring and stairs.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 4, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1250, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2500, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 31.4, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 152.00, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2025-10-26 02:51',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Consumables',
      newValue: 'Sheets',
    },
    {
      timestamp: '2026-04-27 12:50',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Equipment',
      newValue: 'Sheets',
    }
    ],
  },
  {
    id: 'prod-066',
    name: { ru: 'Труба нержавеющая 25x2', en: 'Stainless Pipe 25x2', lt: 'Nerūdijantis vamzdis 25x2' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'SSP-25-2', price: 32.50, minStock: 100, priceUnit: 'EUR/vnt', createdAt: '2025-03-15',
    description: 'Stainless steel pipe 25mm diameter, wall 2mm, for food industry.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'AISI 304', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10217-7', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7900, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 25, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 38, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 25, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 1.13, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 31.00, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2025-10-04 03:23',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '75.23 EUR',
      newValue: '147.70 EUR',
    },
    {
      timestamp: '2026-04-02 23:45',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '27',
      newValue: '177',
    }
    ],
  },
  {
    id: 'prod-067',
    name: { ru: 'Труба оцинкованная 1/2"', en: 'Galvanized Pipe 1/2"', lt: 'Cinkuotas vamzdis 1/2"' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'GALV-05', price: 5.60, minStock: 600, priceUnit: 'EUR/vnt', createdAt: '2025-04-01',
    description: 'Galvanized steel pipe 1/2 inch, for water supply systems.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10255', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 21.3, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 2.65, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 32, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 21.3, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 1.22, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 5.30, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2025-11-03 04:29',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Pipes',
    },
    {
      timestamp: '2026-04-24 18:22',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'LV-8016',
      newValue: 'FY-9659',
    },
    {
      timestamp: '2025-10-31 22:35',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cut to size',
      newValue: 'Hot-rolled steel sheet',
    }
    ],
  },
  {
    id: 'prod-068',
    name: { ru: 'Труба профильная 80x80x4', en: 'Profile Pipe 80x80x4', lt: 'Profilinis vamzdis 80x80x4' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'PP-80-80-4', price: 35.00, minStock: 100, priceUnit: 'EUR/vnt', createdAt: '2025-04-10',
    description: 'Heavy square profile pipe 80x80mm, wall 4mm, for load-bearing structures.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355J2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10219', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 80, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 4, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Profile', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 120, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 80, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 9.22, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 33.50, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-04-11 12:22',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Euro Metal GmbH',
    },
    {
      timestamp: '2026-01-10 20:27',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '45',
      newValue: '49',
    },
    {
      timestamp: '2026-03-31 13:46',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Metal Trade LT',
    }
    ],
  },
  {
    id: 'prod-069',
    name: { ru: 'Труба профильная 100x50x3', en: 'Profile Pipe 100x50x3', lt: 'Profilinis vamzdis 100x50x3' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'PP-100-50-3', price: 28.00, minStock: 120, priceUnit: 'EUR/vnt', createdAt: '2025-04-15',
    description: 'Rectangular profile pipe 100x50mm, wall 3mm, for frames and supports.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10219', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 100, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Profile', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 150, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 6.28, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 26.50, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2025-11-30 07:42',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '67.00 EUR',
      newValue: '73.25 EUR',
    }
    ],
  },
  {
    id: 'prod-070',
    name: { ru: 'Труба нержавеющая 50x3', en: 'Stainless Pipe 50x3', lt: 'Nerūdijantis vamzdis 50x3' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'SSP-50-3', price: 55.00, minStock: 80, priceUnit: 'EUR/vnt', createdAt: '2025-04-20',
    description: 'Stainless steel pipe 50mm diameter, wall 3mm, for chemical industry.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'AISI 316L', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10217-7', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7980, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 75, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 3.48, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 52.00, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2026-04-24 19:49',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Galvanized sheet',
      newValue: 'Cut to size',
    },
    {
      timestamp: '2025-10-12 08:11',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Seamless pipe',
      newValue: 'Hot-rolled steel sheet',
    },
    {
      timestamp: '2026-05-19 12:16',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'UL-8861',
      newValue: 'JG-5758',
    }
    ],
  },
  {
    id: 'prod-071',
    name: { ru: 'Электроды ESAB OK 46.00 3мм', en: 'ESAB OK 46.00 Electrodes 3mm', lt: 'ESAB OK 46.00 Elektrodai 3mm' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'EL-ESAB-3', price: 4.50, minStock: 500, priceUnit: 'EUR/kg', createdAt: '2025-01-10',
    description: 'Rutile welding electrodes 3mm, for general purpose welding.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Тип расходника', en: 'Consumable type', lt: 'Eksploatacinės tipas' }, fieldType: 'enum', value: 'Electrode', inherited: false, options: [
        { ru: 'Электрод', en: 'Electrode', lt: 'Elektrodas' }, { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, { ru: 'Газ', en: 'Gas', lt: 'Dujos' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Сертифицировано', en: 'Certified', lt: 'Sertifikuota' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2027-06-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 4.20, priceUnit: 'EUR/kg', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2025-10-01 17:08',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Galvanized sheet',
      newValue: 'Cut to size',
    }
    ],
  },
  {
    id: 'prod-072',
    name: { ru: 'Электроды ESAB OK 48.00 4мм', en: 'ESAB OK 48.00 Electrodes 4mm', lt: 'ESAB OK 48.00 Elektrodai 4mm' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'EL-ESAB-4', price: 5.20, minStock: 400, priceUnit: 'EUR/kg', createdAt: '2025-01-15',
    description: 'Basic welding electrodes 4mm, for structural welding.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Тип расходника', en: 'Consumable type', lt: 'Eksploatacinės tipas' }, fieldType: 'enum', value: 'Electrode', inherited: false, options: [
        { ru: 'Электрод', en: 'Electrode', lt: 'Elektrodas' }, { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, { ru: 'Газ', en: 'Gas', lt: 'Dujos' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Сертифицировано', en: 'Certified', lt: 'Sertifikuota' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2027-08-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 4.90, priceUnit: 'EUR/kg', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2025-12-16 07:44',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '198',
      newValue: '190',
    },
    {
      timestamp: '2026-05-10 20:48',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Galvanized sheet',
      newValue: 'Welded pipe',
    },
    {
      timestamp: '2025-10-25 10:15',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'FI-1766',
      newValue: 'NC-8188',
    }
    ],
  },
  {
    id: 'prod-073',
    name: { ru: 'Проволока сварочная Lincoln L-56 1мм', en: 'Lincoln L-56 Welding Wire 1mm', lt: 'Lincoln L-56 Suvirinimo viela 1mm' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'WW-LINCOLN-1', price: 3.80, minStock: 300, priceUnit: 'EUR/kg', createdAt: '2025-02-01',
    description: 'Copper-coated MIG welding wire 1mm, 15kg spool.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Тип расходника', en: 'Consumable type', lt: 'Eksploatacinės tipas' }, fieldType: 'enum', value: 'Wire', inherited: false, options: [
        { ru: 'Электрод', en: 'Electrode', lt: 'Elektrodas' }, { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, { ru: 'Газ', en: 'Gas', lt: 'Dujos' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Сертифицировано', en: 'Certified', lt: 'Sertifikuota' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2028-01-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 3.50, priceUnit: 'EUR/kg', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2026-01-02 03:25',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Consumables',
    },
    {
      timestamp: '2026-02-02 06:34',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'SS-6074',
      newValue: 'NP-1218',
    },
    {
      timestamp: '2026-01-17 12:00',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '11.72 EUR',
      newValue: '175.46 EUR',
    }
    ],
  },
  {
    id: 'prod-074',
    name: { ru: 'Проволока сварочная ESAB OK Autrod 12.64 1.2мм', en: 'ESAB OK Autrod 12.64 Wire 1.2mm', lt: 'ESAB OK Autrod 12.64 Viela 1.2mm' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'WW-ESAB-12', price: 4.10, minStock: 250, priceUnit: 'EUR/kg', createdAt: '2025-02-10',
    description: 'Metal-cored welding wire 1.2mm, for high-deposition welding.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Тип расходника', en: 'Consumable type', lt: 'Eksploatacinės tipas' }, fieldType: 'enum', value: 'Wire', inherited: false, options: [
        { ru: 'Электрод', en: 'Electrode', lt: 'Elektrodas' }, { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, { ru: 'Газ', en: 'Gas', lt: 'Dujos' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Сертифицировано', en: 'Certified', lt: 'Sertifikuota' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2028-03-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 3.90, priceUnit: 'EUR/kg', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-04-25 13:42',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Pipes',
      newValue: 'Sheets',
    }
    ],
  },
  {
    id: 'prod-075',
    name: { ru: 'Аргон сжатый 40л', en: 'Compressed Argon 40L', lt: 'Spaustas argonas 40L' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'ARGON-40', price: 65.00, minStock: 20, priceUnit: 'EUR/vnt', createdAt: '2025-03-01',
    description: 'Compressed argon gas cylinder 40L, 200 bar, for TIG welding.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Тип расходника', en: 'Consumable type', lt: 'Eksploatacinės tipas' }, fieldType: 'enum', value: 'Gas', inherited: false, options: [
        { ru: 'Электрод', en: 'Electrode', lt: 'Elektrodas' }, { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, { ru: 'Газ', en: 'Gas', lt: 'Dujos' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Сертифицировано', en: 'Certified', lt: 'Sertifikuota' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2026-09-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 62.00, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2026-03-01 23:00',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '86',
      newValue: '181',
    },
    {
      timestamp: '2026-05-08 04:02',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Consumables',
      newValue: 'Equipment',
    },
    {
      timestamp: '2026-01-02 06:00',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '59',
      newValue: '174',
    }
    ],
  },
  {
    id: 'prod-076',
    name: { ru: 'Смесь газов Corgon 18 (Ar+CO2) 40л', en: 'Corgon 18 Gas Mix (Ar+CO2) 40L', lt: 'Corgon 18 Dujų mišinys (Ar+CO2) 40L' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'CORGON-40', price: 58.00, minStock: 15, priceUnit: 'EUR/vnt', createdAt: '2025-03-10',
    description: 'Argon + CO2 shielding gas mix for MIG/MAG welding, 40L cylinder.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Тип расходника', en: 'Consumable type', lt: 'Eksploatacinės tipas' }, fieldType: 'enum', value: 'Gas', inherited: false, options: [
        { ru: 'Электрод', en: 'Electrode', lt: 'Elektrodas' }, { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, { ru: 'Газ', en: 'Gas', lt: 'Dujos' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Сертифицировано', en: 'Certified', lt: 'Sertifikuota' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2026-10-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 55.00, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2025-10-25 07:51',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Galvanized sheet',
      newValue: 'Hot-rolled steel sheet',
    },
    {
      timestamp: '2026-02-28 09:02',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '85.41 EUR',
      newValue: '195.83 EUR',
    }
    ],
  },
  {
    id: 'prod-077',
    name: { ru: 'Кислород сжатый 40л', en: 'Compressed Oxygen 40L', lt: 'Spaustas deguonis 40L' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'OXYGEN-40', price: 45.00, minStock: 25, priceUnit: 'EUR/vnt', createdAt: '2025-03-15',
    description: 'Compressed oxygen cylinder 40L, for cutting and welding.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Тип расходника', en: 'Consumable type', lt: 'Eksploatacinės tipas' }, fieldType: 'enum', value: 'Gas', inherited: false, options: [
        { ru: 'Электрод', en: 'Electrode', lt: 'Elektrodas' }, { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, { ru: 'Газ', en: 'Gas', lt: 'Dujos' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Сертифицировано', en: 'Certified', lt: 'Sertifikuota' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2026-08-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 42.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-04-29 14:08',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'VC-1215',
      newValue: 'PD-7849',
    },
    {
      timestamp: '2026-04-14 04:30',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Consumables',
      newValue: 'Sheets',
    }
    ],
  },
  {
    id: 'prod-078',
    name: { ru: 'Пропан сжатый 50л', en: 'Compressed Propane 50L', lt: 'Spaustas propanas 50L' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'PROPANE-50', price: 52.00, minStock: 20, priceUnit: 'EUR/vnt', createdAt: '2025-04-01',
    description: 'Propane gas cylinder 50L, for heating and cutting.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Тип расходника', en: 'Consumable type', lt: 'Eksploatacinės tipas' }, fieldType: 'enum', value: 'Gas', inherited: false, options: [
        { ru: 'Электрод', en: 'Electrode', lt: 'Elektrodas' }, { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, { ru: 'Газ', en: 'Gas', lt: 'Dujos' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Сертифицировано', en: 'Certified', lt: 'Sertifikuota' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2026-12-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 49.00, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2025-12-12 02:00',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Seamless pipe',
      newValue: 'Hot-rolled steel sheet',
    },
    {
      timestamp: '2026-02-04 06:29',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cut to size',
      newValue: 'Welded pipe',
    }
    ],
  },
  {
    id: 'prod-079',
    name: { ru: 'Ацетилен растворенный 40л', en: 'Dissolved Acetylene 40L', lt: 'Ištirpintas acetilenas 40L' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'ACETYLENE-40', price: 75.00, minStock: 10, priceUnit: 'EUR/vnt', createdAt: '2025-04-10',
    description: 'Dissolved acetylene cylinder 40L, for oxy-fuel cutting.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Тип расходника', en: 'Consumable type', lt: 'Eksploatacinės tipas' }, fieldType: 'enum', value: 'Gas', inherited: false, options: [
        { ru: 'Электрод', en: 'Electrode', lt: 'Elektrodas' }, { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, { ru: 'Газ', en: 'Gas', lt: 'Dujos' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Сертифицировано', en: 'Certified', lt: 'Sertifikuota' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2026-11-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 72.00, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2025-12-23 08:28',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '193',
      newValue: '95',
    }
    ],
  },
  {
    id: 'prod-080',
    name: { ru: 'Флюс сварочный Lincoln 860 25кг', en: 'Lincoln 860 Welding Flux 25kg', lt: 'Lincoln 860 Suvirinimo fliusas 25kg' },
    categoryId: 'cat-5', categoryName: { ru: 'Расходники', en: 'Consumables', lt: 'Eksploatacinės' }, sku: 'FLUX-LINCOLN-25', price: 38.00, minStock: 50, priceUnit: 'EUR/vnt', createdAt: '2025-04-15',
    description: 'Agglomerated welding flux for submerged arc welding, 25kg bag.',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: { ru: 'Тип расходника', en: 'Consumable type', lt: 'Eksploatacinės tipas' }, fieldType: 'enum', value: 'Electrode', inherited: false, options: [
        { ru: 'Электрод', en: 'Electrode', lt: 'Elektrodas' }, { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, { ru: 'Газ', en: 'Gas', lt: 'Dujos' },
      ] },
      { fieldId: 'f-5-2', fieldName: { ru: 'Сертифицировано', en: 'Certified', lt: 'Sertifikuota' }, fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, fieldType: 'date', value: '2028-06-01', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 36.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2025-11-13 01:40',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '132.08 EUR',
      newValue: '160.62 EUR',
    }
    ],
  },
  {
    id: 'prod-081',
    name: { ru: 'Сварочный аппарат Lincoln Invertec 250', en: 'Lincoln Invertec 250 Welder', lt: 'Lincoln Invertec 250 Suvirinimo aparatas' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'WELD-LINCOLN-250', price: 2500.00, minStock: 5, priceUnit: 'EUR/vnt', createdAt: '2025-01-05',
    description: 'Professional TIG/MMA inverter welder 250A, with pulse function.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Серийный номер', en: 'Serial number', lt: 'Serijos numeris' }, fieldType: 'text', value: 'L250-2025-001', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Мощность (кВт)', en: 'Power (kW)', lt: 'Galia (kW)' }, fieldType: 'number', value: 8.5, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email техподдержки', en: 'Support email', lt: 'Pagalbos el. paštas' }, fieldType: 'email', value: 'support@lincolnelectric.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Документация', en: 'Documentation', lt: 'Dokumentacija' }, fieldType: 'file', value: '/docs/lincoln-invertec-250.pdf', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 2400.00, priceUnit: 'EUR/vnt', leadDays: 14 }],
    auditLog: [
    {
      timestamp: '2026-01-16 06:21',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'CC-4272',
      newValue: 'KQ-6013',
    },
    {
      timestamp: '2026-05-08 14:01',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'HC-7653',
      newValue: 'SJ-5084',
    },
    {
      timestamp: '2026-04-07 06:31',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Welded pipe',
      newValue: 'Seamless pipe',
    }
    ],
  },
  {
    id: 'prod-082',
    name: { ru: 'Сварочный аппарат ESAB Rebel EMP 235', en: 'ESAB Rebel EMP 235 Welder', lt: 'ESAB Rebel EMP 235 Suvirinimo aparatas' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'WELD-ESAB-235', price: 3200.00, minStock: 3, priceUnit: 'EUR/vnt', createdAt: '2025-01-10',
    description: 'Multi-process welder MIG/TIG/MMA 235A, with synergic control.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Серийный номер', en: 'Serial number', lt: 'Serijos numeris' }, fieldType: 'text', value: 'REBEL235-2025-001', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Мощность (кВт)', en: 'Power (kW)', lt: 'Galia (kW)' }, fieldType: 'number', value: 10.2, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email техподдержки', en: 'Support email', lt: 'Pagalbos el. paštas' }, fieldType: 'email', value: 'support@esab.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Документация', en: 'Documentation', lt: 'Dokumentacija' }, fieldType: 'file', value: '/docs/esab-rebel-emp-235.pdf', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 3100.00, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2025-10-01 16:00',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Nordic Steel AB',
    }
    ],
  },
  {
    id: 'prod-083',
    name: { ru: 'Плазморез Hypertherm Powermax 45 XP', en: 'Hypertherm Powermax 45 XP Plasma', lt: 'Hypertherm Powermax 45 XP Plazma' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'PLASMA-HT-45', price: 4500.00, minStock: 2, priceUnit: 'EUR/vnt', createdAt: '2025-01-20',
    description: 'Portable plasma cutter 45A, cuts up to 16mm steel.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Серийный номер', en: 'Serial number', lt: 'Serijos numeris' }, fieldType: 'text', value: 'PM45XP-2025-001', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Мощность (кВт)', en: 'Power (kW)', lt: 'Galia (kW)' }, fieldType: 'number', value: 12.0, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email техподдержки', en: 'Support email', lt: 'Pagalbos el. paštas' }, fieldType: 'email', value: 'support@hypertherm.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Документация', en: 'Documentation', lt: 'Dokumentacija' }, fieldType: 'file', value: '/docs/hypertherm-powermax45xp.pdf', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 4300.00, priceUnit: 'EUR/vnt', leadDays: 14 }],
    auditLog: [
    {
      timestamp: '2026-03-24 14:12',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Pipes',
    }
    ],
  },
  {
    id: 'prod-084',
    name: { ru: 'Станок ленточнопильный Bomar Ergonomic 280', en: 'Bomar Ergonomic 280 Bandsaw', lt: 'Bomar Ergonomic 280 Juostinis pjūklas' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'BANDSAW-BOMAR-280', price: 8500.00, minStock: 2, priceUnit: 'EUR/vnt', createdAt: '2025-02-01',
    description: 'Automatic horizontal bandsaw for metal cutting, 280mm capacity.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Серийный номер', en: 'Serial number', lt: 'Serijos numeris' }, fieldType: 'text', value: 'BOMAR280-2025-001', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Мощность (кВт)', en: 'Power (kW)', lt: 'Galia (kW)' }, fieldType: 'number', value: 3.0, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email техподдержки', en: 'Support email', lt: 'Pagalbos el. paštas' }, fieldType: 'email', value: 'service@bomar.eu', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Документация', en: 'Documentation', lt: 'Dokumentacija' }, fieldType: 'file', value: '/docs/bomar-ergonomic-280.pdf', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 8200.00, priceUnit: 'EUR/vnt', leadDays: 21 }],
    auditLog: [
    {
      timestamp: '2026-03-30 08:50',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Euro Metal GmbH',
      newValue: 'Metal Trade LT',
    },
    {
      timestamp: '2025-10-31 22:46',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '69.63 EUR',
      newValue: '164.69 EUR',
    }
    ],
  },
  {
    id: 'prod-085',
    name: { ru: 'Листогибочный станок Durma AD-R 30120', en: 'Durma AD-R 30120 Press Brake', lt: 'Durma AD-R 30120 Presas' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'PRESS-DURMA-30120', price: 28500.00, minStock: 1, priceUnit: 'EUR/vnt', createdAt: '2025-02-10',
    description: 'Hydraulic press brake 3000mm, 120 ton, CNC controlled.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Серийный номер', en: 'Serial number', lt: 'Serijos numeris' }, fieldType: 'text', value: 'ADR30120-2025-001', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Мощность (кВт)', en: 'Power (kW)', lt: 'Galia (kW)' }, fieldType: 'number', value: 18.5, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email техподдержки', en: 'Support email', lt: 'Pagalbos el. paštas' }, fieldType: 'email', value: 'service@durma.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Документация', en: 'Documentation', lt: 'Dokumentacija' }, fieldType: 'file', value: '/docs/durma-ad-r-30120.pdf', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 27500.00, priceUnit: 'EUR/vnt', leadDays: 30 }],
    auditLog: [
    {
      timestamp: '2025-12-01 02:50',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cold-rolled steel sheet',
      newValue: 'Galvanized sheet',
    },
    {
      timestamp: '2025-10-11 22:04',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Galvanized sheet',
      newValue: 'Hot-rolled steel sheet',
    },
    {
      timestamp: '2025-11-21 16:12',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Pipes',
      newValue: 'Sheets',
    }
    ],
  },
  {
    id: 'prod-086',
    name: { ru: 'Лазерный станок Bystronic ByStar 4020', en: 'Bystronic ByStar 4020 Laser', lt: 'Bystronic ByStar 4020 Lazeris' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'LASER-BYST-4020', price: 185000.00, minStock: 1, priceUnit: 'EUR/vnt', createdAt: '2025-02-20',
    description: 'Fiber laser cutting machine 6kW, 4000x2000mm table.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Серийный номер', en: 'Serial number', lt: 'Serijos numeris' }, fieldType: 'text', value: 'BYST4020-2025-001', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Мощность (кВт)', en: 'Power (kW)', lt: 'Galia (kW)' }, fieldType: 'number', value: 6.0, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email техподдержки', en: 'Support email', lt: 'Pagalbos el. paštas' }, fieldType: 'email', value: 'support@bystronic.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Документация', en: 'Documentation', lt: 'Dokumentacija' }, fieldType: 'file', value: '/docs/bystronic-bystar-4020.pdf', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 180000.00, priceUnit: 'EUR/vnt', leadDays: 60 }],
    auditLog: [
    {
      timestamp: '2025-12-01 21:29',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '66.59 EUR',
      newValue: '198.08 EUR',
    }
    ],
  },
  {
    id: 'prod-087',
    name: { ru: 'Компрессор винтовой Kaeser AS 30', en: 'Kaeser AS 30 Screw Compressor', lt: 'Kaeser AS 30 Sraigtinis kompresorius' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'COMP-KAESER-30', price: 12500.00, minStock: 2, priceUnit: 'EUR/vnt', createdAt: '2025-03-01',
    description: 'Industrial screw compressor 30kW, with integrated dryer.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Серийный номер', en: 'Serial number', lt: 'Serijos numeris' }, fieldType: 'text', value: 'KAESER30-2025-001', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Мощность (кВт)', en: 'Power (kW)', lt: 'Galia (kW)' }, fieldType: 'number', value: 30.0, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email техподдержки', en: 'Support email', lt: 'Pagalbos el. paštas' }, fieldType: 'email', value: 'service@kaeser.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Документация', en: 'Documentation', lt: 'Dokumentacija' }, fieldType: 'file', value: '/docs/kaeser-as-30.pdf', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 12000.00, priceUnit: 'EUR/vnt', leadDays: 21 }],
    auditLog: [
    {
      timestamp: '2025-10-29 19:56',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'PZ-5092',
      newValue: 'AN-8803',
    },
    {
      timestamp: '2025-10-08 02:39',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '84.10 EUR',
      newValue: '205.18 EUR',
    }
    ],
  },
  {
    id: 'prod-088',
    name: { ru: 'Кран мостовой 10т', en: 'Overhead Crane 10t', lt: 'Kabininis kranas 10t' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'CRANE-10T', price: 45000.00, minStock: 1, priceUnit: 'EUR/vnt', createdAt: '2025-03-10',
    description: 'Overhead traveling crane 10 ton capacity, 20m span.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Серийный номер', en: 'Serial number', lt: 'Serijos numeris' }, fieldType: 'text', value: 'CRANE10T-2025-001', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Мощность (кВт)', en: 'Power (kW)', lt: 'Galia (kW)' }, fieldType: 'number', value: 15.0, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email техподдержки', en: 'Support email', lt: 'Pagalbos el. paštas' }, fieldType: 'email', value: 'service@abuscranes.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Документация', en: 'Documentation', lt: 'Dokumentacija' }, fieldType: 'file', value: '/docs/crane-10t.pdf', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 43500.00, priceUnit: 'EUR/vnt', leadDays: 45 }],
    auditLog: [
    {
      timestamp: '2026-02-26 15:11',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Cut to size',
      newValue: 'Galvanized sheet',
    },
    {
      timestamp: '2026-04-18 10:22',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Euro Metal GmbH',
      newValue: 'Metal Trade LT',
    },
    {
      timestamp: '2025-11-10 19:44',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'LE-8991',
      newValue: 'YJ-1631',
    }
    ],
  },
  {
    id: 'prod-089',
    name: { ru: 'Дробеструйная камера Blastrac 2-30DE', en: 'Blastrac 2-30DE Shot Blast', lt: 'Blastrac 2-30DE Srauto pūtimo kamera' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'SHOTBLAST-BLASTRAC', price: 18500.00, minStock: 1, priceUnit: 'EUR/vnt', createdAt: '2025-03-20',
    description: 'Self-propelled shot blasting machine for surface preparation.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Серийный номер', en: 'Serial number', lt: 'Serijos numeris' }, fieldType: 'text', value: 'BLASTRAC-2025-001', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Мощность (кВт)', en: 'Power (kW)', lt: 'Galia (kW)' }, fieldType: 'number', value: 22.0, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email техподдержки', en: 'Support email', lt: 'Pagalbos el. paštas' }, fieldType: 'email', value: 'service@blastrac.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Документация', en: 'Documentation', lt: 'Dokumentacija' }, fieldType: 'file', value: '/docs/blastrac-2-30de.pdf', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 17800.00, priceUnit: 'EUR/vnt', leadDays: 30 }],
    auditLog: [
    {
      timestamp: '2025-12-21 09:09',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '37',
      newValue: '73',
    },
    {
      timestamp: '2026-01-12 21:38',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Consumables',
      newValue: 'Sheets',
    },
    {
      timestamp: '2026-05-14 13:21',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'QK-7763',
      newValue: 'FT-5553',
    }
    ],
  },
  {
    id: 'prod-090',
    name: { ru: 'Сварочный стол Siegmund Micro 2000', en: 'Siegmund Micro 2000 Welding Table', lt: 'Siegmund Micro 2000 Suvirinimo stalas' },
    categoryId: 'cat-6', categoryName: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' }, sku: 'WELDTABLE-SIEGMUND', price: 3800.00, minStock: 3, priceUnit: 'EUR/vnt', createdAt: '2025-04-01',
    description: 'Modular welding table 2000x1000mm with clamping system.',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: { ru: 'Серийный номер', en: 'Serial number', lt: 'Serijos numeris' }, fieldType: 'text', value: 'SIEGMUND-2025-001', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: { ru: 'Мощность (кВт)', en: 'Power (kW)', lt: 'Galia (kW)' }, fieldType: 'number', value: 0, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: { ru: 'Email техподдержки', en: 'Support email', lt: 'Pagalbos el. paštas' }, fieldType: 'email', value: 'info@siegmund.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: { ru: 'Документация', en: 'Documentation', lt: 'Dokumentacija' }, fieldType: 'file', value: '/docs/siegmund-micro-2000.pdf', inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 3600.00, priceUnit: 'EUR/vnt', leadDays: 14 }],
    auditLog: [
    {
      timestamp: '2025-10-22 06:17',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Euro Metal GmbH',
    },
    {
      timestamp: '2025-12-03 04:27',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'OX-2245',
      newValue: 'SN-6740',
    },
    {
      timestamp: '2026-01-18 18:07',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Euro Metal GmbH',
    }
    ],
  },
  {
    id: 'prod-091',
    name: { ru: 'Лист оцинкованный 1.5мм', en: 'Galvanized Sheet 1.5mm', lt: 'Cinkuotas lakštas 1.5mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'GALV-15-1250', price: 85.00, minStock: 100, priceUnit: 'EUR/vnt', createdAt: '2025-04-05',
    description: 'Galvanized steel sheet 1.5mm, 1250x2500mm, Z275 coating.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'DX51D', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10143', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 1.5, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Galvanized', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1250, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2500, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 11.78, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 82.00, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2026-03-30 03:14',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'WI-6432',
      newValue: 'AJ-4710',
    }
    ],
  },
  {
    id: 'prod-092',
    name: { ru: 'Лист холоднокатаный 1мм', en: 'Cold-rolled Sheet 1mm', lt: 'Šaltai valcuotas lakštas 1mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'CRS-1-1000', price: 65.00, minStock: 150, priceUnit: 'EUR/vnt', createdAt: '2025-04-10',
    description: 'Cold-rolled steel sheet 1mm, 1000x2000mm, for automotive panels.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'DC01', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10130', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 1, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1000, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 7.85, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 62.00, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2025-10-31 01:42',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'GY-7389',
      newValue: 'FQ-2044',
    },
    {
      timestamp: '2026-03-24 20:08',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'GY-6956',
      newValue: 'YG-1032',
    }
    ],
  },
  {
    id: 'prod-093',
    name: { ru: 'Лист нержавеющий 2мм', en: 'Stainless Sheet 2mm', lt: 'Nerūdijantis lakštas 2mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'STST-2-1250', price: 220.00, minStock: 50, priceUnit: 'EUR/vnt', createdAt: '2025-04-15',
    description: 'Stainless steel sheet 2mm, 1250x2500mm, AISI 304, 2B finish.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'AISI 304', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10088-2', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7900, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1250, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2500, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 15.8, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 210.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-02-23 16:45',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '150.66 EUR',
      newValue: '86.63 EUR',
    },
    {
      timestamp: '2025-10-15 08:04',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'KG-5576',
      newValue: 'GJ-2105',
    }
    ],
  },
  {
    id: 'prod-094',
    name: { ru: 'Лист алюминиевый 3мм', en: 'Aluminum Sheet 3mm', lt: 'Aliuminio lakštas 3mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'AL-3-1200', price: 145.00, minStock: 60, priceUnit: 'EUR/vnt', createdAt: '2025-04-20',
    description: 'Aluminum sheet 3mm, 1200x2400mm, alloy 5083, marine grade.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'EN AW-5083', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 485', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 2660, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1200, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2400, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 7.98, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 140.00, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2026-01-26 03:21',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Galvanized sheet',
      newValue: 'Cold-rolled steel sheet',
    }
    ],
  },
  {
    id: 'prod-095',
    name: { ru: 'Лист оцинкованный 0.7мм', en: 'Galvanized Sheet 0.7mm', lt: 'Cinkuotas lakštas 0.7mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'GALV-07-1250', price: 52.00, minStock: 200, priceUnit: 'EUR/vnt', createdAt: '2025-04-25',
    description: 'Thin galvanized sheet 0.7mm, for roofing and cladding.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'DX51D', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10143', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 0.7, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Galvanized', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1250, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 2500, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 5.5, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 49.00, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2026-04-13 21:24',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '156.84 EUR',
      newValue: '16.62 EUR',
    },
    {
      timestamp: '2025-12-14 17:54',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '127',
      newValue: '51',
    }
    ],
  },
  {
    id: 'prod-096',
    name: { ru: 'Труба профильная 30x30x2', en: 'Profile Pipe 30x30x2', lt: 'Profilinis vamzdis 30x30x2' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'PP-30-30-2', price: 12.00, minStock: 300, priceUnit: 'EUR/vnt', createdAt: '2025-05-01',
    description: 'Small square profile pipe 30x30mm, wall 2mm, for light frames.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10219', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 30, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Profile', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 45, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 30, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 1.68, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 11.50, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-04-26 03:43',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Seamless pipe',
      newValue: 'Hot-rolled steel sheet',
    },
    {
      timestamp: '2026-01-22 23:14',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '162',
      newValue: '57',
    }
    ],
  },
  {
    id: 'prod-097',
    name: { ru: 'Труба круглая 32x3', en: 'Round Pipe 32x3', lt: 'Apvalus vamzdis 32x3' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'RP-32-3', price: 9.50, minStock: 400, priceUnit: 'EUR/vnt', createdAt: '2025-05-05',
    description: 'Seamless round pipe 32mm diameter, wall 3mm, for hydraulic lines.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'E235', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10216', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 32, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 48, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 32, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 2.15, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 9.00, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2025-12-27 13:05',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '182',
      newValue: '109',
    }
    ],
  },
  {
    id: 'prod-098',
    name: { ru: 'Труба профильная 120x60x4', en: 'Profile Pipe 120x60x4', lt: 'Profilinis vamzdis 120x60x4' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'PP-120-60-4', price: 42.00, minStock: 80, priceUnit: 'EUR/vnt', createdAt: '2025-05-10',
    description: 'Large rectangular profile pipe 120x60mm, wall 4mm, for heavy structures.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355J2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10219', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 120, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 4, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Profile', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 180, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 60, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 10.56, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '3', name: { ru: 'Baltic Steel Group', en: 'Baltic Steel Group', lt: 'Baltic Steel Group' }, price: 40.00, priceUnit: 'EUR/vnt', leadDays: 10 }],
    auditLog: [
    {
      timestamp: '2025-11-21 17:42',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Nordic Steel AB',
    },
    {
      timestamp: '2026-02-22 05:19',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'BH-3038',
      newValue: 'RD-8507',
    }
    ],
  },
  {
    id: 'prod-099',
    name: { ru: 'Труба нержавеющая 100x4', en: 'Stainless Pipe 100x4', lt: 'Nerūdijantis vamzdis 100x4' },
    categoryId: 'cat-4', categoryName: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, sku: 'SSP-100-4', price: 120.00, minStock: 40, priceUnit: 'EUR/vnt', createdAt: '2025-05-15',
    description: 'Large stainless steel pipe 100mm diameter, wall 4mm, for process industry.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'AISI 316L', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10217-7', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7980, inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 100, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 4, inherited: false, options: [] },
      { fieldId: 'f-4-3', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-4-4', fieldName: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, fieldType: 'enum', value: 'Round', inherited: false, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' }, { ru: 'Профильная', en: 'Profile', lt: 'Profilinis' },
      ] },
      { fieldId: 'f-4-5', fieldName: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, fieldType: 'number', value: 150, inherited: false, options: [] },
      { fieldId: 'f-4-6', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 100, inherited: false, options: [] },
      { fieldId: 'f-4-7', fieldName: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, fieldType: 'number', value: 9.47, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 115.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-03-02 04:59',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Equipment',
    },
    {
      timestamp: '2026-04-25 18:19',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Hot-rolled steel sheet',
      newValue: 'Welded pipe',
    },
    {
      timestamp: '2026-04-02 22:39',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '41',
      newValue: '34',
    }
    ],
  },
  {
    id: 'prod-100',
    name: { ru: 'Лист высокопрочный Hardox 450 6мм', en: 'Hardox 450 Wear Plate 6mm', lt: 'Hardox 450 Atsparus dilimui lakštas 6mm' },
    categoryId: 'cat-2', categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, sku: 'HARDOX-6-1500', price: 450.00, minStock: 30, priceUnit: 'EUR/vnt', createdAt: '2025-05-20',
    description: 'Hardox 450 wear-resistant steel plate 6mm, 1500x3000mm, for heavy machinery.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'Hardox 450', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 6, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' }, { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' }, { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { fieldId: 'f-2-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 1500, inherited: false, options: [] },
      { fieldId: 'f-2-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 3000, inherited: false, options: [] },
      { fieldId: 'f-2-5', fieldName: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, fieldType: 'number', value: 47.1, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 430.00, priceUnit: 'EUR/vnt', leadDays: 14 }],
    auditLog: [
    {
      timestamp: '2026-04-25 13:31',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'BL-5867',
      newValue: 'JM-8781',
    }
    ],
  },
  // ─── cat-7: Beams ──────────────────────────────────────────────────────────────
  {
    id: 'prod-101',
    name: { ru: 'Балка IPE 200 S235JR', en: 'IPE 200 Beam S235JR', lt: 'IPE 200 Sija S235JR' },
    categoryId: 'cat-7', categoryName: { ru: 'Балки', en: 'Beams', lt: 'Sijos' }, sku: 'IPE-200-S235', price: 185.00, minStock: 20, priceUnit: 'EUR/vnt', createdAt: '2025-06-01',
    description: 'IPE 200 steel beam, S235JR, height 200mm, for structural applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025-2', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-7-1', fieldName: { ru: 'Тип профиля', en: 'Profile type', lt: 'Profilio tipas' }, fieldType: 'enum', value: 'IPE', inherited: false, options: [
        { ru: 'IPE', en: 'IPE', lt: 'IPE' }, { ru: 'HEA', en: 'HEA', lt: 'HEA' }, { ru: 'HEB', en: 'HEB', lt: 'HEB' }, { ru: 'IPN', en: 'IPN', lt: 'IPN' }, { ru: 'UPN', en: 'UPN', lt: 'UPN' },
      ] },
      { fieldId: 'f-7-2', fieldName: { ru: 'Высота (мм)', en: 'Height (mm)', lt: 'Aukštis (mm)' }, fieldType: 'number', value: 200, inherited: false, options: [] },
      { fieldId: 'f-7-3', fieldName: { ru: 'Ширина полки (мм)', en: 'Flange width (mm)', lt: 'Flanšo plotis (mm)' }, fieldType: 'number', value: 100, inherited: false, options: [] },
      { fieldId: 'f-7-4', fieldName: { ru: 'Толщина полки (мм)', en: 'Flange thickness (mm)', lt: 'Flanšo storis (mm)' }, fieldType: 'number', value: 8.5, inherited: false, options: [] },
      { fieldId: 'f-7-5', fieldName: { ru: 'Толщина стенки (мм)', en: 'Web thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 5.6, inherited: false, options: [] },
      { fieldId: 'f-7-6', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 12000, inherited: false, options: [] },
      { fieldId: 'f-7-7', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 22.4, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 180.00, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2025-10-31 09:54',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Euro Metal GmbH',
      newValue: 'Nordic Steel AB',
    },
    {
      timestamp: '2026-03-26 20:16',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '103',
      newValue: '137',
    },
    {
      timestamp: '2025-12-22 10:04',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Euro Metal GmbH',
    }
    ],
  },
  {
    id: 'prod-102',
    name: { ru: 'Балка HEA 300 S355J2', en: 'HEA 300 Beam S355J2', lt: 'HEA 300 Sija S355J2' },
    categoryId: 'cat-7', categoryName: { ru: 'Балки', en: 'Beams', lt: 'Sijos' }, sku: 'HEA-300-S355', price: 320.00, minStock: 15, priceUnit: 'EUR/vnt', createdAt: '2025-06-01',
    description: 'HEA 300 wide flange beam, S355J2, height 300mm, for heavy structural loads.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355J2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10025-2', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-7-1', fieldName: { ru: 'Тип профиля', en: 'Profile type', lt: 'Profilio tipas' }, fieldType: 'enum', value: 'HEA', inherited: false, options: [
        { ru: 'IPE', en: 'IPE', lt: 'IPE' }, { ru: 'HEA', en: 'HEA', lt: 'HEA' }, { ru: 'HEB', en: 'HEB', lt: 'HEB' }, { ru: 'IPN', en: 'IPN', lt: 'IPN' }, { ru: 'UPN', en: 'UPN', lt: 'UPN' },
      ] },
      { fieldId: 'f-7-2', fieldName: { ru: 'Высота (мм)', en: 'Height (mm)', lt: 'Aukštis (mm)' }, fieldType: 'number', value: 300, inherited: false, options: [] },
      { fieldId: 'f-7-3', fieldName: { ru: 'Ширина полки (мм)', en: 'Flange width (mm)', lt: 'Flanšo plotis (mm)' }, fieldType: 'number', value: 300, inherited: false, options: [] },
      { fieldId: 'f-7-4', fieldName: { ru: 'Толщина полки (мм)', en: 'Flange thickness (mm)', lt: 'Flanšo storis (mm)' }, fieldType: 'number', value: 14, inherited: false, options: [] },
      { fieldId: 'f-7-5', fieldName: { ru: 'Толщина стенки (мм)', en: 'Web thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 8, inherited: false, options: [] },
      { fieldId: 'f-7-6', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 12000, inherited: false, options: [] },
      { fieldId: 'f-7-7', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 88.3, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'IronBridge Corp', en: 'IronBridge Corp', lt: 'IronBridge Corp' }, price: 310.00, priceUnit: 'EUR/vnt', leadDays: 9 }],
    auditLog: [
    {
      timestamp: '2025-12-05 15:05',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'FI-5631',
      newValue: 'BM-1488',
    },
    {
      timestamp: '2025-12-08 04:02',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '10.77 EUR',
      newValue: '106.89 EUR',
    }
    ],
  },
  // ─── cat-8: Channels ───────────────────────────────────────────────────────────
  {
    id: 'prod-103',
    name: { ru: 'Швеллер UPN 100 S235JR', en: 'UPN 100 Channel S235JR', lt: 'UPN 100 Šveleris S235JR' },
    categoryId: 'cat-8', categoryName: { ru: 'Швеллеры', en: 'Channels', lt: 'Šveleriai' }, sku: 'UPN-100-S235', price: 95.00, minStock: 25, priceUnit: 'EUR/vnt', createdAt: '2025-06-05',
    description: 'UPN 100 steel channel, S235JR, height 100mm, for structural framing.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10279', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-8-1', fieldName: { ru: 'Высота (мм)', en: 'Height (mm)', lt: 'Aukštis (mm)' }, fieldType: 'number', value: 100, inherited: false, options: [] },
      { fieldId: 'f-8-2', fieldName: { ru: 'Ширина полки (мм)', en: 'Flange width (mm)', lt: 'Flanšo plotis (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-8-3', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 5, inherited: false, options: [] },
      { fieldId: 'f-8-4', fieldName: { ru: 'Толщина полки (мм)', en: 'Flange thickness (mm)', lt: 'Flanšo storis (mm)' }, fieldType: 'number', value: 8.5, inherited: false, options: [] },
      { fieldId: 'f-8-5', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 12000, inherited: false, options: [] },
      { fieldId: 'f-8-6', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 10.6, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 90.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-05-09 18:01',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Euro Metal GmbH',
      newValue: 'Nordic Steel AB',
    },
    {
      timestamp: '2026-04-21 22:35',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'PK-4323',
      newValue: 'ND-8545',
    }
    ],
  },
  {
    id: 'prod-104',
    name: { ru: 'Швеллер UPN 200 S355J2', en: 'UPN 200 Channel S355J2', lt: 'UPN 200 Šveleris S355J2' },
    categoryId: 'cat-8', categoryName: { ru: 'Швеллеры', en: 'Channels', lt: 'Šveleriai' }, sku: 'UPN-200-S355', price: 210.00, minStock: 20, priceUnit: 'EUR/vnt', createdAt: '2025-06-05',
    description: 'UPN 200 steel channel, S355J2, height 200mm, for heavy-duty structural support.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355J2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10279', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-8-1', fieldName: { ru: 'Высота (мм)', en: 'Height (mm)', lt: 'Aukštis (mm)' }, fieldType: 'number', value: 200, inherited: false, options: [] },
      { fieldId: 'f-8-2', fieldName: { ru: 'Ширина полки (мм)', en: 'Flange width (mm)', lt: 'Flanšo plotis (mm)' }, fieldType: 'number', value: 75, inherited: false, options: [] },
      { fieldId: 'f-8-3', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 6, inherited: false, options: [] },
      { fieldId: 'f-8-4', fieldName: { ru: 'Толщина полки (мм)', en: 'Flange thickness (mm)', lt: 'Flanšo storis (mm)' }, fieldType: 'number', value: 11.5, inherited: false, options: [] },
      { fieldId: 'f-8-5', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 12000, inherited: false, options: [] },
      { fieldId: 'f-8-6', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 25.3, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'IronBridge Corp', en: 'IronBridge Corp', lt: 'IronBridge Corp' }, price: 200.00, priceUnit: 'EUR/vnt', leadDays: 9 }],
    auditLog: [
    {
      timestamp: '2026-02-01 14:41',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'JM-9655',
      newValue: 'QL-6434',
    }
    ],
  },
  // ─── cat-9: Angles ─────────────────────────────────────────────────────────────
  {
    id: 'prod-105',
    name: { ru: 'Уголок равнополочный 50x50x5 S235JR', en: 'Equal Angle 50x50x5 S235JR', lt: 'Lygiakraštis kampainis 50x50x5 S235JR' },
    categoryId: 'cat-9', categoryName: { ru: 'Уголки', en: 'Angles', lt: 'Kampainiai' }, sku: 'ANG-50-50-5-S235', price: 45.00, minStock: 50, priceUnit: 'EUR/vnt', createdAt: '2025-06-10',
    description: 'Equal angle steel bar 50x50x5mm, S235JR, for light structural bracing.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10056-1', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-9-1', fieldName: { ru: 'Ширина полки (мм)', en: 'Side width (mm)', lt: 'Šono plotis (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-9-2', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 5, inherited: false, options: [] },
      { fieldId: 'f-9-3', fieldName: { ru: 'Ширина второй полки (мм)', en: 'Second side width (mm)', lt: 'Antro šono plotis (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-9-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-9-5', fieldName: { ru: 'Тип', en: 'Type', lt: 'Tipas' }, fieldType: 'enum', value: 'Equal', inherited: false, options: [
        { ru: 'Равнополочный', en: 'Equal', lt: 'Lygiakraštis' }, { ru: 'Неравнополочный', en: 'Unequal', lt: 'Nelygiakraštis' },
      ] },
      { fieldId: 'f-9-6', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 3.77, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: 42.00, priceUnit: 'EUR/vnt', leadDays: 5 }],
    auditLog: [
    {
      timestamp: '2026-03-09 10:37',
      user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
      userInitials: 'OP',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'UZ-2113',
      newValue: 'ZC-2384',
    },
    {
      timestamp: '2026-02-23 05:53',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '148',
      newValue: '194',
    },
    {
      timestamp: '2026-05-16 16:15',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Galvanized sheet',
      newValue: 'Welded pipe',
    }
    ],
  },
  {
    id: 'prod-106',
    name: { ru: 'Уголок неравнополочный 80x60x6 S355J2', en: 'Unequal Angle 80x60x6 S355J2', lt: 'Nelygiakraštis kampainis 80x60x6 S355J2' },
    categoryId: 'cat-9', categoryName: { ru: 'Уголки', en: 'Angles', lt: 'Kampainiai' }, sku: 'ANG-80-60-6-S355', price: 72.00, minStock: 35, priceUnit: 'EUR/vnt', createdAt: '2025-06-10',
    description: 'Unequal angle steel bar 80x60x6mm, S355J2, for structural connections.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355J2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10056-1', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-9-1', fieldName: { ru: 'Ширина полки (мм)', en: 'Side width (mm)', lt: 'Šono plotis (mm)' }, fieldType: 'number', value: 80, inherited: false, options: [] },
      { fieldId: 'f-9-2', fieldName: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, fieldType: 'number', value: 6, inherited: false, options: [] },
      { fieldId: 'f-9-3', fieldName: { ru: 'Ширина второй полки (мм)', en: 'Second side width (mm)', lt: 'Antro šono plotis (mm)' }, fieldType: 'number', value: 60, inherited: false, options: [] },
      { fieldId: 'f-9-4', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-9-5', fieldName: { ru: 'Тип', en: 'Type', lt: 'Tipas' }, fieldType: 'enum', value: 'Unequal', inherited: false, options: [
        { ru: 'Равнополочный', en: 'Equal', lt: 'Lygiakraštis' }, { ru: 'Неравнополочный', en: 'Unequal', lt: 'Nelygiakraštis' },
      ] },
      { fieldId: 'f-9-6', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 6.35, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 68.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2025-12-17 21:46',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Sheets',
      newValue: 'Consumables',
    }
    ],
  },
  // ─── cat-10: Rebars ────────────────────────────────────────────────────────────
  {
    id: 'prod-107',
    name: { ru: 'Арматура A500C 12мм', en: 'Rebar A500C 12mm', lt: 'Armatūra A500C 12mm' },
    categoryId: 'cat-10', categoryName: { ru: 'Арматура', en: 'Rebars', lt: 'Armatūra' }, sku: 'REB-A500C-12', price: 1.20, minStock: 500, priceUnit: 'EUR/m', createdAt: '2025-06-15',
    description: 'Reinforcement steel bar A500C, 12mm diameter, for concrete reinforcement.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'A500C', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10080', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-10-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 12, inherited: false, options: [] },
      { fieldId: 'f-10-2', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 12000, inherited: false, options: [] },
      { fieldId: 'f-10-3', fieldName: { ru: 'Класс', en: 'Class', lt: 'Klasė' }, fieldType: 'enum', value: 'A500C', inherited: false, options: [
        { ru: 'A240', en: 'A240', lt: 'A240' }, { ru: 'A400', en: 'A400', lt: 'A400' }, { ru: 'A500C', en: 'A500C', lt: 'A500C' }, { ru: 'B500C', en: 'B500C', lt: 'B500C' },
      ] },
      { fieldId: 'f-10-4', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 0.888, inherited: false, options: [] },
      { fieldId: 'f-10-5', fieldName: { ru: 'Прочность на растяжение (МПа)', en: 'Tensile strength (MPa)', lt: 'Tempimo stipris (MPa)' }, fieldType: 'number', value: 550, inherited: false, options: [] },
      { fieldId: 'f-10-6', fieldName: { ru: 'Предел текучести (МПа)', en: 'Yield strength (MPa)', lt: 'Takumo riba (MPa)' }, fieldType: 'number', value: 500, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '4', name: { ru: 'Baltic Metal Group', en: 'Baltic Metal Group', lt: 'Baltic Metal Group' }, price: 1.15, priceUnit: 'EUR/m', leadDays: 14 }],
    auditLog: [
    {
      timestamp: '2025-11-22 18:00',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Metal Trade LT',
      newValue: 'Nordic Steel AB',
    },
    {
      timestamp: '2025-10-09 20:48',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '157',
      newValue: '67',
    }
    ],
  },
  {
    id: 'prod-108',
    name: { ru: 'Арматура B500C 16мм', en: 'Rebar B500C 16mm', lt: 'Armatūra B500C 16mm' },
    categoryId: 'cat-10', categoryName: { ru: 'Арматура', en: 'Rebars', lt: 'Armatūra' }, sku: 'REB-B500C-16', price: 1.80, minStock: 400, priceUnit: 'EUR/m', createdAt: '2025-06-15',
    description: 'Reinforcement steel bar B500C, 16mm diameter, high ductility for seismic applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'B500C', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10080', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-10-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 16, inherited: false, options: [] },
      { fieldId: 'f-10-2', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 12000, inherited: false, options: [] },
      { fieldId: 'f-10-3', fieldName: { ru: 'Класс', en: 'Class', lt: 'Klasė' }, fieldType: 'enum', value: 'B500C', inherited: false, options: [
        { ru: 'A240', en: 'A240', lt: 'A240' }, { ru: 'A400', en: 'A400', lt: 'A400' }, { ru: 'A500C', en: 'A500C', lt: 'A500C' }, { ru: 'B500C', en: 'B500C', lt: 'B500C' },
      ] },
      { fieldId: 'f-10-4', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 1.58, inherited: false, options: [] },
      { fieldId: 'f-10-5', fieldName: { ru: 'Прочность на растяжение (МПа)', en: 'Tensile strength (MPa)', lt: 'Tempimo stipris (MPa)' }, fieldType: 'number', value: 575, inherited: false, options: [] },
      { fieldId: 'f-10-6', fieldName: { ru: 'Предел текучести (МПа)', en: 'Yield strength (MPa)', lt: 'Takumo riba (MPa)' }, fieldType: 'number', value: 500, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'IronBridge Corp', en: 'IronBridge Corp', lt: 'IronBridge Corp' }, price: 1.70, priceUnit: 'EUR/m', leadDays: 9 }],
    auditLog: [
    {
      timestamp: '2025-10-13 14:14',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Seamless pipe',
      newValue: 'Hot-rolled steel sheet',
    },
    {
      timestamp: '2026-01-24 03:49',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Hot-rolled steel sheet',
      newValue: 'Cold-rolled steel sheet',
    }
    ],
  },
  // ─── cat-11: Profiles ──────────────────────────────────────────────────────────
  {
    id: 'prod-109',
    name: { ru: 'Профиль квадратный 40x40x3 S235JR', en: 'Square Tube 40x40x3 S235JR', lt: 'Kvadratinis vamzdis 40x40x3 S235JR' },
    categoryId: 'cat-11', categoryName: { ru: 'Профили', en: 'Profiles', lt: 'Profiliai' }, sku: 'SQR-40-40-3-S235', price: 28.00, minStock: 60, priceUnit: 'EUR/vnt', createdAt: '2025-06-20',
    description: 'Square hollow section 40x40x3mm, S235JR, for light structural frames.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10219-1', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-11-1', fieldName: { ru: 'Тип профиля', en: 'Profile type', lt: 'Profilio tipas' }, fieldType: 'enum', value: 'Square tube', inherited: false, options: [
        { ru: 'Квадратная труба', en: 'Square tube', lt: 'Kvadratinis vamzdis' }, { ru: 'Прямоугольная труба', en: 'Rectangular tube', lt: 'Stačiakampis vamzdis' }, { ru: 'Полоса', en: 'Flat bar', lt: 'Plokščia juosta' }, { ru: 'Круг', en: 'Round bar', lt: 'Apvali juosta' },
      ] },
      { fieldId: 'f-11-2', fieldName: { ru: 'Высота (мм)', en: 'Height (mm)', lt: 'Aukštis (mm)' }, fieldType: 'number', value: 40, inherited: false, options: [] },
      { fieldId: 'f-11-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 40, inherited: false, options: [] },
      { fieldId: 'f-11-4', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-11-5', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-11-6', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 3.35, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 25.00, priceUnit: 'EUR/vnt', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-02-25 17:00',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Мин. запас', en: 'Min Stock', lt: 'Min. atsargos' },
      oldValue: '17',
      newValue: '143',
    },
    {
      timestamp: '2026-05-09 15:55',
      user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
      userInitials: 'AZ',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '102.84 EUR',
      newValue: '136.58 EUR',
    },
    {
      timestamp: '2025-10-30 23:56',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Описание', en: 'Description', lt: 'Aprašymas' },
      oldValue: 'Welded pipe',
      newValue: 'Seamless pipe',
    }
    ],
  },
  {
    id: 'prod-110',
    name: { ru: 'Профиль прямоугольный 80x40x4 S355J2', en: 'Rectangular Tube 80x40x4 S355J2', lt: 'Stačiakampis vamzdis 80x40x4 S355J2' },
    categoryId: 'cat-11', categoryName: { ru: 'Профили', en: 'Profiles', lt: 'Profiliai' }, sku: 'RECT-80-40-4-S355', price: 52.00, minStock: 40, priceUnit: 'EUR/vnt', createdAt: '2025-06-20',
    description: 'Rectangular hollow section 80x40x4mm, S355J2, for structural frameworks.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355J2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10219-1', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-11-1', fieldName: { ru: 'Тип профиля', en: 'Profile type', lt: 'Profilio tipas' }, fieldType: 'enum', value: 'Rectangular tube', inherited: false, options: [
        { ru: 'Квадратная труба', en: 'Square tube', lt: 'Kvadratinis vamzdis' }, { ru: 'Прямоугольная труба', en: 'Rectangular tube', lt: 'Stačiakampis vamzdis' }, { ru: 'Полоса', en: 'Flat bar', lt: 'Plokščia juosta' }, { ru: 'Круг', en: 'Round bar', lt: 'Apvali juosta' },
      ] },
      { fieldId: 'f-11-2', fieldName: { ru: 'Высота (мм)', en: 'Height (mm)', lt: 'Aukštis (mm)' }, fieldType: 'number', value: 80, inherited: false, options: [] },
      { fieldId: 'f-11-3', fieldName: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, fieldType: 'number', value: 40, inherited: false, options: [] },
      { fieldId: 'f-11-4', fieldName: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, fieldType: 'number', value: 4, inherited: false, options: [] },
      { fieldId: 'f-11-5', fieldName: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, fieldType: 'number', value: 6000, inherited: false, options: [] },
      { fieldId: 'f-11-6', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 6.97, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '4', name: { ru: 'Baltic Metal Group', en: 'Baltic Metal Group', lt: 'Baltic Metal Group' }, price: 48.00, priceUnit: 'EUR/vnt', leadDays: 14 }],
    auditLog: [
    {
      timestamp: '2025-10-05 21:43',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'RC-1251',
      newValue: 'GY-2857',
    }
    ],
  },
  // ─── cat-12: Wire ──────────────────────────────────────────────────────────────
  {
    id: 'prod-111',
    name: { ru: 'Проволока оцинкованная 3мм', en: 'Galvanized Wire 3mm', lt: 'Cinkuota viela 3mm' },
    categoryId: 'cat-12', categoryName: { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, sku: 'WIRE-GALV-3', price: 0.85, minStock: 200, priceUnit: 'EUR/kg', createdAt: '2025-06-25',
    description: 'Galvanized steel wire 3mm diameter, in coils, for fencing and binding.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10244-2', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-12-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-12-2', fieldName: { ru: 'Покрытие', en: 'Coating', lt: 'Danga' }, fieldType: 'enum', value: 'Galvanized', inherited: false, options: [
        { ru: 'Без покрытия', en: 'Bare', lt: 'Be dangos' }, { ru: 'Оцинкованная', en: 'Galvanized', lt: 'Cinkuota' }, { ru: 'С цинковым покрытием', en: 'Zinc-coated', lt: 'Cinku danga' }, { ru: 'С медным покрытием', en: 'Copper-coated', lt: 'Vario danga' },
      ] },
      { fieldId: 'f-12-3', fieldName: { ru: 'Вес бухты (кг)', en: 'Spool weight (kg)', lt: 'Ritės svoris (kg)' }, fieldType: 'number', value: 25, inherited: false, options: [] },
      { fieldId: 'f-12-4', fieldName: { ru: 'Прочность на растяжение (МПа)', en: 'Tensile strength (MPa)', lt: 'Tempimo stipris (MPa)' }, fieldType: 'number', value: 400, inherited: false, options: [] },
      { fieldId: 'f-12-5', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 0.055, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 0.80, priceUnit: 'EUR/kg', leadDays: 7 }],
    auditLog: [
    {
      timestamp: '2026-03-07 12:39',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'BF-3201',
      newValue: 'GC-4401',
    },
    {
      timestamp: '2025-11-12 21:32',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Артикул (SKU)', en: 'SKU', lt: 'Prekės kodas' },
      oldValue: 'CE-5096',
      newValue: 'QN-5479',
    }
    ],
  },
  {
    id: 'prod-112',
    name: { ru: 'Проволока сварочная 1.2мм ER70S-6', en: 'Welding Wire 1.2mm ER70S-6', lt: 'Suvirinimo viela 1.2mm ER70S-6' },
    categoryId: 'cat-12', categoryName: { ru: 'Проволока', en: 'Wire', lt: 'Viela' }, sku: 'WIRE-WELD-1.2', price: 2.50, minStock: 100, priceUnit: 'EUR/kg', createdAt: '2025-06-25',
    description: 'Copper-coated welding wire ER70S-6, 1.2mm, for MIG/MAG welding applications.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'ER70S-6', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'AWS A5.18', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-12-1', fieldName: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, fieldType: 'number', value: 1.2, inherited: false, options: [] },
      { fieldId: 'f-12-2', fieldName: { ru: 'Покрытие', en: 'Coating', lt: 'Danga' }, fieldType: 'enum', value: 'Copper-coated', inherited: false, options: [
        { ru: 'Без покрытия', en: 'Bare', lt: 'Be dangos' }, { ru: 'Оцинкованная', en: 'Galvanized', lt: 'Cinkuota' }, { ru: 'С цинковым покрытием', en: 'Zinc-coated', lt: 'Cinku danga' }, { ru: 'С медным покрытием', en: 'Copper-coated', lt: 'Vario danga' },
      ] },
      { fieldId: 'f-12-3', fieldName: { ru: 'Вес бухты (кг)', en: 'Spool weight (kg)', lt: 'Ritės svoris (kg)' }, fieldType: 'number', value: 15, inherited: false, options: [] },
      { fieldId: 'f-12-4', fieldName: { ru: 'Прочность на растяжение (МПа)', en: 'Tensile strength (MPa)', lt: 'Tempimo stipris (MPa)' }, fieldType: 'number', value: 480, inherited: false, options: [] },
      { fieldId: 'f-12-5', fieldName: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, fieldType: 'number', value: 0.0089, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '6', name: { ru: 'IronBridge Corp', en: 'IronBridge Corp', lt: 'IronBridge Corp' }, price: 2.35, priceUnit: 'EUR/kg', leadDays: 9 }],
    auditLog: [
    {
      timestamp: '2026-04-24 22:03',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '77.51 EUR',
      newValue: '80.96 EUR',
    }
    ],
  },
  // ─── cat-13: Fittings ──────────────────────────────────────────────────────────
  {
    id: 'prod-113',
    name: { ru: 'Отвод 90° DN50 S235JR', en: 'Elbow 90° DN50 S235JR', lt: 'Alkūnė 90° DN50 S235JR' },
    categoryId: 'cat-13', categoryName: { ru: 'Фитинги', en: 'Fittings', lt: 'Jungiamosios detalės' }, sku: 'ELB-90-DN50-S235', price: 8.50, minStock: 80, priceUnit: 'EUR/vnt', createdAt: '2025-07-01',
    description: 'Steel pipe elbow 90°, DN50, S235JR, welded type, for pipeline systems.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 10253-2', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-13-1', fieldName: { ru: 'Тип', en: 'Type', lt: 'Tipas' }, fieldType: 'enum', value: 'Elbow 90°', inherited: false, options: [
        { ru: 'Отвод 90°', en: 'Elbow 90°', lt: 'Alkūnė 90°' }, { ru: 'Отвод 45°', en: 'Elbow 45°', lt: 'Alkūnė 45°' }, { ru: 'Тройник', en: 'Tee', lt: 'Trišakis' }, { ru: 'Переходник', en: 'Reducer', lt: 'Reduktorius' }, { ru: 'Фланец', en: 'Flange', lt: 'Flanšas' }, { ru: 'Муфта', en: 'Coupling', lt: 'Movė' }, { ru: 'Заглушка', en: 'Cap', lt: 'Kamštis' },
      ] },
      { fieldId: 'f-13-2', fieldName: { ru: 'Размер DN (мм)', en: 'Size DN (mm)', lt: 'Dydis DN (mm)' }, fieldType: 'number', value: 50, inherited: false, options: [] },
      { fieldId: 'f-13-3', fieldName: { ru: 'Номинальное давление (бар)', en: 'Pressure rating (bar)', lt: 'Slėgio klasė (bar)' }, fieldType: 'number', value: 16, inherited: false, options: [] },
      { fieldId: 'f-13-4', fieldName: { ru: 'Тип соединения', en: 'Connection type', lt: 'Jungties tipas' }, fieldType: 'enum', value: 'Welded', inherited: false, options: [
        { ru: 'Резьбовое', en: 'Threaded', lt: 'Srieginis' }, { ru: 'Сварное', en: 'Welded', lt: 'Suvirintas' }, { ru: 'Фланцевое', en: 'Flanged', lt: 'Flanšinis' },
      ] },
      { fieldId: 'f-13-5', fieldName: { ru: 'Вес (кг)', en: 'Weight (kg)', lt: 'Svoris (kg)' }, fieldType: 'number', value: 0.85, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '4', name: { ru: 'Baltic Metal Group', en: 'Baltic Metal Group', lt: 'Baltic Metal Group' }, price: 7.80, priceUnit: 'EUR/vnt', leadDays: 14 }],
    auditLog: [
    {
      timestamp: '2026-04-02 23:09',
      user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
      userInitials: 'IN',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '108.10 EUR',
      newValue: '109.78 EUR',
    },
    {
      timestamp: '2025-11-24 03:53',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Nordic Steel AB',
      newValue: 'Steel Plus OÜ',
    },
    {
      timestamp: '2025-11-06 00:37',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Equipment',
      newValue: 'Pipes',
    }
    ],
  },
  {
    id: 'prod-114',
    name: { ru: 'Фланец DN100 PN16 S355J2', en: 'Flange DN100 PN16 S355J2', lt: 'Flanšas DN100 PN16 S355J2' },
    categoryId: 'cat-13', categoryName: { ru: 'Фитинги', en: 'Fittings', lt: 'Jungiamosios detalės' }, sku: 'FLG-DN100-PN16', price: 22.00, minStock: 50, priceUnit: 'EUR/vnt', createdAt: '2025-07-01',
    description: 'Steel flange DN100, PN16 rating, S355J2, flanged connection type, for pipeline systems.',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S355J2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, fieldType: 'text', value: 'EN 1092-1', inherited: true, options: [] },
      { fieldId: 'f-1-3', fieldName: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, fieldType: 'number', value: 7850, inherited: true, options: [] },
      { fieldId: 'f-13-1', fieldName: { ru: 'Тип', en: 'Type', lt: 'Tipas' }, fieldType: 'enum', value: 'Flange', inherited: false, options: [
        { ru: 'Отвод 90°', en: 'Elbow 90°', lt: 'Alkūnė 90°' }, { ru: 'Отвод 45°', en: 'Elbow 45°', lt: 'Alkūnė 45°' }, { ru: 'Тройник', en: 'Tee', lt: 'Trišakis' }, { ru: 'Переходник', en: 'Reducer', lt: 'Reduktorius' }, { ru: 'Фланец', en: 'Flange', lt: 'Flanšas' }, { ru: 'Муфта', en: 'Coupling', lt: 'Movė' }, { ru: 'Заглушка', en: 'Cap', lt: 'Kamštis' },
      ] },
      { fieldId: 'f-13-2', fieldName: { ru: 'Размер DN (мм)', en: 'Size DN (mm)', lt: 'Dydis DN (mm)' }, fieldType: 'number', value: 100, inherited: false, options: [] },
      { fieldId: 'f-13-3', fieldName: { ru: 'Номинальное давление (бар)', en: 'Pressure rating (bar)', lt: 'Slėgio klasė (bar)' }, fieldType: 'number', value: 16, inherited: false, options: [] },
      { fieldId: 'f-13-4', fieldName: { ru: 'Тип соединения', en: 'Connection type', lt: 'Jungties tipas' }, fieldType: 'enum', value: 'Flanged', inherited: false, options: [
        { ru: 'Резьбовое', en: 'Threaded', lt: 'Srieginis' }, { ru: 'Сварное', en: 'Welded', lt: 'Suvirintas' }, { ru: 'Фланцевое', en: 'Flanged', lt: 'Flanšinis' },
      ] },
      { fieldId: 'f-13-5', fieldName: { ru: 'Вес (кг)', en: 'Weight (kg)', lt: 'Svoris (kg)' }, fieldType: 'number', value: 4.5, inherited: false, options: [] },
    ],
    linkedSuppliers: [{ id: '5', name: { ru: 'Euro Metal GmbH', en: 'Euro Metal GmbH', lt: 'Euro Metal GmbH' }, price: 20.00, priceUnit: 'EUR/vnt', leadDays: 21 }],
    auditLog: [
    {
      timestamp: '2025-10-08 11:15',
      user: { ru: 'Дмитрий С.', en: 'Dmitry S.', lt: 'Dmitry S.' },
      userInitials: 'DS',
      property: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
      oldValue: 'Equipment',
      newValue: 'Sheets',
    },
    {
      timestamp: '2025-12-15 04:28',
      user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
      userInitials: 'EK',
      property: { ru: 'Цена', en: 'Price', lt: 'Kaina' },
      oldValue: '163.85 EUR',
      newValue: '187.20 EUR',
    }
    ],
  },
];

function toListItem(p: Product): ProductListItem {
  return {
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    sku: p.sku,
    price: p.price,
    minStock: p.minStock,
    priceUnit: p.priceUnit,
    createdAt: p.createdAt,
  }
}

export async function mockGetProducts(params: PaginationParams & ProductFilters): Promise<PaginatedResponse<ProductListItem>> {
  let filtered = [...STORE]

  // search
  if (params.search) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter(p =>
      p.sku?.toLowerCase().includes(q) ||
      p.name.ru.toLowerCase().includes(q) ||
      p.name.en.toLowerCase().includes(q) ||
      p.name.lt.toLowerCase().includes(q)
    )
  }

  // category filter
  if (params.categoryIds?.length) {
    filtered = filtered.filter(p => params.categoryIds.includes(p.categoryId ?? ''))
  }

  // sort
  if (params.sortBy) {
    filtered.sort((a, b) => {
      let cmp = 0
      if (params.sortBy === 'name') cmp = a.name.en.localeCompare(b.name.en)
      else if (params.sortBy === 'category') cmp = (a.categoryName?.en ?? '').localeCompare(b.categoryName?.en ?? '')
      else if (params.sortBy === 'price') cmp = (a.price ?? 0) - (b.price ?? 0)
      return params.sortDir === 'desc' ? -cmp : cmp
    })
  }

  const total = filtered.length
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize).map(toListItem)

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function mockGetProduct(id: string): Promise<Product> {
  const found = STORE.find(p => p.id === id)
  if (!found) throw new Error(`Product ${id} not found`)
  return found
}

export async function mockCreateProduct(data: {
  name: TranslatedString | string
  categoryId: string
  categoryName?: TranslatedString | string | null
  sku?: string | null
  description?: string | null
  price?: number | null
  minStock?: number | null
  priceUnit?: PriceUnit | null
  fieldValues?: ProductFieldValue[] | null
  linkedSuppliers?: LinkedSupplier[] | null
}, locale: string = 'en'): Promise<Product> {
  // Normalise name: if it's a plain string, wrap it as single-locale TranslatedString
  const name: TranslatedString = typeof data.name === 'string'
    ? toTranslatedString(data.name, locale)
    : data.name

  // Derive categoryName from the store if not provided
  let categoryName: TranslatedString = { ru: '', en: '', lt: '' }
  if (data.categoryName) {
    categoryName = typeof data.categoryName === 'string'
      ? toTranslatedString(data.categoryName, locale)
      : data.categoryName
  } else if (data.categoryId) {
    const cat = mockGetCategory(data.categoryId)
    if (cat) categoryName = cat.name
  }

  // Build fieldValues from category fields + inherited fields when categoryId is set
  // and no explicit fieldValues were provided by the caller
  let fieldValues: ProductFieldValue[]
  if (data.fieldValues) {
    fieldValues = data.fieldValues.map(f => ({
      ...f,
      fieldName: f.fieldName,
      options: f.options?.map(o => typeof o === 'string' ? toTranslatedString(o, locale) : o),
    }))
  } else if (data.categoryId) {
    const cat = mockGetCategory(data.categoryId)
    if (cat) {
      // Inherited fields come first with inherited: true
      const inherited: ProductFieldValue[] = cat.inheritedFields.map(f => ({
        fieldId: f.id,
        fieldName: f.name,
        fieldType: f.type,
        value: null,
        inherited: true,
        options: f.options.length > 0 ? f.options : undefined,
      }))
      // Own fields with inherited: false
      const own: ProductFieldValue[] = cat.fields.map(f => ({
        fieldId: f.id,
        fieldName: f.name,
        fieldType: f.type,
        value: null,
        inherited: false,
        options: f.options.length > 0 ? f.options : undefined,
      }))
      fieldValues = [...inherited, ...own]
    } else {
      fieldValues = []
    }
  } else {
    fieldValues = []
  }

  const product: Product = {
    id: `prod-${String(STORE.length + 1).padStart(3, '0')}`,
    name,
    categoryId: data.categoryId,
    categoryName,
    sku: data.sku ?? null,
    description: data.description ?? null,
    price: data.price ?? null,
    minStock: data.minStock ?? null,
    priceUnit: data.priceUnit ?? null,
    createdAt: new Date().toISOString().slice(0, 10),
    fieldValues,
    linkedSuppliers: (data.linkedSuppliers ?? []).map(s => ({
      ...s,
      name: typeof s.name === 'string' ? toTranslatedString(s.name, locale) : s.name,
    })),
    auditLog: [
    {
      timestamp: '2026-02-27 08:24',
      user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
      userInitials: 'MV',
      property: { ru: 'Поставщики', en: 'Suppliers', lt: 'Tiekėjai' },
      oldValue: 'Steel Plus OÜ',
      newValue: 'Euro Metal GmbH',
    }
    ],
  }
  STORE.push(product)
  return product
}

export async function mockPatchProduct(id: string, data: Partial<{
  name: TranslatedString | string
  categoryId: string
  categoryName: TranslatedString | string | null
  sku: string | null
  description: string | null
  price: number | null
  minStock: number | null
  priceUnit: PriceUnit | null
  fieldValues: ProductFieldValue[]
  linkedSuppliers: LinkedSupplier[]
}>, locale: string = 'en'): Promise<Product | null> {
  const idx = STORE.findIndex(p => p.id === id)
  if (idx === -1) return null
  const existing: Product = STORE[idx]!
  // Normalise string fields to TranslatedString before merging
  const patchName: TranslatedString | undefined = data.name
    ? typeof data.name === 'string' ? toTranslatedString(data.name, locale) : data.name
    : undefined
  const patchCategoryName: TranslatedString | undefined = data.categoryName
    ? typeof data.categoryName === 'string' ? toTranslatedString(data.categoryName, locale) : data.categoryName
    : undefined
  const patched: Product = {
    id: existing.id,
    name: patchName ? mergeTranslatedString(existing.name, patchName) : existing.name,
    categoryId: data.categoryId ?? existing.categoryId,
    categoryName: patchCategoryName ? mergeTranslatedString(existing.categoryName, patchCategoryName) : existing.categoryName,
    sku: data.sku !== undefined ? data.sku : existing.sku,
    description: data.description !== undefined ? data.description : existing.description,
    price: data.price !== undefined ? data.price : existing.price,
    minStock: data.minStock !== undefined ? data.minStock : existing.minStock,
    priceUnit: data.priceUnit !== undefined ? data.priceUnit : existing.priceUnit,
    createdAt: existing.createdAt,
    fieldValues: data.fieldValues ?? existing.fieldValues,
    linkedSuppliers: data.linkedSuppliers ?? existing.linkedSuppliers,
    auditLog: existing.auditLog,
  }
  STORE[idx] = patched
  return patched
}

export async function mockDeleteProduct(id: string): Promise<boolean> {
  const idx = STORE.findIndex(p => p.id === id)
  if (idx === -1) return false
  STORE.splice(idx, 1)
  return true
}

export function mockDeleteProductAuditEntry(productId: string, entryIndex: number): void {
  const product = STORE.find((p) => p.id === productId)
  if (!product) throw new Error('PRODUCT_NOT_FOUND')
  if (!product.auditLog || entryIndex < 0 || entryIndex >= product.auditLog.length) {
    throw new Error('AUDIT_ENTRY_NOT_FOUND')
  }
  product.auditLog.splice(entryIndex, 1)
}
