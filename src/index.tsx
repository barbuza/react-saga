import React from 'react';
import Immutable from 'immutable';

import {
  isValidElement,
  Component,
  ReactElement,
  StatelessComponent,
  Props,
  Ref,
  ReactChild,
  Key
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

function isReactChildren(object:any):boolean {
  return isValidChild(object) || (Array.isArray(object) && object.every(isValidChild))
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

function flattenGroup<P, S>(node:PropsElement<P>, getState:() => S):SagaDescriptor<{}, S>[] {
  const children:SagaDescriptor<{}, S>[] = [];
  React.Children.forEach(node.props.children, (child:ReactChild, index:number) => {
    if (isValidChild(child)) {
      children.push(...flatten(child, getState));
    } else {
      throw new Error(`invalid child ${node.type}`);
    }
  });
  return children;
}

function flatten<P, S>(node:PropsElement<P>, getState:() => S):SagaDescriptor<{}, S>[] {
  if (!node) {
    return [];
  }
  if (typeof node.type === 'string') {
    throw new Error(`invalid node type ${node.type}`);
  }
  if (isFunctionElement(node)) {
    if (Object.is(node.type, Group)) {
      return flattenGroup(node, getState);
    } else if (isSaga(node.type)) {
      const descriptor:SagaDescriptor<{}, S> = makeSagaDescriptor({
        saga: node.type,
        props: Immutable.fromJS(node.props)
      }) as any;
      return [descriptor];
    } else if (isPlainFunction(node.type)) {
      return flatten(node.type(Object.assign({}, node.props, { getState })), getState);
    }
  }
  throw new Error(`invalid node type ${node.type}`);
}

export function getSagas<S>(node:PropsElement<{}>, getState:() => S):Immutable.Set<SagaDescriptor<{}, S>> {
  return Immutable.Set(flatten(node, getState));
}
