import * as Immutable from 'immutable';
import { takeLatest } from 'redux-saga';
import { fork, cancel } from 'redux-saga/effects';
import {
  isValidElement,
  Component,
  ReactElement,
  StatelessComponent,
  Props,
  Ref,
  ReactChild,
  Key,
  Children
} from 'react';

interface PropsElement<P> extends ReactElement<P & Props<any>> {
}

interface SagaProps<S> {
  getState: () => S;
}

interface Saga<P, S> extends StatelessComponent<P & SagaProps<S>> {
}

const makeSagaDescriptor = Immutable.Record({ saga: null, props: null }, 'SagaDescriptor');

interface SagaDescriptor<P, S> {
  saga: Saga<P, S>;
  props: Immutable.Map<string, any>
}

interface FunctionElement<P> {
  type: StatelessComponent<P>;
  props: P;
  key: Key;
  ref: Ref<Component<P, any> | Element>;
}

interface SagaElement extends FunctionElement<{}> {
  type: Saga<{}, {}>;
}

function isValidChild(object?:any):object is PropsElement<any> {
  return object == null || isValidElement(object)
}

function* gen():any {
}

function isSaga<P, S>(fn:StatelessComponent<P>):fn is Saga<P, S> {
  return Object.is(fn.prototype, gen.prototype)
    || Object.is((fn as any)['__proto__'], (gen as any)['__proto__']);
}

export function Group() {
}

function isFunctionElement<P>(node:ReactElement<P>):node is FunctionElement<P> {
  return typeof node.type === 'function';
}

const plainProto = Object.getPrototypeOf(():any => null);

function isPlainFunction(fn:any):fn is FunctionConstructor {
  return typeof fn === 'function' && Object.getPrototypeOf(fn) === plainProto;
}

function childCheckFail(node:any) {
  throw new Error(`invalid node type ${node && node.type}`);
}

function renderGroup<P, S>(node:PropsElement<P>, getState:() => S):SagaDescriptor<{}, S>[] {
  const children:SagaDescriptor<{}, S>[] = [];
  Children.forEach(node.props.children, (child:ReactChild, index:number) => {
    if (isValidChild(child)) {
      children.push(...render(child, getState));
    } else {
      childCheckFail(node);
    }
  });
  return children;
}

export function render<P, S>(node:PropsElement<P>, getState:() => S):SagaDescriptor<{}, S>[] {
  if (!node) {
    return [];
  }
  if (typeof node.type === 'string') {
    childCheckFail(node);
  }
  if (isFunctionElement(node)) {
    if (Object.is(node.type, Group)) {
      return renderGroup(node, getState);
    } else if (isSaga(node.type)) {
      const descriptor:SagaDescriptor<{}, S> = makeSagaDescriptor({
        saga: node.type,
        props: Immutable.fromJS(node.props)
      }) as any;
      return [descriptor];
    } else if (isPlainFunction(node.type)) {
      return render(node.type(Object.assign({}, node.props, { getState })), getState);
    }
  }
  childCheckFail(node);
}

function getSagas<S>(node:PropsElement<{}>, getState:() => S):Immutable.OrderedSet<SagaDescriptor<{}, S>> {
  return Immutable.OrderedSet(render(node, getState));
}

export function reactSaga<S>(node:PropsElement<{}>):ReduxSaga.Saga<S> {
  return function* reactSaga(getState:() => S):ReduxSaga.Result {
    let runningSagas = Immutable.OrderedMap<SagaDescriptor<{}, S>, ReduxSaga.ForkedSaga>();

    function* step():ReduxSaga.Result {
      const sagas = getSagas(node, getState);

      const kill = runningSagas.keySeq().filter(spec => !sagas.contains(spec));
      const spawn = sagas.filter(spec => !runningSagas.has(spec));
      const keep = runningSagas.filter((_, spec) => sagas.contains(spec));

      if (kill.isEmpty() && spawn.isEmpty()) {
        return;
      }

      const killEffects = kill
        .map((spec:SagaDescriptor<{}, S>) =>
          cancel(runningSagas.get(spec)))
        .toArray();

      const spawnEffects = spawn
        .map((spec:SagaDescriptor<{}, S>) =>
          fork((spec.saga as any) as ReduxSaga.Saga<S>, spec.props.toJS()))
        .toArray();

      const result = yield [...killEffects, ...spawnEffects];

      runningSagas = Immutable.OrderedMap(
        keep.concat(spawn.toList().zip(result.slice(killEffects.length)))
      ) as Immutable.OrderedMap<SagaDescriptor<{}, S>, ReduxSaga.ForkedSaga>;
    }

    try {
      yield* step();
      yield* takeLatest('*', step);
    } finally {
      yield* runningSagas.entrySeq().map(forkedSaga => cancel(forkedSaga)).toArray();
    }
  }
}

