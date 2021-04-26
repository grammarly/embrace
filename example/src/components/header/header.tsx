import * as React from 'react'
import * as Rx from 'rxjs/operators'
import { F } from '@grammarly/focal'
import { UI } from '@grammarly/embrace'

import './header.css'

export interface HeaderState {
  readonly user: string
}

export type Actions = 'onClick'

export const Header = UI.Node.make<HeaderState, 'onClick'>(({ state, notify }) => (
  <header className="header">
    <F.span>{state.pipe(Rx.map(({ user }) => `Hello, ${user}`))}</F.span>
    <button onClick={notify('onClick')}>Button</button>
  </header>
))
