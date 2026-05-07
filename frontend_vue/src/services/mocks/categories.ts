import type { Category, CategoryField, CategoryListItem, CategoryFilters } from '@/types/category'
import type { LinkedSupplier } from '@/types/product'
import type { PaginatedResponse } from '@/types/api'
import type { TranslatedString } from '@/types/i18n'
import { mergeTranslatedString } from '@/types/i18n'

// ─── STORE ───────────────────────────────────────────────────────────────────

const STORE: Category[] = [
  {
    id: 'cat-1',
    name: { ru: 'Металл', en: 'Metal', lt: 'Metalas' },
    parentId: null,
    description: { ru: 'Все виды металлопродукции', en: 'All types of metal products', lt: 'Visi metalo gaminių tipai' },
    fieldCount: 3,
    productCount: 0,
    inheritedFields: [],
    fields: [
      { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, type: 'number', required: false, order: 2, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: null, priceUnit: null, leadDays: 7 },
      { id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: null, priceUnit: null, leadDays: 14 },
      { id: '6', name: { ru: 'EuroSteel GmbH', en: 'EuroSteel GmbH', lt: 'EuroSteel GmbH' }, price: null, priceUnit: null, leadDays: 14 },
    ],
  },
  {
    id: 'cat-2',
    name: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
    parentId: 'cat-1',
    description: { ru: 'Плоские металлические листы', en: 'Flat-rolled metal sheets', lt: 'Plokščiai valcuoti metalo lakštai' },
    fieldCount: 5,
    productCount: 12,
    inheritedFields: [
      { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-2-1', name: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, type: 'number', required: true, order: 0, options: [] },
      { id: 'f-2-2', name: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, type: 'enum', required: false, order: 1, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { id: 'f-2-3', name: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, type: 'number', required: false, order: 2, options: [] },
      { id: 'f-2-4', name: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, type: 'number', required: false, order: 3, options: [] },
      { id: 'f-2-5', name: { ru: 'Вес на м² (кг)', en: 'Weight per m² (kg)', lt: 'Svoris m² (kg)' }, type: 'number', required: false, order: 4, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: null, priceUnit: null, leadDays: 7 },
      { id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: null, priceUnit: null, leadDays: 14 },
      { id: '3', name: { ru: 'Nordic Steel AB', en: 'Nordic Steel AB', lt: 'Nordic Steel AB' }, price: null, priceUnit: null, leadDays: 10 },
    ],
  },
  {
    id: 'cat-3',
    name: { ru: 'Алюминиевые листы', en: 'Aluminium sheets', lt: 'Aliuminio lakštai' },
    parentId: 'cat-2',
    description: null,
    fieldCount: 1,
    productCount: 4,
    inheritedFields: [
      { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, type: 'number', required: false, order: 2, options: [] },
      { id: 'f-2-1', name: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, type: 'number', required: true, order: 0, options: [] },
      { id: 'f-2-2', name: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, type: 'enum', required: false, order: 1, options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
        { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
      ] },
      { id: 'f-2-3', name: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, type: 'number', required: false, order: 2, options: [] },
      { id: 'f-2-4', name: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, type: 'number', required: false, order: 3, options: [] },
    ],
    fields: [
      { id: 'f-3-1', name: { ru: 'Сплав', en: 'Alloy', lt: 'Lydinys' }, type: 'enum', required: true, order: 0, options: [
        { ru: 'АМц', en: 'AMts', lt: 'AMts' },
        { ru: 'АМг2', en: 'AMg2', lt: 'AMg2' },
        { ru: 'АМг3', en: 'AMg3', lt: 'AMg3' },
        { ru: 'Д16', en: 'D16', lt: 'D16' },
        { ru: '1561', en: '1561', lt: '1561' },
      ] },
    ],
    linkedSuppliers: [
      { id: '3', name: { ru: 'Nordic Steel AB', en: 'Nordic Steel AB', lt: 'Nordic Steel AB' }, price: null, priceUnit: null, leadDays: 10 },
    ],
  },
  {
    id: 'cat-4',
    name: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' },
    parentId: 'cat-1',
    description: { ru: 'Трубные металлические изделия', en: 'Tubular metal products', lt: 'Vamzdiniai metalo gaminiai' },
    fieldCount: 7,
    productCount: 8,
    inheritedFields: [
      { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-4-1', name: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, type: 'number', required: true, order: 0, options: [] },
      { id: 'f-4-2', name: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, type: 'number', required: true, order: 1, options: [] },
      { id: 'f-4-3', name: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, type: 'number', required: false, order: 2, options: [] },
      { id: 'f-4-4', name: { ru: 'Тип трубы', en: 'Pipe type', lt: 'Vamzdžio tipas' }, type: 'enum', required: false, order: 3, options: [
        { ru: 'Круглая', en: 'Round', lt: 'Apvalus' },
        { ru: 'Квадратная', en: 'Square', lt: 'Kvadratinis' },
        { ru: 'Прямоугольная', en: 'Rectangular', lt: 'Stačiakampis' },
      ] },
      { id: 'f-4-5', name: { ru: 'Радиус гиба (мм)', en: 'Bend radius (mm)', lt: 'Lenkimo spindulys (mm)' }, type: 'number', required: false, order: 4, options: [] },
      { id: 'f-4-6', name: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, type: 'number', required: false, order: 5, options: [] },
      { id: 'f-4-7', name: { ru: 'Вес на метр (кг)', en: 'Weight per meter (kg)', lt: 'Svoris metrui (kg)' }, type: 'number', required: false, order: 6, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: null, priceUnit: null, leadDays: 7 },
      { id: '4', name: { ru: 'Baltic Metals SIA', en: 'Baltic Metals SIA', lt: 'Baltic Metals SIA' }, price: null, priceUnit: null, leadDays: 10 },
    ],
  },
  {
    id: 'cat-5',
    name: { ru: 'Расходные материалы', en: 'Consumables', lt: 'Eksploatacinės medžiagos' },
    parentId: null,
    description: null,
    fieldCount: 3,
    productCount: 0,
    inheritedFields: [],
    fields: [
      { id: 'f-5-1', name: { ru: 'Единица измерения', en: 'Unit of measure', lt: 'Matavimo vienetas' }, type: 'enum', required: true, order: 0, options: [
        { ru: 'шт', en: 'pcs', lt: 'vnt' },
        { ru: 'кг', en: 'kg', lt: 'kg' },
        { ru: 'м', en: 'm', lt: 'm' },
        { ru: 'л', en: 'l', lt: 'l' },
      ] },
      { id: 'f-5-2', name: { ru: 'Опасный материал', en: 'Hazardous material', lt: 'Pavojinga medžiaga' }, type: 'boolean', required: false, order: 1, options: [] },
      { id: 'f-5-3', name: { ru: 'Срок годности', en: 'Expiry date', lt: 'Galiojimo data' }, type: 'date', required: false, order: 2, options: [] },
    ],
    linkedSuppliers: [
      { id: '5', name: { ru: 'Euro Metal GmbH', en: 'Euro Metal GmbH', lt: 'Euro Metal GmbH' }, price: null, priceUnit: null, leadDays: 21 },
    ],
  },
  {
    id: 'cat-6',
    name: { ru: 'Оборудование', en: 'Equipment', lt: 'Įranga' },
    parentId: null,
    description: { ru: 'Промышленное оборудование', en: 'Industrial equipment', lt: 'Pramoninė įranga' },
    fieldCount: 4,
    productCount: 0,
    inheritedFields: [],
    fields: [
      { id: 'f-6-1', name: { ru: 'Производитель', en: 'Manufacturer', lt: 'Gamintojas' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-6-2', name: { ru: 'Гарантия (мес)', en: 'Warranty (months)', lt: 'Garantija (mėn)' }, type: 'number', required: false, order: 1, options: [] },
      { id: 'f-6-3', name: { ru: 'Email поставщика', en: 'Supplier email', lt: 'Tiekėjo el. paštas' }, type: 'email', required: false, order: 2, options: [] },
      { id: 'f-6-4', name: { ru: 'Паспорт оборудования', en: 'Equipment passport', lt: 'Įrangos pasas' }, type: 'file', required: false, order: 3, options: [] },
    ],
    linkedSuppliers: [
      { id: '5', name: { ru: 'Euro Metal GmbH', en: 'Euro Metal GmbH', lt: 'Euro Metal GmbH' }, price: null, priceUnit: null, leadDays: 21 },
      { id: '6', name: { ru: 'IronBridge Corp', en: 'IronBridge Corp', lt: 'IronBridge Corp' }, price: null, priceUnit: null, leadDays: 9 },
    ],
  },
  {
    id: 'cat-7',
    name: { ru: 'Балки', en: 'Beams', lt: 'Sijos' },
    parentId: 'cat-1',
    description: { ru: 'Строительные стальные балки IPE/HEA/HEB', en: 'IPE/HEA/HEB structural steel beams', lt: 'IPE/HEA/HEB konstrukcinės plieno sijos' },
    fieldCount: 7,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-7-1', name: { ru: 'Тип профиля', en: 'Profile type', lt: 'Profilio tipas' }, type: 'enum', required: true, order: 0, options: [
        { ru: 'IPE', en: 'IPE', lt: 'IPE' },
        { ru: 'HEA', en: 'HEA', lt: 'HEA' },
        { ru: 'HEB', en: 'HEB', lt: 'HEB' },
        { ru: 'IPN', en: 'IPN', lt: 'IPN' },
        { ru: 'UPN', en: 'UPN', lt: 'UPN' },
      ] },
      { id: 'f-7-2', name: { ru: 'Высота (мм)', en: 'Height (mm)', lt: 'Aukštis (mm)' }, type: 'number', required: true, order: 1, options: [] },
      { id: 'f-7-3', name: { ru: 'Ширина полки (мм)', en: 'Flange width (mm)', lt: 'Flanšo plotis (mm)' }, type: 'number', required: false, order: 2, options: [] },
      { id: 'f-7-4', name: { ru: 'Толщина полки (мм)', en: 'Flange thickness (mm)', lt: 'Flanšo storis (mm)' }, type: 'number', required: false, order: 3, options: [] },
      { id: 'f-7-5', name: { ru: 'Толщина стенки (мм)', en: 'Web thickness (mm)', lt: 'Sienelės storis (mm)' }, type: 'number', required: false, order: 4, options: [] },
      { id: 'f-7-6', name: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, type: 'number', required: false, order: 5, options: [] },
      { id: 'f-7-7', name: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, type: 'number', required: false, order: 6, options: [] },
    ],
    linkedSuppliers: [
      { id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: null, priceUnit: null, leadDays: 5 },
      { id: '6', name: { ru: 'IronBridge Corp', en: 'IronBridge Corp', lt: 'IronBridge Corp' }, price: null, priceUnit: null, leadDays: 9 },
    ],
  },
  {
    id: 'cat-8',
    name: { ru: 'Швеллеры', en: 'Channels', lt: 'Šveleriai' },
    parentId: 'cat-1',
    description: { ru: 'Стальные швеллеры (UPN/UPE)', en: 'Steel channel sections (UPN/UPE)', lt: 'Plieniniai šveleriai (UPN/UPE)' },
    fieldCount: 6,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-8-1', name: { ru: 'Высота (мм)', en: 'Height (mm)', lt: 'Aukštis (mm)' }, type: 'number', required: true, order: 0, options: [] },
      { id: 'f-8-2', name: { ru: 'Ширина полки (мм)', en: 'Flange width (mm)', lt: 'Flanšo plotis (mm)' }, type: 'number', required: false, order: 1, options: [] },
      { id: 'f-8-3', name: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, type: 'number', required: false, order: 2, options: [] },
      { id: 'f-8-4', name: { ru: 'Толщина полки (мм)', en: 'Flange thickness (mm)', lt: 'Flanšo storis (mm)' }, type: 'number', required: false, order: 3, options: [] },
      { id: 'f-8-5', name: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, type: 'number', required: false, order: 4, options: [] },
      { id: 'f-8-6', name: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, type: 'number', required: false, order: 5, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: null, priceUnit: null, leadDays: 7 },
      { id: '6', name: { ru: 'IronBridge Corp', en: 'IronBridge Corp', lt: 'IronBridge Corp' }, price: null, priceUnit: null, leadDays: 9 },
    ],
  },
  {
    id: 'cat-9',
    name: { ru: 'Уголки', en: 'Angles', lt: 'Kampainiai' },
    parentId: 'cat-1',
    description: { ru: 'Равнополочные и неравнополочные стальные уголки', en: 'Equal and unequal steel angle bars', lt: 'Lygiakraščiai ir nelygiakraščiai plieno kampainiai' },
    fieldCount: 6,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-9-1', name: { ru: 'Ширина полки (мм)', en: 'Side width (mm)', lt: 'Šono plotis (mm)' }, type: 'number', required: true, order: 0, options: [] },
      { id: 'f-9-2', name: { ru: 'Толщина (мм)', en: 'Thickness (mm)', lt: 'Storis (mm)' }, type: 'number', required: true, order: 1, options: [] },
      { id: 'f-9-3', name: { ru: 'Ширина второй полки (мм)', en: 'Second side width (mm)', lt: 'Antro šono plotis (mm)' }, type: 'number', required: false, order: 2, options: [] },
      { id: 'f-9-4', name: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, type: 'number', required: false, order: 3, options: [] },
      { id: 'f-9-5', name: { ru: 'Тип', en: 'Type', lt: 'Tipas' }, type: 'enum', required: false, order: 4, options: [
        { ru: 'Равнополочный', en: 'Equal', lt: 'Lygiakraštis' },
        { ru: 'Неравнополочный', en: 'Unequal', lt: 'Nelygiakraštis' },
      ] },
      { id: 'f-9-6', name: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, type: 'number', required: false, order: 5, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: null, priceUnit: null, leadDays: 7 },
      { id: '2', name: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' }, price: null, priceUnit: null, leadDays: 5 },
    ],
  },
  {
    id: 'cat-10',
    name: { ru: 'Арматура', en: 'Rebars', lt: 'Armatūra' },
    parentId: 'cat-1',
    description: { ru: 'Арматурные стальные стержни', en: 'Reinforcement steel bars', lt: 'Armatūriniai plieno strypai' },
    fieldCount: 6,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-10-1', name: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, type: 'number', required: true, order: 0, options: [] },
      { id: 'f-10-2', name: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, type: 'number', required: false, order: 1, options: [] },
      { id: 'f-10-3', name: { ru: 'Класс', en: 'Class', lt: 'Klasė' }, type: 'enum', required: false, order: 2, options: [
        { ru: 'A240', en: 'A240', lt: 'A240' },
        { ru: 'A400', en: 'A400', lt: 'A400' },
        { ru: 'A500C', en: 'A500C', lt: 'A500C' },
        { ru: 'B500C', en: 'B500C', lt: 'B500C' },
      ] },
      { id: 'f-10-4', name: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, type: 'number', required: false, order: 3, options: [] },
      { id: 'f-10-5', name: { ru: 'Прочность на растяжение (МПа)', en: 'Tensile strength (MPa)', lt: 'Tempimo stipris (MPa)' }, type: 'number', required: false, order: 4, options: [] },
      { id: 'f-10-6', name: { ru: 'Предел текучести (МПа)', en: 'Yield strength (MPa)', lt: 'Takumo riba (MPa)' }, type: 'number', required: false, order: 5, options: [] },
    ],
    linkedSuppliers: [
      { id: '4', name: { ru: 'Baltic Metal Group', en: 'Baltic Metal Group', lt: 'Baltic Metal Group' }, price: null, priceUnit: null, leadDays: 14 },
      { id: '6', name: { ru: 'IronBridge Corp', en: 'IronBridge Corp', lt: 'IronBridge Corp' }, price: null, priceUnit: null, leadDays: 9 },
    ],
  },
  {
    id: 'cat-11',
    name: { ru: 'Профили', en: 'Profiles', lt: 'Profiliai' },
    parentId: 'cat-1',
    description: { ru: 'Квадратные и прямоугольные полые профили, полоса, круг', en: 'Square and rectangular hollow sections, flat and round bars', lt: 'Kvadratiniai ir stačiakampiai tuščiaviduriai profiliai, plokščios ir apvalios juostos' },
    fieldCount: 6,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-11-1', name: { ru: 'Тип профиля', en: 'Profile type', lt: 'Profilio tipas' }, type: 'enum', required: true, order: 0, options: [
        { ru: 'Квадратная труба', en: 'Square tube', lt: 'Kvadratinis vamzdis' },
        { ru: 'Прямоугольная труба', en: 'Rectangular tube', lt: 'Stačiakampis vamzdis' },
        { ru: 'Полоса', en: 'Flat bar', lt: 'Plokščia juosta' },
        { ru: 'Круг', en: 'Round bar', lt: 'Apvali juosta' },
      ] },
      { id: 'f-11-2', name: { ru: 'Высота (мм)', en: 'Height (mm)', lt: 'Aukštis (mm)' }, type: 'number', required: true, order: 1, options: [] },
      { id: 'f-11-3', name: { ru: 'Ширина (мм)', en: 'Width (mm)', lt: 'Plotis (mm)' }, type: 'number', required: false, order: 2, options: [] },
      { id: 'f-11-4', name: { ru: 'Толщина стенки (мм)', en: 'Wall thickness (mm)', lt: 'Sienelės storis (mm)' }, type: 'number', required: false, order: 3, options: [] },
      { id: 'f-11-5', name: { ru: 'Длина (мм)', en: 'Length (mm)', lt: 'Ilgis (mm)' }, type: 'number', required: false, order: 4, options: [] },
      { id: 'f-11-6', name: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, type: 'number', required: false, order: 5, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: null, priceUnit: null, leadDays: 7 },
      { id: '4', name: { ru: 'Baltic Metal Group', en: 'Baltic Metal Group', lt: 'Baltic Metal Group' }, price: null, priceUnit: null, leadDays: 14 },
    ],
  },
  {
    id: 'cat-12',
    name: { ru: 'Проволока', en: 'Wire', lt: 'Viela' },
    parentId: 'cat-1',
    description: { ru: 'Стальная проволока в бухтах и на катушках', en: 'Steel wire in coils and spools', lt: 'Plieninė viela ritėse ir ant būgnų' },
    fieldCount: 5,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-12-1', name: { ru: 'Диаметр (мм)', en: 'Diameter (mm)', lt: 'Skersmuo (mm)' }, type: 'number', required: true, order: 0, options: [] },
      { id: 'f-12-2', name: { ru: 'Покрытие', en: 'Coating', lt: 'Danga' }, type: 'enum', required: false, order: 1, options: [
        { ru: 'Без покрытия', en: 'Bare', lt: 'Be dangos' },
        { ru: 'Оцинкованная', en: 'Galvanized', lt: 'Cinkuota' },
        { ru: 'С цинковым покрытием', en: 'Zinc-coated', lt: 'Cinku danga' },
        { ru: 'С медным покрытием', en: 'Copper-coated', lt: 'Vario danga' },
      ] },
      { id: 'f-12-3', name: { ru: 'Вес бухты (кг)', en: 'Spool weight (kg)', lt: 'Ritės svoris (kg)' }, type: 'number', required: false, order: 2, options: [] },
      { id: 'f-12-4', name: { ru: 'Прочность на растяжение (МПа)', en: 'Tensile strength (MPa)', lt: 'Tempimo stipris (MPa)' }, type: 'number', required: false, order: 3, options: [] },
      { id: 'f-12-5', name: { ru: 'Вес на метр (кг/м)', en: 'Weight per meter (kg/m)', lt: 'Svoris metrui (kg/m)' }, type: 'number', required: false, order: 4, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: null, priceUnit: null, leadDays: 7 },
      { id: '6', name: { ru: 'IronBridge Corp', en: 'IronBridge Corp', lt: 'IronBridge Corp' }, price: null, priceUnit: null, leadDays: 9 },
    ],
  },
  {
    id: 'cat-13',
    name: { ru: 'Фитинги', en: 'Fittings', lt: 'Jungiamosios detalės' },
    parentId: 'cat-1',
    description: { ru: 'Трубные фитинги и соединители', en: 'Pipe fittings and connectors', lt: 'Vamzdžių jungtys ir adapteriai' },
    fieldCount: 5,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: { ru: 'Стандарт / ГОСТ', en: 'Standard / GOST', lt: 'Standartas / GOST' }, type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: { ru: 'Плотность (кг/м³)', en: 'Density (kg/m³)', lt: 'Tankis (kg/m³)' }, type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-13-1', name: { ru: 'Тип', en: 'Type', lt: 'Tipas' }, type: 'enum', required: true, order: 0, options: [
        { ru: 'Отвод 90°', en: 'Elbow 90°', lt: 'Alkūnė 90°' },
        { ru: 'Отвод 45°', en: 'Elbow 45°', lt: 'Alkūnė 45°' },
        { ru: 'Тройник', en: 'Tee', lt: 'Trišakis' },
        { ru: 'Переходник', en: 'Reducer', lt: 'Reduktorius' },
        { ru: 'Фланец', en: 'Flange', lt: 'Flanšas' },
        { ru: 'Муфта', en: 'Coupling', lt: 'Movė' },
        { ru: 'Заглушка', en: 'Cap', lt: 'Kamštis' },
      ] },
      { id: 'f-13-2', name: { ru: 'Размер DN (мм)', en: 'Size DN (mm)', lt: 'Dydis DN (mm)' }, type: 'number', required: true, order: 1, options: [] },
      { id: 'f-13-3', name: { ru: 'Номинальное давление (бар)', en: 'Pressure rating (bar)', lt: 'Slėgio klasė (bar)' }, type: 'number', required: false, order: 2, options: [] },
      { id: 'f-13-4', name: { ru: 'Тип соединения', en: 'Connection type', lt: 'Jungties tipas' }, type: 'enum', required: false, order: 3, options: [
        { ru: 'Резьбовое', en: 'Threaded', lt: 'Srieginis' },
        { ru: 'Сварное', en: 'Welded', lt: 'Suvirintas' },
        { ru: 'Фланцевое', en: 'Flanged', lt: 'Flanšinis' },
      ] },
      { id: 'f-13-5', name: { ru: 'Вес (кг)', en: 'Weight (kg)', lt: 'Svoris (kg)' }, type: 'number', required: false, order: 4, options: [] },
    ],
    linkedSuppliers: [
      { id: '4', name: { ru: 'Baltic Metal Group', en: 'Baltic Metal Group', lt: 'Baltic Metal Group' }, price: null, priceUnit: null, leadDays: 14 },
      { id: '5', name: { ru: 'Euro Metal GmbH', en: 'Euro Metal GmbH', lt: 'Euro Metal GmbH' }, price: null, priceUnit: null, leadDays: 21 },
    ],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLevel(id: string): number {
  let level = 0
  let current = STORE.find((c) => c.id === id)
  while (current?.parentId) {
    level++
    current = STORE.find((c) => c.id === current!.parentId)
  }
  return level
}

function getParentName(parentId: string | null): TranslatedString | null {
  if (!parentId) return null
  return STORE.find((c) => c.id === parentId)?.name ?? null
}

function hasChildren(id: string): boolean {
  return STORE.some((c) => c.parentId === id)
}

function toListItem(cat: Category): CategoryListItem {
  return {
    id: cat.id,
    name: cat.name,
    parentId: cat.parentId,
    parentName: getParentName(cat.parentId),
    fieldCount: cat.fieldCount,
    productCount: cat.productCount,
    level: getLevel(cat.id),
  }
}

function depthFirstSort(items: Category[]): Category[] {
  const result: Category[] = []
  function visit(parentId: string | null) {
    items
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.name.en.localeCompare(b.name.en, 'en'))
      .forEach((c) => { result.push(c); visit(c.id) })
  }
  visit(null)
  return result
}

function cascadeInheritedFields(parentId: string): void {
  const parent = STORE.find((c) => c.id === parentId)
  if (!parent) return
  STORE.filter((c) => c.parentId === parentId).forEach((child) => {
    child.inheritedFields = [...parent.inheritedFields, ...parent.fields]
    cascadeInheritedFields(child.id)
  })
}

let idSeq = 100
let fieldSeq = 1000

// ─── Mock functions ───────────────────────────────────────────────────────────

export function mockGetCategories(
  filters: CategoryFilters,
  page = 1,
  pageSize = 25,
): PaginatedResponse<CategoryListItem> {
  const filtered = STORE.filter((c) => {
    if (!filters.search) return true
    const q = filters.search.toLowerCase()
    return (
      c.name.ru?.toLowerCase().includes(q) ||
      c.name.en?.toLowerCase().includes(q) ||
      c.name.lt?.toLowerCase().includes(q)
    )
  })
  const sorted = filters.search
    ? filtered.slice().sort((a, b) => a.name.en.localeCompare(b.name.en, 'en'))
    : depthFirstSort(STORE)
  const total = sorted.length
  const totalPages = Math.ceil(total / pageSize)
  const page_items = sorted.slice((page - 1) * pageSize, page * pageSize)
  return {
    items: page_items.map(toListItem),
    total,
    page,
    pageSize,
    totalPages,
  }
}

export function mockGetCategory(id: string): Category {
  const cat = STORE.find((c) => c.id === id)
  if (!cat) throw new Error(`Category ${id} not found`)
  return JSON.parse(JSON.stringify(cat))
}

export function mockCreateCategory(data: {
  name: TranslatedString
  parentId?: string | null
  description?: TranslatedString | null
}): Category {
  const parentId = data.parentId ?? null

  // прямой родитель уже хранит накопленную цепочку inheritedFields + свои fields
  const parent = STORE.find((c) => c.id === parentId)
  const inheritedFields: CategoryField[] = parent
    ? [...parent.inheritedFields, ...parent.fields]
    : []

  const newCat: Category = {
    id: `cat-${++idSeq}`,
    name: data.name,
    parentId,
    description: data.description ?? null,
    fieldCount: 0,
    productCount: 0,
    inheritedFields,
    fields: [],
    linkedSuppliers: [],
  }
  STORE.push(newCat)
  return JSON.parse(JSON.stringify(newCat))
}

export function mockPatchCategory(
  id: string,
  delta: Partial<Pick<Category, 'name' | 'parentId' | 'description'>> & { linkedSuppliers?: LinkedSupplier[] },
): Category | undefined {
  const cat = STORE.find((c) => c.id === id)
  if (!cat) return undefined
  if (delta.name !== undefined) cat.name = mergeTranslatedString(cat.name as TranslatedString, delta.name as TranslatedString)
  if (delta.description !== undefined) cat.description = mergeTranslatedString(cat.description as TranslatedString, delta.description as TranslatedString)
  if (delta.linkedSuppliers !== undefined)
    cat.linkedSuppliers = JSON.parse(JSON.stringify(delta.linkedSuppliers)) as LinkedSupplier[]
  if (delta.parentId !== undefined) {
    cat.parentId = delta.parentId
    const parent = STORE.find((c) => c.id === delta.parentId)
    cat.inheritedFields = parent ? [...parent.inheritedFields, ...parent.fields] : []
    cascadeInheritedFields(cat.id)
  }
  return JSON.parse(JSON.stringify(cat))
}

export function mockDeleteCategory(id: string): { ok: boolean; code?: string } {
  const cat = STORE.find((c) => c.id === id)
  if (!cat) return { ok: false, code: 'CATEGORY_NOT_FOUND' }
  if (cat.productCount > 0) return { ok: false, code: 'CATEGORY_HAS_PRODUCTS' }
  if (hasChildren(id)) return { ok: false, code: 'CATEGORY_HAS_CHILDREN' }
  const idx = STORE.findIndex((c) => c.id === id)
  STORE.splice(idx, 1)
  return { ok: true }
}

export function mockPutCategoryFields(
  id: string,
  fields: CategoryField[],
): CategoryField[] | undefined {
  const cat = STORE.find((c) => c.id === id)
  if (!cat) return undefined
  // ВАЖНО: JSON.parse/stringify чтобы избежать DataCloneError на reactive данных
  // tmp-* id заменяются постоянными (имитирует поведение сервера)
  cat.fields = JSON.parse(JSON.stringify(fields)).map(
    (f: CategoryField, i: number) => ({
      ...f,
      name: mergeTranslatedString(cat.fields[i]?.name as TranslatedString ?? { ru: '', en: '', lt: '' }, f.name as TranslatedString),
      options: f.options?.map((o: TranslatedString, oi: number) =>
        mergeTranslatedString(
          (cat.fields[i]?.options?.[oi] as TranslatedString) ?? { ru: '', en: '', lt: '' },
          o as unknown as TranslatedString,
        ),
      ),
      id: f.id.startsWith('tmp-') ? `f-perm-${++fieldSeq}` : f.id,
      order: i,
    }),
  )
  cat.fieldCount = cat.fields.length
  // каскадируем изменение полей на всех потомков
  cascadeInheritedFields(id)
  return JSON.parse(JSON.stringify(cat.fields))
}
