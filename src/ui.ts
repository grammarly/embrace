import * as React from 'react'
import { IO } from 'fp-ts/lib/IO'
import * as O from 'fp-ts/lib/Option'
import * as R from 'fp-ts/lib/Reader'
import * as Record from 'fp-ts/lib/Record'
import { constVoid, flow, identity } from 'fp-ts/lib/function'
import { pipe } from 'fp-ts/lib/pipeable'
import { EMPTY, Observable, Subject } from 'rxjs'
import * as Rx from 'rxjs/operators'
import { F } from '@grammarly/focal'
import { Flow } from './flow'
import {
  _ComposedAction,
  _ComposedState,
  ChangeDescendant,
  Decompose,
  FocusDescendant,
  GridWithSingleSlotWithoutStateAndActions,
  KeyedAction,
  Recompose,
  ROOT,
  UIAny,
  UIAnyWithOwnSA,
  UICompositeAny,
  UIKnotAny,
  UIListAny,
  UINodeAny,
  UIUnionAny
} from './internal'
import { FoldableWithIndexAny } from './internal/foldable'
import { fromFoldable } from './internal/rx_map'
import { splitBy } from './internal/rx_split_by'
import { Exact } from './internal/utils'

export namespace UI {
  /**
   * The most basic part of UI.
   * Represents how to render UI according to @param State.
   * And emits @param Action to side-effects from interactions with UI.
   *
   * example:
   * ```ts
   * UI.Node<
   *   { count: number }, // UI state
   *   "increment" | "decrement" // actions which UI can emit
   * >
   * ```
   */
  export interface Node<State, Action> extends UIPart<State, Action, never> {}

  /**
   * Part of UI like UI.Node, with configurable holes (@param Slots) for extending.
   * Useful in composition of UI elements.
   *
   * example:
   * ```ts
   * UI.Grid<
   *   { count: number }, // UI state
   *   "increment" | "decrement", // actions which UI can emit
   *   "footer" | "header" // holes where can be placed other UI parts
   * >
   * ```
   */
  export interface Grid<State, Action, Slots> extends UIPart<State, Action, Slots> {}

  /**
   * Composition of UI Parts.
   * Contains own @param State & @param Action with children (@param Children) UI parts.
   *
   * example:
   * ```ts
   * UI.Knot<
   *   { scrollTop: number }, // UI state
   *   { scrollOffset: number }, // actions which UI can emit
   *   { // record of children nodes with own state/action pairs.
   *     first: UI.Node<string, "click">
   *     second: UI.Node<number, "hover">
   *   }
   * >
   * ```
   */
  export interface Knot<State, Action, Children extends Record<string, UIAny>> {
    readonly grid: UI.Grid<State, Action, keyof Children>
    readonly children: Children
  }

  /**
   * Similar to UI.Knot, but unlike UI.Knot, does not create the root object for its @param Child.
   * The State & Actions of the @param Child is propagated to the State & Actions of the Composite.
   * UI.Composite works only with UI.Grid with the single slot and without State & Actions (State & Actions equals `never`)
   *
   * example:
   * ```ts
   * UI.Composite<UI.Node<string, "click">>
   * ```
   */
  export interface Composite<Child extends UIAny> {
    readonly grid: UI.Grid<never, never, any>
    readonly child: Child
  }

  /**
   * Special case of {@link UI.Knot} where composition container does not have own State & Action.
   *
   * example:
   * ```ts
   * UI.Group<
   *   { // record of children nodes with own state/action pairs.
   *     header: UI.Node<string, "click">
   *     footer: UI.Node<number, "hover">
   *   }
   * >
   * ```
   */
  export interface Group<Children extends Record<string, UIAny>>
    extends Knot<never, never, Children> {}

  /**
   * Represents a collection of UI parts with dynamic size.
   *
   * @param F is a High Kind Type reference to collection constructor.
   * @param Foldable is a reference to HKT Foldable instance.
   * @param Children is a UI part which take a place of collection values.
   *
   * example:
   * ```ts
   * UI.List<"Array", number, UI.Node<string, "nameClick">>
   * ```
   */
  export interface List<F, I, Children extends UIAny> {
    readonly foldable: FoldableWithIndexAny<F, I>
    readonly of: Children
  }

  /**
   * Represents a union of UI parts where only one UI part can be rendered at a time.
   *
   * @param Tag is a discriminant which will be placed in state, and by which we will choose which one UI part
   * from @param Members should be rendered now.
   */
  export interface Union<Tag extends string, Members extends Record<string, UIAny>> {
    readonly tag: Tag
    readonly members: Members
  }

  /**
   * Represents a transition animation from @param In to @param Out
   */
  export interface Transition<In, Out>
    extends UI.Grid<O.Option<In | Out>, Transition.Action<In | Out>, 'children'> {
    /** Phantom type for expressing inbound transitions */
    readonly _in: In
    /** Phantom type for expressing outbound transitions */
    readonly _out: Out
  }

  /**
   * Represents an animated part of UI Tree which @param Children are wrapped in animated transition from @param In to @param Out
   */
  export interface Animated<In, Out, Children extends UIAny>
    extends UI.List<
      Record.URI,
      string,
      UI.Knot<O.Option<In | Out>, Transition.Action<In | Out>, { readonly children: Children }>
    > {}

  /**
   * All possible types of UI parts.
   * *WARNING* This type is unsafe. Use it only in generic interfaces
   */
  export type Any = UIAny

  export namespace Node {
    export const empty: UI.Node<never, never> = () => (null as any) as ReactElement

    /**
     * Create an instance of {@link UI.Node}
     *
     * example:
     * ```ts
     * const Button = UI.Node.make<
     *   string, // component state,
     *   'click' // and possible actions should be manually specified.
     * >(({
     *   // We can access property `state` in cases when component `State` is not never.
     *   state, // Here it is a `Observable<string>`
     *   // We can access property `notify` in cases when component `Action` is not never.
     *   notify // Here it is a `(type: 'click') => () => void`
     * }) => (
     *   <F.button onClick={notify('click')}>{state}</F.button>
     * ))
     * //------------------------------------------------------------------------
     * const Counter = UI.Node.make<
     *   { count: number }, // component state,
     *   'increment' | 'decrement' // and possible actions should be manually specified.
     * >(({
     *   // In cases when component `State` has an object signature, we can access property `view` which works like `pluck`.
     *   view,
     *   notify
     * }) => (
     *     <div>
     *       <F.span>{view('count')}</F.span>
     *       <footer>
     *         <button onClick={notify('increment')}>+</button>
     *         <button onClick={notify('decrement')}>-</button>
     *       </footer>
     *     </div>
     *   )
     * )
     * ```
     */
    export function make<State = never, Action = never>(
      component: React.FC<InitProps<State, Action, never>>
    ): UI.Node<State, Action> {
      return UI.Grid.make(component)
    }
  }

  export namespace Grid {
    /**
     * Create an instance of {@link UI.Grid}
     *
     * example:
     * ```ts
     * const Container = UI.Grid.make<
     *   'header' | 'footer', // component slots,
     *   never, // component state,
     *   'hover' // and possible actions should be manually specified.
     * >(({
     *   slots, // Record<'header' | 'footer', Observable<ReactNode>>
     *   notify
     * }) => (
     *   <div onMouseMove={notify('hover')}>
     *     <F.header>{slots.header}</F.header>
     *     <F.footer>{slots.footer}</F.footer>
     *   </div>
     * ))
     * ```
     */
    export function make<Slots extends PropertyKey, State = never, Action = never>(
      component: React.FC<InitProps<State, Action, Slots>>
    ): UI.Grid<State, Action, Slots> {
      return ({ children, state, notify }) =>
        React.createElement(component, {
          slots: children,
          state,
          notify: (i: Action) => () => notify(i),
          view: (...k: string[]) => pipe(state, Rx.pluck(...k), Rx.distinctUntilChanged())
        } as any)
    }
  }

  export namespace Composite {
    /**
     * Create an instance of {@link UI.Composite}, which joins @param grid slot with corresponding @param child.
     * @param grid can only have a single slot, and should not have State & Actions
     *
     * example:
     * ```ts
     * const StyleProvider = UI.Grid.make<'children'>(({ slots }) => (
     *   <F.div className={style.myClass}>{slots.children}</F.div>
     * ))
     *
     * const Button = UI.Node.make<string, 'click'>(({ state, notify }) => (
     *   <F.button onClick={notify('click')}>{state}</F.button>
     * ))
     *
     * // UI.ComposedState<typeof Composite> === UI.ComposedState<typeof Button> &&
     * // UI.ComposedActions<typeof Composite> === UI.ComposedActions<typeof Button>
     * const Composite = UI.Composite.make(StyleProvider, Button)
     * ```
     */
    export function make<Grid extends UI.Grid<never, never, any>, Child extends UIAny>(
      grid: GridWithSingleSlotWithoutStateAndActions<Grid>,
      child: Child
    ): UI.Composite<Child> {
      return {
        grid,
        child
      }
    }
  }

  export namespace Knot {
    /**
     * Create a instance of {@link UI.Knot} which joins @param grid slots with corresponding @param children.
     * @param children keys are strongly types, and will raise compile error on unknown slots.
     *
     * @returns {@link UI.Knot}
     *
     * example:
     * ```ts
     * const Button = UI.Node.make<string, 'click'>(({ state, notify }) => (
     *   <F.button onClick={notify('click')}>{state}</F.button>
     * ))
     *
     * const Container = UI.Grid.make<'header' | 'footer'>(({ slots }) => (
     *  <div>
     *    <F.header>{slots.header}</F.header>
     *    <F.footer>{slots.footer}</F.footer>
     *  </div>
     *))
     *
     * // declare const Component: UI.Knot<never, never, { header: UI.Node<string, 'click'>; footer: UI.Node<string, 'click'> }>
     * const Component = UI.Knot.make(Container, {
     *   header: Button,
     *   footer: Button
     * })
     * ```
     */
    export function make<
      State,
      Action,
      Slots extends PropertyKey,
      Children extends {
        readonly [K in Slots]: UIAny
      }
    >(
      grid: UI.Grid<State, Action, Slots>,
      children: Exact<Slots, Children>
    ): UI.Knot<State, Action, { readonly [K in Slots]: Children[K] }> {
      return { grid, children }
    }
  }

  export namespace Group {
    /**
     * Create a instance of {@link UI.Group} by composing record of UI part (@param children).
     * It is basically a {@link UI.Knot} with `grid` as Focal.Fragment.
     *
     * example:
     * ```ts
     * const Button = UI.Node.make<string, 'click'>(({ state, notify }) => (
     *   <F.button onClick={notify('click')}>{state}</F.button>
     * ))
     *
     * // declare const Component: UI.Group<{ left: UI.Node<string, 'click'>; right: UI.Node<string, 'click'> }>
     * const Component = UI.Group.make({
     *   left: Button,
     *   right: Button
     * })
     * ```
     */
    // TODO: consider to make it as overload of UI.Knot.Make
    export function make<Children extends Record<string, UIAny>>(
      children: Children
    ): UI.Group<{ readonly [K in keyof Children]: Children[K] }> {
      return {
        grid: props =>
          toFragment(
            pipe(
              props.children,
              Record.collect((_, v) => v)
            )
          ),
        children
      }
    }
  }

  export namespace List {
    /**
     * Create a instance of {@link UI.List} by composing UI part (@param of) with collection @param foldable.
     * Useful for creating a lists of same components with dynamic size.
     *
     * example:
     * ```ts
     * const Button = UI.Node.make<string, 'click'>(({ state, notify }) => (
     *   <F.button onClick={notify('click')}>{state}</F.button>
     * ))
     *
     * import * as A from 'fp-ts/lib/Array'
     *
     * // declare const ButtonList: UI.List<"Array", number, UI.Node<string, 'click'>>
     * const ButtonList = UI.List.make(A.array, Button)
     * ```
     */
    export function make<F, I, Node extends UIAny>(
      foldable: FoldableWithIndexAny<F, I>,
      of: Node
    ): UI.List<F, I, Node> {
      return { foldable, of }
    }
  }

  export namespace Union {
    /**
     * Create a instance of {@link UI.Union} with discriminant @param tag
     * and possible render variants defined in @param members.
     * Which one of the @param members is rendered at any given time is determined by the value of @param tag in a `Flow` state.
     *
     * example:
     * ```ts
     * declare const Button: UI.Node<{ label: string }, 'click'>
     * declare const Field: UI.Node<{ left: number; right: number }, 'click'>
     *
     * // declare const ButtonOrField: UI.Union<"type", {
     * //   foo: UI.Node<{ label: string }, 'click'>;
     * //   bar: UI.Node<{ left: number; right: number }, 'click'>
     * // }>
     * const ButtonOrField = UI.Union.make('type', { foo: Button, bar: Field })
     * ```
     */
    export function make<Tag extends string, Members extends Record<string, UIAny>>(
      tag: Tag,
      members: Members
    ): UI.Union<Tag, Members> {
      return { tag, members }
    }

    /** Represents an instance of {@link UI.Union} that renders Some or UI.Node.Empty */
    export interface Option<Some extends UIAny>
      extends UI.Union<
        '_tag',
        {
          readonly Some: UI.Group<{ readonly value: Some }>
          readonly None: UI.Node<O.None, never>
        }
      > {}

    /**
     * Create an instance of {@link UI.Union} that renders @param some or UI.Node.Empty
     * depending on the Option value
     * @param some Node to render in case of some value
     */
    export function asOption<Some extends UIAny>(some: Some): UI.Union.Option<Some> {
      return {
        tag: '_tag',
        members: {
          Some: UI.Group.make({ value: some }),
          None: UI.Node.empty as UI.Node<O.None, never>
        }
      }
    }
  }

  export namespace Transition {
    /** Signals beginning or end of a transition */
    export type Action<Type> = Start<Type> | End<Type>

    /** Represents a "Start" animation type of a transition */
    export interface Start<Type> {
      readonly kind: 'start'
      readonly animationType: Type
    }

    /** Represents an "End" state of an animated transition */
    export interface End<Type> {
      readonly kind: 'end'
      readonly animationType: Type
    }

    /**
     * Create an instance of {@link UI.Transition} from @param InTransition and @param OutTransition
     * by wrapping inner UI tree in an "animation-wrapper" div that handles transition animation by changing its CSS class name dynamically
     *
     * example:
     * ```ts
     * // declare const transition: UI.Transition<"fadein", "fadeout">
     * const transition = UI.Transition.make(
     *   {
     *     fadein: 'fadein-animation'
     *   },
     *   {
     *     fadeout: 'fadeout-animation'
     *   }
     * )
     * ```
     */
    export function make<
      InTransition extends Record<string, string>,
      OutTransition extends Record<string, string>
    >(
      inTransition: InTransition,
      outTransition: OutTransition
    ): UI.Transition<keyof InTransition, keyof OutTransition> {
      return (s =>
        React.createElement(F.div, {
          ['data-purpose' as any /** Focal does not allow data attributes in types =( */]: 'animation-wrapper',
          children: s.children.children /** Transition's always has only one slot - `children` */,
          className: pipe(
            s.state,
            Rx.map(
              flow(
                O.map(name => (inTransition as any)[name] || (outTransition as any)[name]),
                O.toUndefined
              )
            ),
            Rx.distinctUntilChanged()
          ),
          onAnimationStart: pipe(
            s.state,
            Rx.map(
              O.fold(
                () => constVoid,
                animationType => () => s.notify({ kind: 'start', animationType })
              )
            )
          ),
          onAnimationEnd: pipe(
            s.state,
            Rx.map(
              O.fold(
                () => constVoid,
                animationType => () => s.notify({ kind: 'end', animationType })
              )
            )
          )
        })) as UI.Transition<keyof InTransition, keyof OutTransition>
    }
  }

  export namespace Animated {
    /**
     * Create an instance of {@link UI.Animated} component by wrapping @param of children into @param transition animation
     *
     * example:
     * ```ts
     * const comp = UI.Union.make('kind', {
     *   one: CompOne,
     *   two: CompTwo,
     *   three: CompThree
     * })
     * const transition = UI.Transition.make(
     *   {
     *     fadein: 'fadein-animation'
     *   },
     *   {
     *     fadeout: 'fadeout-animation'
     *   }
     * )
     * // declare const animated: UI.Animated<"fadein", "fadeout", UI.Union<"kind", {
     * //     one: UI.Node<never, never>;
     * //     two: UI.Node<State1, "toOne">;
     * //     three: UI.Node<State2, "toTwo" | "inc">;
     * // }>>
     * const animated = UI.Animated.make(transition, comp)
     * ```
     */
    export function make<In, Out, Children extends UIAny>(
      transition: Transition<In, Out>,
      of: Children
    ): UI.Animated<In, Out, Children> {
      return UI.List.make(Record.record, UI.Knot.make(transition, { children: of }))
    }
  }

  /**
   * Transform @param uiNode into ReactElement by composing it with @param uiFlow.
   * @param uiFlow would be inferred from structure of @param uiNode.
   * @return ReactElement
   *
   * example:
   * ```ts
   * declare const Button: UI.Node<string, 'click'>
   * mount(Button, (s: Observable<'click'>) => Observable<string>)
   *
   * //--------------------------------------------------------------------------
   * declare const Component: UI.Knot<
   *   { scrollTop: number },
   *   { scrollOffset: number },
   *   {
   *     first: UI.Node<string, "click">
   *     second: UI.Node<number, "hover">
   *   }
   * >
   * mount(
   *   Button,
   *   (s: Observable<{
   *     key: 'root',
   *     action: { scrollOffset: number }
   *   } | {
   *     key: 'first'
   *     action: 'click'
   *   } | {
   *     key: 'second'
   *     action: 'hover'
   *   }
   * >) => Observable<{
   *   root: { scrollOffset: number }
   *   first: string
   *   second: number
   * }>)
   *
   * //--------------------------------------------------------------------------
   * declare const ButtonList: UI.List<"Array", number, UI.Node<string, 'click'>>
   * mount(
   *   ButtonList,
   *   (s: Observable<{ key: number; action: 'click' }>) => Observable<string[]>
   * )
   * ```
   */
  export function mount<Node extends UIAny>(
    uiNode: Node,
    uiFlow: Flow<ComposedAction<Node>, ComposedState<Node>>
  ): ReactElement {
    const action = new Subject<ComposedAction<Node>>()
    return squash(uiNode)({
      children: null as never,
      notify: i => action.next(i),
      state: pipe(
        uiFlow(action),
        // we can not use shareReplay here, because it makes observable "hot"
        // so, on unsubscription we will not clear current state,
        // and new subscriptions will get stale state
        // see https://blog.strongbrew.io/share-replay-issue/
        Rx.publishReplay(1),
        Rx.refCount()
      )
    })
  }

  /**
   * Modify UI Tree by changing UI Parts at provided @param path.
   * @return new UI Tree with updated structure.
   *
   * example:
   * ```ts
   * declare const Component: UI.Knot<
   *   never,
   *   never,
   *   {
   *     header: UI.Node<string, "click">
   *     footer: UI.List<
   *       "Array",
   *       number,
   *       UI.Group<{
   *         top: UI.Node<number, "hover">
   *         bottom: UI.Node<number, "hover">
   *       }>
   *     >
   *   }
   * >
   *
   * // drop list combinator
   * pipe(Component, UI.patch('footer')(list => list.of.children.top))
   * // $ShouldEqualTo
   * UI.Knot<
   *   never,
   *   never,
   *   {
   *     header: UI.Node<string, "click">
   *     footer: UI.Node<number, "hover">
   *   }
   * >
   *
   * // change list content
   * declare const Checkbox: UI.Node<{ label:string }, { type: "switch"; state: boolean }>
   * pipe(Component, UI.patch('footer', 'top')(() => Checkbox))
   * // $ShouldEqualTo
   * UI.Knot<
   *   never,
   *   never,
   *   {
   *     header: UI.Node<string, "click">
   *     footer: UI.List<
   *       "Array",
   *       number,
   *       UI.Group<{
   *         top: UI.Node<{ label:string }, { type: "switch"; state: boolean }>
   *         bottom: UI.Node<number, "hover">
   *       }>
   *     >
   *   }
   * >
   * ```
   */
  export function patch<P extends string[]>(
    // TODO: typecheck tree path
    ...path: P
  ): <Node extends UIAny, NewNode extends UIAny>(
    f: (current: FocusDescendant<Node, P>) => NewNode
  ) => (root: Node) => ChangeDescendant<Node, P, NewNode> {
    return f => root => changeDescendant(root, path, f)
  }

  /**
   * Postprocess UI part actions.
   * Works only with top level `Action` kind.
   * If you need to work on UI Part children use that function with `UI.patch` or `UI.squash`.
   *
   * example:
   * ```ts
   * declare const Button: UI.Node<string, "click">
   * pipe(Button, UI.mapAction(action => ({ type: "Button" as const, action })))
   * // $ShouldEqualTo
   * UI.Node<string, { type: "Button"; action: "click" }>
   *
   * //--------------------------------------------------------------------------
   * declare const Component: UI.Knot<
   *   { scrollTop: number },
   *   { scrollOffset: number },
   *   {
   *     first: UI.Node<string, "click">
   *     second: UI.Node<number, "hover">
   *   }
   * >
   * pipe(Component, UI.mapAction(offset => offset > 200 ? ("bigScroll" as const) : ("smallScroll" as const)))
   * // $ShouldEqualTo
   * UI.Knot<
   *   { scrollTop: number },
   *   "bigScroll" | "smallScroll",
   *   {
   *     first: UI.Node<string, "click">
   *     second: UI.Node<number, "hover">
   *   }
   * >
   *
   * //--------------------------------------------------------------------------
   * declare const List: UI.List<"Array", number, UI.Node<string, "nameClick">>
   * pipe(List, UI.mapAction(action => ({ type: "Button" as const, action })))
   * // $ShouldEqualTo
   * UI.List<"Array", number, UI.Node<string, { type: "Button"; action: "nameClick" }>>
   * ```
   */
  export function mapAction<Node extends UIAnyWithOwnSA, Action>(
    f: (v: Decompose<Node>[1]) => Action
  ): (node: Node) => Recompose<Node, Decompose<Node>[0], Action> {
    return node => promap(node, identity, f)
  }

  /**
   * Preprocess UI part state.
   * Works only with top level `State` kind.
   * If you need to work on UI Part children use that function with `UI.patch` or `UI.squash`.
   *
   * example:
   * ```ts
   * declare const Button: UI.Node<string, "click">
   * pipe(Button, UI.contramapState((state: { label: string }) => state.label))
   * // $ShouldEqualTo
   * UI.Node<{ label: string }, "click">
   *
   * //--------------------------------------------------------------------------
   * declare const Component: UI.Knot<
   *   { scrollTop: number },
   *   { scrollOffset: number },
   *   {
   *     first: UI.Node<string, "click">
   *     second: UI.Node<number, "hover">
   *   }
   * >
   * pipe(Component, UI.contramapState((top: number) => ({ scrollTop: top })))
   * // $ShouldEqualTo
   * UI.Knot<
   *   number,
   *   { scrollOffset: number },
   *   {
   *     first: UI.Node<string, "click">
   *     second: UI.Node<number, "hover">
   *   }
   * >
   *
   * //--------------------------------------------------------------------------
   * declare const List: UI.List<"Array", number, UI.Node<string, "nameClick">>
   * pipe(List, UI.contramapState((_x: never) => "staticText"))
   * // $ShouldEqualTo
   * UI.List<"Array", number, UI.Node<never, "nameClick">>
   * ```
   */
  export function contramapState<Node extends UIAnyWithOwnSA, State>(
    f: (v: State) => Decompose<Node>[0]
  ): (node: Node) => Recompose<Node, State, Decompose<Node>[1]> {
    return node => promap(node, f, identity)
  }

  /**
   * WARNING: this function will break the Embrace composition possibilities.
   * Use Flow composition instead - create a small flow`s for the small components, and compose them using Flow.composeX.
   *
   * Transform nested composition of UI parts (@param uiNode) into single {@link UI.Node}.
   * @returns `UI.Node` with composed State & Action of @param uiNode.
   *
   * example:
   * ```ts
   * declare const ItemList: UI.List<
   *   "Record",
   *   string,
   *   UI.Knot<
   *    { margin: number },
   *    "scroll",
   *    {
   *      first: UI.Node<string, "click">
   *      second: UI.Node<number, "hover">
   *    }
   *   >
   * >
   *
   * const ItemComponent = UI.squash(ItemList)
   * // $ShouldEqualTo
   * declare const ItemComponent: UI.Node<
   *  Record<
   *   string, // list item key
   *   {
   *     root: number // state of the knot
   *     first: string // state of the first knot children
   *     second: number // state of the second knot children
   *   }
   *  >,
   *  {
   *   key: string // List item key
   *   action:
   *     | { key: "root"; action: "scroll" } // action of the knot
   *     | { key: "first"; action: "click" } // action of the first knot children
   *     | { key: "second"; action: "hover" } // action of the second knot children
   *  }
   * >
   * ```
   */
  export function squash<Node extends UIAny>(
    uiNode: Node
  ): UI.Node<ComposedState<Node>, ComposedAction<Node>> {
    if (isComposite(uiNode)) {
      return props => {
        // here we create an object what will always return `child` by calling any of its properties getter
        const children = new Proxy(
          {},
          {
            get: () =>
              squash(uiNode.child)({
                children: null as never,
                notify: props.notify,
                // state will be undefined in cases when children has state equal to never
                state: props.state || EMPTY
              })
          }
        )

        return uiNode.grid({
          children,
          state: EMPTY,
          notify: constVoid
        })
      }
    } else if (isKnot(uiNode)) {
      return props =>
        pipe(
          props.state,
          fromFoldable(Record.record),
          Rx.map(data => {
            const children = pipe(
              uiNode.children as Record<string, UIAny>,
              Record.mapWithIndex((key, part) =>
                // Here squash will be called only once, during first state emit, so it does not make sense to cache it
                makeNamespacedNode(
                  key,
                  squash(part)
                )({
                  children: null as never,
                  notify: props.notify,
                  // state will be undefined in cases when children has state equal to never
                  state: data.get(key) || EMPTY
                })
              )
            )

            return uiNode.grid({
              children,
              // state will be undefined in cases when grid has state equal to never
              state: data.get(ROOT) || EMPTY,
              notify: action => props.notify({ key: ROOT, action } as ComposedAction<Node>)
            })
          }),
          toFragment
        )
    } else if (isList(uiNode)) {
      return props =>
        pipe(
          props.state,
          fromFoldable(uiNode.foldable),
          Rx.scan((cache, data: Map<string, Observable<any>>) => {
            const children = new Map<string, ReactElement>()
            data.forEach((state, key) => {
              const cached = cache.get(key)
              if (cached !== undefined) {
                children.set(key, cached)
              } else {
                // TODO: Should we add a cache for that squash???
                const kc = makeNamespacedNode(key, squash(uiNode.of))
                children.set(key, kc({ children: null as never, notify: props.notify, state }))
              }
            })

            return children
          }, new Map<string, ReactElement>()),
          Rx.map(data => {
            const children = new Array<ReactElement>()
            data.forEach(v => children.push(v))
            return children
          }),
          toFragment
        )
    } else if (isUnion(uiNode)) {
      return props =>
        pipe(
          props.state,
          splitBy(uiNode.tag),
          Rx.map(state =>
            // TODO: Should we add a cache for that squash???
            makeNamespacedNode(
              state.key,
              squash(uiNode.members[state.key])
            )({
              children: null as never,
              notify: props.notify,
              state
            })
          ),
          toFragment
        )
    } else {
      return uiNode as UI.Node<ComposedState<Node>, ComposedAction<Node>>
    }
  }

  /**
   * Uncuried postprocess Action + preprocess State operation.
   * Obey Profunctor laws.
   *
   * see examples in {@link mapAction} & {@link contramapState}.
   */
  export function promap<Node extends UIAnyWithOwnSA, State, Action>(
    uiNode: Node,
    contramapState: (v: State) => Decompose<Node>[0],
    mapAction: (v: Decompose<Node>[1]) => Action
  ): Recompose<Node, State, Action> {
    if (isKnot(uiNode)) {
      return {
        grid: promap(uiNode.grid as Node, contramapState, mapAction),
        children: uiNode.children
      } as Recompose<Node, State, Action>
    } else if (isList(uiNode)) {
      return {
        foldable: uiNode.foldable,
        of: promap(uiNode.of, contramapState, mapAction)
      } as Recompose<Node, State, Action>
    } else {
      return (props =>
        (uiNode as UINodeAny)({
          children: props.children,
          notify: pipe(props.notify, R.local(mapAction)),
          state: pipe(props.state, Rx.map(contramapState))
        })) as Recompose<Node, State, Action>
    }
  }

  /**
   * @returns computed State of provided UI parts composition.
   *
   * example:
   * ```ts
   * declare const ItemList: UI.List<
   *   "Record",
   *   string,
   *   UI.Knot<
   *    { margin: number },
   *    "scroll",
   *    {
   *      first: UI.Node<string, "click">
   *      second: UI.Node<number, "hover">
   *    }
   *   >
   * >
   *
   * type ItemListState = UI.ComposedState<typeof ItemList>
   * // $ShouldEqualTo
   * type ItemListState = Record<
   *   string, // list item key
   *   {
   *     root: number // state of the knot
   *     first: string // state of the first knot children
   *     second: number // state of the second knot children
   *   }
   * >
   * ```
   */
  export type ComposedState<Node extends UIAny> = Node extends unknown
    ? _ComposedState<Node> // hide type complexity to make it more readable in usage places
    : never

  /**
   * @returns computed Actions of provided UI parts composition.
   *
   * example:
   * ```ts
   * declare const ItemList: UI.List<
   *   "Record",
   *   string,
   *   UI.Knot<
   *    { margin: number },
   *    "scroll",
   *    {
   *      first: UI.Node<string, "click">
   *      second: UI.Node<number, "hover">
   *    }
   *   >
   * >
   *
   * type ItemListAction = UI.ComposedAction<typeof ItemList>
   * // $ShouldEqualTo
   * type ItemListAction = {
   *   key: string // List item key
   *   action:
   *     | { key: "root"; action: "scroll" } // action of the knot
   *     | { key: "first"; action: "click" } // action of the first knot children
   *     | { key: "second"; action: "hover" } // action of the second knot children
   * }
   * ```
   */
  export type ComposedAction<Node extends UIAny> = Node extends unknown
    ? _ComposedAction<Node> // hide type complexity to make it more readable in usage places
    : never
}

interface ReactElement extends React.ReactElement<any, any> {}
interface UIPart<State, Action, Slots>
  extends R.Reader<
    MountProps<State, Action, Slots extends PropertyKey ? Slots : never>,
    ReactElement
  > {}

interface MountProps<State, Action, Slots extends PropertyKey> {
  readonly children: Record<Slots, Observable<React.ReactNode> | React.ReactNode>
  readonly state: Observable<State>
  notify(i: Action): void
}

type InitProps<State, Action, Slots extends PropertyKey> = ([State] extends [never] // without tuple wrapper when State is never typescript return never instead of what we have in true condition. See https://github.com/microsoft/TypeScript/issues/31751#issuecomment-498526919
  ? {} // append state prop if state is not never
  : {
      readonly state: Observable<State>
    } & (State extends object // append view helper if state has object like structure
      ? {
          // TODO: allow nested keys
          view<K extends keyof State>(key: K): Observable<State[K]>
        }
      : {})) &
  ([Action] extends [never]
    ? {} // append notify helper if actions is not never
    : { notify(type: Action): IO<void> }) &
  ([Slots] extends [never]
    ? {} // append children object if slots is not never
    : { readonly slots: Record<Slots, Observable<React.ReactNode> | React.ReactNode> })

function makeNamespacedNode<K extends string | number, Node extends UINodeAny>(
  key: K,
  node: Node
): UI.Node<Decompose<Node>[0], KeyedAction<K, Decompose<Node>[1]>> {
  return pipe(
    node,
    UI.mapAction(action => ({ key, action })),
    R.map(el => (el === null ? el : React.cloneElement(el, { key })))
  )
}

function changeDescendant<RootNode extends UIAny, P extends string[], NewNode extends UIAny>(
  parent: RootNode,
  path: P,
  f: (current: FocusDescendant<RootNode, P>) => NewNode
): ChangeDescendant<RootNode, P, NewNode> {
  if (isComposite(parent) && path.length > 0) {
    return {
      grid: parent.grid,
      child: changeDescendant(parent.child, path, f)
    } as ChangeDescendant<RootNode, P, NewNode>
  } else if (isKnot(parent) && path.length > 0) {
    const [head, ...tail] = path
    return {
      grid: parent.grid,
      children: {
        ...parent.children,
        [head]: changeDescendant(parent.children[head], tail as P, f)
      }
    } as ChangeDescendant<RootNode, P, NewNode>
  } else if (isList(parent) && path.length > 0) {
    return {
      foldable: parent.foldable,
      of: changeDescendant(parent.of, path, f)
    } as ChangeDescendant<RootNode, P, NewNode>
  } else if (isUnion(parent) && path.length > 0) {
    const [head, ...tail] = path
    return {
      tag: parent.tag,
      members: {
        ...parent.members,
        [head]: changeDescendant(parent.members[head], tail as P, f)
      }
    } as ChangeDescendant<RootNode, P, NewNode>
  } else {
    return f(parent as any) as ChangeDescendant<RootNode, P, NewNode>
  }
}

function isKnot(part: UIAny): part is UIKnotAny {
  return 'children' in part
}

function isComposite(part: UIAny): part is UICompositeAny {
  return 'child' in part
}

function isList(part: UIAny): part is UIListAny {
  return 'foldable' in part
}

function isUnion(part: UIAny): part is UIUnionAny {
  return 'members' in part
}

function toFragment(children: Observable<React.ReactNode> | React.ReactNode): ReactElement {
  return React.createElement(F.Fragment, {
    children
  })
}
