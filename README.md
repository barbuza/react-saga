# react-saga [![Build Status](https://travis-ci.org/barbuza/react-saga.svg?branch=master)](https://travis-ci.org/barbuza/react-saga) [![Coverage Status](https://coveralls.io/repos/github/barbuza/react-saga/badge.svg?branch=master)](https://coveralls.io/github/barbuza/react-saga?branch=master)

`react-saga` is an attempt to make data / logic dependencies declarative in the same way as UI. following code manages 3 sagas (`AuthenticatedApi`, `AnotherAuthenticatedSaga`, `GuestApi`) based on authentication state and current user id. `react-saga` forks / cancels sagas based on their presence in render tree and passed props. in this case `AnotherAuthenticatedSaga` is running when user is authenticated, `AuthenticatedApi` is running when authenticated as well, but restarts on `userId` changes.

```es6
import React from 'react';
import { put } from 'redux-saga/effects';
import { reactSaga, Group } from 'react-saga';

function *AuthenticatedApi({ userId }) {
  yield put({ type: 'USER_ID_CHANGED', userId });
  while (true) {
    // handle authenticated api calls
  }
}

function *AnotherAuthenticatedSaga() {
  // whatever
}

function *GuestApi() {
  while (true) {
    // handle guest api calls
  }
}

function Api({ state: { authenticated, userId } }) {
  if (authenticated) {
    return (
      <Group>
        <AuthenticatedApi userId={userId}/>
        <AnotherAuthenticatedSaga/>
      </Group>
    );
  }
  return <GuestApi/>;
}

export default reactSaga(<Api/>);
```
