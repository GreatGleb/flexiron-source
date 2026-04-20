import { computed, type ComputedRef } from 'vue'
import { featureFlags } from '@/config/featureFlags'
import type { FeatureFlagKey } from '@/types/features'

export function useFeatureFlag(flag: FeatureFlagKey): ComputedRef<boolean> {
  return computed(() => featureFlags[flag] ?? false)
}
