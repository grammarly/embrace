import * as Enzyme from "enzyme";
import * as Adapter from "enzyme-adapter-react-16";
import { flow } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as React from "react";
import * as Rx from "rxjs/operators";

import { F } from "@grammarly/focal";

import { Flow, UI } from "../index";
import { assertNever } from "./utils";

describe('Flow.composeOption', () => {
  Enzyme.configure({ adapter: new Adapter() })

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

  it('re-use child flow in option', () => {
    const comp1Option = UI.Union.asOption(comp1)

    const comp1Flow: Flow.For<typeof comp1> = flow(
      Rx.mapTo('first component'),
      Rx.startWith('first component')
    )

    const comp1OptionFlow = Flow.composeOption<typeof comp1Option>(
      comp1Flow,
      flow(
        Rx.map(() => O.none),
        Rx.startWith({ _tag: 'Some' })
      )
    )

    const res = UI.mount(comp1Option, comp1OptionFlow)

    const w = Enzyme.mount(res)
    expect(w.html()).toBe('<div name="first">first component</div>')

    w.find('[name="first"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))

    expect(w.html()).toBeNull()
  })

  it('re-use nested children flows in option of knot', () => {
    const grid = UI.Grid.make<'comp1' | 'comp2', string>(({ slots, state }) => (
      <F.div name="grid">
        {slots.comp1}
        {state}
        {slots.comp2}
      </F.div>
    ))

    const knot = UI.Knot.make(grid, {
      comp1,
      comp2
    })

    const knotOption = UI.Union.asOption(knot)

    let totalActionsCount = 0
    let comp1ActionsCount = 0
    let comp2ActionsCount = 0

    const comp1Flow: Flow.For<typeof comp1> = flow(
      Rx.tap(() => comp1ActionsCount++),
      Rx.mapTo('first'),
      Rx.startWith('first')
    )
    const comp2Flow: Flow.For<typeof comp2> = flow(
      Rx.tap(() => comp2ActionsCount++),
      Rx.mapTo(0),
      Rx.startWith(0)
    )

    const knotFlow = Flow.composeKnot<typeof knot>({
      comp1: comp1Flow,
      comp2: comp2Flow,
      root: flow(Rx.mapTo('foo'), Rx.startWith('foo'))
    })

    const knotOptionFlow = Flow.composeOption<typeof knotOption>(
      knotFlow,
      flow(
        Rx.tap(() => totalActionsCount++),
        Rx.map(action => {
          switch (action.key) {
            case 'comp1':
              return { _tag: 'Some' as const }
            case 'comp2':
              return { _tag: 'None' as const }
            default:
              assertNever(action)
          }
        }),
        Rx.startWith({ _tag: 'Some' as const })
      )
    )

    const res = UI.mount(knotOption, knotOptionFlow)

    const w = Enzyme.mount(res)
    expect(w.html()).toBe(
      '<div name="grid"><div name="first">first</div>foo<div name="second">0</div></div>'
    )

    w.find('[name="first"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))

    expect(w.html()).toBe(
      '<div name="grid"><div name="first">first</div>foo<div name="second">0</div></div>'
    )

    expect(totalActionsCount).toBe(1)
    expect(comp1ActionsCount).toBe(1)
    expect(comp2ActionsCount).toBe(0)

    w.find('[name="second"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))

    expect(w.html()).toBeNull()

    expect(totalActionsCount).toBe(2)
    expect(comp1ActionsCount).toBe(1)
    expect(comp2ActionsCount).toBe(1)
  })
})
