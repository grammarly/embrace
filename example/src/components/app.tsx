import * as React from 'react'
import { pipe } from 'fp-ts/lib/function'
import { UI } from '@grammarly/embrace'
import { CustomFooter } from './custom-footer'
import { Main, mainFlow } from './main'

const patchedMain = pipe(
  Main,
  UI.patch('footer')(() => CustomFooter)
)

export const App: React.FC = () => UI.mount(patchedMain, mainFlow)
