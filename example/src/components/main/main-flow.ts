import * as Rx from 'rxjs'
import { Flow } from '@grammarly/embrace'
import { bodyFlow } from '../body'
import { headerFlow } from '../header/header-flow'
import { Main } from './main'

export const mainFlow: Flow.For<typeof Main> = Flow.composeKnot<typeof Main>({
  header: headerFlow,
  body: bodyFlow,
  footer: () => Rx.of(null as never)
})
