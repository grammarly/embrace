import * as Eq from 'fp-ts/lib/Eq'
import {
  FoldableWithIndex,
  FoldableWithIndex1,
  FoldableWithIndex2,
  FoldableWithIndex2C,
  FoldableWithIndex3
} from 'fp-ts/lib/FoldableWithIndex'
import { HKT, Kind, Kind2, Kind3, URIS, URIS2, URIS3 } from 'fp-ts/lib/HKT'
import { flow } from 'fp-ts/lib/function'
import { BehaviorSubject, Observable } from 'rxjs'
import * as Rx from 'rxjs/operators'

/**
 * Reactive key value data structure.
 */
export interface RxMap<K, V> extends Observable<ReadonlyMap<K, Observable<V>>> {}

/**
 * Create RxMap from @param foldable.
 * Outer Observable emits only when the incoming keys are changes.
 * When keys stay the same, updates are propagated through internal observables.
 */
export function fromFoldable<F extends URIS3, K>(
  foldable: FoldableWithIndex3<F, K>
): <R, E, A>(ma: Observable<Kind3<F, R, E, A>>) => RxMap<K, A>
export function fromFoldable<F extends URIS2, K>(
  foldable: FoldableWithIndex2<F, K>
): <E, A>(ma: Observable<Kind2<F, E, A>>) => RxMap<K, A>
export function fromFoldable<F extends URIS2, K, E>(
  foldable: FoldableWithIndex2C<F, K, E>
): <A>(ma: Observable<Kind2<F, E, A>>) => RxMap<K, A>
export function fromFoldable<F extends URIS, K>(
  foldable: FoldableWithIndex1<F, K>
): <A>(ma: Observable<Kind<F, A>>) => RxMap<K, A>
export function fromFoldable<F, K>(
  foldable: FoldableWithIndex<F, K>
): <A>(ma: Observable<HKT<F, A>>) => RxMap<K, A>
export function fromFoldable<F, K>(
  foldable: FoldableWithIndex<F, K>
): <A>(ma: Observable<HKT<F, A>>) => RxMap<K, A> {
  return flow(
    Rx.distinctUntilChanged(), // discard updates which are equal by reference check
    Rx.scan(
      (oldState, value) =>
        foldable.reduceWithIndex(
          value,
          new Map<K, BehaviorSubject<any>>(),
          (key, result, value) => {
            const existing = oldState.get(key)
            if (existing !== undefined) {
              result.set(key, existing)
              existing.next(value)
            } else {
              result.set(key, new BehaviorSubject(value))
            }

            return result
          }
        ),
      new Map<K, BehaviorSubject<any>>()
    ),
    Rx.distinctUntilChanged(getEqByValue<K, any>(Eq.fromEquals(() => true)).equals)
  )
}

/**
 * @returns Eq instance on Map which checks map keys equality by reference.
 * and map values by @param valueEq
 */
function getEqByValue<K, A>(valueEq: Eq.Eq<A>): Eq.Eq<Map<K, A>> {
  return {
    equals: (a, b) => {
      if (a === b) {
        return true
      } else if (a.size === b.size) {
        // Map.keys() + Map.get() works from 5% to 30% faster than Map.entries() on V8
        const entries = a.keys()
        let e: IteratorResult<K>

        while (!(e = entries.next()).done) {
          if (!b.has(e.value) || !valueEq.equals(a.get(e.value)!, b.get(e.value)!)) {
            return false
          }
        }

        return true
      } else {
        return false
      }
    }
  }
}
