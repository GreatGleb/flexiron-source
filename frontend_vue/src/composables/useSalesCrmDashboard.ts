import { ref, onMounted } from 'vue'
import { getOrders, getSalesCrmStats } from '@/services/ordersService'
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
      // The KPIs are asked for, not derived here: they count every order and
      // every client there is, and this page only ever holds the five it shows.
      // Deriving them from a page of the list made them stop moving as soon as
      // the store outgrew the page — silently, which is the worst way for a
      // number to be wrong.
      //
      // The two widgets ask for exactly what they display, newest first.
      const [stats, ordersResult, clientsResult] = await Promise.all([
        getSalesCrmStats(),
        getOrders(
          {
            search: '',
            status: 'all',
            clientId: null,
            dateFrom: '',
            dateTo: '',
            sortBy: 'createdAt',
            sortDir: 'desc',
          },
          { page: 1, pageSize: 5 },
        ),
        getClients({
          search: '',
          status: null,
          sortBy: 'createdAt',
          sortDir: 'desc',
          page: 1,
          pageSize: 5,
        }),
      ])

      recentOrders.value = ordersResult.items
      recentClients.value = clientsResult.items

      activeOrdersCount.value = stats.activeOrders
      pendingOrdersCount.value = stats.pendingOrders
      // Net on purpose: VAT is not revenue. `totalWithVat` on the orders list is
      // what the client pays, and that is the list's business, not a sales KPI's.
      totalSalesMtd.value = stats.salesMtd
      newClientsThisMonth.value = stats.newClientsThisMonth
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
