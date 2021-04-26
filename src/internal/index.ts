import { I } from 'ts-toolbelt'
import { UI } from '../ui'
import { KindAny } from './foldable'
import { DropNever, EmptyWhenNever, Id, IsNever, Merge, RecordWithSingleKey } from './utils'

/**
 * Recursive traverse through @param Part until the end of the @param Path
 * At the end old UI Part will be replaced with @param NewNode
 */
export type ChangeDescendant<
  Part extends UIAny,
  Path extends string[],
  NewNode extends UIAny
> = Part extends unknown
  ? _ChangeDescendant<Part, Path, NewNode> // hide type complexity to make it more readable in usage places
  : never

export type FocusDescendant<Part extends UIAny, Path extends string[]> = Part extends unknown
  ? _FocusDescendant<Part, Path> // hide type complexity to make it more readable in usage places
  : never

export type Decompose<Part extends UIAny> = Part extends unknown
  ? _Decompose<Part> // hide type complexity to make it more readable in usage places
  : never

export type Recompose<Part extends UIAny, State, Action> = Part extends unknown
  ? _Recompose<Part, State, Action> // hide type complexity to make it more readable in usage places
  : never

// ###### BEWARE ######
//
// In this file we heavy using the indexed mapped types to workaround
// Typescript limitations on recursive conditional types.
//
// They very helps us here due to several reasons:
// 1. They are lazy in evaluation, which helps in proper recursion teardown
// 2. After that PR (@see https://github.com/microsoft/TypeScript/pull/30769) they have very significant internal performance optimizations, and now they work faster than simple nested condition types
// 3. They improve readability in big recursions types (like we have here)
//
// But a strong disadvantage here: indexed types require to write a big boilerplate
// to make possible to iterate over structures with them. To save our time here we decided to use a library which encapsulate
// the heaviest parts of that boilerplate.
//
// However this approach is not officially supported, (@see https://github.com/microsoft/TypeScript/issues/26223#issuecomment-513187373
// (also @see https://github.com/microsoft/TypeScript/issues/26980#issuecomment-421354117)
// It is the only way how we can deal with such types in both typescript versions 3.9 and 3.7
//
// P.S. one more good sign of the fate of this approach: https://github.com/microsoft/TypeScript/pull/32131/files#diff-f513b52f385dc8851d644bd07e470664R1
// (Typescript team uses the same hack to fix types for built-in js runtime)

export type ROOT = 'root'
export const ROOT: ROOT = 'root'

export type _ComposedState<
  _Node extends UIAny,
  I extends I.Iteration = I.IterationOf<'8'>
> = _Node extends infer Node // defer type evaluation, helps with compilation performance
  ? {
      readonly node: Node extends UI.Node<infer S, any>
        ? S // for UINode just return state
        : never

      readonly list: Node extends UI.List<infer F, infer K, infer Node> // if we got UIList - return wrapped into HKT by list type and continue iteration
        ? KindAny<F, _ComposedState<Node, I.Prev<I>>, K>
        : never

      readonly composite: Node extends UI.Composite<infer Child>
        ? _ComposedState<Child, I.Prev<I>>
        : never

      readonly knot: Node extends UI.Knot<infer S, any, infer Children>
        ? DropNever<
            {
              readonly [K in keyof Children]: _ComposedState<Children[K], I.Prev<I>> // iterate over each children, and
            } & { readonly [ROOT]: S } // append own UIKnot state in `ROOT` namespace.
          > // and ignore all children which state are never
        : never

      readonly union: Node extends UI.Union<infer Tag, infer Members>
        ? {
            readonly [K in keyof Members]: Id<
              { readonly [P in Tag]: K } & // skip state merge operation if member state are never
                EmptyWhenNever<_ComposedState<Members[K], I.Prev<I>>>
            >
          }[keyof Members]
        : never

      readonly unknown: unknown
    }[I.Pos<I> extends 0 ? 'unknown' : UIMatcher<Node>]
  : never

export type _ComposedAction<
  _Node extends UIAny,
  I extends I.Iteration = I.IterationOf<'7'>
> = _Node extends infer Node // defer type evaluation, helps with compilation performance
  ? {
      readonly node: Node extends UI.Node<any, infer I>
        ? I // for UINode just return action
        : never

      readonly list: Node extends UI.List<any, infer K, infer Node> // if we got UIList - return wrapped into namespace by list key and continue iteration
        ? KeyedAction<K, _ComposedAction<Node, I.Prev<I>>> // dummy mapped type required to workaround typescript limitations on recursive types
        : never

      readonly composite: Node extends UI.Composite<infer Child>
        ? _ComposedAction<Child, I.Prev<I>>
        : never

      readonly knot: Node extends UI.Knot<any, infer A, infer Children>
        ?
            | KeyedAction<ROOT, A> // Append own UIKnot action in `root` namespace, and
            | {
                readonly [K in keyof Children]: KeyedAction<
                  K,
                  _ComposedAction<Children[K], I.Prev<I>>
                >
              }[keyof Children] // form action union from iteration over each children.
        : never

      readonly union: Node extends UI.Union<any, infer Members>
        ? {
            readonly [K in keyof Members]: KeyedAction<K, _ComposedAction<Members[K], I.Prev<I>>>
          }[keyof Members]
        : never
      readonly unknown: unknown
    }[I.Pos<I> extends 0 ? 'unknown' : UIMatcher<Node>]
  : never

type _Decompose<Part extends UIAny, I extends I.Iteration = I.IterationOf<'10'>> = {
  readonly node: Part extends UI.Node<infer State, infer Action> ? [State, Action] : never
  readonly list: Part extends UI.List<any, any, infer Child> ? _Decompose<Child, I.Prev<I>> : never
  readonly composite: Part extends UI.Composite<infer Child> ? _Decompose<Child, I.Prev<I>> : never
  readonly knot: Part extends UI.Knot<infer State, infer Action, any> ? [State, Action] : never
  readonly union: never // union does not has own state|actions, so we do not support such case here
  readonly unknown: never
}[I.Pos<I> extends 0 ? 'unknown' : UIMatcher<Part>]

type _Recompose<
  _Part extends UIAny,
  State,
  Action,
  I extends I.Iteration = I.IterationOf<'10'>
> = _Part extends infer Part // defer type evaluation, helps with compilation performance
  ? {
      readonly node: UI.Node<State, Action>
      readonly list: Part extends UI.List<infer F, infer K, infer Child>
        ? UI.List<F, K, _Recompose<Child, State, Action, I.Prev<I>>>
        : never
      readonly composite: Part extends UI.Composite<infer Child>
        ? UI.Composite<_Recompose<Child, State, Action, I.Prev<I>>>
        : never
      readonly knot: Part extends UI.Knot<any, any, infer Children>
        ? UI.Knot<State, Action, Children>
        : never
      readonly union: never // union does not has own state|actions, so we do not support such case here
      readonly unknown: never
    }[I.Pos<I> extends 0 ? 'unknown' : UIMatcher<Part>]
  : never

type _FocusDescendant<
  _Part extends UIAny,
  Path extends string[],
  I extends I.Iteration = I.IterationOf<'0'>
> = _Part extends infer Part // defer type evaluation, helps with compilation performance
  ? {
      readonly node: Part
      readonly list: Part extends UI.List<any, any, infer Children>
        ? _FocusDescendant<Children, Path, I>
        : never
      readonly composite: Part extends UI.Composite<infer Child>
        ? _FocusDescendant<Child, Path, I>
        : never
      readonly knot: Part extends UI.Knot<any, any, infer Children>
        ? _FocusDescendant<Children[Path[I.Pos<I>]], Path, I.Next<I>>
        : never
      readonly union: Part extends UI.Union<any, infer Members>
        ? _FocusDescendant<Members[Path[I.Pos<I>]], Path, I.Next<I>>
        : never
      readonly unknown: unknown
    }[I.Pos<I> extends Path['length'] ? 'node' : UIMatcher<Part>]
  : never

type _ChangeDescendant<
  _Part extends UIAny,
  Path extends string[],
  NewNode extends UIAny,
  I extends I.Iteration = I.IterationOf<'0'>
> = _Part extends infer Part // defer type evaluation, helps with compilation performance
  ? {
      readonly node: NewNode
      readonly list: Part extends UI.List<infer F, infer K, infer Children>
        ? UI.List<F, K, _ChangeDescendant<Children, Path, NewNode, I>> // jump into list content and continue traversing current path
        : never
      readonly composite: Part extends UI.Composite<infer Child>
        ? _ChangeDescendant<Child, Path, NewNode, I> // continue iteration on Composite internals
        : never
      readonly knot: Part extends UI.Knot<infer S, infer A, infer Children>
        ? UI.Knot<
            // reconstructing new Knot
            S, // with same State
            A, // and Action
            Merge<
              // but with changed children
              Children, // split path into head and tail
              {
                readonly // and continue traversing current pos path member, and increment iterator position
                [K in Path[I.Pos<I>]]: _ChangeDescendant<
                  Children[Path[I.Pos<I>]],
                  Path,
                  NewNode,
                  I.Next<I>
                >
              }
            >
          >
        : never
      readonly union: Part extends UI.Union<infer Tag, infer Members>
        ? UI.Union<
            // reconstruct new Union
            Tag, // with same Tag
            Merge<
              // but with changed members
              Members, // split path into head and tail
              {
                readonly // and continue traversing current pos path member, and increment iterator position
                [K in Path[I.Pos<I>]]: _ChangeDescendant<
                  Members[Path[I.Pos<I>]],
                  Path,
                  NewNode,
                  I.Next<I>
                >
              }
            >
          >
        : never
      readonly unknown: never
    }[I.Pos<I> extends Path['length'] ? 'node' : UIMatcher<Part>]
  : never

export type GridWithSingleSlotWithoutStateAndActions<Node extends UIAny> = Node extends UI.Grid<
  infer S,
  infer A,
  infer Slot
>
  ? RecordWithSingleKey<Slot> extends never
    ? never
    : IsNever<S> extends true
    ? IsNever<A> extends true
      ? Node
      : never
    : never
  : never

/**
 * Any renderable UI Tree element which has own `State` & `Action`
 */
export type UIAnyWithOwnSA = UINodeAny | UIKnotAny | UIListAny
export type UIAny = UIAnyWithOwnSA | UIUnionAny | UICompositeAny
export type UINodeAny = UI.Node<any, any>
export type UIKnotAny = UI.Knot<any, any, any>
export type UICompositeAny = UI.Composite<any>
export type UIListAny = UI.List<any, any, any>
export type UIUnionAny = UI.Union<any, any>

/**
 * Transforms provided @param Part into string literal.
 * Useful for pattern matching over indexed mapped types.
 */
type UIMatcher<Part> = Part extends UINodeAny
  ? 'node'
  : Part extends UIListAny
  ? 'list'
  : Part extends UICompositeAny
  ? 'composite'
  : Part extends UIKnotAny
  ? 'knot'
  : Part extends UIUnionAny
  ? 'union'
  : 'unknown'

// Wrapping in tuple disables type distribution in conditional types.
// We need it to have a more readable union types.
// inspired from: https://github.com/microsoft/TypeScript/issues/29368#issuecomment-453529532
export type KeyedAction<K, I> = [I] extends [never]
  ? never
  : { readonly key: K; readonly action: I }
