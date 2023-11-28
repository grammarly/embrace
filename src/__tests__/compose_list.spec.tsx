import * as React from 'react'
import * as Enzyme from 'enzyme'
import * as Adapter from 'enzyme-adapter-react-16'
import { eqString } from 'fp-ts/lib/Eq'
import * as O from 'fp-ts/lib/Option'
import * as RA from 'fp-ts/lib/ReadonlyArray'
import * as R from 'fp-ts/lib/ReadonlyRecord'
import * as RS from 'fp-ts/lib/ReadonlySet'
import { Endomorphism, flow } from 'fp-ts/lib/function'
import { pipe } from 'fp-ts/lib/pipeable'
import * as Rx from 'rxjs/operators'
import { Atom, F } from '@grammarly/focal'
import { Flow, UI } from '../index'

describe('Flow.composeList', () => {
  Enzyme.configure({ adapter: new Adapter() })

  interface ItemAction {
    readonly id: string
    readonly kind: 'copy' | 'remove'
  }

  it('readonlyRecord - can update collection structure', () => {
    interface ItemState {
      readonly id: string
      readonly label: string
      readonly removable: boolean
    }

    const item = UI.Node.make<ItemState, ItemAction>(({ state, notify }) => (
      <F.Fragment>
        {state.pipe(
          Rx.map(({ id, label, removable }) => (
            <div data-name={id} onClick={notify({ id, kind: removable ? 'remove' : 'copy' })}>
              {label}
            </div>
          ))
        )}
      </F.Fragment>
    ))

    interface ItemData {
      readonly id: string
      readonly removable: boolean
    }

    const list = UI.List.make(R.readonlyRecord, item)

    // These counters are used to ensure that the total number of action "seen" by the item flows
    // equal the number of actions "seen" by the collection provider function.
    let itemFlowActionsCount = 0
    let collectionActionsCount = 0

    const createItemFlow = ({ id, removable }: ItemData): Flow.For<typeof item> =>
      flow(
        Rx.tap(() => itemFlowActionsCount++),
        Rx.startWith(null),
        Rx.mapTo({
          id,
          removable,
          label: `item ${{ a: 'A!', b: 'B!', 'a-copy': 'A Copy!' }[id]}`
        })
      )

    const startState = {
      a: { id: 'a', removable: false }, // will be copied on click
      b: { id: 'b', removable: true } // will be removed on click
    }

    const listFlow = Flow.composeList<typeof list, ItemData>(
      R.readonlyRecord,
      flow(
        Rx.tap(() => collectionActionsCount++),
        Rx.scan(
          (acc, a) =>
            // copy item and mark original and copy as removable
            a.action.kind === 'copy'
              ? pipe(
                  acc,
                  R.updateAt(a.action.id, { id: a.action.id, removable: true }),
                  O.getOrElse(() => acc),
                  R.insertAt(`${a.action.id}-copy`, {
                    id: `${a.action.id}-copy`,
                    removable: true
                  })
                )
              : pipe(acc, R.deleteAt(a.key)),
          startState
        ),
        Rx.startWith(startState)
      ),
      createItemFlow
    )

    const res = <div>{UI.mount(list, listFlow)}</div>

    const w = Enzyme.mount(res)
    expect(w.html()).toBe(
      '<div><div data-name="a">item A!</div><div data-name="b">item B!</div></div>'
    )

    w.find('[data-name="a"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))

    expect(w.html()).toBe(
      '<div><div data-name="a">item A!</div><div data-name="a-copy">item A Copy!</div><div data-name="b">item B!</div></div>'
    )
    expect(itemFlowActionsCount).toBe(1)
    expect(collectionActionsCount).toBe(1)

    w.find('[data-name="a"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))

    expect(w.html()).toBe(
      '<div><div data-name="a-copy">item A Copy!</div><div data-name="b">item B!</div></div>'
    )
    expect(itemFlowActionsCount).toBe(2)
    expect(collectionActionsCount).toBe(2)

    w.find('[data-name="b"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))

    expect(w.html()).toBe('<div><div data-name="a-copy">item A Copy!</div></div>')
    expect(itemFlowActionsCount).toBe(3)
    expect(collectionActionsCount).toBe(3)

    w.find('[data-name="a-copy"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))

    expect(w.html()).toBe('<div></div>')
    expect(itemFlowActionsCount).toBe(4)
    expect(collectionActionsCount).toBe(4)
  })

  it('readonlyArray - can use external state', () => {
    interface ItemState {
      readonly id: string
      readonly label: string
      readonly counter: number
      readonly removable: boolean
    }

    const item = UI.Node.make<ItemState, ItemAction>(({ state, notify }) => (
      <F.Fragment>
        {state.pipe(
          Rx.map(({ id, label, counter, removable }) => (
            <div data-name={id} onClick={notify({ id, kind: removable ? 'remove' : 'copy' })}>
              {label}:{counter}
            </div>
          ))
        )}
      </F.Fragment>
    ))

    const list = UI.List.make(RA.readonlyArray, item)

    interface State {
      readonly actionsCounter: number
      readonly itemsToShow: ReadonlyArray<string>
      readonly removableItems: ReadonlySet<string>
    }

    const state = Atom.create<State>({
      actionsCounter: 0,
      itemsToShow: ['a', 'b'],
      removableItems: new Set(['b'])
    })

    function reducer(action: ItemAction): Endomorphism<State> {
      return state => ({
        actionsCounter: state.actionsCounter + 1,
        removableItems:
          action.kind === 'copy'
            ? pipe(
                // Make the copied item and its copy removable on next click
                state.removableItems,
                RS.insert(eqString)(action.id),
                RS.insert(eqString)(`${action.id}-copy`)
              )
            : state.removableItems,
        itemsToShow:
          action.kind === 'copy'
            ? pipe(
                state.itemsToShow,
                RA.chain(id => (id === action.id ? [id, `${id}-copy`] : [id]))
              )
            : state.itemsToShow.filter(item => item !== action.id)
      })
    }

    // This example shows a case where all actions are handled by the item flows
    // by updating a central state atom.
    const listFlow = Flow.composeList<typeof list, string>(
      RA.readonlyArray,
      () => state.view('itemsToShow'),
      id =>
        Flow.fromSideEffect(
          a => state.modify(reducer(a)),
          state.view(s => ({
            id,
            label: `${id.toUpperCase()}`,
            counter: s.actionsCounter,
            removable: s.removableItems.has(id)
          }))
        )
    )

    const res = <div>{UI.mount(list, listFlow)}</div>

    const w = Enzyme.mount(res)
    expect(w.html()).toBe('<div><div data-name="a">A:0</div><div data-name="b">B:0</div></div>')

    w.find('[data-name="a"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))
    expect(w.html()).toBe(
      '<div><div data-name="a">A:1</div><div data-name="a-copy">A-COPY:1</div><div data-name="b">B:1</div></div>'
    )

    w.find('[data-name="a"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))
    expect(w.html()).toBe(
      '<div><div data-name="a-copy">A-COPY:2</div><div data-name="b">B:2</div></div>'
    )

    w.find('[data-name="b"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))
    expect(w.html()).toBe('<div><div data-name="a-copy">A-COPY:3</div></div>')

    w.find('[data-name="a-copy"]')
      .hostNodes()
      .forEach(el => el.simulate('click'))
    expect(w.html()).toBe('<div></div>')
  })
})
