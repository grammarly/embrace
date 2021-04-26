/**
 * refine product of records into one record
 **/
export type Id<T> = T extends unknown ? { readonly [K in keyof T]: T[K] } : never
export type NotNever<T> = { readonly [K in keyof T]: T[K] extends never ? never : K }[keyof T]
export type DropNever<T> = T extends unknown ? { readonly [K in NotNever<T>]: T[K] } : never
export type Merge<T, U> = Id<DropNever<T & { readonly [K in keyof U]: never }> & U>
/**
 * example:
 * ```ts
 * function f<T extends Exact<'a', T>>(a: T): void {}
 * f({ a: 'a' })
 * // $ExpectError
 * // f({ a: 'a', b: 1 })
 * ```
 */
export type Exact<AllowedProps extends PropertyKey, A extends object> = A &
  Record<Exclude<keyof A, AllowedProps>, never>

export type RecordWithSingleKey<Keys> = Exclude<Keys, LastKey<Keys>> extends never ? Keys : never

export type LastKey<T> = IntersectOf<T extends unknown ? (x: T) => void : never> extends (
  x: infer P
) => void
  ? P
  : never

type IntersectOf<T> = (T extends unknown ? (k: T) => void : never) extends (k: infer I) => void
  ? I
  : never

export type IsNever<T> = '__IS_NEVER' | T extends '__IS_NEVER' ? true : false

export type EmptyWhenNever<T> = [T] extends [never] ? {} : T
