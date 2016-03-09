declare module ReduxSaga {

  export interface SingleEffect {

  }

  export type MultiEffect = SingleEffect[];

  export type Effect = SingleEffect | MultiEffect;

  export type Result = IterableIterator<Effect>;

  export interface Saga<S> {
    (getState:() => S): Result;
  }

  export class SagaCancelationError extends Error {

  }

  export interface ForkedSaga extends SingleEffect {

  }

  export type Pattern = string | string[];

  export function takeLatest<S>(pattern:Pattern, saga:Saga<S>):Result;

}

declare module 'redux-saga/effects' {


  export function take(pattern?:ReduxSaga.Pattern):ReduxSaga.Effect;

  export function fork<S>(saga:ReduxSaga.Saga<S>, ...args:any[]):ReduxSaga.ForkedSaga;

  export function cancel(forkedSaga:ReduxSaga.ForkedSaga):ReduxSaga.Effect;

}

declare module 'redux-saga' {

  export = ReduxSaga;

}
