import test from 'brittle'
import { emptyState } from '../src/fold.ts'

test('fold module loads', (t) => {
  const state = emptyState()
  t.is(state.collection, null)
})
