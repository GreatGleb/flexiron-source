/**
 * Service-layer smoke test.
 *
 * The mock router throws "[mock] VERB path not found" when nothing matches, so
 * calling every function through the real service layer proves that each path
 * string and its route regex agree. Testing the mock functions directly cannot
 * catch a mismatch here, and neither can reading the two lists side by side.
 */
import { describe, it, expect } from 'vitest'
import {
  createOrder,
  getOrder,
  getOrders,
  patchOrder,
  patchOrderStatus,
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
  addOrderService,
  updateOrderService,
  deleteOrderService,
  allocateOrderTotal,
  splitOrderItem,
  planOrderShipment,
  planOrderStatus,
  getOrderShipments,
  createOrderShipment,
  cancelOrderShipment,
  reserveOrderStock,
  getOrderReservations,
  getOrderPayments,
  addOrderPayment,
  deleteOrderPayment,
  getOrderInvoices,
  createOrderInvoice,
  deleteOrder,
  addOrderFile,
  removeOrderFile,
  deleteOrderAuditEntry,
} from './ordersService'
import { mockGetClients } from './mocks/clients'
import { round2, round4 } from '@/domain/orderPricing'

const TIMEOUT = { timeout: 60_000 }

describe('every order endpoint is reachable through the service layer', () => {
  it('walks the whole surface without a single unmatched route', TIMEOUT, async () => {
    const client = mockGetClients()[0]!
    const order = await createOrder({ clientId: client.id, documentType: 'local' })

    // ── Reads ──
    expect(
      (
        await getOrders(
          {
            search: '',
            status: 'all',
            clientId: null,
            dateFrom: '',
            dateTo: '',
            sortBy: null,
            sortDir: 'asc',
          },
          { page: 1, pageSize: 5 },
        )
      ).items.length,
    ).toBeGreaterThan(0)
    expect((await getOrder(order.id)).id).toBe(order.id)

    // ── Lines ──
    const item = await addOrderItem(order.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
    })
    expect(
      (await updateOrderItem(order.id, item.id, { manualUnitPrice: 108 })).discountPercent,
    ).toBe(10)

    // Every kind of line edit, through the wire format the card actually sends —
    // `lineTotal` and `resetPrice` are edits, not fields, and only exist here.
    //
    // The cost comes off the warehouse, so it is read from the line rather than
    // assumed: a test that hardcodes it would only be testing the mock data.
    const unitCost = item.unitCost
    expect((await updateOrderItem(order.id, item.id, { resetPrice: true })).unitPrice).toBe(120)

    // Cutting the line total to 900 over 10 units is a price of 90 against a
    // computed 120 — a 25% discount, which is what the client sees on paper.
    const cut = await updateOrderItem(order.id, item.id, { lineTotal: 900 })
    expect([cut.unitPrice, cut.discountPercent]).toEqual([90, 25])

    // A margin edit changes the markup and LEAVES THE DISCOUNT STANDING (model
    // section 4): the 25% was agreed with the client and is not the markup's to
    // withdraw. So the price is cost × 1.5 × 0.75, not cost × 1.5 — and the
    // discount column on the card says so. Only "reset to computed" clears it.
    const remargined = await updateOrderItem(order.id, item.id, { marginPercent: 50 })
    expect(remargined.discountPercent).toBe(25)
    expect(remargined.unitPrice).toBe(round4(unitCost * 1.5 * 0.75))

    expect((await updateOrderItem(order.id, item.id, { quantity: 8 })).totalPrice).toBe(
      round2(unitCost * 1.5 * 0.75 * 8),
    )
    // Back to ten, so the shipment and the split further down still describe the
    // line this walk started with.
    await updateOrderItem(order.id, item.id, { quantity: 10 })
    const manual = await updateOrderItem(order.id, item.id, {
      manualUnitCost: 100,
      manualCostReason: 'Supplier invoice',
    })
    expect([manual.unitCost, manual.costSource]).toEqual([100, 'manual'])

    const svc = await addOrderService(order.id, { serviceId: 'svc-001', quantity: 1, price: 12 })
    expect((await updateOrderService(order.id, svc.id, { discountPercent: 10 })).price).toBe(10.8)
    expect((await updateOrderService(order.id, svc.id, { unitCost: 6 })).cost).toBe(6)

    // ── Order-level ──
    expect((await patchOrder(order.id, { notes: 'via service' })).notes).toBe('via service')
    expect((await patchOrderStatus(order.id, 'confirmed')).status).toBe('confirmed')
    expect((await allocateOrderTotal(order.id, 1210)).achievedGross).toBe(1210)

    // ── Warehouse side ──
    // The two read-only planners as well: a path string that no longer matches
    // its route only shows up when something actually calls it.
    expect((await planOrderStatus(order.id, 'shipped')).status).toBe('shipped')
    expect(Array.isArray(await planOrderShipment(order.id))).toBe(true)

    await reserveOrderStock(order.id)
    expect(Array.isArray(await getOrderReservations(order.id))).toBe(true)

    const shipment = await createOrderShipment(order.id, {
      lines: [{ lineId: item.id, quantity: 6 }],
    })
    expect((await getOrderShipments(order.id)).length).toBe(1)

    const split = await splitOrderItem(order.id, item.id, 6)
    expect(split.remainder.quantity).toBe(4)

    // ── Documents and money ──
    const invoice = await createOrderInvoice(order.id, { shipmentId: shipment.id })
    expect((await getOrderInvoices(order.id))[0]!.id).toBe(invoice.id)

    // An advance invoice covers no delivery, and its amount is stated as gross —
    // what the client is asked to pay. The server does the VAT.
    const advance = await createOrderInvoice(order.id, { kind: 'advance', amountGross: 121 })
    expect([advance.amountNet, advance.shipmentId]).toEqual([100, null])

    const payment = await addOrderPayment(order.id, { amount: 100, purpose: 'advance' })
    expect((await getOrderPayments(order.id)).length).toBe(1)
    await deleteOrderPayment(order.id, payment.id)
    expect((await getOrderPayments(order.id)).length).toBe(0)

    // Cancelling the INVOICED shipment is refused while there is nothing to say
    // for itself — the client holds a document for it, and a document is
    // corrected, never silently withdrawn.
    await expect(cancelOrderShipment(order.id, shipment.id)).rejects.toThrow(
      'SHIPMENT_ALREADY_INVOICED',
    )
    const second = await createOrderShipment(order.id, {
      lines: [{ lineId: split.remainder.id, quantity: 4 }],
    })
    expect((await cancelOrderShipment(order.id, second.id)).cancelled).toBe(true)

    // With a reason it goes through: the correcting invoice and the return of the
    // goods are one operation, so the document and the warehouse cannot disagree.
    expect(
      (await cancelOrderShipment(order.id, shipment.id, { correctionReason: 'Client refused' }))
        .cancelled,
    ).toBe(true)
    const corrections = (await getOrderInvoices(order.id)).filter((i) => i.kind === 'correction')
    expect([corrections.length, corrections[0]!.correctsInvoiceId]).toEqual([1, invoice.id])

    // ── Files and history ──
    await addOrderFile(order.id, 'file-1')
    expect((await getOrder(order.id)).files.length).toBe(1)
    await removeOrderFile(order.id, 'file-1')
    expect((await getOrder(order.id)).files.length).toBe(0)
    await deleteOrderAuditEntry(order.id, 0)

    // ── Deletes ──
    await deleteOrderService(order.id, svc.id)
    await deleteOrderItem(order.id, split.remainder.id)
    const finished = await getOrder(order.id)
    expect(finished.services.length).toBe(0)
    expect(finished.items.map((i) => i.id)).not.toContain(split.remainder.id)

    // This order is not deletable and should not be: the advance invoice above is
    // still live, and dropping the order would leave the client holding a document
    // for something the system has forgotten. The refusal names the blocker.
    await expect(deleteOrder(order.id)).rejects.toThrow('ORDER_HAS_INVOICE')
    expect((await getOrder(order.id)).id).toBe(order.id)

    // The endpoint itself works — on an order that has nothing outstanding.
    const spare = await createOrder({ clientId: client.id, documentType: 'local' })
    await deleteOrder(spare.id)
    await expect(getOrder(spare.id)).resolves.toBeUndefined()
  })
})
