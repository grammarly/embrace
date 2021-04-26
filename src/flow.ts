import { IO } from 'fp-ts/lib/IO'
import * as O from 'fp-ts/lib/Option'
import * as R from 'fp-ts/lib/Reader'
import * as Record from 'fp-ts/lib/Record'
import * as T from 'fp-ts/lib/These'
import { flow, pipe } from 'fp-ts/lib/function'
import { combineLatest, EMPTY, merge, NEVER, Observable, of } from 'rxjs'
import * as Rx from 'rxjs/operators'
import { UIAny } from './internal'
import { AnimationActions, AnimationState } from './internal/animated'
import { IsNever } from './internal/utils'
import { UI } from './ui'

/**
 * Consumes @param Action and produces @param State.
 * Useful for subsystems composition.
 */
export interface Flow<Action, State> extends R.Reader<Observable<Action>, Observable<State>> {}

export namespace Flow {
  // We need a distributive conditional type here to hide @param T from the result type
  export type For<T> = T extends UIAny ? Flow<UI.ComposedAction<T>, UI.ComposedState<T>> : never

  /**
   * WARNING: this function will break the flow composition.
   * Use it only when Embrace meets React (if you are creating the flow for `UI.Mount`).
   * Use Flow composition instead - create a small flow`s for the small components, and compose them using Flow.composeX.
   *
   * Create a `Flow` which will call @param sideEffect callback on every incoming action not affecting state,
   * but will always use @param state as a source of component state.
   *
   * example:
   * ```ts
   * const myFlow: Flow.For<'click' | 'hover', string> = Flow.fromSideEffect(({ action }) => {
      switch (action.kind) {
        case 'click':
          doClick()
          break
        case 'hover':
          doHover()
          break
        default:
          assertNever(action)
      }
    }, of('myState'))
    ```
   */
  export function fromSideEffect<Action, State>(
    sideEffect: (a: Action) => void,
    state: Observable<State> | State
  ): Flow<Action, State> {
    return actions =>
      merge(
        actions.pipe(
          Rx.tap(sideEffect),
          Rx.switchMap(() => NEVER)
        ),
        toObservable(state)
      )
  }

  /**
   * Modify an existing `Flow` by changing the resulting state.
   * Useful for flow re-usage for patched components.
   * @return new `Flow` with updated state.
   *
   * example:
   * ```ts
   * declare const container: UI.Knot<never, never, { header: UI.Node<string, 'click'>; footer: UI.Node<string, 'click'> }>
   * declare const containerFlow: Flow.For<typeof container>
   *
   * const myContainer = pipe(container, UI.patch('footer')(() => myFooter))
   *
   * const flow: Flow.For<typeof myContainer> = pipe(
   *  containerFlow,
   *  Flow.patchState(map(defaultState => ({ header: defaultState.header, footer: myFooterState })))
   * )
   * ```
   */
  export function patchState<State1, State2, Actions>(
    mapState: R.Reader<Observable<State1>, Observable<State2>>
  ): (uiFlow: Flow<Actions, State1>) => Flow<Actions, State2> {
    return R.map(mapState)
  }

  /**
   * Extend an existing `Flow` by adding additional actions pipeline.
   * Useful for flow re-usage for patched components.
   *
   * WARNING: this function does not cancel the actions pipeline of the patched flow. To completely replace actions pipeline see `changeActions`.
   * @return new `Flow` with extended actions pipeline.
   *
   * example:
   * ```ts
   * declare const container: UI.Knot<never, never, { header: UI.Node<string, 'click'>; footer: UI.Node<string, 'click'> }>
   * declare const containerFlow: Flow.For<typeof container>
   *
   * const myContainer = pipe(container, UI.patch('footer')(() => myFooter))
   *
   * const flow: Flow.For<typeof myContainer> = pipe(
   *  containerFlow,
   *  Flow.extendActions(Rx.tap(myContainerActions => doWork(myContainerActions)))
   * )
   * ```
   */
  export function extendActions<Actions1, Actions2, State>(
    contramapActions: R.Reader<Observable<Actions2>, Observable<Actions1>>
  ): (uiFlow: Flow<Actions1, State>) => Flow<Actions2, State> {
    return R.local(contramapActions)
  }

  /**
   * Modify an existing `Flow`
   * Useful for flow re-usage for patched components.
   *
   * WARNING: this function does not cancel the actions pipeline of the patched flow. To completely replace actions pipeline see `replaceActions`.
   * @return new updated `Flow`.
   *
   * example:
   * ```ts
   * declare const container: UI.Knot<never, never, { header: UI.Node<string, 'click'>; footer: UI.Node<string, 'click'> }>
   * declare const containerFlow: Flow.For<typeof container>
   *
   * const myContainer = pipe(container, UI.patch('footer')(() => myFooter))
   *
   * const flow: Flow.For<typeof myContainer> = pipe(
   *  containerFlow,
   *  Flow.patch(
   *    Rx.tap(myContainerActions => doWork(myContainerActions)),
   *    Rx.map(defaultState => ({ header: defaultState.header, footer: myFooterState }))
   *  )
   * )
   * ```
   */
  export function patch<Actions1, State1, Actions2, State2>(
    contramapActions: R.Reader<Observable<Actions2>, Observable<Actions1>>,
    mapState: R.Reader<Observable<State1>, Observable<State2>>
  ): (uiFlow: Flow<Actions1, State1>) => Flow<Actions2, State2> {
    return flow(extendActions(contramapActions), patchState(mapState))
  }

  /**
   * Modify an existing `Flow` by changing the actions pipeline.
   * Useful for flow re-usage for patched components.
   *
   * @return new `Flow` with new actions pipeline.
   *
   * example:
   * ```ts
   * declare const container: UI.Knot<never, never, { header: UI.Node<string, 'click'>; footer: UI.Node<string, 'click'> }>
   * declare const containerFlow: Flow.For<typeof container>
   *
   * const myContainer = pipe(container, UI.patch('footer')(() => myFooter))
   *
   * const flow: Flow.For<typeof myContainer> = pipe(
   *  containerFlow,
   *  Flow.replaceActions(Rx.tap(myContainerActions => doWork(myContainerActions)))
   * )
   * ```
   */
  export function replaceActions<Actions1, Actions2, State>(
    contramapActions: R.Reader<Observable<Actions2>, Observable<Actions1>>
  ): (uiFlow: Flow<Actions1, State>) => Flow<Actions2, State> {
    return R.local(
      flow(
        contramapActions,
        Rx.switchMap(() => NEVER)
      )
    )
  }

  /**
   * Create a Flow for composition of the components (@see UI.Knot) from its children flow.
   *
   * example:
   * ```ts
   * declare const container: UI.Knot<never, never, { header: UI.Node<string, 'click'>; footer: UI.Node<string, 'click'> }>
   * declare const headerFlow: Flow.For<typeof header>
   * declare const footerFlow: Flow.For<typeof footer>
   *
   * // declare const containerFlow: Flow.For<typeof container>
   * const containerFlow = Flow.composeKnot({ header: headerFlow, footer: footerFlow })
   * ```
   */
  export function composeKnot<Node extends UIAny = never>(
    flowComposition: KnotFlowComposition<Node>
  ): Flow.For<Node> {
    return R.asks(actions =>
      combineLatest(
        Object.keys(flowComposition).map((key: keyof typeof flowComposition) =>
          flowComposition[key](
            actions.pipe(
              Rx.filter(a => a.key === key),
              Rx.map(a => a.action)
            )
          ).pipe(Rx.map(state => ({ [key]: state })))
        )
      ).pipe(Rx.map(s => s.reduce((a, v) => ({ ...a, ...v }))))
    ) as Flow.For<Node>
  }

  /**
   * Create a Flow for composition of the components (@see UI.Union) from its members flow.
   *
   * example:
   * ```ts
   * declare const union: UI.Union<'kind', {comp1: UI.Node<{ text: string; }, "action1">; comp2: UI.Node<{ num: number; }, "action2">;}>
   * declare const comp1Flow: Flow.For<typeof comp1>
   * declare const comp2Flow: Flow.For<typeof comp2>
   * declare const kindSelector: (actions: Observable<UI.ComposedAction<typeof union>>) => Observable<{kind: 'comp1' | 'comp2'}>
   *
   * const unionFlow = Flow.composeUnion({ comp1: comp1Flow, comp2: comp2Flow }, kindSelector)
   * ```
   */
  export function composeUnion<Node extends UIAny>(
    flowComposition: UnionFlowComposition<Node>,
    kindSelector: UnionKindSelector<Node>
  ) {
    return R.asks(actions =>
      pipe(
        kindSelector(actions),
        Rx.switchMap(keyRecord => {
          const [[tag, key]] = Object.entries(keyRecord) as [UnionTag<Node>, UnionKeys<Node>][]
          return pipe(
            actions,
            Rx.filter(a => a.key === key),
            Rx.map(a => a.action),
            flowComposition[key],
            Rx.map(state => ({ ...state, [tag]: key }))
          )
        })
      )
    ) as Flow.For<Node>
  }

  export type AnimationDecisionFor<Tree extends UIAny> = Tree extends UI.Animated<
    infer In,
    infer Out,
    infer Children
  >
    ? AnimationDecision<UI.ComposedState<Children>, In, Out>
    : never

  /**
   * Represents a decision to start an @param In - @param Out transition animation based on a change in @param State
   * @returns Some if animation should start
   */
  export type AnimationDecision<State, In, Out> = (
    prevState: O.Option<State>,
    nextState: State
  ) => O.Option<T.These<Out, In>>

  /**
   * Extends @param originalFlow by adding animation flow
   * which will use @param shouldAnimate decision function to trigger a new animation.
   *
   * We suppose that can not happen anything bad if we clear animation state from dom
   * not immediately on animation end, and better be to touch DOM state less frequently.
   * That's why we do several hidden optimizations:
   * 1. We batching transition state changes by denouncing their events by 100ms.
   * 2. if we did not get for 500ms any transition events - we clear animation state.
   * 3. if we receive an animation start event, we will wait for 5000ms until we clear animation state.
   *
   * NOTE: 2 and 3 should work fine for the most cases, but if you have an animation which does not belong to such requirements,
   * please use self-made animation flow.
   */
  export function animatingFlow<Action, State, In, Out>(
    originalFlow: Flow<Action, State>,
    shouldAnimate: AnimationDecision<State, In, Out>
  ): Flow<AnimationActions<In | Out, Action>, AnimationState<In | Out, State>> {
    return a => {
      const { action, animation } = AnimationActions.split(a)
      let iterationVar = 0

      return pipe(
        action,
        Rx.filter(a => a.key === String(iterationVar)),
        Rx.pluck('action'),
        originalFlow,
        Rx.scan(
          collectAnimationState<State, In, Out>(shouldAnimate, () => iterationVar),
          {} as AnimationState<In | Out, State>
        ),
        Rx.tap(
          state =>
            /* reset current iteration number by incoming state change*/ (iterationVar =
              /** latest iteration number will be always the last key in state Record due to insertion order behavior of Objects in JS */
              Number(Object.keys(state).pop()))
        ),
        Rx.switchMap(updateStateByAnimationEvents<State, In | Out>(animation, () => iterationVar))
      )
    }
  }

  function updateStateByAnimationEvents<State, Type>(
    animation: Observable<AnimationActions.AnimationFromIteration<Type>>,
    iterationVar: IO<number>
  ): (
    value: AnimationState<Type, State>,
    index: number
  ) => Observable<AnimationState<Type, State>> {
    return init => {
      const prevKey = String(iterationVar() - 1)
      const nextKey = String(iterationVar())
      const prevTransitionEvents = pipe(
        O.fromNullable(init[prevKey]),
        O.chain(av => av.root),
        O.map(getEventsByKey<Type>(animation, prevKey)),
        O.getOrElse(() => EMPTY),
        Rx.mapTo(Record.deleteAt(prevKey))
      )
      const nextTransitionEvents = pipe(
        init[nextKey].root,
        O.map(getEventsByKey<Type>(animation, nextKey)),
        O.getOrElse(() => EMPTY),
        Rx.mapTo((state: AnimationState<Type, State>) => {
          const nextState = { ...state }
          nextState[nextKey] = { ...nextState[nextKey], root: O.none }
          return nextState
        })
      )

      return pipe(
        merge(prevTransitionEvents, nextTransitionEvents),
        Rx.scan((state, applicator) => applicator(state), init),
        // simultaneous prev & next state animation end should emit state change only once
        Rx.debounceTime(WAIT_UNTIL_SECOND_STATE_CHANGE_EMITS),
        Rx.startWith(init)
      )
    }
  }

  function getEventsByKey<Type>(
    animation: Observable<AnimationActions.AnimationFromIteration<Type>>,
    key: string
  ): (a: Type) => Observable<AnimationActions.AnimationFromIteration<Type>['action']> {
    return animationType =>
      pipe(
        animation,
        Rx.filter(a => a.key === key && a.action.animationType === animationType),
        Rx.map(a => a.action),
        Rx.startWith({ kind: 'init' }),
        Rx.switchMap(a =>
          // animation end event are passed without any delay
          a.kind === 'end'
            ? of(a as AnimationActions.AnimationFromIteration<Type>['action'])
            : pipe(
                of({ kind: 'end' as const, animationType }),
                // if we detect an animation start event we provide a window for 5s until animation can be completed
                // if animation start was not fired in 500 ms, we will reset animation state
                Rx.delay(
                  a.kind === 'start'
                    ? WAIT_UNTIL_ANIMATION_END_EMITS_IF_IT_WAS_STARTED
                    : WAIT_UNTIL_ANY_EVENTS_EMITS_FROM_ANIMATION
                )
              )
        ),
        Rx.first()
      )
  }

  function collectAnimationState<State, In, Out>(
    shouldAnimate: AnimationDecision<State, In, Out>,
    iterationVar: IO<number>
  ): (acc: AnimationState<In | Out, State>, value: State) => AnimationState<In | Out, State> {
    return (prevAnimationState, nextChildren) => {
      const prevIteration = iterationVar()
      const prevAnimation = O.fromNullable(prevAnimationState[prevIteration])
      const prevChildren = pipe(
        prevAnimation,
        O.map(i => i.children)
      )

      const transition = shouldAnimate(prevChildren, nextChildren)

      // performance intense place
      // it is called for EACH state update, so we try to grow here call stack as less as possible
      // so we intentionaly avoid using fold helper here
      if (O.isNone(transition)) {
        /**
         * FIXME (DN-5768): The current implementation is a temporary fix. It unmounts the previous animation immediately once the new children state is emitted.
         * We need to let the previous animation to finish if the flow receives a new children state and animation decision is None.
         * So, ideally, we have to return the following:
         * @example
         * {
         * ...prevAnimationState,
         *  [prevIteration]: {
         *    root: pipe(
         *       prevAnimation,
         *       chain(i => i.root)
         *    ),
         *     children: nextChildren
         *  }
         * }

         * However children state change leads to re-render of the animation wrapper, hence animations are played once more.
         * We need the way to re-render children only and leave the wrapper intact to prevent playing the same animation twice.
         */
        return {
          [prevIteration]: {
            root: O.none,
            children: nextChildren
          }
        }
      } else {
        const nextIteration = prevIteration + 1
        const animationState: AnimationState<In | Out, State> = {
          [nextIteration]: {
            root: T.getRight(transition.value),
            children: nextChildren
          }
        }
        const prevTransition = T.getLeft(transition.value)

        if (O.isSome(prevTransition) && O.isSome(prevChildren)) {
          animationState[prevIteration] = {
            root: prevTransition,
            children: prevChildren.value
          }
        }

        return animationState
      }
    }
  }

  function toObservable<T>(value: T | Observable<T>): Observable<T> {
    return value instanceof Observable ? value : of(value)
  }

  const WAIT_UNTIL_SECOND_STATE_CHANGE_EMITS = 100
  const WAIT_UNTIL_ANY_EVENTS_EMITS_FROM_ANIMATION = 500
  const WAIT_UNTIL_ANIMATION_END_EMITS_IF_IT_WAS_STARTED =
    WAIT_UNTIL_ANY_EVENTS_EMITS_FROM_ANIMATION * 10

  type KnotFlowComposition<Node extends UIAny> = Node extends UI.Knot<
    infer State,
    infer Actions,
    infer Children
  >
    ? IsNever<State> extends true
      ? IsNever<Actions> extends true
        ? RecordOfFlow<Children>
        : RecordOfFlow<Children> & Record<'root', Flow<Actions, State>>
      : RecordOfFlow<Children> & Record<'root', Flow<Actions, State>>
    : never

  export type UnionFlowComposition<Node extends UIAny> = Node extends UI.Union<any, infer Members>
    ? Members extends Record<string, UIAny>
      ? {
          readonly [K in keyof Members]: Flow<
            UI.ComposedAction<Members[K]>,
            UI.ComposedState<Members[K]>
          >
        }
      : never
    : never

  type UnionTagValuesRecord<Node extends UIAny> = {
    readonly [key in UnionTag<Node>]: UnionKeys<Node>
  }

  type UnionKindSelector<Node extends UIAny> = Node extends UI.Union<any, infer Members>
    ? Members extends Record<string, UIAny>
      ? R.Reader<Observable<UI.ComposedAction<Node>>, Observable<UnionTagValuesRecord<Node>>>
      : never
    : never

  type UnionTag<Node extends UIAny> = Node extends UI.Union<infer Tag, any> ? Tag : never

  type UnionKeys<Node extends UIAny> = Node extends UI.Union<any, infer Members>
    ? keyof Members
    : never
}

type RecordOfFlow<Children extends Record<string, UIAny>> = Record<
  keyof Children,
  Flow<UI.ComposedAction<Children[keyof Children]>, UI.ComposedState<Children[keyof Children]>>
>
