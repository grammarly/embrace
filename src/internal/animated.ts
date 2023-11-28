import * as O from 'fp-ts/lib/Option'
import { pipe } from 'fp-ts/lib/pipeable'
import { Observable } from 'rxjs'
import * as Rx from 'rxjs/operators'
import { UI } from '../ui'
import { KeyedAction } from './index'

export interface AnimationView<Transition, State> {
  readonly root: O.Option<Transition>
  readonly children: State
}

export type Iteration = string

export interface AnimationState<Transition, State>
  extends Record<Iteration, AnimationView<Transition, State>> {}

export type AnimationActions<Transition, Action> =
  | AnimationActions.AnimationFromComposition<Transition>
  | AnimationActions.ChildrenFromComposition<Action>

export namespace AnimationActions {
  export type AnimationFromComposition<Transition> = KeyedAction<
    Iteration,
    KeyedAction<'root', UI.Transition.Action<Transition>>
  >

  export type AnimationFromIteration<Transition> = KeyedAction<
    Iteration,
    UI.Transition.Action<Transition>
  >

  export type ChildrenFromComposition<Action> = KeyedAction<
    Iteration,
    KeyedAction<'children', Action>
  >
  export type ChildrenFromIteration<Action> = KeyedAction<Iteration, Action>

  export function split<Transition, Action>(
    aa: Observable<AnimationActions<Transition, Action>>
  ): {
    readonly animation: Observable<AnimationFromIteration<Transition>>
    readonly action: Observable<ChildrenFromIteration<Action>>
  } {
    const actions = pipe(aa, Rx.publishReplay(1), Rx.refCount())

    return {
      animation: pipe(
        actions,
        Rx.filter((a): a is AnimationFromComposition<Transition> => a.action.key === 'root'),
        Rx.map(a => ({ key: a.key, action: a.action.action } as AnimationFromIteration<Transition>))
      ),
      action: pipe(
        actions,
        Rx.filter((a): a is ChildrenFromComposition<Action> => a.action.key === 'children'),
        Rx.map(a => ({ key: a.key, action: a.action.action } as ChildrenFromIteration<Action>))
      )
    }
  }
}
