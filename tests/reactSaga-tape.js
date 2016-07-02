import 'babel-polyfill';
import test from 'tape';
import React from 'react';
import { createStore, applyMiddleware } from 'redux';
import sagaMiddleware  from 'redux-saga';
import { take, put, fork, cancel } from 'redux-saga/effects';
import * as Immutable from 'immutable';

import { Group, reactSaga, render, createElement } from '../es6/index';

const SET_USER = 'SET_USER';
const USER_START = 'USER_START';
const USER_STOP = 'USER_STOP';
const TEST_STOP = 'TEST_STOP';
const TEST_START = 'TEST_START';
const PARENT_STOP = 'PARENT_STOP';

function* Test(props) {
  yield put({ type: TEST_START });
  try {
    while (true) {
      yield take();
    }
  } finally {
    yield put({ type: TEST_STOP });
  }
}

function* UserSaga(props) {
  try {
    yield put({ type: USER_START });
    while (true) {
      yield take();
    }
  } finally {
    yield put({ type: USER_STOP });
  }
}

function User({ state }) {
  if (state.user === 'fail') {
    return <div />;
  }
  if (state.user) {
    return <UserSaga user={state.user}/>;
  }
}

function reducer(state = { user: null, userSaga: 0, testSaga: 0 }, action) {
  switch (action.type) {
  case SET_USER:
    return { ...state, user: action.user };
  case USER_START:
    return { ...state, userSaga: state.userSaga + 1 };
  case USER_STOP:
    return { ...state, userSaga: state.userSaga - 1 };
  case TEST_START:
    return { ...state, testSaga: state.testSaga + 1 };
  case TEST_STOP:
    return { ...state, testSaga: state.testSaga - 1 };
  default:
    return state;
  }
}

const sagaTree = (
  <Group>
    <Group>{false}</Group>
    <Group>
      <Test />
    </Group>
    <User />
  </Group>
);

function delay() {
  return new Promise(resolve => setTimeout(resolve));
}

test('errors', t => {
  t.throws(() => {
    render(<div />, {});
  }, /invalid node type/);

  t.throws(() => {
    render(<User />, { user: 'fail' });
  }, /invalid node type/);

  t.throws(() => {
    render(<Group>spam</Group>, { user: 'fail' });
  }, /invalid node type/);

  t.end();
});

test('basic', t => {
  const store = applyMiddleware(sagaMiddleware(reactSaga(sagaTree)))(createStore)(reducer);

  (async() => {
    t.equal(store.getState().userSaga, 0);
    store.dispatch({ type: SET_USER, user: 0 });
    await delay();
    t.equal(store.getState().userSaga, 0);
    store.dispatch({ type: SET_USER, user: false });
    await delay();
    t.equal(store.getState().userSaga, 0);
    store.dispatch({ type: SET_USER, user: 1 });
    await delay();
    t.equal(store.getState().userSaga, 1);
    store.dispatch({ type: SET_USER, user: 1 });
    await delay();
    t.equal(store.getState().userSaga, 1);
    store.dispatch({ type: SET_USER, user: null });
    await delay();
    t.equal(store.getState().userSaga, 0);
    t.end();
  })();
});

test('shutdown', t => {
  function* parent() {
    const task = yield fork(reactSaga(sagaTree));
    yield take(PARENT_STOP);
    yield cancel(task);
  }

  const store = applyMiddleware(sagaMiddleware(parent))(createStore)(reducer);

  (async() => {
    await delay();
    t.equal(store.getState().testSaga, 1);
    store.dispatch({ type: PARENT_STOP });
    await delay();
    t.equal(store.getState().testSaga, 0);
    t.end();
  })();
});

test('createElement', t => {
  const createElementTreee = createElement(Group, null,
    createElement(Group),
    createElement(Group, null,
      createElement(Test)
    ),
    createElement(User)
  );

  t.ok(Immutable.is(
    Immutable.fromJS(render(sagaTree, {})),
    Immutable.fromJS(render(createElementTreee, {}))
  ), 'render trees equal');
  t.end();
});
