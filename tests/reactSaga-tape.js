import test from 'tape';
import React from 'react';
import { createStore, applyMiddleware } from 'redux';
import sagaMiddleware  from 'redux-saga';
import { take, put } from 'redux-saga/effects';

import { Group, reactSaga, render } from '../es6/index';

const SET_USER = 'SET_USER';
const USER_START = 'USER_START';
const USER_STOP = 'USER_STOP';

function* Test(props) {
  while (true) {
    yield take();
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

function User({ getState }) {
  const state = getState();
  if (state.user === 'fail') {
    return <div />;
  }
  if (state.user) {
    return <UserSaga user={state.user}/>;
  }
}

function reducer(state = { user: null, userSaga: 0 }, action) {
  if (action.type === SET_USER) {
    return { ...state, user: action.user };
  }
  if (action.type === USER_START) {
    return { ...state, userSaga: state.userSaga + 1 };
  }
  if (action.type === USER_STOP) {
    return { ...state, userSaga: state.userSaga - 1 };
  }
  return state;
}

const sagaTree = (
  <Group>
    <Group>
      <Test />
    </Group>
    <User />
  </Group>
);

function delay() {
  return new Promise(resolve => setTimeout(resolve));
}

class Header extends React.Component {
}

test('reactSaga', t => {
  const store = applyMiddleware(sagaMiddleware(reactSaga(sagaTree)))(createStore)(reducer);

  t.throws(() => {
    render(<div />, () => ({}));
  }, /invalid node type/);

  t.throws(() => {
    render(<User />, () => ({ user: 'fail' }));
  }, /invalid node type/);

  t.throws(() => {
    render(<Group>spam</Group>, () => ({ user: 'fail' }));
  }, /invalid node type/);

  t.throws(() => {
    render(<Header />, () => ({ user: 'fail' }));
  }, /invalid node type/);

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
