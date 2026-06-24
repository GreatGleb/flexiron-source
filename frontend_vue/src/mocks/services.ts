import type { Service } from '@/types/service'

export const mockServices: Service[] = [
  {
    id: 'svc-001',
    name: { ru: 'Резка металла', en: 'Metal cutting', lt: 'Metalo pjovimas' },
    costPrice: 5.0,
    sellingPrice: 12.0,
    priceUnit: 'EUR/m',
    description: {
      ru: 'Резка листового металла любой сложности',
      en: 'Cutting of sheet metal of any complexity',
      lt: 'Bet kokio sudėtingumo lakštinio metalo pjovimas',
    },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'svc-002',
    name: { ru: 'Доставка', en: 'Delivery', lt: 'Pristatymas' },
    costPrice: 10.0,
    sellingPrice: 25.0,
    priceUnit: 'EUR/vnt',
    description: {
      ru: 'Доставка по городу и области',
      en: 'Delivery within the city and region',
      lt: 'Pristatymas mieste ir regione',
    },
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 'svc-003',
    name: { ru: 'Упаковка', en: 'Packaging', lt: 'Pakavimas' },
    costPrice: 2.0,
    sellingPrice: 5.0,
    priceUnit: 'EUR/vnt',
    description: {
      ru: 'Упаковка готовой продукции',
      en: 'Packaging of finished products',
      lt: 'Gatavos produkcijos pakavimas',
    },
    createdAt: '2025-01-03T00:00:00Z',
    updatedAt: '2025-01-03T00:00:00Z',
  },
  {
    id: 'svc-004',
    name: { ru: 'Гибка металла', en: 'Metal bending', lt: 'Metalo lenkimas' },
    costPrice: 8.0,
    sellingPrice: 18.0,
    priceUnit: 'EUR/m',
    description: {
      ru: 'Гибка листового металла под любым углом',
      en: 'Bending of sheet metal at any angle',
      lt: 'Lakštinio metalo lenkimas bet kokiu kampu',
    },
    createdAt: '2025-01-04T00:00:00Z',
    updatedAt: '2025-01-04T00:00:00Z',
  },
  {
    id: 'svc-005',
    name: { ru: 'Сварка', en: 'Welding', lt: 'Suvirinimas' },
    costPrice: 15.0,
    sellingPrice: 35.0,
    priceUnit: 'EUR/h',
    description: {
      ru: 'Сварочные работы любой сложности',
      en: 'Welding work of any complexity',
      lt: 'Bet kokio sudėtingumo suvirinimo darbai',
    },
    createdAt: '2025-01-05T00:00:00Z',
    updatedAt: '2025-01-05T00:00:00Z',
  },
]
