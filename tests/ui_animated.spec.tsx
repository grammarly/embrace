import * as React from 'react'
import * as Enzyme from 'enzyme'
import * as Adapter from 'enzyme-adapter-react-16'
import * as O from 'fp-ts/lib/Option'
import * as TH from 'fp-ts/lib/These'
import { flow } from 'fp-ts/lib/function'
import * as Rx from 'rxjs/operators'
import { F } from '@grammarly/focal'
import { Flow, UI } from '../src/index'
import { assertNever } from './utils'

Enzyme.configure({ adapter: new Adapter() })

describe('UI.Animated', () => {
  let renderCount = 0 // to ensure that we do not do unnecessary react rerenders

  describe('animated on generic union', () => {
    let w: Enzyme.ReactWrapper

    beforeAll(() => {
      renderCount = 0

      const comp = UI.Union.make('kind', {
        one: CompOne,
        two: CompTwo,
        three: CompThree
      })

      const transition = UI.Transition.make(
        {
          fadein: 'fadein-animation'
        },
        {
          fadeout: 'fadeout-animation'
        }
      )

      const animated = UI.Animated.make(transition, comp)

      const anima: Flow.AnimationDecisionFor<typeof animated> = (prev, next) =>
        prev._tag === 'Some' && prev.value.kind !== next.kind
          ? O.some(TH.both('fadeout', 'fadein'))
          : O.none

      const res = (
        <div>
          {UI.mount(
            animated,
            Flow.animatingFlow(flow(Rx.scan(unionReducer, init), Rx.startWith(init)), anima)
          )}
        </div>
      )
      w = Enzyme.mount(res)
    })

    afterAll(() => {
      w.unmount()
    })

    it('mount works', () => {
      expect(w.html()).toBe(
        '<div><div data-purpose="animation-wrapper"><div name="third" data-render="0">10+20</div></div></div>'
      )
    })

    it('update state does not trigger animation', () => {
      w.find('[name="third"]')
        .hostNodes()
        .forEach(el => el.simulate('mouseEnter'))

      expect(w.html()).toBe(
        '<div><div data-purpose="animation-wrapper"><div name="third" data-render="0">20+40</div></div></div>'
      )
    })

    it('update state does trigger animation', () => {
      w.find('[name="third"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div data-purpose="animation-wrapper" class="fadeout-animation"><div name="third" data-render="0">20+40</div></div>' +
          '<div data-purpose="animation-wrapper" class="fadein-animation"><div name="second" data-render="1">2040</div></div></div>'
      )
    })

    it('animation end on next state should remove dom tree', async () => {
      w.find('.fadeout-animation').simulate('animationEnd')

      await delay(100)

      expect(w.html()).toBe(
        '<div><div data-purpose="animation-wrapper" class="fadein-animation"><div name="second" data-render="1">2040</div></div></div>'
      )
    })

    it('animation end on next state should remove classname', async () => {
      w.find('.fadein-animation').simulate('animationEnd')

      await delay(100)

      expect(w.html()).toBe(
        '<div><div data-purpose="animation-wrapper"><div name="second" data-render="1">2040</div></div></div>'
      )
    })

    it('state change does trigger animation once again', () => {
      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div data-purpose="animation-wrapper" class="fadeout-animation"><div name="second" data-render="1">2040</div></div>' +
          '<div data-purpose="animation-wrapper" class="fadein-animation"><div name="one" data-render="2">I am number one!</div></div></div>'
      )
    })
  })

  interface State1 {
    value: string
  }

  interface State2 {
    left: number
    right: number
  }

  interface One {
    kind: 'one'
  }

  interface Two extends State1 {
    kind: 'two'
  }

  interface Three extends State2 {
    kind: 'three'
  }

  type Union = One | Two | Three

  const CompOne = UI.Node.make(() => (
    <F.div name="one" data-render={renderCount++}>
      I am number one!
    </F.div>
  ))

  const CompTwo = UI.Node.make<State1, 'toOne'>(({ view, notify }) => (
    <F.div name="second" onClick={notify('toOne')} data-render={renderCount++}>
      {view('value')}
    </F.div>
  ))

  const CompThree = UI.Node.make<State2, 'toTwo' | 'inc'>(({ view, notify }) => (
    <F.div
      name="third"
      onClick={notify('toTwo')}
      onMouseEnter={notify('inc')}
      data-render={renderCount++}
    >
      {view('left')}+{view('right')}
    </F.div>
  ))

  const init: Union = { kind: 'three', left: 10, right: 20 }

  function unionReducer(
    res: Union,
    a:
      | {
          key: 'two'
          action: 'toOne'
        }
      | {
          key: 'three'
          action: 'toTwo'
        }
      | {
          key: 'three'
          action: 'inc'
        }
  ): Union {
    switch (a.action) {
      case 'toOne':
        return { kind: 'one' }
      case 'toTwo':
        return {
          kind: 'two',
          value: res.kind === 'three' ? String(res.left) + String(res.right) : 'empty'
        }
      case 'inc':
        return res.kind === 'three'
          ? { kind: 'three', left: res.left + 10, right: res.right * 2 }
          : res
      default:
        return assertNever(a)
    }
  }

  const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms))
})
