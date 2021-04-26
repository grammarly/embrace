import { flow } from 'fp-ts/lib/function'
import * as Rx from 'rxjs/operators'
import { Flow } from '@grammarly/embrace'
import { Body } from './body'

export const bodyFlow: Flow.For<typeof Body> = flow(
  Rx.scan((acc, a) => (a.key === 'plus' ? acc + 1 : acc - 1), 0),
  Rx.map(acc => ({ content: acc })),
  Rx.startWith({ content: 0 })
)
