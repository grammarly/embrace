import * as Enzyme from "enzyme";
import * as Adapter from "enzyme-adapter-react-16";
import * as A from "fp-ts/lib/Array";
import { Endomorphism, flow, identity } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import * as R from "fp-ts/lib/Record";
import * as React from "react";
import { of as rxOf } from "rxjs";
import * as Rx from "rxjs/operators";

import { F } from "@grammarly/focal";

import { Flow, UI } from "../index";
import { getMapFoldableWithIndex } from "./utils";

Enzyme.configure({ adapter: new Adapter() })

describe('UI Tree', () => {
  let renderCount = 0 // to ensure that we do not do unnecessary react rerenders
  beforeEach(() => (renderCount = 0))

  describe('mount', () => {
    it('on simple case', () => {
      const comp1 = UI.Node.make<string, 'nameClick'>(({ state, notify }) => (
        <F.div onClick={notify('nameClick')} data-render={renderCount++}>
          {state}
        </F.div>
      ))

      const res = UI.mount(comp1, Rx.startWith('begin'))

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<div data-render="0">begin</div>')
      w.simulate('click')

      expect(w.html()).toBe('<div data-render="0">nameClick</div>')
    })

    it('with nested state', () => {
      const comp1 = UI.Node.make<{ title: string; count: number }, 'nameClick'>(
        ({ notify, view }) => (
          <div onClick={notify('nameClick')} data-render={renderCount++}>
            <F.b>{view('title')}</F.b>
            <F.i>{view('count')}</F.i>
          </div>
        )
      )

      let stateChangeCount = 0 // to ensure that we do not do unnecessary state recalculations
      const res = UI.mount(
        comp1,
        flow(
          Rx.map((title, count) => ({ title, count })),
          Rx.tap(() => stateChangeCount++),
          Rx.startWith({ title: 'begin', count: 0 })
        )
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<div data-render="0"><b>begin</b><i>0</i></div>')
      expect(stateChangeCount).toBe(0)
      w.simulate('click')

      expect(stateChangeCount).toBe(1)
      expect(w.html()).toBe('<div data-render="0"><b>nameClick</b><i>0</i></div>')
    })

    it('same component twice', () => {
      const comp1 = UI.Node.make<string, 'nameClick'>(({ state, notify }) => (
        <F.div onClick={notify('nameClick')} data-render={renderCount++}>
          {state}
        </F.div>
      ))

      const res1 = UI.mount(comp1, Rx.startWith('begin'))
      const res2 = UI.mount(comp1, Rx.startWith('begin'))

      const w1 = Enzyme.mount(res1)
      const w2 = Enzyme.mount(res2)

      expect(w1.html()).toBe('<div data-render="0">begin</div>')
      expect(w2.html()).toBe('<div data-render="1">begin</div>')
      w1.simulate('click')

      expect(w1.html()).toBe('<div data-render="0">nameClick</div>')
      expect(w2.html()).toBe('<div data-render="1">begin</div>')

      w2.simulate('click')
      expect(w1.html()).toBe('<div data-render="0">nameClick</div>')
      expect(w2.html()).toBe('<div data-render="1">nameClick</div>')
    })
  })

  describe('compose', () => {
    it('as group', () => {
      const comp = UI.Group.make({
        comp1,
        comp2
      })

      const res = (
        <div>
          {UI.mount(
            comp,
            flow(
              Rx.scan((res, a) => reducer(a)(res), init),
              Rx.startWith(init)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="second" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="second" data-render="1">begin2</div></div>'
      )

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="second" data-render="1">nameHover</div></div>'
      )

      expect(renderCount).toBe(2)
    })

    it('nested tree', () => {
      const res = (
        <div>
          {UI.mount(
            comp12,
            flow(
              Rx.scan((res, a) => reducer(a)(res), init),
              Rx.startWith(init)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="second" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="second" data-render="1">begin2</div></div>'
      )

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="second" data-render="1">nameHover</div></div>'
      )

      expect(renderCount).toBe(2)
    })

    it('nested tree with value', () => {
      const container = UI.Grid.make<'comp1' | 'comp2', number, 'hover'>(
        ({ slots, state, notify }) => (
          <F.div name="root" onMouseEnter={notify('hover')}>
            Hover count: {state}
            {slots.comp1}
            {slots.comp2}
          </F.div>
        )
      )

      const comp12 = UI.Knot.make(container, { comp1, comp2 })

      const res = UI.mount(
        comp12,
        flow(
          Rx.scan(
            (res, a) =>
              a.key === 'root' ? { ...res, root: res.root + 1 } : { ...res, ...reducer(a)(res) },
            { ...init, root: 0 }
          ),
          Rx.startWith({ ...init, root: 0 })
        )
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div name="root">Hover count: 0<div name="first" data-render="0">begin1</div><div name="second" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div name="root">Hover count: 0<div name="first" data-render="0">nameClick</div><div name="second" data-render="1">begin2</div></div>'
      )

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div name="root">Hover count: 0<div name="first" data-render="0">nameClick</div><div name="second" data-render="1">nameHover</div></div>'
      )

      w.find('[name="root"]')
        .hostNodes()
        .forEach(el => el.simulate('mouseEnter'))

      expect(w.html()).toBe(
        '<div name="root">Hover count: 1<div name="first" data-render="0">nameClick</div><div name="second" data-render="1">nameHover</div></div>'
      )

      expect(renderCount).toBe(2)
    })

    it('deep nested tree', () => {
      const res = (
        <div>
          {UI.mount(
            comp1212,
            flow(
              Rx.scan((res, a) => ({ ...res, [a.key]: reducer(a.action)(res[a.key]) }), {
                comp1: init,
                comp2: init
              }),
              Rx.startWith({ comp1: init, comp2: init })
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="second" data-render="1">begin2</div><div name="first" data-render="2">begin1</div><div name="second" data-render="3">begin2</div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="second" data-render="1">begin2</div><div name="first" data-render="2">nameClick</div><div name="second" data-render="3">begin2</div></div>'
      )

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="second" data-render="1">nameHover</div><div name="first" data-render="2">nameClick</div><div name="second" data-render="3">nameHover</div></div>'
      )

      expect(renderCount).toBe(4)
    })

    it('with empty comp', () => {
      const comp = UI.Group.make({
        comp1,
        comp2: UI.Node.empty
      })

      const res = (
        <div>
          {UI.mount(
            comp,
            flow(
              Rx.scan((res, a) => reducer(a)(res), init),
              Rx.startWith(init)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<div><div name="first" data-render="0">begin1</div></div>')

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div><div name="first" data-render="0">nameClick</div></div>')

      expect(renderCount).toBe(1)
    })

    it('with null comp', () => {
      const comp = UI.Group.make({
        comp1,
        comp2: UI.Node.make(() => null as any)
      })

      const res = (
        <div>
          {UI.mount(
            comp,
            flow(
              Rx.scan((res, a) => reducer(a)(res), init),
              Rx.startWith(init)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<div><div name="first" data-render="0">begin1</div></div>')

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div><div name="first" data-render="0">nameClick</div></div>')

      expect(renderCount).toBe(1)
    })

    it('composite works', () => {
      const composite = UI.Grid.make<'comp1'>(({ slots }) => (
        <F.div name="composite">{slots.comp1}</F.div>
      ))

      const comp = UI.Composite.make(composite, comp1)

      const res = <div>{UI.mount(comp, Rx.startWith('begin1'))}</div>

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="composite"><div name="first" data-render="0">begin1</div></div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="composite"><div name="first" data-render="0">nameClick</div></div></div>'
      )

      expect(renderCount).toBe(1)
    })

    it('composite works with composition', () => {
      const composite = UI.Grid.make<'comp1'>(({ slots }) => (
        <F.div name="composite">{slots.comp1}</F.div>
      ))

      const comp = UI.Composite.make(composite, comp12)

      const res = (
        <div>
          {UI.mount(
            comp,
            flow(
              Rx.scan((res, a) => reducer(a)(res), init),
              Rx.startWith(init)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="composite"><div name="first" data-render="0">begin1</div><div name="second" data-render="1">begin2</div></div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="composite"><div name="first" data-render="0">nameClick</div><div name="second" data-render="1">begin2</div></div></div>'
      )

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="composite"><div name="first" data-render="0">nameClick</div><div name="second" data-render="1">nameHover</div></div></div>'
      )

      expect(renderCount).toBe(2)
    })
  })

  describe('patch', () => {
    it('knot to knot', () => {
      const patchedComp = pipe(
        comp1212,
        UI.patch('comp1')(() => comp1),
        UI.patch('comp2')(() => comp2)
      )

      const res = (
        <div>
          {UI.mount(
            patchedComp,
            flow(
              Rx.scan((res, a) => reducer(a)(res), init),
              Rx.startWith(init)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="second" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="second" data-render="1">begin2</div></div>'
      )

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="second" data-render="1">nameHover</div></div>'
      )

      expect(renderCount).toBe(2)
    })

    it('composite to composite', () => {
      const grid1 = UI.Grid.make<'comp1'>(({ slots }) => (
        <F.div name="composite1">{slots.comp1}</F.div>
      ))

      const grid2 = UI.Grid.make<'comp42'>(({ slots }) => (
        <F.div name="composite2">{slots.comp42}</F.div>
      ))

      const composite1 = UI.Composite.make(grid1, comp1)

      const composite2 = UI.Composite.make(grid2, comp1)

      const comp = pipe(
        UI.Knot.make(container, { comp1: composite1, comp2 }),
        UI.patch('comp1')(() => composite2)
      )

      const res = (
        <div>
          {UI.mount(
            comp,
            flow(
              Rx.scan((res, a) => reducer(a)(res), init),
              Rx.startWith(init)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="composite2"><div name="first" data-render="0">begin1</div></div><div name="second" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="composite2"><div name="first" data-render="0">nameClick</div></div><div name="second" data-render="1">begin2</div></div>'
      )

      expect(renderCount).toBe(2)
    })

    it('composite child', () => {
      const grid1 = UI.Grid.make<'comp1'>(({ slots }) => (
        <F.div name="composite1">{slots.comp1}</F.div>
      ))

      const composite1 = UI.Composite.make(grid1, comp12)

      const grid2 = UI.Grid.make<'comp42'>(({ slots }) => (
        <F.div name="composite2">{slots.comp42}</F.div>
      ))

      const comp = pipe(
        composite1,
        UI.patch('comp1')(c => UI.Composite.make(grid2, c))
      )

      const res = (
        <div>
          {UI.mount(
            comp,
            flow(
              Rx.scan((res, a) => reducer(a)(res), init),
              Rx.startWith(init)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="composite1"><div name="composite2"><div name="first" data-render="0">begin1</div></div><div name="second" data-render="1">begin2</div></div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="composite1"><div name="composite2"><div name="first" data-render="0">nameClick</div></div><div name="second" data-render="1">begin2</div></div></div>'
      )

      expect(renderCount).toBe(2)
    })

    it('first level knot to knot of list', () => {
      const patchedComp = pipe(
        comp1212,
        UI.patch('comp1')(x => UI.List.make(R.record, x.children.comp1)),
        UI.patch('comp2')(() => UI.Node.empty)
      )

      const linit = { comp1: init }

      const res = (
        <div>
          {UI.mount(
            patchedComp,
            flow(
              Rx.scan((res, a) => ({ ...res, [a.key]: listReducer(a.action)(res[a.key]) }), linit),
              Rx.startWith(linit)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="first" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .at(0)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .last()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">nameClick</div></div>'
      )

      expect(renderCount).toBe(2)
    })

    it('second level knot to knot of list', () => {
      const patchedComp = pipe(
        comp1212,
        UI.patch('comp1', 'comp1')(x => UI.List.make(R.record, x)),
        UI.patch('comp2')(() => UI.Node.empty)
      )

      const linit = { comp1: { comp1: init, comp2: init.comp2 } }

      const res = (
        <div>
          {UI.mount(
            patchedComp,
            flow(
              Rx.scan(
                (res, a) => ({
                  ...res,
                  [a.key]: {
                    ...res[a.key],
                    [a.action.key]:
                      a.action.key === 'comp2'
                        ? a.action.action
                        : listReducer(a.action.action)(res[a.key][a.action.key])
                  }
                }),
                linit
              ),
              Rx.startWith(linit)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="first" data-render="1">begin2</div><div name="second" data-render="2">begin2</div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .at(0)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">begin2</div><div name="second" data-render="2">begin2</div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .last()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">nameClick</div><div name="second" data-render="2">begin2</div></div>'
      )

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">nameClick</div><div name="second" data-render="2">nameHover</div></div>'
      )

      expect(renderCount).toBe(3)
    })

    it('from list to node', () => {
      const patchedComp = pipe(
        UI.List.make(R.record, comp1),
        UI.patch()(x => x.of)
      )

      const res = UI.mount(patchedComp, Rx.startWith('begin'))

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<div name="first" data-render="0">begin</div>')
      w.simulate('click')

      expect(w.html()).toBe('<div name="first" data-render="0">nameClick</div>')
    })

    it('from knot to node', () => {
      const patchedComp = pipe(
        comp12,
        UI.patch()(x => x.children.comp1)
      )

      const res = UI.mount(patchedComp, Rx.startWith('begin'))

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<div name="first" data-render="0">begin</div>')
      w.simulate('click')

      expect(w.html()).toBe('<div name="first" data-render="0">nameClick</div>')
    })

    it('from knot of list to node', () => {
      const patchedComp = pipe(
        UI.Knot.make(container, {
          comp1: UI.List.make(R.record, comp1),
          comp2: UI.List.make(R.record, comp2)
        }),
        UI.patch()(x => x.children.comp1.of)
      )

      const res = UI.mount(patchedComp, Rx.startWith('begin'))

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<div name="first" data-render="0">begin</div>')
      w.simulate('click')

      expect(w.html()).toBe('<div name="first" data-render="0">nameClick</div>')
    })

    it('from list of knot to list of knot singleton', () => {
      const patchedComp = pipe(
        UI.List.make(R.record, comp12),
        UI.patch('comp1')(UI.mapAction<any, any>(x => x + 'new')), // TODO: <any, any> to prevent TS2589
        UI.patch('comp2')(() => UI.Node.empty)
      )

      const linit = { comp1: init, comp2: init }

      const res = (
        <div>
          {UI.mount(
            patchedComp,
            flow(
              Rx.scan(
                (res, a) => ({ ...res, [a.key]: listReducer(a.action)(res[a.action.key]) }),
                linit
              ),
              Rx.startWith(linit)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="first" data-render="1">begin1</div></div>'
      )
      w.find('[name="first"]')
        .at(1)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClicknew</div><div name="first" data-render="1">begin1</div></div>'
      )

      w.find('[name="first"]')
        .at(2)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClicknew</div><div name="first" data-render="1">nameClicknew</div></div>'
      )
    })

    it('from knot of list to knot of list', () => {
      const patchedComp = pipe(
        UI.List.make(R.record, comp12),
        UI.patch('comp1')(UI.mapAction<any, any>(x => x + 'new')) // TODO: <any, any> to prevent TS2589
      )

      const linit = { comp1: init, comp2: init }

      const res = (
        <div>
          {UI.mount(
            patchedComp,
            flow(
              Rx.scan(
                (res, a) => ({ ...res, [a.key]: listReducer(a.action)(res[a.action.key]) }),
                linit
              ),
              Rx.startWith(linit)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="second" data-render="1">begin2</div><div name="first" data-render="2">begin1</div><div name="second" data-render="3">begin2</div></div>'
      )
      w.find('[name="first"]')
        .at(1)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClicknew</div><div name="second" data-render="1">begin2</div><div name="first" data-render="2">begin1</div><div name="second" data-render="3">begin2</div></div>'
      )

      w.find('[name="first"]')
        .at(2)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClicknew</div><div name="second" data-render="1">begin2</div><div name="first" data-render="2">nameClicknew</div><div name="second" data-render="3">begin2</div></div>'
      )
    })
  })

  describe('list of', () => {
    it('dynamic record works', () => {
      const recordOfcomp = UI.List.make(R.record, comp1)

      const state1 = { comp1: 'begin1', comp2: 'begin2' }
      const state2 = { comp2: 'restart' }

      const res = (
        <div>
          {UI.mount(
            recordOfcomp,
            flow(
              Rx.scan(
                (res, a) =>
                  a.key === 'comp1'
                    ? { ...res, [a.key]: a.action }
                    : 'comp1' in res
                    ? state2
                    : state1,
                state1
              ),
              Rx.startWith(state1)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="first" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .at(1)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .last()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div><div name="first" data-render="1">restart</div></div>')

      w.find('[name="first"]')
        .last()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="2">begin1</div><div name="first" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .first()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="2">nameClick</div><div name="first" data-render="1">begin2</div></div>'
      )
    })

    it('static record works', () => {
      const recordOfcomp = UI.List.make(R.record, comp1)

      const res = (
        <div>
          {UI.mount(
            recordOfcomp,
            flow(
              Rx.scan((res, a) => listReducer(a)(res), {
                comp1: 'begin1',
                comp2: 'begin2',
                comp3: 'begin3'
              }),
              Rx.startWith({ comp1: 'begin1', comp2: 'begin2', comp3: 'begin3' })
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="first" data-render="1">begin2</div><div name="first" data-render="2">begin3</div></div>'
      )

      w.find('[name="first"]')
        .at(1)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">begin2</div><div name="first" data-render="2">begin3</div></div>'
      )

      w.find('[name="first"]')
        .at(2)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">nameClick</div><div name="first" data-render="2">begin3</div></div>'
      )

      w.find('[name="first"]')
        .last()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">nameClick</div><div name="first" data-render="2">nameClick</div></div>'
      )
    })

    it('list order works', () => {
      const mapOfComp = UI.List.make(getMapFoldableWithIndex<number>(), comp1)

      const data = new Map<number, string>()
      data.set(42, 'first')
      data.set(1, 'second')
      data.set(2, 'third')

      const res = <div>{UI.mount(mapOfComp, () => rxOf(data as never))}</div>

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">first</div><div name="first" data-render="1">second</div><div name="first" data-render="2">third</div></div>'
      )
    })

    it('list of dynamic array works', () => {
      const arrayOfcomp = UI.List.make(A.array, comp1)

      const state1 = ['begin1', 'begin2']
      const state2 = ['restart']

      const res = (
        <div>
          {UI.mount(
            arrayOfcomp,
            flow(
              Rx.scan(
                (res, a) => (res.length > 1 ? (a.key === 0 ? [a.action, res[1]] : state2) : state1),
                state1
              ),
              Rx.startWith(state1)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="first" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .at(1)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .last()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe('<div><div name="first" data-render="0">restart</div></div>')

      w.find('[name="first"]')
        .last()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="first" data-render="2">begin2</div></div>'
      )

      w.find('[name="first"]')
        .first()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="2">begin2</div></div>'
      )
    })

    it('list of static array works', () => {
      const arrayOfcomp = UI.List.make(A.array, comp1)
      const state = ['begin1', 'begin2', 'begin3']

      const res = (
        <div>
          {UI.mount(
            arrayOfcomp,
            flow(
              Rx.scan(
                (res, a) => [
                  a.key === 0 ? a.action : res[0],
                  a.key === 1 ? a.action : res[1],
                  a.key === 2 ? a.action : res[2]
                ],
                state
              ),
              Rx.startWith(state)
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="first" data-render="1">begin2</div><div name="first" data-render="2">begin3</div></div>'
      )

      w.find('[name="first"]')
        .at(1)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">begin2</div><div name="first" data-render="2">begin3</div></div>'
      )

      w.find('[name="first"]')
        .at(2)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">nameClick</div><div name="first" data-render="2">begin3</div></div>'
      )

      w.find('[name="first"]')
        .last()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">nameClick</div><div name="first" data-render="2">nameClick</div></div>'
      )
    })
  })

  describe('profunctor traits works', () => {
    it('action identity', () => {
      const oldC = simpleAssert(comp, Rx.startWith('begin'))
      renderCount = 0
      const newC = simpleAssert(pipe(comp, UI.mapAction(identity)), Rx.startWith('begin'))
      expect(oldC).toBe(newC)
    })

    it('state identity', () => {
      const oldC = simpleAssert(comp, Rx.startWith('begin'))
      renderCount = 0
      const newC = simpleAssert(
        pipe(
          comp,
          UI.contramapState(x => x as string)
        ),
        Rx.startWith('begin')
      )
      expect(oldC).toBe(newC)
    })

    it('action change', () => {
      const tcomp = pipe(
        comp,
        UI.mapAction(x => 'test' + x)
      )

      const res = UI.mount(tcomp, Rx.startWith('begin'))

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<div data-render="0">begin</div>')
      w.simulate('click')

      expect(w.html()).toBe('<div data-render="0">testclick</div>')
    })

    it('state change', () => {
      const tcomp = pipe(
        comp,
        UI.contramapState((x: { state: string }) => x.state)
      )

      const res = UI.mount(
        tcomp,
        flow(
          Rx.map(state => ({ state })),
          Rx.startWith({ state: 'begin' })
        )
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<div data-render="0">begin</div>')
      w.simulate('click')

      expect(w.html()).toBe('<div data-render="0">click</div>')
    })

    it('identity on lists', () => {
      const recordOfcomp = UI.promap(UI.List.make(R.record, comp1), (x: string) => x, identity)

      const res = (
        <div>
          {UI.mount(
            recordOfcomp,
            flow(
              Rx.scan((res, a) => listReducer(a)(res), {
                comp1: 'begin1',
                comp2: 'begin2',
                comp3: 'begin3'
              }),
              Rx.startWith({ comp1: 'begin1', comp2: 'begin2', comp3: 'begin3' })
            )
          )}
        </div>
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">begin1</div><div name="first" data-render="1">begin2</div><div name="first" data-render="2">begin3</div></div>'
      )

      w.find('[name="first"]')
        .at(1)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">begin2</div><div name="first" data-render="2">begin3</div></div>'
      )

      w.find('[name="first"]')
        .at(2)
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">nameClick</div><div name="first" data-render="2">begin3</div></div>'
      )

      w.find('[name="first"]')
        .last()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div><div name="first" data-render="0">nameClick</div><div name="first" data-render="1">nameClick</div><div name="first" data-render="2">nameClick</div></div>'
      )
    })

    it('identity on knot', () => {
      const container = UI.Grid.make<'comp1' | 'comp2', number, 'hover'>(
        ({ slots, state, notify }) => (
          <F.div name="root" onMouseEnter={notify('hover')}>
            Hover count: {state}
            {slots.comp1}
            {slots.comp2}
          </F.div>
        )
      )

      const comp12 = UI.promap(
        UI.Knot.make(container, { comp1, comp2 }),
        (x: number) => x,
        identity
      )

      const res = UI.mount(
        comp12,
        flow(
          Rx.scan(
            (res, a) =>
              a.key === 'root' ? { ...res, root: res.root + 1 } : { ...res, ...reducer(a)(res) },
            { ...init, root: 0 }
          ),
          Rx.startWith({ ...init, root: 0 })
        )
      )

      const w = Enzyme.mount(res)

      expect(w.html()).toBe(
        '<div name="root">Hover count: 0<div name="first" data-render="0">begin1</div><div name="second" data-render="1">begin2</div></div>'
      )

      w.find('[name="first"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div name="root">Hover count: 0<div name="first" data-render="0">nameClick</div><div name="second" data-render="1">begin2</div></div>'
      )

      w.find('[name="second"]')
        .hostNodes()
        .forEach(el => el.simulate('click'))

      expect(w.html()).toBe(
        '<div name="root">Hover count: 0<div name="first" data-render="0">nameClick</div><div name="second" data-render="1">nameHover</div></div>'
      )

      w.find('[name="root"]')
        .hostNodes()
        .forEach(el => el.simulate('mouseEnter'))

      expect(w.html()).toBe(
        '<div name="root">Hover count: 1<div name="first" data-render="0">nameClick</div><div name="second" data-render="1">nameHover</div></div>'
      )

      expect(renderCount).toBe(2)
    })

    function simpleAssert(uiNode: UI.Node<string, string>, uiFlow: Flow<string, string>) {
      const res = UI.mount(uiNode, uiFlow)

      const w = Enzyme.mount(res)

      expect(w.html()).toBe('<div data-render="0">begin</div>')
      w.simulate('click')

      expect(w.html()).toBe('<div data-render="0">click</div>')
      const html = w.html()
      w.unmount()
      return html
    }
  })

  const comp = UI.Node.make<string, 'click'>(({ state, notify }) => (
    <F.div onClick={notify('click')} data-render={renderCount++}>
      {state}
    </F.div>
  ))

  const comp1 = UI.Node.make<string, 'nameClick'>(({ state, notify }) => (
    <F.div name="first" onClick={notify('nameClick')} data-render={renderCount++}>
      {state}
    </F.div>
  ))

  const comp2 = UI.Node.make<string, 'nameHover'>(({ state, notify }) => (
    <F.div name="second" onClick={notify('nameHover')} data-render={renderCount++}>
      {state}
    </F.div>
  ))

  const container = UI.Grid.make<'comp1' | 'comp2'>(({ slots }) => (
    <F.Fragment>
      {slots.comp1}
      {slots.comp2}
    </F.Fragment>
  ))

  const comp12 = UI.Knot.make(container, { comp1, comp2 })

  const comp1212 = UI.Knot.make(container, { comp1: comp12, comp2: comp12 })

  const init = { comp1: 'begin1', comp2: 'begin2' }

  const reducer = (
    a: { key: 'comp1'; action: 'nameClick' } | { key: 'comp2'; action: 'nameHover' }
  ): Endomorphism<{ comp1: string; comp2: string }> =>
    listReducer(a) as Endomorphism<{ comp1: string; comp2: string }>

  const listReducer = <A extends string>(a: {
    key: string
    action: A
  }): Endomorphism<{ [x: string]: string }> => res => ({
    ...res,
    [a.key]: a.action
  })
})
