import * as React from 'react'
import * as Enzyme from 'enzyme'
import * as Adapter from 'enzyme-adapter-react-16'
import * as O from 'fp-ts/lib/Option'
import { flow, identity } from 'fp-ts/lib/function'
import { pipe } from 'fp-ts/lib/pipeable'
import { NEVER, Subject } from 'rxjs'
import * as Rx from 'rxjs/operators'
import { F } from '@grammarly/focal'
import { UI } from '../src/ui'
import { assertNever } from './utils'

Enzyme.configure({ adapter: new Adapter() })

describe('union of', () => {
  let renderCount = 0 // to ensure that we do not do unnecessary react rerenders
  jest.spyOn(console, 'error').mockImplementation()

  beforeEach(() => (renderCount = 0))

  afterEach(() => {
    expect(console.error).not.toHaveBeenCalled()
  })

  it('works with generic union', () => {
    const comp = UI.Union.make('kind', {
      one: CompOne,
      two: CompTwo,
      three: CompThree
    })

    const res = UI.mount(comp, flow(Rx.scan(unionReducer, init), Rx.startWith(init)))

    const w = Enzyme.mount(res)

    expect(w.html()).toBe('<div name="third" data-render="0">10+20</div>')
    w.simulate('mouseEnter')

    expect(w.html()).toBe('<div name="third" data-render="0">20+40</div>')
    w.simulate('click')

    expect(w.html()).toBe('<div name="second" data-render="1">2040</div>')
    w.simulate('click')

    expect(w.html()).toBe('<div name="one" data-render="2">I am number one!</div>')
  })

  it('works with patched generic union', () => {
    const comp = pipe(
      UI.Union.make('kind', {
        one: CompOne,
        two: CompTwo,
        three: CompThree
      }),
      UI.patch('three')(identity)
    )

    const res = UI.mount(comp, flow(Rx.scan(unionReducer, init), Rx.startWith(init)))

    const w = Enzyme.mount(res)

    expect(w.html()).toBe('<div name="third" data-render="0">10+20</div>')
    w.simulate('mouseEnter')

    expect(w.html()).toBe('<div name="third" data-render="0">20+40</div>')
    w.simulate('click')

    expect(w.html()).toBe('<div name="second" data-render="1">2040</div>')
    w.simulate('click')

    expect(w.html()).toBe('<div name="one" data-render="2">I am number one!</div>')
  })

  it('works with group patched into generic union', () => {
    const comp = pipe(
      UI.Group.make({
        one: CompOne,
        two: CompTwo,
        three: CompThree
      }),
      UI.patch()(group => UI.Union.make('kind', group.children))
    )

    const res = UI.mount(comp, flow(Rx.scan(unionReducer, init), Rx.startWith(init)))

    const w = Enzyme.mount(res)

    expect(w.html()).toBe('<div name="third" data-render="0">10+20</div>')
    w.simulate('mouseEnter')

    expect(w.html()).toBe('<div name="third" data-render="0">20+40</div>')
    w.simulate('click')

    expect(w.html()).toBe('<div name="second" data-render="1">2040</div>')
    w.simulate('click')

    expect(w.html()).toBe('<div name="one" data-render="2">I am number one!</div>')
  })

  it('works with generic union patched into group', () => {
    const comp = pipe(
      UI.Union.make('kind', {
        one: CompOne,
        two: CompTwo,
        three: CompThree
      }),
      UI.patch()(union => UI.Group.make(union.members))
    )

    const initial: UI.ComposedState<typeof comp> = {
      two: { value: 'start' },
      three: { left: 10, right: 20 }
    }

    const res = (
      <div>{UI.mount(comp, flow(Rx.scan(stateReducer, initial), Rx.startWith(initial)))}</div>
    )

    const w = Enzyme.mount(res)

    expect(w.html()).toBe(
      '<div><div name="one" data-render="0">I am number one!</div><div name="third" data-render="1">10+20</div><div name="second" data-render="2">start</div></div>'
    )

    w.find('[name="third"]')
      .hostNodes()
      .forEach(el => el.simulate('mouseEnter'))
    expect(w.html()).toBe(
      '<div><div name="one" data-render="0">I am number one!</div><div name="third" data-render="1">20+40</div><div name="second" data-render="2">start</div></div>'
    )

    w.find('[name="third"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))
    expect(w.html()).toBe(
      '<div><div name="one" data-render="0">I am number one!</div><div name="third" data-render="1">20+40</div><div name="second" data-render="2">2040</div></div>'
    )

    w.find('[name="second"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))
    expect(w.html()).toBe(
      '<div><div name="one" data-render="0">I am number one!</div><div name="third" data-render="1">20+40</div><div name="second" data-render="2">2040</div></div>'
    )
  })

  describe('asOption ', () => {
    it('works with O.some', () => {
      const comp = UI.Union.asOption(BasicNode)

      const res = UI.mount(comp, Rx.startWith(O.some({} as never)))

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<p>I am rendered!</p>')
    })

    it('works with O.none', () => {
      const comp = UI.Union.asOption(BasicNode)

      const res = UI.mount(comp, Rx.startWith(O.none))

      const w = Enzyme.mount(res)

      expect(w.html()).toBeNull()
    })

    it('works with O.some of state node', () => {
      const comp = UI.Union.asOption(CompTwo)
      const i = new Subject()

      const res = UI.mount(
        comp,
        flow(
          Rx.switchMapTo(NEVER),
          Rx.merge(
            i.pipe(Rx.map((_, i) => (i % 2 === 0 ? O.none : O.some({ value: `work${i}` }))))
          ),
          Rx.startWith(O.some({ value: 'init' }))
        )
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<div name="second" data-render="0">init</div>')

      i.next()
      expect(w.html()).toBe(null)

      i.next()
      expect(w.html()).toBe('<div name="second" data-render="1">work1</div>')

      i.next()
      expect(w.html()).toBe(null)

      i.next()
      expect(w.html()).toBe('<div name="second" data-render="2">work3</div>')
    })
  })

  const BasicNode = UI.Node.make(() => <p>I am rendered!</p>)

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

  interface Knot {
    two: State1
    three: State2
  }

  function stateReducer(
    res: Knot,
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
  ): Knot {
    switch (a.action) {
      case 'toOne':
        return res
      case 'toTwo':
        return {
          ...res,
          two: { value: String(res.three.left) + String(res.three.right) }
        }
      case 'inc':
        return {
          ...res,
          three: { left: res.three.left + 10, right: res.three.right * 2 }
        }
      default:
        return assertNever(a)
    }
  }
})
