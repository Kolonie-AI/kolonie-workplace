import { createApp, h } from 'vue'
import WorkplaceScreen from '@/components/WorkplaceScreen.vue'
import { createMockTaskGateway } from '@/mock/mockTaskGateway'

/**
 * The composition root. This is the one place that knows a mock adapter exists;
 * every component below it sees only the typed TaskGateway.
 */
createApp({
  render: () => h(WorkplaceScreen, { gateway: createMockTaskGateway() }),
}).mount('#app')
