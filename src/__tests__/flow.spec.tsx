import * as React from 'react'
import * as Enzyme from 'enzyme'
import * as Adapter from 'enzyme-adapter-react-16'
import * as O from 'fp-ts/lib/Option'
import * as TH from 'fp-ts/lib/These'
import { flow } from 'fp-ts/lib/function'
import { pipe } from 'fp-ts/lib/pipeable'
import { Observable, from as rxFrom, of as rxOf } from 'rxjs'
import { SubscriptionLog } from 'rxjs/internal/testing/SubscriptionLog'
import { TestMessage } from 'rxjs/internal/testing/TestMessage'
import * as Rx from 'rxjs/operators'
import { TestScheduler } from 'rxjs/testing'
import { Atom, F } from '@grammarly/focal'
import { Flow, UI } from '../index'
import { AnimationActions, AnimationState } from '../internal/animated'
import { assertNever } from './utils'

describe('Flow', () => {
  Enzyme.configure({ adapter: new Adapter() })

  let testScheduler: TestScheduler

  beforeEach(() => {
    testScheduler = createTestScheduler((a, e) => expect(a).toEqual(e))
  })

  describe('fromSideEffect', () => {
    it('works with simple value', () => {
      let count = 0

      const comp1 = UI.Node.make<string, 'click'>(({ state, notify }) => (
        <F.div onClick={notify('click')}>{state}</F.div>
      ))

      const comp1flow = Flow.fromSideEffect(() => count++, 'test')

      const res = UI.mount(comp1, comp1flow)

      const w = Enzyme.mount(res)
      expect(w.html()).toBe('<div>test</div>')

      w.simulate('click')

      expect(count).toBe(1)
    })

    it('works with observable', () => {
      let count = 0

      const comp1 = UI.Node.make<string, 'click'>(({ state, notify }) => (
        <F.div onClick={notify('click')}>{state}</F.div>
      ))

      const comp1flow = Flow.fromSideEffect(
        () => count++,
        rxFrom([1, 2, 3]).pipe(Rx.map(x => `test${x}`))
      )

      const res = UI.mount(comp1, comp1flow)

      const w = Enzyme.mount(res)
      expect(w.html()).toBe('<div>test3</div>')

      w.simulate('click')

      expect(count).toBe(1)
    })

    it('marble test with value', () => {
      let count = 0

      const comp1flow = Flow.fromSideEffect(() => count++, 'test')

      testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const e1 = cold(' -a-b-|', { a: 'one', b: 'two' })
        const expected = 'x-----'
        const subs = '    ^----!'
        const values2 = { x: 'test' }

        expectObservable(e1.pipe(comp1flow)).toBe(expected, values2)
        expectSubscriptions(e1.subscriptions).toBe(subs)
      })

      expect(count).toEqual(2)
    })

    it('marble test with observable', () => {
      let count = 0

      const comp1flow = Flow.fromSideEffect(() => count++, rxOf('test').pipe(Rx.delay(4)))

      testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const e1 = cold(' -a-b-|', { a: 'one', b: 'two' })
        const expected = '----x-'
        const subs = '    ^----!'
        const values2 = { x: 'test' }

        expectObservable(e1.pipe(comp1flow)).toBe(expected, values2)
        expectSubscriptions(e1.subscriptions).toBe(subs)
      })

      expect(count).toEqual(2)
    })
  })

  describe('animatingFlow', () => {
    it('works in simple case', () => {
      const animatedFlow = Flow.animatingFlow(
        (a: Observable<string>) => a,
        () => O.none
      )
      const actions: Record<string, AnimationActions<TestTransition, string>> = {
        a: {
          key: '0',
          action: {
            key: 'children',
            action: 'test'
          }
        }
      }
      const states: Record<string, AnimationState<string, string>> = {
        x: {
          '0': {
            root: O.none,
            children: 'test'
          }
        }
      }

      testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const e1 = cold(' -a---|', actions)
        const expected = '-x---|'
        const subs = '    ^----!'

        expectObservable(pipe(e1, animatedFlow)).toBe(expected, states)
        expectSubscriptions(e1.subscriptions).toBe(subs)
      })
    })

    // FIXME (DN-5768): fix the issue and unskip.
    it.skip('prev state transition should be unmounted later if the state is changed and animation decision is none', () => {
      const states: Record<string, AnimationState<string, string>> = {
        w: {
          '1': {
            root: O.some('in'),
            children: 'a'
          }
        },
        x: {
          '1': {
            root: O.some('out'),
            children: 'a'
          },
          '2': {
            root: O.some('in'),
            children: 'b'
          }
        },
        y: {
          '1': {
            root: O.some('out'),
            children: 'a'
          },
          '2': {
            root: O.some('in'),
            children: 'c'
          }
        },
        z: {
          '2': {
            root: O.none,
            children: 'c'
          }
        }
      }

      const originalStates = {
        a: 'a',
        b: 'b',
        c: 'c'
      }

      testScheduler.run(({ hot, cold, expectObservable }) => {
        const originalState = hot('a-b-c-|', originalStates)
        const e1 = cold<AnimationActions<TestTransition, string>>('')
        const expected = `         w-x-y${'-'.repeat(499)}z-|`
        const animatedFlow = Flow.animatingFlow(
          () => originalState,
          (_, next) => (next === 'c' ? O.none : O.some(TH.both('out', 'in')))
        )
        expectObservable(pipe(e1, animatedFlow)).toBe(expected, states)
      })
    })

    it('prev state should be unmounted even if animation does not ends', () => {
      const animatedFlow = Flow.animatingFlow(Rx.startWith('test'), (a, b) =>
        O.isSome(a) && a.value !== b ? O.some(TH.both('out', 'in')) : O.none
      )
      const actions: Record<string, AnimationActions<TestTransition, string>> = {
        a: {
          key: '0',
          action: {
            key: 'children',
            action: 'test2'
          }
        },
        b: {
          key: '1',
          action: {
            key: 'root',
            action: {
              kind: 'end',
              animationType: 'in'
            }
          }
        }
      }
      const states: Record<string, AnimationState<string, string>> = {
        x: {
          '0': {
            root: O.none,
            children: 'test'
          }
        },
        y: {
          '0': {
            root: O.some('out'),
            children: 'test'
          },
          '1': {
            root: O.some('in'),
            children: 'test2'
          }
        },
        u: {
          '0': {
            root: O.some('out'),
            children: 'test'
          },
          '1': {
            root: O.none,
            children: 'test2'
          }
        },
        z: {
          '1': {
            root: O.none,
            children: 'test2'
          }
        }
      }

      testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const e1 = cold(' --a-                   b                 ----| ', actions)
        const expected = `x-y-${'-'.repeat(100)} u ${'-'.repeat(397)}(z|)`
        const subs = '    ^---                   -                 ----! '

        expectObservable(pipe(e1, animatedFlow)).toBe(expected, states)
        expectSubscriptions(e1.subscriptions).toBe(subs)
      })
    })

    it('next state transition should be unmounted even if animation does not ends', () => {
      const animatedFlow = Flow.animatingFlow(Rx.startWith('test'), (a, b) =>
        O.isSome(a) && a.value !== b ? O.some(TH.both('out', 'in')) : O.none
      )
      const actions: Record<string, AnimationActions<TestTransition, string>> = {
        a: {
          key: '0',
          action: {
            key: 'children',
            action: 'test2'
          }
        },
        b: {
          key: '0',
          action: {
            key: 'root',
            action: {
              kind: 'end',
              animationType: 'out'
            }
          }
        }
      }
      const states: Record<string, AnimationState<string, string>> = {
        x: {
          '0': {
            root: O.none,
            children: 'test'
          }
        },
        y: {
          '0': {
            root: O.some('out'),
            children: 'test'
          },
          '1': {
            root: O.some('in'),
            children: 'test2'
          }
        },
        u: {
          '1': {
            root: O.some('in'),
            children: 'test2'
          }
        },
        z: {
          '1': {
            root: O.none,
            children: 'test2'
          }
        }
      }

      testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const e1 = cold(' --a-                   b                 ----| ', actions)
        const expected = `x-y-${'-'.repeat(100)} u ${'-'.repeat(397)}(z|)`
        const subs = '    ^---                   -                 ----! '

        expectObservable(pipe(e1, animatedFlow)).toBe(expected, states)
        expectSubscriptions(e1.subscriptions).toBe(subs)
      })
    })

    it('prev state transition should be unmounted later if animation start was emited', () => {
      const animatedFlow = Flow.animatingFlow(Rx.startWith('test'), (a, b) =>
        O.isSome(a) && a.value !== b ? O.some(TH.both('out', 'in')) : O.none
      )
      const actions: Record<string, AnimationActions<TestTransition, string>> = {
        a: {
          key: '0',
          action: {
            key: 'children',
            action: 'test2'
          }
        },
        b: {
          key: '0',
          action: {
            key: 'root',
            action: {
              kind: 'start',
              animationType: 'out'
            }
          }
        },
        c: {
          key: '1',
          action: {
            key: 'root',
            action: {
              kind: 'end',
              animationType: 'in'
            }
          }
        }
      }
      const states: Record<string, AnimationState<string, string>> = {
        x: {
          '0': {
            root: O.none,
            children: 'test'
          }
        },
        y: {
          '0': {
            root: O.some('out'),
            children: 'test'
          },
          '1': {
            root: O.some('in'),
            children: 'test2'
          }
        },
        u: {
          '0': {
            root: O.some('out'),
            children: 'test'
          },
          '1': {
            root: O.none,
            children: 'test2'
          }
        },
        z: {
          '1': {
            root: O.none,
            children: 'test2'
          }
        }
      }

      testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const e1 = cold(' --a-                   b                 c---- |', actions)
        const expected = `x-y-${'-'.repeat(100)} -u ${'-'.repeat(4898)}(z|)`
        const subs = '    ^---                   -                 ----- !'

        expectObservable(pipe(e1, animatedFlow)).toBe(expected, states)
        expectSubscriptions(e1.subscriptions).toBe(subs)
      })
    })

    it('ignore incorrect transition events', () => {
      const animatedFlow = Flow.animatingFlow(Rx.startWith('test'), (a, b) =>
        O.isSome(a) && a.value !== b ? O.some(TH.both('out', 'in')) : O.none
      )
      const actions: Record<string, AnimationActions<TestTransition, string>> = {
        a: {
          key: '0',
          action: {
            key: 'children',
            action: 'test2'
          }
        },
        b: {
          key: '1',
          action: {
            key: 'root',
            action: {
              kind: 'end',
              animationType: 'out' // stale transition, should be ignored
            }
          }
        },
        c: {
          key: '1',
          action: {
            key: 'root',
            action: {
              kind: 'end',
              animationType: 'in'
            }
          }
        },
        d: {
          key: '0',
          action: {
            key: 'root',
            action: {
              kind: 'end',
              animationType: 'out'
            }
          }
        }
      }
      const states: Record<string, AnimationState<string, string>> = {
        x: {
          '0': {
            root: O.none,
            children: 'test'
          }
        },
        y: {
          '0': {
            root: O.some('out'),
            children: 'test'
          },
          '1': {
            root: O.some('in'),
            children: 'test2'
          }
        },
        z: {
          '1': {
            root: O.none,
            children: 'test2'
          }
        }
      }

      testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const e1 = cold(` --a-b-${'-'.repeat(200)}-c-d-|`, actions)
        const expected = `x-y---${'-'.repeat(200)}---z-|`
        const subs = `    ^-----${'-'.repeat(200)}-----!`

        expectObservable(pipe(e1, animatedFlow)).toBe(expected, states)
        expectSubscriptions(e1.subscriptions).toBe(subs)
      })
    })

    it('simultaneous prev & next state animation end should emit state change only once', () => {
      const animatedFlow = Flow.animatingFlow(Rx.startWith('test'), (a, b) =>
        O.isSome(a) && a.value !== b ? O.some(TH.both('out', 'in')) : O.none
      )
      const actions: Record<string, AnimationActions<TestTransition, string>> = {
        a: {
          key: '0',
          action: {
            key: 'children',
            action: 'test2'
          }
        },
        b: {
          key: '1',
          action: {
            key: 'root',
            action: {
              kind: 'end',
              animationType: 'in'
            }
          }
        },
        c: {
          key: '0',
          action: {
            key: 'root',
            action: {
              kind: 'end',
              animationType: 'out'
            }
          }
        }
      }
      const states: Record<string, AnimationState<string, string>> = {
        x: {
          '0': {
            root: O.none,
            children: 'test'
          }
        },
        y: {
          '0': {
            root: O.some('out'),
            children: 'test'
          },
          '1': {
            root: O.some('in'),
            children: 'test2'
          }
        },
        z: {
          '1': {
            root: O.none,
            children: 'test2'
          }
        }
      }

      testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const e1 = cold(' --a-b c--| ', actions)
        const expected = 'x-y-- (z |)'
        const subs = '    ^---- ---! '

        expectObservable(pipe(e1, animatedFlow)).toBe(expected, states)
        expectSubscriptions(e1.subscriptions).toBe(subs)
      })
    })

    type TestTransition = 'in' | 'out'
  })

  describe('flow re-usage', () => {
    const comp1 = UI.Node.make<string, 'action1'>(({ state, notify }) => (
      <F.div name="first" onClick={notify('action1')}>
        {state}
      </F.div>
    ))

    const comp2 = UI.Node.make<number, 'action2'>(({ state, notify }) => (
      <F.div name="second" onClick={notify('action2')}>
        {state}
      </F.div>
    ))

    const comp3 = UI.Node.make<string, 'action3'>(({ state, notify }) => (
      <F.div name="third" onClick={notify('action3')}>
        {state}
      </F.div>
    ))

    const grid = UI.Grid.make<'comp1' | 'comp2', never, never>(({ slots }) => (
      <div>
        {slots.comp1}
        {slots.comp2}
      </div>
    ))

    const knot = UI.Knot.make(grid, { comp1, comp2 })

    const defaultState = { comp1: 'begin', comp2: 42 }

    it('re-use flow for patched component, keep actions, change state', () => {
      let actionsCount = 0

      const defaultFlow: Flow.For<typeof knot> = flow(
        Rx.tap(() => actionsCount++),
        Rx.mapTo(defaultState),
        Rx.startWith(defaultState)
      )

      const patchedKnot = pipe(
        knot,
        UI.patch('comp2')(() => knot)
      )

      const patchedFlow: Flow.For<typeof patchedKnot> = pipe(
        defaultFlow,
        Flow.patchState(
          Rx.map(defaultState => ({
            comp1: defaultState.comp1,
            comp2: { comp1: 'hello', comp2: defaultState.comp2 }
          }))
        )
      )

      const res = UI.mount(patchedKnot, patchedFlow)

      const w = Enzyme.mount(res)
      expect(w.html()).toBe(
        '<div><div name="first">begin</div><div><div name="first">hello</div><div name="second">42</div></div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(actionsCount).toBe(2)
    })

    it('re-use flow for patched component, change actions, keep state', () => {
      let defaultActionsCount = 0
      let patchedActionsCount = 0

      const defaultFlow: Flow.For<typeof knot> = flow(
        Rx.tap(() => defaultActionsCount++),
        Rx.mapTo(defaultState),
        Rx.startWith(defaultState)
      )

      const patchedKnot = pipe(
        knot,
        UI.patch('comp1')(() => comp3)
      )

      const patchedFlow: Flow.For<typeof patchedKnot> = pipe(
        defaultFlow,
        Flow.replaceActions(Rx.tap(() => patchedActionsCount++))
      )

      const res = UI.mount(patchedKnot, patchedFlow)

      const w = Enzyme.mount(res)
      expect(w.html()).toBe('<div><div name="third">begin</div><div name="second">42</div></div>')

      w.find('[name="third"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(defaultActionsCount).toBe(0)
      expect(patchedActionsCount).toBe(1)
    })

    it('re-use flow for patched component, add action handler, change state', () => {
      let defaultActionsCount = 0
      let patchedActionsCount = 0

      const defaultFlow: Flow.For<typeof knot> = flow(
        Rx.tap(() => defaultActionsCount++),
        Rx.mapTo(defaultState),
        Rx.startWith(defaultState)
      )

      const patchedKnot = pipe(
        knot,
        UI.patch('comp1')(() => comp3)
      )

      const patchedFlow: Flow.For<typeof patchedKnot> = pipe(
        defaultFlow,
        Flow.patch(
          Rx.tap(a => {
            if (a.action === 'action3') {
              patchedActionsCount++
            }
          }),
          Rx.map(defaultState => ({ comp1: 'hello', comp2: defaultState.comp2 }))
        )
      )

      const res = UI.mount(patchedKnot, patchedFlow)

      const w = Enzyme.mount(res)
      expect(w.html()).toBe('<div><div name="third">hello</div><div name="second">42</div></div>')

      w.find('[name="third"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(defaultActionsCount).toBe(1)
      expect(patchedActionsCount).toBe(1)
    })

    it('re-use children flows in knot', () => {
      let comp1ActionsCount = 0
      let comp2ActionsCount = 0

      const comp1Flow: Flow.For<typeof comp1> = flow(
        Rx.tap(() => comp1ActionsCount++),
        Rx.mapTo('begin'),
        Rx.startWith('begin')
      )

      const comp2Flow: Flow.For<typeof comp2> = flow(
        Rx.tap(() => comp2ActionsCount++),
        Rx.mapTo(42),
        Rx.startWith(42)
      )

      const knotFlow = Flow.composeKnot<typeof knot>({ comp1: comp1Flow, comp2: comp2Flow })

      const res = UI.mount(knot, knotFlow)

      const w = Enzyme.mount(res)
      expect(w.html()).toBe('<div><div name="first">begin</div><div name="second">42</div></div>')

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(comp1ActionsCount).toBe(1)

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(comp2ActionsCount).toBe(1)
    })

    it('re-use children flows in nested knot', () => {
      let comp1ActionsCount = 0
      let comp2ActionsCount = 0

      const comp1Flow: Flow.For<typeof comp1> = flow(
        Rx.tap(() => comp1ActionsCount++),
        Rx.mapTo('begin'),
        Rx.startWith('begin')
      )

      const comp2Flow: Flow.For<typeof comp2> = flow(
        Rx.tap(() => comp2ActionsCount++),
        Rx.mapTo(42),
        Rx.startWith(42)
      )

      const wrappedComp1 = UI.Knot.make(
        UI.Grid.make<'comp1', never, never>(({ slots }) => <div>{slots.comp1}</div>),
        { comp1 }
      )

      const grid = UI.Grid.make<'comp1' | 'comp2', string, 'onClick'>(
        ({ slots, state, notify }) => (
          <F.div name="grid" onClick={notify('onClick')}>
            {slots.comp1}
            {state}
            {slots.comp2}
          </F.div>
        )
      )

      let gridActionsCount = 0

      const knot = UI.Knot.make(grid, {
        comp1: wrappedComp1,
        comp2
      })

      const knotFlow = Flow.composeKnot<typeof knot>({
        comp1: Flow.composeKnot<typeof wrappedComp1>({ comp1: comp1Flow }),
        comp2: comp2Flow,
        root: flow(
          Rx.tap(() => gridActionsCount++),
          Rx.mapTo('foo'),
          Rx.startWith('foo')
        )
      })

      const res = UI.mount(knot, knotFlow)

      const w = Enzyme.mount(res)
      expect(w.html()).toBe(
        '<div name="grid"><div><div name="first">begin</div></div>foo<div name="second">42</div></div>'
      )

      w.find('[name="grid"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(gridActionsCount).toBe(1)

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(comp1ActionsCount).toBe(1)

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(comp2ActionsCount).toBe(1)
    })

    it('re-use children flows in union', () => {
      const comp1 = UI.Node.make<{ text: string }, 'action1'>(({ state, notify }) => (
        <F.div name="first" onClick={notify('action1')}>
          {state.pipe(Rx.map(s => s.text))}
        </F.div>
      ))

      const comp2 = UI.Node.make<{ text: string }, 'action2'>(({ state, notify }) => (
        <F.div name="second" onClick={notify('action2')}>
          {state.pipe(Rx.map(s => s.text))}
        </F.div>
      ))

      const union = UI.Union.make('kind', {
        comp1,
        comp2
      })

      const comp1Flow: Flow.For<typeof comp1> = flow(
        Rx.mapTo({ text: 'first component' }),
        Rx.startWith({ text: 'first component' })
      )

      const comp2Flow: Flow.For<typeof comp2> = flow(
        Rx.mapTo({ text: 'second component' }),
        Rx.startWith({ text: 'second component' })
      )

      const unionFlow = Flow.composeUnion<typeof union>(
        {
          comp1: comp1Flow,
          comp2: comp2Flow
        },
        flow(
          Rx.map(({ action }) => {
            switch (action) {
              case 'action1':
                return { kind: 'comp2' as const }
              case 'action2':
                return { kind: 'comp1' as const }
              default:
                assertNever(action)
            }
          }),
          Rx.startWith({ kind: 'comp1' as const })
        )
      )

      const res = UI.mount(union, unionFlow)

      const w = Enzyme.mount(res)
      expect(w.html()).toBe('<div name="first">first component</div>')

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div name="second">second component</div>')

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div name="first">first component</div>')
    })

    it('re-use children flows in nested union', () => {
      const innerComp1 = UI.Node.make<{ text: string }, 'action1'>(({ state, notify }) => (
        <F.div name="inner-first" onClick={notify('action1')}>
          {state.pipe(Rx.map(s => s.text))}
        </F.div>
      ))

      const innerComp2 = UI.Node.make<{ text: string }, 'action2'>(({ state, notify }) => (
        <F.div name="inner-second" onClick={notify('action2')}>
          {state.pipe(Rx.map(s => s.text))}
        </F.div>
      ))

      const comp2 = UI.Node.make<{ text: string }, 'action3'>(({ state, notify }) => (
        <F.div name="second" onClick={notify('action3')}>
          {state.pipe(Rx.map(s => s.text))}
        </F.div>
      ))

      const innerUnion = UI.Union.make('innerKind', {
        innerComp1,
        innerComp2
      })

      const union = UI.Union.make('kind', {
        comp1: innerUnion,
        comp2
      })

      const innerComp1Flow: Flow.For<typeof innerComp1> = flow(
        Rx.mapTo({ text: 'first inner component' }),
        Rx.startWith({ text: 'first inner component' })
      )

      const innerComp2Flow: Flow.For<typeof innerComp2> = flow(
        Rx.mapTo({ text: 'second inner component' }),
        Rx.startWith({ text: 'second inner component' })
      )

      const comp2Flow: Flow.For<typeof comp2> = flow(
        Rx.mapTo({ text: 'second outer component' }),
        Rx.startWith({ text: 'second outer component' })
      )

      const innerUnionFlow = Flow.composeUnion<typeof innerUnion>(
        {
          innerComp1: innerComp1Flow,
          innerComp2: innerComp2Flow
        },
        flow(
          Rx.map(({ action }) => {
            switch (action) {
              case 'action1':
                return { innerKind: 'innerComp2' as const }
              case 'action2':
                return { innerKind: 'innerComp1' as const }
              default:
                assertNever(action)
            }
          }),
          // Start with the default kind
          Rx.startWith({ innerKind: 'innerComp1' as const })
        )
      )

      const unionFlow = Flow.composeUnion<typeof union>(
        {
          comp1: innerUnionFlow,
          comp2: comp2Flow
        },
        flow(
          // Filter actions that will change the outer kind
          Rx.filter(actions => actions.action === 'action3' || actions.action.key === 'innerComp2'),
          Rx.map(actions => {
            if (actions.action === 'action3') {
              return { kind: 'comp1' as const }
            }

            return { kind: 'comp2' as const }
          }),
          // Start with the default kind
          Rx.startWith({ kind: 'comp1' as const })
        )
      )

      const res = UI.mount(union, unionFlow)

      const w = Enzyme.mount(res)
      expect(w.html()).toBe('<div name="inner-first">first inner component</div>')

      w.find('[name="inner-first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div name="inner-second">second inner component</div>')

      w.find('[name="inner-second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div name="second">second outer component</div>')

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div name="inner-first">first inner component</div>')
    })

    it('re-use children flows in union with external state', () => {
      type Kind = 'comp1' | 'comp2'

      const state = Atom.create<{
        kind: Kind
        text: string
      }>({ kind: 'comp1', text: 'begin' })

      const reducer = (currentText: string, kind: Kind) => {
        switch (kind) {
          case 'comp1':
            state.set({
              kind,
              text: `${currentText} switched to comp1`
            })
            break
          case 'comp2':
            state.set({
              kind,
              text: `${currentText} switched to comp2`
            })
            break
          default:
            assertNever(kind)
        }
      }

      const comp1 = UI.Node.make<{ text: string }, 'first component'>(({ state, notify }) => (
        <F.div name="first" onClick={notify('first component')}>
          {state.pipe(Rx.map(s => s.text))}
        </F.div>
      ))

      const comp2 = UI.Node.make<{ text: string }, 'second component'>(({ state, notify }) => (
        <F.div name="second" onClick={notify('second component')}>
          {state.pipe(Rx.map(s => s.text))}
        </F.div>
      ))

      const union = UI.Union.make('kind', {
        comp1,
        comp2
      })

      const comp1Flow: Flow.For<typeof comp1> = Flow.fromSideEffect(
        action => reducer(action, 'comp2'),
        state.view(s => ({ text: s.text }))
      )

      const comp2Flow: Flow.For<typeof comp2> = Flow.fromSideEffect(
        action => reducer(action, 'comp1'),
        state.view(s => ({ text: s.text }))
      )

      const unionFlow = Flow.composeUnion<typeof union>(
        {
          comp1: comp1Flow,
          comp2: comp2Flow
        },
        () =>
          state.view(({ kind }) => ({
            kind
          }))
      )

      const res = UI.mount(union, unionFlow)

      const w = Enzyme.mount(res)
      expect(w.html()).toBe('<div name="first">begin</div>')

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div name="second">first component switched to comp2</div>')

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div name="first">second component switched to comp1</div>')
    })

    it('re-use children flows in nested union with external state', () => {
      const state = Atom.create<{
        kind: 'comp1' | 'comp2'
        innerKind: 'innerComp1' | 'innerComp2'
      }>({ kind: 'comp1', innerKind: 'innerComp1' })

      const innerComp1 = UI.Node.make<{ text: string }, 'action1'>(({ state, notify }) => (
        <F.div name="inner-first" onClick={notify('action1')}>
          {state.pipe(Rx.map(x => x.text))}
        </F.div>
      ))

      const comp2 = UI.Node.make<{ text: string }, 'action2'>(({ state, notify }) => (
        <F.div name="second" onClick={notify('action2')}>
          {state.pipe(Rx.map(x => x.text))}
        </F.div>
      ))

      const innerComp2 = UI.Node.make<{ text: string }, 'action3'>(({ state, notify }) => (
        <F.div name="inner-second" onClick={notify('action3')}>
          {state.pipe(Rx.map(x => x.text))}
        </F.div>
      ))

      const nestedUnion = UI.Union.make('innerKind', {
        innerComp1,
        innerComp2
      })

      const union = UI.Union.make('kind', {
        comp1: nestedUnion,
        comp2
      })

      const innerComp1Flow: Flow.For<typeof innerComp1> = flow(
        Rx.tap(() => state.lens('innerKind').set('innerComp2')),
        Rx.mapTo({ text: 'inner comp 1' }),
        Rx.startWith({ text: 'inner comp 1' })
      )

      const innerComp2Flow: Flow.For<typeof innerComp2> = flow(
        Rx.tap(() => state.lens('kind').set('comp2')),
        Rx.mapTo({ text: 'inner comp 2' }),
        Rx.startWith({ text: 'inner comp 2' })
      )

      const comp2Flow: Flow.For<typeof comp2> = flow(
        Rx.tap(() => state.lens('kind').set('comp1')),
        Rx.mapTo({ text: 'outer comp 2' }),
        Rx.startWith({ text: 'outer comp 2' })
      )

      const unionFlow = Flow.composeUnion<typeof union>(
        {
          comp1: Flow.composeUnion<typeof nestedUnion>(
            {
              innerComp1: innerComp1Flow,
              innerComp2: innerComp2Flow
            },
            () => state.view('innerKind').view(innerKind => ({ innerKind }))
          ),
          comp2: comp2Flow
        },
        () => state.view('kind').view(kind => ({ kind }))
      )

      const res = UI.mount(union, unionFlow)

      const w = Enzyme.mount(res)
      expect(w.html()).toBe('<div name="inner-first">inner comp 1</div>')

      w.find('[name="inner-first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div name="inner-second">inner comp 2</div>')

      w.find('[name="inner-second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div name="second">outer comp 2</div>')

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div name="inner-second">inner comp 2</div>')
    })
  })

  const createTestScheduler = (expect: (actual: string, expected: string) => boolean | void) =>
    new TestScheduler(
      (actual: (TestMessage | SubscriptionLog)[], expected: (TestMessage | SubscriptionLog)[]) => {
        // asserting the two objects are equal
        const prettyActual = JSON.stringify(actual.map(resFormat), null, 2)
        const prettyExpected = JSON.stringify(expected.map(resFormat), null, 2)
        expect(prettyActual, prettyExpected)
      }
    )

  const isTestMessage = (value: any): value is TestMessage =>
    value !== undefined && typeof value === 'object' && 'notification' in value

  const msgFormat = (msg: TestMessage): Record<string, string | object> => ({
    [`f(${msg.frame})[${msg.notification.kind}]`]: Array.isArray(msg.notification.value)
      ? msg.notification.value.map(msgFormat)
      : isTestMessage(msg.notification.value)
      ? msgFormat(msg.notification.value)
      : msg.notification.value !== undefined
      ? msg.notification.value
      : msg.notification.error
  })

  const resFormat = (res: TestMessage | SubscriptionLog) =>
    res instanceof SubscriptionLog ? res : msgFormat(res)
})
