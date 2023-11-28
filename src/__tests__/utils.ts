import { FoldableWithIndex2C } from 'fp-ts/lib/FoldableWithIndex'

export function getMapFoldableWithIndex<K = never>(): FoldableWithIndex2C<any, K, K> {
  const reduceWithIndex = <K, A, B>(map: Map<K, A>, b: B, f: (k: K, b: B, a: A) => B): B => {
    let result: B = b

    map.forEach((v: A, k: K) => (result = f(k, result, v)))

    return result
  }

  return {
    URI: 'Map',
    _E: (undefined as unknown) as K,
    reduce: (fa, b, f) => reduceWithIndex(fa, b, (_, x, y: any) => f(x, y)),
    foldMap: M => (fa, f) => reduceWithIndex(fa, M.empty, (_, x, y: any) => M.concat(x, f(y))),
    reduceRight: (fa, b, f) => reduceWithIndex(fa, b, (_, x, y: any) => f(y, x)),
    reduceWithIndex,
    reduceRightWithIndex: (fa, b, f) => reduceWithIndex(fa, b, (k: any, x, y: any) => f(k, y, x)),
    foldMapWithIndex: M => (fa, f) =>
      reduceWithIndex(fa, M.empty, (k: any, x, y: any) => M.concat(x, f(k, y)))
  }
}

export function assertNever(x: never): never {
  throw new Error(`Matching not exhaustive${x ? `: unexpected value ${JSON.stringify(x)}` : ''}`)
}
