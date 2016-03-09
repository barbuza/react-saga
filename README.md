# react-saga [![Build Status](https://travis-ci.org/barbuza/react-saga.svg?branch=master)](https://travis-ci.org/barbuza/react-saga) [![Coverage Status](https://coveralls.io/repos/github/barbuza/react-saga/badge.svg?branch=master)](https://coveralls.io/github/barbuza/react-saga?branch=master)

declarative saga management with jsx

## usage

```js
import React from 'react';
import sagaMiddleware from 'redux-saga';
import { Group, reactSaga } from 'react-saga';

function* UserSaga({ getState, userId }) {
  // ...
}

function* FriendsSaga({ getState, userId }) {
  // ...
}

function* PostsSaga({ getState }) {
  // ...
}

function User({ getState }) {
  const user = getState().user;
  if (user) {
    return (
      <Group>
        <UserSaga userId={user.id} />
        <FriendsSaga userId={user.id} />
      </Group>
    );
  }
}

sagaMiddleware(reactSaga(
  <Group>
    <User />
    <PostsSaga />
  </Group>
));
```
