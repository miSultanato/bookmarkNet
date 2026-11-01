import test from 'brittle'
import { version } from '../src/index.ts'

test('smoke', (t) => {
  t.is(version, '0.2.0')
})
