import { flow } from 'fp-ts/lib/function'
import * as Rx from 'rxjs/operators'
import { Flow } from '@grammarly/embrace'
import { Header } from './header'

export const headerFlow: Flow.For<typeof Header> = flow(
  Rx.map(() => ({ user: 'username' })),
  Rx.startWith({ user: 'anonymous' })
)
