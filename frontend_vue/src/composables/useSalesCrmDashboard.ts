import { ref, onMounted } from 'vue'
import { getOrders } from '@/services/ordersService'
import { getClients } from '@/services/clientsService'
import type { OrderListItem } from '@/types/order'
import type { Client } from '@/types/client'

export function useSalesCrmDashboard() {
  const recentOrders = ref<OrderListItem[]>([])
  const recentClients = ref<Client[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeOrdersCount = ref(0)
  const pendingOrdersCount = ref(0)
  const newClientsThisMonth = ref(0)
  const totalSalesMtd = ref(0)

  async function load() {
    loading.value = true
    error.value = null

    try {
      const now = new Date()
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      // Fetch orders (up to 100 for accurate KPI counts) + clients
      const [ordersResult, clientsResult] = await Promise.all([
        getOrders(
          { search: '', status: 'all', clientId: null, dateFrom: '', dateTo: '', sortBy: null, sortDir: 'asc' },
          { page: 1, pageSize: 100 },
        ),
        getClients({ search: '', status: null, sortBy: null, sortDir: 'asc' }),
      ])

      const allOrders = ordersResult.items
      const allClients = clientsResult.items

      // Recent 5 orders for the widget
      recentOrders.value = allOrders.slice(0, 5)

      // Recent 5 clients sorted by createdAt DESC
      const sorted = [...allClients].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      recentClients.value = sorted.slice(0, 5)

      // ── Compute KPIs from orders ──
      activeOrdersCount.value = allOrders.filter(
        (o: OrderListItem) => o.status !== 'delivered' && o.status !== 'cancelled',
      ).length

      pendingOrdersCount.value = allOrders.filter(
        (o: OrderListItem) => o.status === 'new' || o.status === 'confirmed',
      ).length

      totalSalesMtd.value = allOrders
        .filter(
          (o: OrderListItem) =>
            (o.status === 'confirmed' ||
              o.status === 'shipped' ||
              o.status === 'delivered') &&
            new Date(o.createdAt) >= thisMonthStart,
        )
        .reduce((sum: number, o: OrderListItem) => sum + o.totalAmount, 0)

      // ── Compute KPIs from clients ──
      newClientsThisMonth.value = allClients.filter(
        (c: Client) => new Date(c.createdAt) >= thisMonthStart,
      ).length
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  return {
    recentOrders,
    recentClients,
    loading,
    error,
    activeOrdersCount,
    pendingOrdersCount,
    newClientsThisMonth,
    totalSalesMtd,
    load,
  }
}
