import React from 'react';
import Immutable from 'immutable';
import { Group, getSagas } from './es6/index';

function* Test(props) {
  console.log('Test', props);
}

function* Spam(props) {
  console.log('Spam', props);
}

function User({ getState }) {
  const state = getState();
  if (state.user) {
    return <Spam user={state.user}/>;
  }
}

const state = { user: null };

function getState() {
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

const sagas = getSagas(sagaTree, getState);

console.log(sagas);
state.user = false;

const sagas2 = getSagas(sagaTree, getState);
console.log(sagas2);

console.log(Immutable.is(sagas, sagas2));
