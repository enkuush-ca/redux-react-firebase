'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.resetPassword = exports.createUser = exports.logout = exports.init = exports.login = exports.unWatchEvents = exports.watchEvents = exports.unWatchEvent = exports.watchEvent = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _constants = require('./constants');

var _es6Promise = require('es6-promise');

var getWatchPath = function getWatchPath(event, path) {
    return event + ':' + (path.substring(0, 1) === '/' ? '' : '/') + path;
};

var setWatcher = function setWatcher(firebase, event, path) {
    var queryId = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : undefined;

    var id = queryId || getQueryIdFromPath(path, event) || getWatchPath(event, path);

    if (event != 'once') {
        if (firebase._.watchers[id]) {
            firebase._.watchers[id]++;
        } else {
            firebase._.watchers[id] = 1;
        }
    }

    return firebase._.watchers[id];
};

var getWatcherCount = function getWatcherCount(firebase, event, path) {
    var queryId = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : undefined;

    var id = queryId || getQueryIdFromPath(path, event) || getWatchPath(event, path);
    return firebase._.watchers[id];
};

var getQueryIdFromPath = function getQueryIdFromPath(path) {
    var event = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

    var origPath = path;
    var pathSplitted = path.split('#');
    path = pathSplitted[0];

    var isQuery = pathSplitted.length > 1;
    var queryParams = isQuery ? pathSplitted[1].split('&') : [];
    var queryId = isQuery ? queryParams.map(function (param) {
        var splittedParam = param.split('=');
        if (splittedParam[0] === 'queryId') {
            return splittedParam[1];
        }
    }).filter(function (q) {
        return q;
    }) : undefined;

    return queryId && queryId.length > 0 ? event ? event + ':/' + queryId : queryId[0] : isQuery ? origPath : undefined;
};

var unsetWatcher = function unsetWatcher(firebase, dispatch, event, path) {
    var queryId = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : undefined;
    var isCleanFromState = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : true;

    var id = queryId || getQueryIdFromPath(path, event) || getWatchPath(event, path);
    path = path.split('#')[0];

    if (firebase._.watchers[id] <= 1) {
        delete firebase._.watchers[id];
        if (event != 'once') {
            // if (event !== 'first_child') {
            //   firebase.database().ref().child(path).off(event)
            // }
            firebase.database().ref().child(path).off(event);
            if (isCleanFromState) {
                dispatch({
                    type: _constants.INIT_BY_PATH,
                    path: path
                });
            }
        }
    } else if (firebase._.watchers[id]) {
        firebase._.watchers[id]--;
    }
};

var watchEvent = exports.watchEvent = function watchEvent(firebase, dispatch, event, path) {
    var isListenOnlyOnDelta = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;

    var isQuery = false;
    var queryParams = [];
    var queryId = getQueryIdFromPath(path, event);

    if (queryId) {
        var pathSplitted = path.split('#');
        path = pathSplitted[0];
        isQuery = true;
        queryParams = pathSplitted[1].split('&');
    }

    var watchPath = path;
    var counter = getWatcherCount(firebase, event, watchPath, queryId);

    if (counter > 0) {
        if (queryId) {
            unsetWatcher(firebase, dispatch, event, path, queryId, false);
        } else {
            return;
        }
    }

    setWatcher(firebase, event, watchPath, queryId);

    // if (event === 'first_child') {
    //   // return
    //   return firebase.database().ref().child(path).orderByKey().limitToFirst(1).once('value', snapshot => {
    //     if (snapshot.val() === null) {
    //       dispatch({
    //         type: NO_VALUE,
    //         path
    //       })
    //     }
    //   })
    // }

    var query = firebase.database().ref().child(path);

    if (isQuery) {
        (function () {
            var doNotParse = false;

            queryParams.forEach(function (param) {
                param = param.split('=');
                switch (param[0]) {
                    case 'orderByValue':
                        query = query.orderByValue();
                        doNotParse = true;
                        break;
                    case 'orderByPriority':
                        query = query.orderByPriority();
                        doNotParse = true;
                        break;
                    case 'orderByKey':
                        query = query.orderByKey();
                        doNotParse = true;
                        break;
                    case 'orderByChild':
                        query = query.orderByChild(param[1]);
                        break;
                    case 'limitToFirst':
                        query = query.limitToFirst(parseInt(param[1]));
                        break;
                    case 'limitToLast':
                        query = query.limitToLast(parseInt(param[1]));
                        break;
                    case 'equalTo':
                        var equalToParam = !doNotParse ? parseInt(param[1]) || param[1] : param[1];
                        equalToParam = equalToParam === 'null' ? null : equalToParam;
                        query = param.length === 3 ? query.equalTo(equalToParam, param[2]) : query.equalTo(equalToParam);
                        break;
                    case 'startAt':
                        var startAtParam = !doNotParse ? parseInt(param[1]) || param[1] : param[1];
                        startAtParam = startAtParam === 'null' ? null : startAtParam;
                        query = param.length === 3 ? query.startAt(startAtParam, param[2]) : query.startAt(startAtParam);
                        break;
                    case 'endAt':
                        var endAtParam = !doNotParse ? parseInt(param[1]) || param[1] : param[1];
                        endAtParam = endAtParam === 'null' ? null : endAtParam;
                        query = param.length === 3 ? query.endAt(endAtParam, param[2]) : query.endAt(endAtParam);
                        break;
                    default:
                        break;
                }
            });
        })();
    }

    var runQuery = function runQuery(q, e, p) {
        dispatch({
            type: _constants.START,
            timestamp: Date.now(),
            requesting: true,
            requested: false,
            path: path
        });

        if (e === 'once') {
            return q.once('value').then(function (snapshot) {
                if (snapshot.val() !== null) {
                    dispatch({
                        type: _constants.SET,
                        path: p,
                        rootPath: path,
                        data: snapshot.val(),
                        snapshot: snapshot,
                        timestamp: Date.now(),
                        requesting: false,
                        requested: true
                    });
                }
                return snapshot;
            });
        } else if (e === 'child_added' && isListenOnlyOnDelta) {
            var _ret2 = function () {
                var newItems = false;

                q.on(e, function (snapshot) {
                    if (!newItems) return;
                    dispatch({
                        type: _constants.SET,
                        path: p + '/' + snapshot.key,
                        rootPath: path,
                        data: snapshot.val(),
                        snapshot: snapshot,
                        timestamp: Date.now(),
                        requesting: false,
                        requested: true
                    });
                });

                return {
                    v: q.once('value').then(function (snapshot) {
                        newItems = true;
                        if (snapshot.val() !== null) {
                            dispatch({
                                type: _constants.SET,
                                path: p + '/' + snapshot.key,
                                rootPath: path,
                                data: snapshot.val(),
                                snapshot: snapshot,
                                timestamp: Date.now(),
                                requesting: false,
                                requested: true
                            });
                        }
                        return snapshot;
                    })
                };
            }();

            if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
        }

        q.on(e, function (snapshot) {
            var data = e === 'child_removed' ? undefined : snapshot.val();
            var resultPath = e === 'value' ? p : p + '/' + snapshot.key;
            // if (e !== 'child_removed') {
            //   data = {
            //     _id: snapshot.key,
            //     val: snapshot.val()
            //   }
            // }
            dispatch({
                type: _constants.SET,
                path: resultPath,
                rootPath: path,
                data: data,
                snapshot: snapshot,
                timestamp: Date.now(),
                requesting: false,
                requested: true
            });
        });
    };

    runQuery(query, event, path);
};

var unWatchEvent = exports.unWatchEvent = function unWatchEvent(firebase, dispatch, event, path) {
    var isCleanState = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;

    var queryId = getQueryIdFromPath(path, event);
    unsetWatcher(firebase, dispatch, event, path, queryId, isCleanState);
};

var watchEvents = exports.watchEvents = function watchEvents(firebase, dispatch, events) {
    return events.forEach(function (event) {
        return watchEvent(firebase, dispatch, event.name, event.path, event.isListenOnlyOnDelta);
    });
};

var unWatchEvents = exports.unWatchEvents = function unWatchEvents(firebase, dispatch, events) {
    var isCleanState = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    return events.forEach(function (event) {
        return unWatchEvent(firebase, dispatch, event.name, event.path, isCleanState);
    });
};

var dispatchLoginError = function dispatchLoginError(dispatch, authError) {
    return dispatch({
        type: _constants.LOGIN_ERROR,
        authError: authError
    });
};

var dispatchLogin = function dispatchLogin(dispatch, auth) {
    return dispatch({
        type: _constants.LOGIN,
        auth: auth,
        authError: null
    });
};

var unWatchUserProfile = function unWatchUserProfile(firebase) {
    var authUid = firebase._.authUid;
    var userProfile = firebase._.config.userProfile;
    if (firebase._.profileWatch) {
        firebase.database().ref().child(userProfile + '/' + authUid).off('value', firebase._.profileWatch);
        firebase._.profileWatch = null;
    }
};

var watchUserProfile = function watchUserProfile(dispatch, firebase) {
    var authUid = firebase._.authUid;
    var userProfile = firebase._.config.userProfile;
    unWatchUserProfile(firebase);
    if (firebase._.config.userProfile) {
        firebase._.profileWatch = firebase.database().ref().child(userProfile + '/' + authUid).on('value', function (snap) {
            dispatch({
                type: _constants.SET_PROFILE,
                profile: snap.val()
            });
        });
    }
};

var login = exports.login = function login(dispatch, firebase, credentials) {
    return new _es6Promise.Promise(function (resolve, reject) {
        dispatchLoginError(dispatch, null);

        var email = credentials.email,
            password = credentials.password;

        firebase.auth().signInWithEmailAndPassword(email, password).then(resolve).catch(function (err) {
            dispatchLoginError(dispatch, err);
            reject(err);
        });
    });
};

var init = exports.init = function init(dispatch, firebase) {
    firebase.auth().onAuthStateChanged(function (authData) {
        if (!authData) {
            return dispatch({ type: _constants.LOGOUT });
        }

        firebase._.authUid = authData.uid;
        watchUserProfile(dispatch, firebase);

        dispatchLogin(dispatch, authData);
    });

    firebase.auth().currentUser;

    // Run onAuthStateChanged if it exists in config
    if (firebase._.config.onAuthStateChanged) {
        firebase._.config.onAuthStateChanged(authData, firebase);
    }
};

var logout = exports.logout = function logout(dispatch, firebase) {
    var preserve = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
    var remove = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

    firebase.auth().signOut();
    dispatch({ type: _constants.LOGOUT, preserve: preserve, remove: remove });
    firebase._.authUid = null;
    unWatchUserProfile(firebase);
};

var createUser = exports.createUser = function createUser(dispatch, firebase, credentials, profile) {
    return new _es6Promise.Promise(function (resolve, reject) {
        dispatchLoginError(dispatch, null);
        firebase.auth().createUserWithEmailAndPassword(credentials.email, credentials.password).then(function (userData) {
            if (profile && firebase._.config.userProfile) {
                firebase.database().ref().child(firebase._.config.userProfile + '/' + userData.uid).set(profile);
            }

            login(dispatch, firebase, credentials).then(function () {
                return resolve(userData.uid);
            }).catch(function (err) {
                return reject(err);
            });
        }).catch(function (err) {
            dispatchLoginError(dispatch, err);
            return reject(err);
        });
    });
};

var resetPassword = exports.resetPassword = function resetPassword(dispatch, firebase, email) {
    dispatchLoginError(dispatch, null);
    return firebase.auth().sendPasswordResetEmail(email).catch(function (err) {
        if (err) {
            switch (err.code) {
                case 'INVALID_USER':
                    dispatchLoginError(dispatch, new Error('The specified user account does not exist.'));
                    break;
                default:
                    dispatchLoginError(dispatch, err);
            }
            return;
        }
    });
};

exports.default = { watchEvents: watchEvents, unWatchEvents: unWatchEvents, init: init, logout: logout, createUser: createUser, resetPassword: resetPassword };