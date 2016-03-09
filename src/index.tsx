import * as Immutable from 'immutable';
import { takeLatest, Task } from 'redux-saga';
import { fork, cancel, Effect, EffectFunction } from 'redux-saga/effects';
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

interface SagaComponent<P, S> extends StatelessComponent<P & SagaProps<S>> {
}

const makeSagaDescriptor = Immutable.Record({ saga: null, props: null }, 'SagaDescriptor');

interface SagaDescriptor<P, S> {
  saga: SagaComponent<P, S>;
  props: Immutable.Map<string, any>
}

interface FunctionElement<P> {
  type: StatelessComponent<P>;
  props: P;
  key: Key;
  ref: Ref<Component<P, any> | Element>;
}

interface SagaElement extends FunctionElement<{}> {
  type: SagaComponent<{}, {}>;
}

type SagaResult = IterableIterator<Effect>;
type ReactSagaGenerator<P, S> = (props:P & SagaProps<S>) => SagaResult;
type SagaGenerator<S> = (getState:() => S) => SagaResult;

function isValidChild(object?:any):object is PropsElement<any> {
  return object == null || isValidElement(object)
}

function* gen():any {
}

const genPrototype = Object.getPrototypeOf

function isSaga<P, S>(fn:StatelessComponent<P>):fn is SagaComponent<P, S> {
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

function forkDescriptor<P, S>(spec:SagaDescriptor<P, S>):Task<any> {
  return fork(spec.saga as any, spec.props.toJS()) as Task<any>;
}

export function reactSaga<S>(node:PropsElement<{}>):SagaGenerator<S> {
  type Spec = SagaDescriptor<{}, S>;

  return function* reactSaga(getState:() => S):SagaResult {
    let runningSagas = Immutable.OrderedMap<Spec, Task<any>>();

    function* step():SagaResult {
      const sagas = getSagas(node, getState);

      const kill = runningSagas.keySeq().filter(spec => !sagas.contains(spec));
      const spawn = sagas.filter(spec => !runningSagas.has(spec));
      const keep = runningSagas.filter((_, spec) => sagas.contains(spec));

      if (kill.isEmpty() && spawn.isEmpty()) {
        return;
      }

      const killEffects = kill
        .map((spec:Spec) => runningSagas.get(spec))
        .map(cancel)
        .toArray();

      const spawnEffects = spawn
        .map(forkDescriptor)
        .toArray();

      const result = yield [...killEffects, ...spawnEffects];

      runningSagas = Immutable.OrderedMap(
        keep.concat(
          spawn.toList().zip(
            Immutable.Iterable(result).slice(killEffects.length)
          )
        )
      ) as Immutable.OrderedMap<Spec, Task<any>>;
    }

    try {
      yield* step();
      yield* takeLatest('*', step);
    } finally {
      yield* runningSagas.valueSeq().map(cancel).toArray();
    }
  }
}

