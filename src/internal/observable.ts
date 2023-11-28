import { Applicative1 } from 'fp-ts/lib/Applicative'
import { combineLatest, Observable, of as rxOf } from 'rxjs'
import { map } from 'rxjs/operators'

declare module 'fp-ts/lib/HKT' {
  interface URItoKind<A> {
    readonly Observable: Observable<A>
  }
}

export const URI = 'Observable'
export type URI = typeof URI

export const of: <A>(a: A) => Observable<A> = a => rxOf(a)

export const ApplicativeCombine: Applicative1<URI> = {
  URI,
  map: (fa, f) => fa.pipe(map(f)),
  ap: (fab, fa) => combineLatest([fab, fa]).pipe(map(([fab, fa]) => fab(fa))),
  of
}
