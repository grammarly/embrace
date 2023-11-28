// Must not be empty for swc. See https://github.com/swc-project/swc/issues/7822

import {
  FoldableWithIndex,
  FoldableWithIndex1,
  FoldableWithIndex2C
} from 'fp-ts/lib/FoldableWithIndex'
import { Kind, Kind2, URIS, URIS2 } from 'fp-ts/lib/HKT'

export type FoldableWithIndexAny<F, I> = F extends URIS
  ? FoldableWithIndex1<F, I>
  : F extends URIS2
  ? FoldableWithIndex2C<F, I, any>
  : FoldableWithIndex<F, I>

export type KindAny<F, A, I> = F extends URIS
  ? Kind<F, A>
  : F extends URIS2
  ? Kind2<F, I, A>
  : never
