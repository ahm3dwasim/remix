import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getCurrentComponentForHmr, registerComponentForHmr } from './server-runtime.ts'

describe('server component HMR runtime', () => {
  it('returns the latest registered component implementation', () => {
    function first() {
      return () => 'first'
    }
    function second() {
      return () => 'second'
    }

    registerComponentForHmr('/app/component.tsx', 'Component', first)
    registerComponentForHmr('/app/component.tsx', 'Component', second)

    assert.equal(getCurrentComponentForHmr('/app/component.tsx', 'Component'), second)
  })

  it('keeps the first registered wrapper as the stable component identity', () => {
    function impl1() {
      return () => 'one'
    }
    function impl2() {
      return () => 'two'
    }
    function wrapper1() {}
    function wrapper2() {}

    assert.equal(registerComponentForHmr('/app/stable.tsx', 'Stable', impl1, wrapper1), wrapper1)
    assert.equal(registerComponentForHmr('/app/stable.tsx', 'Stable', impl2, wrapper2), wrapper1)
    assert.equal(getCurrentComponentForHmr('/app/stable.tsx', 'Stable'), impl2)
  })

  it('throws when a component has not been registered', () => {
    assert.throws(
      () => getCurrentComponentForHmr('/app/missing.tsx', 'Missing'),
      /Missing HMR component registration for \/app\/missing\.tsx:Missing/,
    )
  })
})
