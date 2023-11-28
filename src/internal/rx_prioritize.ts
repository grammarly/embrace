import { Observable, OperatorFunction, Subject, Subscription } from 'rxjs'
import { publish } from 'rxjs/operators'

/**
 * Allows to control the order in which subscriptions are made.
 *
 * Taken from @see https://github.com/cartant/rxjs-etc/blob/main/source/operators/prioritize.ts
 *
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-etc
 */
export function prioritize<T, R = T>(
  selector: (...prioritizedList: Observable<T>[]) => Observable<R>
): OperatorFunction<T, R> {
  return source =>
    new Observable<R>(observer => {
      const published = publish<T>()(source)
      const orderedSubjects: Subject<T>[] = []
      const subscription = new Subscription()
      for (let i = 0; i < selector.length; ++i) {
        const subject = new Subject<T>()
        orderedSubjects.push(subject)
        subscription.add(published.subscribe(subject))
      }
      subscription.add(selector(...orderedSubjects).subscribe(observer))
      subscription.add(published.connect())
      return subscription
    })
}
