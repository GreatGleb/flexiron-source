import type { Client, ClientFormData } from '@/types/client'
import type { StockAuditEntry } from '@/types/warehouse'

const STORE: Client[] = [
  // ── Existing clients (1-9) ──
  {
    id: 'CL-001',
    name: 'UAB Metalica',
    companyCode: '304567890',
    vatCode: 'LT304567890',
    address: 'Vytauto g. 15, Kaunas',
    phone: '+37061234567',
    email: 'info@metalica.lt',
    status: 'active',
    notes: 'Main client, sheet steel orders',
    createdAt: '2025-01-10',
    orderHistory: [
      { id: 'ORD-001', date: '2025-03-15', total: 12450.0, currency: 'EUR', status: 'completed' },
      { id: 'ORD-002', date: '2025-05-20', total: 8900.0, currency: 'EUR', status: 'completed' },
      { id: 'ORD-005', date: '2026-01-10', total: 15300.0, currency: 'EUR', status: 'processing' },
    ],
    interactionHistory: [
      {
        date: '2025-06-01',
        type: 'call',
        summary: 'Discussed new order for sheet steel',
        user: 'Ivan N.',
        rejectionReason: null,
      },
      {
        date: '2025-06-15',
        type: 'email',
        summary: 'Sent updated price list',
        user: 'Elena K.',
        rejectionReason: null,
      },
      {
        date: '2025-07-10',
        type: 'meeting',
        summary: 'Quarterly review — agreed on volume discount',
        user: 'Ivan N.',
        rejectionReason: null,
      },
    ],
    auditLog: [
      {
        timestamp: '2025-01-10 09:00',
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Клиент создан', en: 'Client created', lt: 'Klientas sukurtas' },
        oldValue: '',
        newValue: 'UAB Metalica',
      },
      {
        timestamp: '2025-01-12 14:30',
        user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
        userInitials: 'IN',
        property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
        oldValue: 'inactive',
        newValue: 'active',
      },
      {
        timestamp: '2025-03-05 11:00',
        user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
        userInitials: 'EK',
        property: { ru: 'Телефон', en: 'Phone', lt: 'Telefonas' },
        oldValue: '+37060000000',
        newValue: '+37061234567',
      },
    ],
  },
  {
    id: 'CL-002',
    name: 'SIA SteelWorks',
    companyCode: '40203040506',
    vatCode: 'LV40203040506',
    address: 'Brīvības iela 120, Riga',
    phone: '+37129123456',
    email: 'orders@steelworks.lv',
    status: 'active',
    notes: 'Export partner, pipe products',
    createdAt: '2025-02-15',
    auditLog: [
      {
        timestamp: '2025-02-15 10:00',
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Клиент создан', en: 'Client created', lt: 'Klientas sukurtas' },
        oldValue: '',
        newValue: 'SIA SteelWorks',
      },
      {
        timestamp: '2025-02-18 09:15',
        user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
        userInitials: 'MV',
        property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
        oldValue: 'inactive',
        newValue: 'active',
      },
    ],
  },
  {
    id: 'CL-003',
    name: 'MB Statyba',
    companyCode: '305678901',
    vatCode: 'LT305678901',
    address: 'Gedimino pr. 50, Vilnius',
    phone: '+37069876543',
    email: 'info@statyba.lt',
    status: 'active',
    notes: null,
    createdAt: '2025-03-20',
    auditLog: [
      {
        timestamp: '2025-03-20 08:00',
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Клиент создан', en: 'Client created', lt: 'Klientas sukurtas' },
        oldValue: '',
        newValue: 'MB Statyba',
      },
    ],
  },
  {
    id: 'CL-004',
    name: 'OOO Ferrum Invest',
    companyCode: '40305060708',
    vatCode: 'LV40305060708',
    address: 'Daugavgrīvas iela 68, Riga',
    phone: '+37127890123',
    email: 'ferrum@inbox.lv',
    status: 'inactive',
    notes: 'Temporarily suspended due to sanctions check',
    rejectionReason: 'Sanctions compliance - awaiting legal review',
    createdAt: '2025-04-05',
    interactionHistory: [
      {
        date: '2025-04-10',
        type: 'email',
        summary: 'Sent compliance questionnaire',
        user: 'Elena K.',
        rejectionReason: null,
      },
      {
        date: '2025-04-20',
        type: 'call',
        summary: 'Follow-up on missing documents',
        user: 'Ivan N.',
        rejectionReason: null,
      },
      {
        date: '2025-05-05',
        type: 'note',
        summary: 'Sanctions check triggered - account suspended',
        user: 'Alex Z.',
        rejectionReason: 'Beneficiary not verified',
      },
    ],
  },
  {
    id: 'CL-005',
    name: 'UAB Plieno Centras',
    companyCode: '306789012',
    vatCode: 'LT306789012',
    address: 'Pramonės g. 25, Šiauliai',
    phone: '+37061237890',
    email: 'info@plienocentras.lt',
    status: 'active',
    notes: 'Regular buyer of stainless steel coils',
    createdAt: '2025-04-18',
    orderHistory: [
      { id: 'ORD-003', date: '2025-06-01', total: 5600.0, currency: 'EUR', status: 'completed' },
      { id: 'ORD-007', date: '2026-02-15', total: 22100.0, currency: 'EUR', status: 'shipped' },
    ],
    auditLog: [
      {
        timestamp: '2025-04-18 08:00',
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Клиент создан', en: 'Client created', lt: 'Klientas sukurtas' },
        oldValue: '',
        newValue: 'UAB Plieno Centras',
      },
      {
        timestamp: '2025-05-20 16:30',
        user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
        userInitials: 'OP',
        property: { ru: 'Примечания', en: 'Notes', lt: 'Pastabos' },
        oldValue: '',
        newValue: 'Regular buyer of stainless steel coils',
      },
    ],
  },
  {
    id: 'CL-006',
    name: 'SIA Metāla Tirdzniecība',
    companyCode: '40123456789',
    vatCode: 'LV40123456789',
    address: 'Mārupes iela 15, Riga',
    phone: '+37125678901',
    email: 'sales@metalatirdznieciba.lv',
    status: 'active',
    notes: 'Distributor, aluminum profiles',
    createdAt: '2025-05-02',
  },
  {
    id: 'CL-007',
    name: 'UAB Krantas Logistics',
    companyCode: '307890123',
    vatCode: 'LT307890123',
    address: 'Jūros g. 42, Klaipėda',
    phone: '+37067890123',
    email: 'logistics@krantas.lt',
    status: 'inactive',
    notes: null,
    createdAt: '2025-05-20',
  },
  {
    id: 'CL-008',
    name: 'SIA Būvmateriāli',
    companyCode: '40890123456',
    vatCode: 'LV40890123456',
    address: 'Ventas iela 8, Liepāja',
    phone: '+37126789012',
    email: 'info@buvmateriali.lv',
    status: 'active',
    notes: 'Construction materials, quarterly contracts',
    createdAt: '2025-06-10',
    auditLog: [
      {
        timestamp: '2025-06-10 08:00',
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Клиент создан', en: 'Client created', lt: 'Klientas sukurtas' },
        oldValue: '',
        newValue: 'SIA Būvmateriāli',
      },
      {
        timestamp: '2025-06-12 10:30',
        user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
        userInitials: 'AZ',
        property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
        oldValue: 'inactive',
        newValue: 'active',
      },
    ],
  },
  {
    id: 'CL-009',
    name: 'UAB EKO Metalas',
    companyCode: '308901234',
    vatCode: 'LT308901234',
    address: 'Žalioji g. 10, Panevėžys',
    phone: '+37068901234',
    email: 'recycling@ekometalas.lt',
    status: 'active',
    notes: 'Scrap metal recycling partner',
    createdAt: '2025-07-01',
  },

  // ── Lithuanian companies (CL-010 – CL-030) ──
  {
    id: 'CL-010',
    name: 'UAB InfraStatyba',
    companyCode: '301234567',
    vatCode: 'LT301234567',
    address: 'Savanorių pr. 187, Vilnius',
    phone: '+37062010001',
    email: 'info@infrastatyba.lt',
    status: 'active',
    notes: 'Road construction, rebar orders',
    createdAt: '2025-07-15',
  },
  {
    id: 'CL-011',
    name: 'AB Plieno Gamyba',
    companyCode: '302345678',
    vatCode: 'LT302345678',
    address: 'Metalurgų g. 3, Elektrėnai',
    phone: '+37062010002',
    email: 'sales@plienogamyba.lt',
    status: 'active',
    notes: 'Large industrial client, monthly rolled steel allocations',
    createdAt: '2025-07-22',
    orderHistory: [
      { id: 'ORD-004', date: '2025-09-10', total: 45000.0, currency: 'EUR', status: 'completed' },
      { id: 'ORD-008', date: '2026-03-01', total: 32000.0, currency: 'EUR', status: 'processing' },
    ],
    auditLog: [
      {
        timestamp: '2025-07-22 08:00',
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Клиент создан', en: 'Client created', lt: 'Klientas sukurtas' },
        oldValue: '',
        newValue: 'AB Plieno Gamyba',
      },
      {
        timestamp: '2025-08-01 11:00',
        user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
        userInitials: 'MV',
        property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
        oldValue: 'inactive',
        newValue: 'active',
      },
      {
        timestamp: '2025-09-15 09:20',
        user: { ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' },
        userInitials: 'EK',
        property: { ru: 'Email', en: 'Email', lt: 'El. paštas' },
        oldValue: 'sales@plienas.lt',
        newValue: 'sales@plienogamyba.lt',
      },
    ],
  },
  {
    id: 'CL-012',
    name: 'MB Wood & Metal',
    companyCode: '303456789',
    vatCode: 'LT303456789',
    address: 'Miško g. 8, Alytus',
    phone: '+37062010003',
    email: 'info@woodmetal.lt',
    status: 'active',
    notes: null,
    createdAt: '2025-08-01',
  },
  {
    id: 'CL-013',
    name: 'VŠĮ Statybos Centras',
    companyCode: '304567001',
    vatCode: 'LT304567001',
    address: 'Laisvės al. 45, Kaunas',
    phone: '+37062010004',
    email: 'centras@statyba.lt',
    status: 'inactive',
    notes: 'Public procurement entity, contract expired',
    createdAt: '2025-08-10',
    auditLog: [
      {
        timestamp: '2025-08-10 08:00',
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Клиент создан', en: 'Client created', lt: 'Klientas sukurtas' },
        oldValue: '',
        newValue: 'VŠĮ Statybos Centras',
      },
      {
        timestamp: '2025-12-01 14:00',
        user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
        userInitials: 'IN',
        property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
        oldValue: 'active',
        newValue: 'inactive',
      },
    ],
  },
  {
    id: 'CL-014',
    name: 'UAB Šiaurės Metas',
    companyCode: '305678112',
    vatCode: 'LT305678112',
    address: 'Respublikos g. 12, Panevėžys',
    phone: '+37062010005',
    email: 'siaures.metas@gmail.com',
    status: 'active',
    notes: 'Small-batch custom orders',
    createdAt: '2025-08-18',
  },
  {
    id: 'CL-015',
    name: 'UAB Jūros Prekyba',
    companyCode: '306789223',
    vatCode: 'LT306789223',
    address: 'Tilžės g. 30, Klaipėda',
    phone: '+37062010006',
    email: 'trade@jurosprekyba.lt',
    status: 'active',
    notes: 'Export-import, container flat steel',
    createdAt: '2025-08-25',
  },
  {
    id: 'CL-016',
    name: 'MB Namų Projektai',
    companyCode: '307890334',
    vatCode: 'LT307890334',
    address: 'Vilniaus g. 22, Ukmergė',
    phone: '+37062010007',
    email: 'info@namuprojektai.lt',
    status: 'inactive',
    notes: 'Seasonal buyer, only spring-summer',
    createdAt: '2025-09-01',
  },
  {
    id: 'CL-017',
    name: 'UAB Aukštaitijos Metalas',
    companyCode: '308901445',
    vatCode: 'LT308901445',
    address: 'Klaipėdos g. 5, Utena',
    phone: '+37062010008',
    email: 'aukstaitija@metalas.lt',
    status: 'active',
    notes: 'Regional distributor, wire rod products',
    createdAt: '2025-09-12',
  },
  {
    id: 'CL-018',
    name: 'AB Rytų Prekyba',
    companyCode: '309012556',
    vatCode: 'LT309012556',
    address: 'Geležinkelio g. 14, Vilnius',
    phone: '+37062010009',
    email: 'rytai@prekyba.lt',
    status: 'active',
    notes: null,
    createdAt: '2025-09-20',
  },
  {
    id: 'CL-019',
    name: 'UAB Statybos Inžinerija',
    companyCode: '310123667',
    vatCode: 'LT310123667',
    address: 'Taikos pr. 88, Klaipėda',
    phone: '+37062010010',
    email: 'engineering@statybos.lt',
    status: 'active',
    notes: 'Steel structures for commercial buildings',
    createdAt: '2025-10-01',
  },
  {
    id: 'CL-020',
    name: 'MB AutoRemontas',
    companyCode: '311234778',
    vatCode: 'LT311234778',
    address: 'Pramonės g. 7, Marijampolė',
    phone: '+37062010011',
    email: 'info@autoremontas.lt',
    status: 'inactive',
    notes: null,
    createdAt: '2025-10-08',
  },
  {
    id: 'CL-021',
    name: 'UAB Vakarų Logistika',
    companyCode: '312345889',
    vatCode: 'LT312345889',
    address: 'Minijos g. 55, Klaipėda',
    phone: '+37062010012',
    email: 'logistics@vakarai.lt',
    status: 'active',
    notes: 'Warehouse and distribution, regular coil orders',
    createdAt: '2025-10-15',
  },
  {
    id: 'CL-022',
    name: 'UAB Energetikos Sistema',
    companyCode: '313456990',
    vatCode: 'LT313456990',
    address: 'Žalgirio g. 100, Vilnius',
    phone: '+37062010013',
    email: 'power@energetika.lt',
    status: 'active',
    notes: 'Wind tower component manufacturer',
    createdAt: '2025-10-22',
    orderHistory: [
      { id: 'ORD-006', date: '2025-12-05', total: 18700.0, currency: 'EUR', status: 'completed' },
      { id: 'ORD-009', date: '2026-04-20', total: 28500.0, currency: 'EUR', status: 'shipped' },
    ],
    auditLog: [
      {
        timestamp: '2025-10-22 08:00',
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Клиент создан', en: 'Client created', lt: 'Klientas sukurtas' },
        oldValue: '',
        newValue: 'UAB Energetikos Sistema',
      },
      {
        timestamp: '2025-11-10 10:00',
        user: { ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' },
        userInitials: 'OP',
        property: { ru: 'Примечания', en: 'Notes', lt: 'Pastabos' },
        oldValue: '',
        newValue: 'Wind tower component manufacturer',
      },
    ],
  },
  {
    id: 'CL-023',
    name: 'MB Mažoji Architektūra',
    companyCode: '314567001',
    vatCode: 'LT314567001',
    address: 'Parko g. 3, Druskininkai',
    phone: '+37062010014',
    email: 'arch@mazoji.lt',
    status: 'active',
    notes: 'Landscaping and small structures',
    createdAt: '2025-11-01',
  },
  {
    id: 'CL-024',
    name: 'UAB Žemės Ūkio Technika',
    companyCode: '315678112',
    vatCode: 'LT315678112',
    address: 'Lauko g. 18, Raseiniai',
    phone: '+37062010015',
    email: 'agri@zemestechnika.lt',
    status: 'inactive',
    notes: 'Seasonal agricultural equipment',
    createdAt: '2025-11-10',
  },
  {
    id: 'CL-025',
    name: 'UAB Buitinė Technika',
    companyCode: '316789223',
    vatCode: 'LT316789223',
    address: 'Ukmergės g. 240, Vilnius',
    phone: '+37062010016',
    email: 'home@buitine.lt',
    status: 'active',
    notes: 'Home appliance manufacturer, sheet metal',
    createdAt: '2025-11-18',
  },
  {
    id: 'CL-026',
    name: 'AB Transporto Parkas',
    companyCode: '317890334',
    vatCode: 'LT317890334',
    address: 'Sodo g. 9, Kaišiadorys',
    phone: '+37062010017',
    email: 'fleet@transportoparkas.lt',
    status: 'active',
    notes: null,
    createdAt: '2025-11-25',
  },
  {
    id: 'CL-027',
    name: 'MB Mediniai Fasatai',
    companyCode: '318901445',
    vatCode: 'LT318901445',
    address: 'Ąžuolų g. 11, Trakai',
    phone: '+37062010018',
    email: 'wood@fasatai.lt',
    status: 'inactive',
    notes: 'Switched to wood-only supplier',
    createdAt: '2025-12-01',
  },
  {
    id: 'CL-028',
    name: 'UAB Plastiko Formos',
    companyCode: '319012556',
    vatCode: 'LT319012556',
    address: 'Chemijos g. 4, Jonava',
    phone: '+37062010019',
    email: 'molds@plastikoforma.lt',
    status: 'active',
    notes: 'Injection mold steel buyer',
    createdAt: '2025-12-10',
  },
  {
    id: 'CL-029',
    name: 'AB Kelių Tiesimas',
    companyCode: '320123667',
    vatCode: 'LT320123667',
    address: 'Automagistralės g. 1, Kaunas',
    phone: '+37062010020',
    email: 'roads@keliu-tiesimas.lt',
    status: 'active',
    notes: 'Road construction, rebar and mesh',
    createdAt: '2025-12-18',
  },
  {
    id: 'CL-030',
    name: 'UAB Šaltasis Sandėlis',
    companyCode: '321234778',
    vatCode: 'LT321234778',
    address: 'Šaltkalvių g. 6, Panevėžys',
    phone: '+37062010021',
    email: 'cold@saltasis.lt',
    status: 'inactive',
    notes: null,
    createdAt: '2026-01-05',
  },

  // ── Latvian companies (CL-031 – CL-045) ──
  {
    id: 'CL-031',
    name: 'SIA Latvijas Metāls',
    companyCode: '41001001001',
    vatCode: 'LV41001001001',
    address: 'Dzelzceļa iela 25, Riga',
    phone: '+37126000001',
    email: 'info@latvijasmetals.lv',
    status: 'active',
    notes: 'National metal distributor, LT and EE market',
    createdAt: '2026-01-12',
    orderHistory: [
      { id: 'ORD-010', date: '2026-02-20', total: 9800.0, currency: 'EUR', status: 'completed' },
    ],
    auditLog: [
      {
        timestamp: '2026-01-12 08:00',
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Клиент создан', en: 'Client created', lt: 'Klientas sukurtas' },
        oldValue: '',
        newValue: 'SIA Latvijas Metāls',
      },
      {
        timestamp: '2026-01-15 14:00',
        user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
        userInitials: 'AZ',
        property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
        oldValue: 'inactive',
        newValue: 'active',
      },
    ],
  },
  {
    id: 'CL-032',
    name: 'SIA Būvnieks',
    companyCode: '41002002002',
    vatCode: 'LV41002002002',
    address: 'Meža iela 18, Ogre',
    phone: '+37126000002',
    email: 'info@buvnieks.lv',
    status: 'active',
    notes: 'General construction, profile pipes',
    createdAt: '2026-01-20',
  },
  {
    id: 'CL-033',
    name: 'SIA Rīgas Tilti',
    companyCode: '41003003003',
    vatCode: 'LV41003003003',
    address: 'Maskavas iela 240, Riga',
    phone: '+37126000003',
    email: 'bridges@rigastilti.lv',
    status: 'active',
    notes: 'Bridge construction, heavy beams',
    createdAt: '2026-01-28',
  },
  {
    id: 'CL-034',
    name: 'SIA Kurzemes Metālapstrāde',
    companyCode: '41004004004',
    vatCode: 'LV41004004004',
    address: 'Liepu iela 33, Liepāja',
    phone: '+37126000004',
    email: 'metal@kurzeme.lv',
    status: 'active',
    notes: 'Metalworking, custom fabrication',
    createdAt: '2026-02-05',
  },
  {
    id: 'CL-035',
    name: 'SIA Jūrmalas Projekts',
    companyCode: '41005005005',
    vatCode: 'LV41005005005',
    address: 'Jomas iela 55, Jūrmala',
    phone: '+37126000005',
    email: 'project@jurmala.lv',
    status: 'inactive',
    notes: null,
    createdAt: '2026-02-14',
  },
  {
    id: 'CL-036',
    name: 'SIA Daugavpils Energo',
    companyCode: '41006006006',
    vatCode: 'LV41006006006',
    address: 'Vienības iela 20, Daugavpils',
    phone: '+37126000006',
    email: 'energy@daugavpils.lv',
    status: 'active',
    notes: 'Energy sector, boiler steel',
    createdAt: '2026-02-22',
  },
  {
    id: 'CL-037',
    name: 'SIA Valmieras Stikls',
    companyCode: '41007007007',
    vatCode: 'LV41007007007',
    address: 'Rūpniecības iela 5, Valmiera',
    phone: '+37126000007',
    email: 'glass@valmiera.lv',
    status: 'inactive',
    notes: 'Temporary halt due to furnace maintenance',
    createdAt: '2026-03-01',
  },
  {
    id: 'CL-038',
    name: 'SIA Celtniecības Materiāli',
    companyCode: '41008008008',
    vatCode: 'LV41008008008',
    address: 'Rīgas iela 88, Jelgava',
    phone: '+37126000008',
    email: 'materials@celtnieciba.lv',
    status: 'active',
    notes: 'Building materials wholesaler',
    createdAt: '2026-03-10',
  },
  {
    id: 'CL-039',
    name: 'SIA Ostas Loģistika',
    companyCode: '41009009009',
    vatCode: 'LV41009009009',
    address: 'Ostas iela 12, Ventspils',
    phone: '+37126000009',
    email: 'port@ostaslogistika.lv',
    status: 'active',
    notes: 'Port operations, steel re-export',
    createdAt: '2026-03-18',
  },
  {
    id: 'CL-040',
    name: 'SIA Koksnes Grupa',
    companyCode: '41010010010',
    vatCode: 'LV41010010010',
    address: 'Mežrūpniecības iela 7, Riga',
    phone: '+37126000010',
    email: 'wood@koksnesgrupa.lv',
    status: 'active',
    notes: null,
    createdAt: '2026-03-25',
  },
  {
    id: 'CL-041',
    name: 'SIA AutoCeļš',
    companyCode: '41011011011',
    vatCode: 'LV41011011011',
    address: 'Šosejas iela 2, Bauska',
    phone: '+37126000011',
    email: 'road@autocels.lv',
    status: 'inactive',
    notes: 'Contract under renegotiation',
    createdAt: '2026-04-01',
  },
  {
    id: 'CL-042',
    name: 'SIA Rēzeknes Mašīnbūve',
    companyCode: '41012012012',
    vatCode: 'LV41012012012',
    address: 'Atbrīvošanas aleja 90, Rēzekne',
    phone: '+37126000012',
    email: 'machinery@rezekne.lv',
    status: 'active',
    notes: 'Machine building, cast iron and steel',
    createdAt: '2026-04-08',
  },
  {
    id: 'CL-043',
    name: 'SIA Zaļā Enerģija',
    companyCode: '41013013013',
    vatCode: 'LV41013013013',
    address: 'Saules iela 15, Salaspils',
    phone: '+37126000013',
    email: 'green@zalaenergija.lv',
    status: 'active',
    notes: 'Solar panel frame manufacturer',
    createdAt: '2026-04-15',
  },
  {
    id: 'CL-044',
    name: 'SIA Jēkabpils Saimnieks',
    companyCode: '41014014014',
    vatCode: 'LV41014014014',
    address: 'Brīvības iela 40, Jēkabpils',
    phone: '+37126000014',
    email: 'saimnieks@jekabpils.lv',
    status: 'inactive',
    notes: null,
    createdAt: '2026-04-22',
  },
  {
    id: 'CL-045',
    name: 'SIA Baltijas Tranzīts',
    companyCode: '41015015015',
    vatCode: 'LV41015015015',
    address: 'Eksporta iela 10, Riga',
    phone: '+37126000015',
    email: 'transit@baltija.lv',
    status: 'active',
    notes: 'Transit and logistics, regular buyer',
    createdAt: '2026-05-01',
  },

  // ── Estonian & other EU (CL-046 – CL-055) ──
  {
    id: 'CL-046',
    name: 'OÜ Eesti Teras',
    companyCode: '123456789',
    vatCode: 'EE123456789',
    address: 'Tööstuse tn 15, Tallinn',
    phone: '+3725100001',
    email: 'info@eestiteras.ee',
    status: 'active',
    notes: 'Estonian steel distributor',
    createdAt: '2026-05-08',
  },
  {
    id: 'CL-047',
    name: 'OÜ Põhja Ehitus',
    companyCode: '234567890',
    vatCode: 'EE234567890',
    address: 'Pärnu mnt 110, Tallinn',
    phone: '+3725100002',
    email: 'build@pohja.ee',
    status: 'active',
    notes: 'Northern Estonian construction company',
    createdAt: '2026-05-15',
  },
  {
    id: 'CL-048',
    name: 'AS Tartu Metall',
    companyCode: '345678901',
    vatCode: 'EE345678901',
    address: 'Riia tn 55, Tartu',
    phone: '+3725100003',
    email: 'metal@tartu.ee',
    status: 'inactive',
    notes: null,
    createdAt: '2026-05-20',
  },
  {
    id: 'CL-049',
    name: 'OÜ Lääne Rannik',
    companyCode: '456789012',
    vatCode: 'EE456789012',
    address: 'Keskväljak 3, Pärnu',
    phone: '+3725100004',
    email: 'west@laanerannik.ee',
    status: 'active',
    notes: 'Port city client, imported steel',
    createdAt: '2026-05-25',
  },
  {
    id: 'CL-050',
    name: 'Sp. z o.o. PolStal',
    companyCode: '5290001010',
    vatCode: 'PL5290001010',
    address: 'ul. Hutnicza 12, Kraków',
    phone: '+48123456701',
    email: 'office@polstal.pl',
    status: 'active',
    notes: 'Polish partner, large volume orders',
    createdAt: '2026-06-01',
    orderHistory: [
      { id: 'ORD-011', date: '2026-06-01', total: 67500.0, currency: 'EUR', status: 'processing' },
    ],
    auditLog: [
      {
        timestamp: '2026-06-01 08:00',
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Клиент создан', en: 'Client created', lt: 'Klientas sukurtas' },
        oldValue: '',
        newValue: 'Sp. z o.o. PolStal',
      },
    ],
  },
  {
    id: 'CL-051',
    name: 'GmbH Nordstahl Berlin',
    companyCode: 'HRB245678',
    vatCode: 'DE324567890',
    address: 'Stahlstraße 45, Berlin',
    phone: '+49301234567',
    email: 'info@nordstahl.de',
    status: 'active',
    notes: null,
    createdAt: '2026-06-03',
  },
  {
    id: 'CL-052',
    name: 'SIA Mežs un Metāls',
    companyCode: '41016016016',
    vatCode: 'LV41016016016',
    address: 'Rūpnīcas iela 3, Cēsis',
    phone: '+37126000016',
    email: 'forest@mezsmetals.lv',
    status: 'active',
    notes: 'Forestry equipment steel parts',
    createdAt: '2026-06-05',
  },
  {
    id: 'CL-053',
    name: 'UAB Aviacijos Dalys',
    companyCode: '322345889',
    vatCode: 'LT322345889',
    address: 'Lėktuvų g. 8, Kaunas',
    phone: '+37062010022',
    email: 'parts@aviacija.lt',
    status: 'active',
    notes: 'Aviation parts, specialty alloys',
    createdAt: '2026-06-07',
  },
  {
    id: 'CL-054',
    name: 'MB 3D Spausdinimas',
    companyCode: '323456990',
    vatCode: 'LT323456990',
    address: 'Inovacijų g. 12, Vilnius',
    phone: '+37062010023',
    email: 'print@3dspausdinimas.lt',
    status: 'active',
    notes: 'Additive manufacturing, metal powders',
    createdAt: '2026-06-09',
  },
  {
    id: 'CL-055',
    name: 'SIA Digital Manufacturing',
    companyCode: '41017017017',
    vatCode: 'LV41017017017',
    address: 'Skaitļošanas iela 22, Riga',
    phone: '+37126000017',
    email: 'digifab@inbox.lv',
    status: 'inactive',
    notes: 'Startup, paused operations',
    createdAt: '2026-06-10',
  },
]

let nextSeq = STORE.length + 1

function nextId(): string {
  return `CL-${String(nextSeq++).padStart(3, '0')}`
}

export function mockGetClients(): Client[] {
  return structuredClone(STORE)
}

export function mockGetClient(id: string): Client | undefined {
  return structuredClone(STORE.find((c) => c.id === id))
}

export function mockCreateClient(data: ClientFormData): Client {
  // Валидация required полей (БАГ-10)
  if (!data.name || !data.name.trim()) {
    throw new Error('VALIDATION_ERROR: name is required')
  }
  if (!data.companyCode || !data.companyCode.trim()) {
    throw new Error('VALIDATION_ERROR: companyCode is required')
  }
  if (!data.email || !data.email.trim()) {
    throw new Error('VALIDATION_ERROR: email is required')
  }
  // Проверка на duplicate companyCode
  const existing = STORE.find((c) => c.companyCode === data.companyCode.trim())
  if (existing) {
    throw new Error('CONFLICT: companyCode already exists')
  }
  const client: Client = {
    id: nextId(),
    ...data,
    name: data.name.trim(),
    companyCode: data.companyCode.trim(),
    email: data.email.trim(),
    createdAt: new Date().toISOString().slice(0, 10),
    auditLog: [],
  }
  STORE.push(client)
  return structuredClone(client)
}

export function mockPatchClient(id: string, delta: Partial<Client>): Client {
  const idx = STORE.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error('CLIENT_NOT_FOUND')
  Object.assign(STORE[idx]!, delta)
  return structuredClone(STORE[idx]!)
}

export function mockDeleteClient(id: string): void {
  const idx = STORE.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error('CLIENT_NOT_FOUND')
  // Проверка на активные заказы (БАГ-11)
  const client = STORE[idx]
  if (client?.orderHistory && client.orderHistory.length > 0) {
    const hasActiveOrders = client.orderHistory.some((o) =>
      ['processing', 'shipped', 'pending'].includes(o.status),
    )
    if (hasActiveOrders) {
      throw new Error('CONFLICT: client has active orders')
    }
  }
  STORE.splice(idx, 1)
}

export function mockDeleteClientAuditEntry(clientId: string, entryIndex: number): void {
  const client = STORE.find((c) => c.id === clientId)
  if (!client) throw new Error('CLIENT_NOT_FOUND')
  if (!client.auditLog || entryIndex < 0 || entryIndex >= client.auditLog.length) {
    throw new Error('AUDIT_ENTRY_NOT_FOUND')
  }
  client.auditLog.splice(entryIndex, 1)
}

export function mockAddClientInteraction(
  clientId: string,
  entry: import('@/types/client').InteractionHistoryEntry,
): import('@/types/client').InteractionHistoryEntry {
  const client = STORE.find((c) => c.id === clientId)
  if (!client) throw new Error('CLIENT_NOT_FOUND')
  if (!client.interactionHistory) {
    client.interactionHistory = []
  }
  client.interactionHistory.push(entry)
  return structuredClone(entry)
}

export function mockDeleteClientInteraction(clientId: string, entryIndex: number): void {
  const client = STORE.find((c) => c.id === clientId)
  if (!client) throw new Error('CLIENT_NOT_FOUND')
  if (
    !client.interactionHistory ||
    entryIndex < 0 ||
    entryIndex >= client.interactionHistory.length
  ) {
    throw new Error('INTERACTION_ENTRY_NOT_FOUND')
  }
  client.interactionHistory.splice(entryIndex, 1)
}

export function mockGetClientAudit(clientId: string): StockAuditEntry[] {
  const client = STORE.find((c) => c.id === clientId)
  return structuredClone(client?.auditLog ?? [])
}
