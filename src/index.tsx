import * as Immutable from 'immutable';
import { takeLatest, Task } from 'redux-saga';
import { fork, cancel, select, Effect } from 'redux-saga/effects';
import {
  Component,
  ReactElement,
  StatelessComponent,
  Props,
  Ref,
  ReactChild,
  Key,
  Children
} from 'react';
import isGeneratorFunction from 'is-generator-function';

export interface PropsElement<P> extends ReactElement<P & Props<any>> {
}

export interface SagaProps<S> {
  state: S;
}

export interface SagaComponent<P, S> extends StatelessComponent<P & SagaProps<S>> {
}

const makeSagaDescriptor = Immutable.Record({ saga: null, props: null }, 'SagaDescriptor');

export interface SagaDescriptor<P, S> {
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

export type SagaResult = IterableIterator<Effect>;
type ReactSagaGenerator<P, S> = (props: P & SagaProps<S>) => SagaResult;
export type SagaGenerator = () => SagaResult;

function isGenerator(fun: any): Boolean {
  return isGeneratorFunction(fun)
    || (typeof regeneratorRuntime !== 'undefined' && regeneratorRuntime.isGeneratorFunction(fun));
}

function isValidChild(object?: any): object is PropsElement<any> {
  if (!object) {
    return true;
  }
  return typeof object.type === 'function';
}

export function Group() {
}

function isFunctionElement<P>(node: ReactElement<P>): node is FunctionElement<P> {
  return typeof node.type === 'function';
}

function childCheckFail(node: any) {
  throw new Error(`invalid node type ${node && node.type}`);
}

function renderGroup<P, S>(node: PropsElement<P>, state: S): SagaDescriptor<{}, S>[] {
  const children: SagaDescriptor<{}, S>[] = [];
  Children.forEach(node.props.children, (child: ReactChild) => {
    if (isValidChild(child)) {
      children.push(...render(child, state));
    } else {
      childCheckFail(node);
    }
  });
  return children;
}

export function render<P, S>(node: PropsElement<P>, state: S): SagaDescriptor<{}, S>[] {
  if (!node) {
    return [];
  }
  if (isFunctionElement(node)) {
    if (node.type === Group) {
      return renderGroup(node, state);
    } else if (isGenerator(node.type)) {
      const descriptor: SagaDescriptor<{}, S> = makeSagaDescriptor({
        saga: node.type,
        props: Immutable.fromJS(node.props)
      }) as any;
      return [descriptor];
    } else {
      return render(node.type(Object.assign({}, node.props, { state })), state);
    }
  }
  childCheckFail(node);
}

function getSagas<S>(node: PropsElement<{}>, state: S): Immutable.OrderedSet<SagaDescriptor<{}, S>> {
  return Immutable.OrderedSet(render(node, state));
}

function forkDescriptor<P, S>(spec: SagaDescriptor<P, S>): Task<any> {
  return fork(spec.saga as any, spec.props.toJS()) as Task<any>;
}

export function reactSaga<S>(node: PropsElement<{}>, debugFn: (...args: any[]) => void = null): SagaGenerator {
  type Spec = SagaDescriptor<{}, S>;

  return function* reactSaga(): SagaResult {
    let runningSagas = Immutable.OrderedMap<Spec, Task<any>>();

    function* step(): SagaResult {
      const state = yield select();
      const sagas = getSagas(node, state);

      const kill = runningSagas.keySeq().filter(spec => !sagas.contains(spec));
      const spawn = sagas.filter(spec => !runningSagas.has(spec));
      const keep = runningSagas.filter((_, spec) => sagas.contains(spec));

      if (kill.isEmpty() && spawn.isEmpty()) {
        return;
      }

      const killEffects = kill
        .map((spec: Spec) => runningSagas.get(spec))
        .map(cancel)
        .toArray();

      const spawnEffects = spawn
        .map(forkDescriptor)
        .toArray();

      if (debugFn) {
        kill.forEach(spec => {
          debugFn('kill %s', spec.saga.name, spec.props.toJS());
        });
        spawn.forEach(spec => {
          debugFn('spawn %s', spec.saga.name, spec.props.toJS());
        });
      }

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

