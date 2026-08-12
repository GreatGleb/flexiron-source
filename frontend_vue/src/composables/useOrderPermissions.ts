import { computed } from 'vue'
import { useSettings } from '@/composables/useSettings'

/**
 * The three rights the pricing model puts on an order (model section 12).
 *
 * Read from the settings, against the role of the user who is signed in. Not a
 * feature flag: a flag says whether the system has a capability at all, a right
 * says whether this person may use it — and the answer differs per user on the
 * same build.
 *
 * `ready` is here because the rights arrive from the server a moment after the
 * page does, and "not yet" is not "no". Anything that HIDES on a denied right has
 * to wait for `ready`, or it renders once without the cost columns and again with
 * them — a visible flicker, and under load a test that catches the first frame.
 *
 * IMPORTANT, and written down in the backend contract: hiding the cost in the UI
 * is a curtain, not a right. The server must not send cost and margin to a user
 * who may not see them. The card recomputes prices from cost, so a server that
 * strips them has to send the computed price instead, and the card has to stop
 * recomputing for that user — see `plans/orders-backend-contract.md`, section 5.
 */
export function useOrderPermissions() {
  const { settings, settled } = useSettings()

  const role = computed(() => settings.profile.role)

  const canSeeCost = computed(() => settings.orderPermissions.seeCost.includes(role.value))
  const canSetManualCost = computed(() => settings.orderPermissions.manualCost.includes(role.value))
  const canCorrect = computed(() => settings.orderPermissions.correction.includes(role.value))

  return { ready: settled, role, canSeeCost, canSetManualCost, canCorrect }
}
