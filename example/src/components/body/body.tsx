import * as React from 'react'
import { F } from '@grammarly/focal'
import { UI } from '@grammarly/embrace'

import './body.css'

const bodyGrid = UI.Grid.make<'minus' | 'plus' | 'content', never, never>(({ slots }) => (
  <main className="body">
    {slots.minus}
    {slots.content}
    {slots.plus}
  </main>
))

const minus = UI.Node.make<never, 'onClick'>(({ notify }) => (
  <button onClick={notify('onClick')}>-</button>
))

const plus = UI.Node.make<never, 'onClick'>(({ notify }) => (
  <button onClick={notify('onClick')}>+</button>
))

export const Body = UI.Knot.make(bodyGrid, {
  minus,
  plus,
  content: UI.Node.make<number, never>(({ state }) => <F.Fragment>{state}</F.Fragment>)
})
