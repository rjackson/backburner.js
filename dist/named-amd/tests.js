define('backburner-tests', ['backburner'], function (Backburner) { 'use strict';

Backburner = 'default' in Backburner ? Backburner['default'] : Backburner;

QUnit.module('tests/autorun');
QUnit.test('autorun', function (assert) {
    var done = assert.async();
    var bb = new Backburner(['zomg']);
    var step = 0;
    assert.ok(!bb.currentInstance, 'The DeferredActionQueues object is lazily instaniated');
    assert.equal(step++, 0);
    bb.schedule('zomg', null, function () {
        assert.equal(step, 2);
        setTimeout(function () {
            assert.ok(!bb.hasTimers(), 'The all timers are cleared');
            done();
        });
    });
    assert.ok(bb.currentInstance, 'The DeferredActionQueues object exists');
    assert.equal(step++, 1);
});
QUnit.test('autorun (joins next run if not yet flushed)', function (assert) {
    var bb = new Backburner(['zomg']);
    var order = -1;
    var tasks = {
        one: { count: 0, order: -1 },
        two: { count: 0, order: -1 }
    };
    bb.schedule('zomg', null, function () {
        tasks.one.count++;
        tasks.one.order = ++order;
    });
    assert.deepEqual(tasks, {
        one: { count: 0, order: -1 },
        two: { count: 0, order: -1 }
    });
    bb.run(function () {
        bb.schedule('zomg', null, function () {
            tasks.two.count++;
            tasks.two.order = ++order;
        });
        assert.deepEqual(tasks, {
            one: { count: 0, order: -1 },
            two: { count: 0, order: -1 }
        });
    });
    assert.deepEqual(tasks, {
        one: { count: 1, order: 0 },
        two: { count: 1, order: 1 }
    });
});

QUnit.module('tests/bb-has-timers');
QUnit.test('hasTimers', function (assert) {
    var done = assert.async();
    var bb = new Backburner(['ohai']);
    var timer;
    var target = {
        fn: function fn() { }
    };
    bb.schedule('ohai', null, function () {
        assert.ok(!bb.hasTimers(), 'Initially there are no timers');
        timer = bb.later('ohai', function () { });
        assert.ok(bb.hasTimers(), 'hasTimers checks timers');
        bb.cancel(timer);
        assert.ok(!bb.hasTimers(), 'Timers are cleared');
        timer = bb.debounce(target, 'fn', 200);
        assert.ok(bb.hasTimers(), 'hasTimers checks debouncees');
        bb.cancel(timer);
        assert.ok(!bb.hasTimers(), 'Timers are cleared');
        timer = bb.throttle(target, 'fn', 200);
        assert.ok(bb.hasTimers(), 'hasTimers checks throttlers');
        bb.cancel(timer);
        assert.ok(!bb.hasTimers(), 'Timers are cleared');
        done();
    });
});

QUnit.module('tests/cancel');
QUnit.test('null', function (assert) {
    // mimic browser behavior: window.clearTimeout(null) -> undefined
    assert.expect(3);
    var bb = new Backburner(['cancel']);
    assert.equal(bb.cancel(), undefined, 'cancel with no arguments should return undefined');
    assert.equal(bb.cancel(null), undefined, 'cancel a null timer should return undefined');
    assert.equal(bb.cancel(undefined), undefined, 'cancel an undefined timer should return undefined');
});
QUnit.test('scheduleOnce', function (assert) {
    assert.expect(3);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    bb.run(function () {
        var timer = bb.scheduleOnce('one', function () { return functionWasCalled = true; });
        assert.ok(timer, 'Timer object was returned');
        assert.ok(bb.cancel(timer), 'Cancel returned true');
        assert.ok(!functionWasCalled, 'function was not called');
    });
});
QUnit.test('setTimeout', function (assert) {
    assert.expect(5);
    var done = assert.async();
    var called = false;
    var bb = new Backburner(['one'], {
        onBegin: function onBegin() {
            called = true;
        }
    });
    var functionWasCalled = false;
    var timer = bb.later(function () { return functionWasCalled = true; });
    assert.ok(timer, 'Timer object was returned');
    assert.ok(bb.cancel(timer), 'Cancel returned true');
    assert.ok(!called, 'onBegin was not called');
    setTimeout(function () {
        assert.ok(!functionWasCalled, 'function was not called');
        assert.ok(!called, 'onBegin was not called');
        done();
    }, 0);
});
QUnit.test('setTimeout with multiple pending', function (assert) {
    assert.expect(7);
    var done = assert.async();
    var called = false;
    var bb = new Backburner(['one'], {
        onBegin: function onBegin() {
            called = true;
        }
    });
    var function1WasCalled = false;
    var function2WasCalled = false;
    var timer1 = bb.later(function () { return function1WasCalled = true; });
    var timer2 = bb.later(function () { return function2WasCalled = true; });
    assert.ok(timer1, 'Timer object 2 was returned');
    assert.ok(bb.cancel(timer1), 'Cancel for timer 1 returned true');
    assert.ok(timer2, 'Timer object 2 was returned');
    assert.ok(!called, 'onBegin was not called');
    setTimeout(function () {
        assert.ok(!function1WasCalled, 'function 1 was not called');
        assert.ok(function2WasCalled, 'function 2 was called');
        assert.ok(called, 'onBegin was called');
        done();
    }, 10);
});
QUnit.test('setTimeout and creating a new later', function (assert) {
    assert.expect(7);
    var done = assert.async();
    var called = false;
    var bb = new Backburner(['one'], {
        onBegin: function onBegin() {
            called = true;
        }
    });
    var function1WasCalled = false;
    var function2WasCalled = false;
    var timer1 = bb.later(function () { return function1WasCalled = true; }, 0);
    assert.ok(timer1, 'Timer object 2 was returned');
    assert.ok(bb.cancel(timer1), 'Cancel for timer 1 returned true');
    var timer2 = bb.later(function () { return function2WasCalled = true; }, 1);
    assert.ok(timer2, 'Timer object 2 was returned');
    assert.ok(!called, 'onBegin was not called');
    setTimeout(function () {
        assert.ok(!function1WasCalled, 'function 1 was not called');
        assert.ok(function2WasCalled, 'function 2 was called');
        assert.ok(called, 'onBegin was called');
        done();
    }, 50);
});
QUnit.test('cancelTimers', function (assert) {
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    var timer = bb.later(function () { return functionWasCalled = true; });
    assert.ok(timer, 'Timer object was returned');
    assert.ok(bb.hasTimers(), 'bb has scheduled timer');
    bb.cancelTimers();
    assert.ok(!bb.hasTimers(), 'bb has no scheduled timer');
    assert.ok(!functionWasCalled, 'function was not called');
});
QUnit.test('cancel during flush', function (assert) {
    assert.expect(1);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    bb.run(function () {
        var timer1 = bb.scheduleOnce('one', function () { return bb.cancel(timer2); });
        var timer2 = bb.scheduleOnce('one', function () { return functionWasCalled = true; });
    });
    assert.ok(!functionWasCalled, 'function was not called');
});
QUnit.test('with GUID_KEY and target', function (assert) {
    assert.expect(3);
    var obj = {
        ___FOO___: 1
    };
    var bb = new Backburner(['action'], {
        GUID_KEY: '___FOO___'
    });
    var wasCalled = 0;
    function fn() {
        wasCalled++;
    }
    bb.run(function () {
        var timer = bb.scheduleOnce('action', obj, fn);
        assert.equal(wasCalled, 0);
        bb.cancel(timer);
        bb.scheduleOnce('action', obj, fn);
        assert.equal(wasCalled, 0);
    });
    assert.equal(wasCalled, 1);
});
QUnit.test('with GUID_KEY and a target without meta', function (assert) {
    assert.expect(3);
    var obj = {};
    var bb = new Backburner(['action'], {
        GUID_KEY: '___FOO___'
    });
    var wasCalled = 0;
    function fn() {
        wasCalled++;
    }
    bb.run(function () {
        var timer = bb.scheduleOnce('action', obj, fn);
        assert.equal(wasCalled, 0);
        bb.cancel(timer);
        bb.scheduleOnce('action', obj, fn);
        assert.equal(wasCalled, 0);
    });
    assert.equal(wasCalled, 1);
});
QUnit.test('with GUID_KEY no target', function (assert) {
    assert.expect(3);
    var bb = new Backburner(['action'], {
        GUID_KEY: '___FOO___'
    });
    var wasCalled = 0;
    function fn() {
        wasCalled++;
    }
    bb.run(function () {
        var timer = bb.scheduleOnce('action', fn);
        assert.equal(wasCalled, 0);
        bb.cancel(timer);
        bb.scheduleOnce('action', fn);
        assert.equal(wasCalled, 0);
    });
    assert.equal(wasCalled, 1);
});
QUnit.test('with peekGuid and target', function (assert) {
    assert.expect(3);
    var obj = {};
    var bb = new Backburner(['action'], {
        peekGuid: function peekGuid(obj2) {
            if (obj === obj2) {
                return 1;
            }
        }
    });
    var wasCalled = 0;
    function fn() {
        wasCalled++;
    }
    bb.run(function () {
        var timer = bb.scheduleOnce('action', obj, fn);
        assert.equal(wasCalled, 0);
        bb.cancel(timer);
        bb.scheduleOnce('action', obj, fn);
        assert.equal(wasCalled, 0);
    });
    assert.equal(wasCalled, 1);
});
QUnit.test('with peekGuid and a target without guid', function (assert) {
    assert.expect(3);
    var obj = {};
    var bb = new Backburner(['action'], {
        peekGuid: function peekGuid() { }
    });
    var wasCalled = 0;
    function fn() {
        wasCalled++;
    }
    bb.run(function () {
        var timer = bb.scheduleOnce('action', obj, fn);
        assert.equal(wasCalled, 0);
        bb.cancel(timer);
        bb.scheduleOnce('action', obj, fn);
        assert.equal(wasCalled, 0);
    });
    assert.equal(wasCalled, 1);
});
QUnit.test('with peekGuid no target', function (assert) {
    assert.expect(3);
    var bb = new Backburner(['action'], {
        peekGuid: function peekGuid() { }
    });
    var wasCalled = 0;
    function fn() {
        wasCalled++;
    }
    bb.run(function () {
        var timer = bb.scheduleOnce('action', fn);
        assert.equal(wasCalled, 0);
        bb.cancel(timer);
        bb.scheduleOnce('action', fn);
        assert.equal(wasCalled, 0);
    });
    assert.equal(wasCalled, 1);
});

QUnit.module('tests/configurable-timeout');
QUnit.test('We can configure a custom platform', function (assert) {
    assert.expect(1);
    var fakePlatform = {
        setTimeout: function setTimeout() { },
        clearTimeout: function clearTimeout() { },
        isFakePlatform: true
    };
    var bb = new Backburner(['one'], {
        _platform: fakePlatform
    });
    assert.ok(bb.options._platform.isFakePlatform, 'We can pass in a custom platform');
});
QUnit.test('We can use a custom later', function (assert) {
    assert.expect(2);
    var done = assert.async();
    var customTimeoutWasUsed = false;
    var bb = new Backburner(['one'], {
        _platform: {
            setTimeout: function setTimeout$1(method, wait) {
                customTimeoutWasUsed = true;
                return setTimeout(method, wait);
            },
            clearTimeout: function clearTimeout$1(timer) {
                return clearTimeout(timer);
            },
            isFakePlatform: true
        }
    });
    bb.scheduleOnce('one', function () {
        assert.ok(bb.options._platform.isFakePlatform, 'we are using the fake platform');
        assert.ok(customTimeoutWasUsed, 'custom later was used');
        done();
    });
});
QUnit.test('We can use a custom clearTimeout', function (assert) {
    assert.expect(2);
    var functionWasCalled = false;
    var customClearTimeoutWasUsed = false;
    var bb = new Backburner(['one'], {
        _platform: {
            setTimeout: function setTimeout$1(method, wait) {
                return setTimeout(method, wait);
            },
            clearTimeout: function clearTimeout$1(timer) {
                customClearTimeoutWasUsed = true;
                return clearTimeout(timer);
            },
            next: function next(method) {
                return setTimeout(method, 0);
            },
            clearNext: function clearNext(timer) {
                customClearTimeoutWasUsed = true;
                return clearTimeout(timer);
            }
        }
    });
    bb.scheduleOnce('one', function () { return functionWasCalled = true; });
    bb.cancelTimers();
    bb.run(function () {
        bb.scheduleOnce('one', function () {
            assert.ok(!functionWasCalled, 'function was not called');
            assert.ok(customClearTimeoutWasUsed, 'custom clearTimeout was used');
        });
    });
});

QUnit.module('tests/debounce');
QUnit.test('debounce', function (assert) {
    assert.expect(14);
    var bb = new Backburner(['zomg']);
    var step = 0;
    var done = assert.async();
    var wasCalled = false;
    function debouncee() {
        assert.ok(!wasCalled);
        wasCalled = true;
    }
    // let's debounce the function `debouncee` for 40ms
    // it will be executed 40ms after
    bb.debounce(null, debouncee, 40);
    assert.equal(step++, 0);
    // let's schedule `debouncee` to run in 10ms
    setTimeout(function () {
        assert.equal(step++, 1);
        assert.ok(!wasCalled);
        bb.debounce(null, debouncee, 40);
    }, 10);
    // let's schedule `debouncee` to run again in 30ms
    setTimeout(function () {
        assert.equal(step++, 2);
        assert.ok(!wasCalled);
        bb.debounce(null, debouncee, 40);
    }, 30);
    // let's schedule `debouncee` to run yet again in 60ms
    setTimeout(function () {
        assert.equal(step++, 3);
        assert.ok(!wasCalled);
        bb.debounce(null, debouncee, 40);
    }, 60);
    // now, let's schedule an assertion to occur at 110ms,
    // 10ms after `debouncee` has been called the last time
    setTimeout(function () {
        assert.equal(step++, 4);
        assert.ok(wasCalled);
    }, 110);
    // great, we've made it this far, there's one more thing
    // we need to QUnit.test. we want to make sure we can call `debounce`
    // again with the same target/method after it has executed
    // at the 120ms mark, let's schedule another call to `debounce`
    setTimeout(function () {
        wasCalled = false; // reset the flag
        // assert call order
        assert.equal(step++, 5);
        // call debounce for the second time
        bb.debounce(null, debouncee, 100);
        // assert that it is called in the future and not blackholed
        setTimeout(function () {
            assert.equal(step++, 6);
            assert.ok(wasCalled, 'Another debounce call with the same function can be executed later');
            done();
        }, 230);
    }, 120);
});
QUnit.test('debounce - immediate', function (assert) {
    assert.expect(16);
    var done = assert.async();
    var bb = new Backburner(['zomg']);
    var step = 0;
    var wasCalled = false;
    function debouncee() {
        assert.ok(!wasCalled);
        wasCalled = true;
    }
    // let's debounce the function `debouncee` for 40ms
    // it will be executed immediately, and prevent
    // any actions for 40ms after
    bb.debounce(null, debouncee, 40, true);
    assert.equal(step++, 0);
    assert.ok(wasCalled);
    wasCalled = false;
    // let's schedule `debouncee` to run in 10ms
    setTimeout(function () {
        assert.equal(step++, 1);
        assert.ok(!wasCalled);
        bb.debounce(null, debouncee, 40, true);
    }, 10);
    // let's schedule `debouncee` to run again in 30ms
    setTimeout(function () {
        assert.equal(step++, 2);
        assert.ok(!wasCalled);
        bb.debounce(null, debouncee, 40, true);
    }, 30);
    // let's schedule `debouncee` to run yet again in 60ms
    setTimeout(function () {
        assert.equal(step++, 3);
        assert.ok(!wasCalled);
        bb.debounce(null, debouncee, 40, true);
    }, 60);
    // now, let's schedule an assertion to occur at 110ms,
    // 10ms after `debouncee` has been called the last time
    setTimeout(function () {
        assert.equal(step++, 4);
        assert.ok(!wasCalled);
    }, 110);
    // great, we've made it this far, there's one more thing
    // we need to QUnit.test. we want to make sure we can call `debounce`
    // again with the same target/method after it has executed
    // at the 120ms mark, let's schedule another call to `debounce`
    setTimeout(function () {
        wasCalled = false; // reset the flag
        // assert call order
        assert.equal(step++, 5);
        // call debounce for the second time
        bb.debounce(null, debouncee, 100, true);
        assert.ok(wasCalled, 'Another debounce call with the same function can be executed later');
        wasCalled = false;
        // assert that it is called in the future and not blackholed
        setTimeout(function () {
            assert.equal(step++, 6);
            assert.ok(!wasCalled);
            done();
        }, 230);
    }, 120);
});
QUnit.test('debounce accept time interval like string numbers', function (assert) {
    var done = assert.async();
    var bb = new Backburner(['zomg']);
    var step = 0;
    var wasCalled = false;
    function debouncee() {
        assert.ok(!wasCalled);
        wasCalled = true;
    }
    bb.debounce(null, debouncee, '40');
    assert.equal(step++, 0);
    setTimeout(function () {
        assert.equal(step++, 1);
        assert.ok(!wasCalled);
        bb.debounce(null, debouncee, '40');
    }, 10);
    setTimeout(function () {
        assert.equal(step++, 2);
        assert.ok(wasCalled);
        done();
    }, 60);
});
QUnit.test('debounce returns timer information usable for cancelling', function (assert) {
    assert.expect(3);
    var done = assert.async();
    var bb = new Backburner(['batman']);
    var wasCalled = false;
    function debouncee() {
        assert.ok(false, 'this method shouldn\'t be called');
        wasCalled = true;
    }
    var timer = bb.debounce(null, debouncee, 1);
    assert.ok(bb.cancel(timer), 'the timer is cancelled');
    // should return false second time around
    assert.ok(!bb.cancel(timer), 'the timer no longer exists in the list');
    setTimeout(function () {
        assert.ok(!wasCalled, 'the timer wasn\'t called after waiting');
        done();
    }, 60);
});
QUnit.test('debounce cancelled after it\'s executed returns false', function (assert) {
    assert.expect(3);
    var done = assert.async();
    var bb = new Backburner(['darkknight']);
    var wasCalled = false;
    function debouncee() {
        assert.ok(true, 'the debounced method was called');
        wasCalled = true;
    }
    var timer = bb.debounce(null, debouncee, 1);
    setTimeout(function () {
        assert.ok(!bb.cancel(timer), 'no timer existed to cancel');
        assert.ok(wasCalled, 'the timer was actually called');
        done();
    }, 10);
});
QUnit.test('debounce cancelled doesn\'t cancel older items', function (assert) {
    assert.expect(4);
    var bb = new Backburner(['robin']);
    var wasCalled = false;
    var done = assert.async();
    function debouncee() {
        assert.ok(true, 'the debounced method was called');
        if (wasCalled) {
            done();
        }
        wasCalled = true;
    }
    var timer = bb.debounce(null, debouncee, 1);
    setTimeout(function () {
        bb.debounce(null, debouncee, 1);
        assert.ok(!bb.cancel(timer), 'the second timer isn\'t removed, despite appearing to be the same');
        assert.ok(wasCalled, 'the timer was actually called');
    }, 10);
});
QUnit.test('debounce that is immediate, and cancelled and called again happens immediately', function (assert) {
    assert.expect(3);
    var done = assert.async();
    var bb = new Backburner(['robin']);
    var calledCount = 0;
    function debouncee() {
        calledCount++;
    }
    var timer = bb.debounce(null, debouncee, 1000, true);
    setTimeout(function () {
        assert.equal(1, calledCount, 'debounced method was called');
        assert.ok(bb.cancel(timer), 'debounced delay was cancelled');
        bb.debounce(null, debouncee, 1000, true);
        setTimeout(function () {
            assert.equal(2, calledCount, 'debounced method was called again immediately');
            done();
        }, 10);
    }, 10);
});
QUnit.test('onError', function (assert) {
    assert.expect(1);
    var done = assert.async();
    function onError(error) {
        assert.equal('QUnit.test error', error.message);
        done();
    }
    var bb = new Backburner(['errors'], {
        onError: onError
    });
    bb.debounce(null, function () { throw new Error('QUnit.test error'); }, 20);
});

QUnit.module('tests/debug');
QUnit.test('DEBUG flag enables stack tagging', function (assert) {
    var bb = new Backburner(['one']);
    bb.schedule('one', function () { });
    assert.ok(bb.currentInstance && !bb.currentInstance.queues.one._queue[3], 'No stack is recorded');
    bb.DEBUG = true;
    bb.schedule('one', function () { });
    if (new Error().stack) {
        assert.expect(4);
        var stack = bb.currentInstance && bb.currentInstance.queues.one._queue[7].stack;
        assert.ok(typeof stack === 'string', 'A stack is recorded');
        var onError = function (error, errorRecordedForStack) {
            assert.ok(errorRecordedForStack, 'errorRecordedForStack passed to error function');
            assert.ok(errorRecordedForStack.stack, 'stack is recorded');
        };
        bb = new Backburner(['errors'], { onError: onError });
        bb.DEBUG = true;
        bb.run(function () {
            bb.schedule('errors', function () {
                throw new Error('message!');
            });
        });
    }
});

QUnit.module('tests/defer-iterable');
var Iterator = function Iterator(collection) {
    if ( collection === void 0 ) collection = [];

    this._iteration = 0;
    this._collection = collection;
};
Iterator.prototype.next = function next () {
    var iteration = this._iteration++;
    var collection = this._collection;
    var done = collection.length <= iteration;
    var value = done ? undefined : collection[iteration];
    return {
        done: done,
        value: value
    };
};
QUnit.test('deferIterable', function (assert) {
    var bb = new Backburner(['zomg']);
    var order = 0;
    var tasks = {
        one: { count: 0, order: -1 },
        two: { count: 0, order: -1 },
        three: { count: 0, order: -1 }
    };
    function task1() {
        tasks.one.count++;
        tasks.one.order = order++;
    }
    function task2() {
        tasks.two.count++;
        tasks.two.order = order++;
    }
    function task3() {
        tasks.three.count++;
        tasks.three.order = order++;
    }
    var iterator = function () { return new Iterator([task1, task2, task3]); };
    bb.run(function () {
        bb.scheduleIterable('zomg', iterator);
        assert.deepEqual(tasks, {
            one: { count: 0, order: -1 },
            two: { count: 0, order: -1 },
            three: { count: 0, order: -1 }
        });
    });
    assert.deepEqual(tasks, {
        one: { count: 1, order: 0 },
        two: { count: 1, order: 1 },
        three: { count: 1, order: 2 }
    });
});

QUnit.module('tests/defer-once');
QUnit.test('when passed a function', function (assert) {
    assert.expect(1);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    bb.run(function () {
        bb.scheduleOnce('one', function () {
            functionWasCalled = true;
        });
    });
    assert.ok(functionWasCalled, 'function was called');
});
QUnit.test('when passed a target and method', function (assert) {
    assert.expect(2);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    bb.run(function () {
        bb.scheduleOnce('one', { zomg: 'hi' }, function () {
            assert.equal(this.zomg, 'hi', 'the target was properly set');
            functionWasCalled = true;
        });
    });
    assert.ok(functionWasCalled, 'function was called');
});
QUnit.test('when passed a target and method name', function (assert) {
    assert.expect(2);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    var targetObject = {
        zomg: 'hi',
        checkFunction: function checkFunction() {
            assert.equal(this.zomg, 'hi', 'the target was properly set');
            functionWasCalled = true;
        }
    };
    bb.run(function () { return bb.scheduleOnce('one', targetObject, 'checkFunction'); });
    assert.ok(functionWasCalled, 'function was called');
});
QUnit.test('throws when passed a null method', function (assert) {
    assert.expect(1);
    function onError(error) {
        assert.equal('You attempted to schedule an action in a queue (deferErrors) for a method that doesn\'t exist', error.message);
    }
    var bb = new Backburner(['deferErrors'], {
        onError: onError
    });
    bb.run(function () { return bb.scheduleOnce('deferErrors', { zomg: 'hi' }, null); });
});
QUnit.test('throws when passed an undefined method', function (assert) {
    assert.expect(1);
    function onError(error) {
        assert.equal('You attempted to schedule an action in a queue (deferErrors) for a method that doesn\'t exist', error.message);
    }
    var bb = new Backburner(['deferErrors'], {
        onError: onError
    });
    bb.run(function () { return bb.deferOnce('deferErrors', { zomg: 'hi' }, undefined); });
});
QUnit.test('throws when passed an method name that does not exists on the target', function (assert) {
    assert.expect(1);
    function onError(error) {
        assert.equal('You attempted to schedule an action in a queue (deferErrors) for a method that doesn\'t exist', error.message);
    }
    var bb = new Backburner(['deferErrors'], {
        onError: onError
    });
    bb.run(function () { return bb.deferOnce('deferErrors', { zomg: 'hi' }, 'checkFunction'); });
});
QUnit.test('when passed a target, method, and arguments', function (assert) {
    assert.expect(5);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    bb.run(function () {
        bb.scheduleOnce('one', { zomg: 'hi' }, function (a, b, c) {
            assert.equal(this.zomg, 'hi', 'the target was properly set');
            assert.equal(a, 1, 'the first arguments was passed in');
            assert.equal(b, 2, 'the second arguments was passed in');
            assert.equal(c, 3, 'the third arguments was passed in');
            functionWasCalled = true;
        }, 1, 2, 3);
    });
    assert.ok(functionWasCalled, 'function was called');
});
QUnit.test('when passed same function twice', function (assert) {
    assert.expect(2);
    var bb = new Backburner(['one']);
    var i = 0;
    var functionWasCalled = false;
    function deferMethod() {
        i++;
        assert.equal(i, 1, 'Function should be called only once');
        functionWasCalled = true;
    }
    bb.run(function () {
        bb.scheduleOnce('one', deferMethod);
        bb.scheduleOnce('one', deferMethod);
    });
    assert.ok(functionWasCalled, 'function was called only once');
});
QUnit.test('when passed same function twice with same target', function (assert) {
    assert.expect(3);
    var bb = new Backburner(['one']);
    var i = 0;
    var functionWasCalled = false;
    function deferMethod() {
        i++;
        assert.equal(i, 1, 'Function should be called only once');
        assert.equal(this['first'], 1, 'the target property was set');
        functionWasCalled = true;
    }
    var argObj = { first: 1 };
    bb.run(function () {
        bb.scheduleOnce('one', argObj, deferMethod);
        bb.scheduleOnce('one', argObj, deferMethod);
    });
    assert.ok(functionWasCalled, 'function was called only once');
});
QUnit.test('when passed same function twice with different targets', function (assert) {
    assert.expect(3);
    var bb = new Backburner(['one']);
    var i = 0;
    function deferMethod() {
        i++;
        assert.equal(this['first'], 1, 'the target property was set');
    }
    bb.run(function () {
        bb.scheduleOnce('one', { first: 1 }, deferMethod);
        bb.scheduleOnce('one', { first: 1 }, deferMethod);
    });
    assert.equal(i, 2, 'function was called twice');
});
QUnit.test('when passed same function twice with same arguments and same target', function (assert) {
    assert.expect(4);
    var bb = new Backburner(['one']);
    var i = 0;
    function deferMethod(a, b) {
        i++;
        assert.equal(a, 1, 'First argument is set only one time');
        assert.equal(b, 2, 'Second argument remains same');
        assert.equal(this['first'], 1, 'the target property was set');
    }
    var argObj = { first: 1 };
    bb.run(function () {
        bb.scheduleOnce('one', argObj, deferMethod, 1, 2);
        bb.scheduleOnce('one', argObj, deferMethod, 1, 2);
    });
    assert.equal(i, 1, 'function was called once');
});
QUnit.test('when passed same function twice with same target and different arguments', function (assert) {
    assert.expect(4);
    var bb = new Backburner(['one']);
    var i = 0;
    function deferMethod(a, b) {
        i++;
        assert.equal(a, 3, 'First argument of only second call is set');
        assert.equal(b, 2, 'Second argument remains same');
        assert.equal(this['first'], 1, 'the target property was set');
    }
    var argObj = { first: 1 };
    bb.run(function () {
        bb.scheduleOnce('one', argObj, deferMethod, 1, 2);
        bb.scheduleOnce('one', argObj, deferMethod, 3, 2);
    });
    assert.equal(i, 1, 'function was called once');
});
QUnit.test('when passed same function twice with different target and different arguments', function (assert) {
    assert.expect(7);
    var bb = new Backburner(['one']);
    var i = 0;
    function deferMethod(a, b) {
        i++;
        if (i === 1) {
            assert.equal(a, 1, 'First argument set during first call');
        }
        else {
            assert.equal(a, 3, 'First argument set during second call');
        }
        assert.equal(b, 2, 'Second argument remains same');
        assert.equal(this['first'], 1, 'the target property was set');
    }
    var argObj = { first: 1 };
    bb.run(function () {
        bb.scheduleOnce('one', { first: 1 }, deferMethod, 1, 2);
        bb.scheduleOnce('one', { first: 1 }, deferMethod, 3, 2);
    });
    assert.equal(i, 2, 'function was called twice');
});
QUnit.test('when passed same function with same target after already triggering in current loop (GUID_KEY)', function (assert) {
    assert.expect(5);
    var bb = new Backburner(['one', 'two'], { GUID_KEY: 'GUID_KEY' });
    var i = 0;
    function deferMethod(a) {
        i++;
        assert.equal(a, i, 'Correct argument is set');
        assert.equal(this['first'], 1, 'the target property was set');
    }
    function scheduleMethod() {
        bb.scheduleOnce('one', argObj, deferMethod, 2);
    }
    var argObj = { first: 1, GUID_KEY: '1' };
    bb.run(function () {
        bb.scheduleOnce('one', argObj, deferMethod, 1);
        bb.scheduleOnce('two', argObj, scheduleMethod);
    });
    assert.equal(i, 2, 'function was called twice');
});
QUnit.test('when passed same function with same target after already triggering in current loop (peekGuid)', function (assert) {
    assert.expect(5);
    var argObj = { first: 1 };
    var bb = new Backburner(['one', 'two'], {
        peekGuid: function peekGuid(obj) {
            if (argObj === obj) {
                return '1';
            }
        }
    });
    var i = 0;
    function deferMethod(a) {
        i++;
        assert.equal(a, i, 'Correct argument is set');
        assert.equal(this['first'], 1, 'the target property was set');
    }
    function scheduleMethod() {
        bb.scheduleOnce('one', argObj, deferMethod, 2);
    }
    bb.run(function () {
        bb.scheduleOnce('one', argObj, deferMethod, 1);
        bb.scheduleOnce('two', argObj, scheduleMethod);
    });
    assert.equal(i, 2, 'function was called twice');
});
QUnit.test('onError', function (assert) {
    assert.expect(1);
    function onError(error) {
        assert.equal('QUnit.test error', error.message);
    }
    var bb = new Backburner(['errors'], { onError: onError });
    bb.run(function () {
        bb.scheduleOnce('errors', function () {
            throw new Error('QUnit.test error');
        });
    });
});

var originalDateValueOf = Date.prototype.valueOf;
QUnit.module('tests/defer', {
    afterEach: function afterEach() {
        Date.prototype.valueOf = originalDateValueOf;
    }
});
QUnit.test('when passed a function', function (assert) {
    assert.expect(1);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    bb.run(function () {
        bb.schedule('one', function () { return functionWasCalled = true; });
    });
    assert.ok(functionWasCalled, 'function was called');
});
QUnit.test('when passed a target and method', function (assert) {
    assert.expect(2);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    bb.run(function () {
        bb.schedule('one', { zomg: 'hi' }, function () {
            assert.equal(this.zomg, 'hi', 'the target was properly set');
            functionWasCalled = true;
        });
    });
    assert.ok(functionWasCalled, 'function was called');
});
QUnit.test('when passed a target and method name', function (assert) {
    assert.expect(2);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    var targetObject = {
        zomg: 'hi',
        checkFunction: function checkFunction() {
            assert.equal(this.zomg, 'hi', 'the target was properly set');
            functionWasCalled = true;
        }
    };
    bb.run(function () { return bb.schedule('one', targetObject, 'checkFunction'); });
    assert.ok(functionWasCalled, 'function was called');
});
QUnit.test('throws when passed a null method', function (assert) {
    assert.expect(1);
    function onError(error) {
        assert.equal('You attempted to schedule an action in a queue (deferErrors) for a method that doesn\'t exist', error.message);
    }
    var bb = new Backburner(['deferErrors'], {
        onError: onError
    });
    bb.run(function () { return bb.schedule('deferErrors', { zomg: 'hi' }, null); });
});
QUnit.test('throws when passed an undefined method', function (assert) {
    assert.expect(1);
    function onError(error) {
        assert.equal('You attempted to schedule an action in a queue (deferErrors) for a method that doesn\'t exist', error.message);
    }
    var bb = new Backburner(['deferErrors'], {
        onError: onError
    });
    bb.run(function () { return bb.schedule('deferErrors', { zomg: 'hi' }, undefined); });
});
QUnit.test('throws when passed an method name that does not exists on the target', function (assert) {
    assert.expect(1);
    function onError(error) {
        assert.equal('You attempted to schedule an action in a queue (deferErrors) for a method that doesn\'t exist', error.message);
    }
    var bb = new Backburner(['deferErrors'], {
        onError: onError
    });
    bb.run(function () { return bb.schedule('deferErrors', { zomg: 'hi' }, 'checkFunction'); });
});
QUnit.test('when passed a target, method, and arguments', function (assert) {
    assert.expect(5);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    bb.run(function () {
        bb.schedule('one', { zomg: 'hi' }, function (a, b, c) {
            assert.equal(this.zomg, 'hi', 'the target was properly set');
            assert.equal(a, 1, 'the first arguments was passed in');
            assert.equal(b, 2, 'the second arguments was passed in');
            assert.equal(c, 3, 'the third arguments was passed in');
            functionWasCalled = true;
        }, 1, 2, 3);
    });
    assert.ok(functionWasCalled, 'function was called');
});
QUnit.test('when passed same function twice', function (assert) {
    assert.expect(1);
    var bb = new Backburner(['one']);
    var i = 0;
    function deferMethod() {
        i++;
    }
    bb.run(function () {
        bb.schedule('one', deferMethod);
        bb.schedule('one', deferMethod);
    });
    assert.equal(i, 2, 'function was called twice');
});
QUnit.test('when passed same function twice with arguments', function (assert) {
    assert.expect(2);
    var bb = new Backburner(['one']);
    var i = 0;
    var argObj = { first: 1 };
    function deferMethod() {
        assert.equal(this['first'], 1, 'the target property was set');
    }
    bb.run(function () {
        bb.schedule('one', argObj, deferMethod);
        bb.schedule('one', argObj, deferMethod);
    });
});
QUnit.test('when passed same function twice with same arguments and same target', function (assert) {
    assert.expect(7);
    var bb = new Backburner(['one']);
    var i = 0;
    function deferMethod(a, b) {
        i++;
        assert.equal(a, 1, 'First argument is set twice');
        assert.equal(b, 2, 'Second argument is set twice');
        assert.equal(this['first'], 1, 'the target property was set');
    }
    var argObj = { first: 1 };
    bb.run(function () {
        bb.schedule('one', argObj, deferMethod, 1, 2);
        bb.schedule('one', argObj, deferMethod, 1, 2);
    });
    assert.equal(i, 2, 'function was called twice');
});
QUnit.test('when passed same function twice with same target and different arguments', function (assert) {
    assert.expect(7);
    var bb = new Backburner(['one']);
    var i = 0;
    function deferMethod(a, b) {
        i++;
        if (i === 1) {
            assert.equal(a, 1, 'First argument set during first call');
        }
        else {
            assert.equal(a, 3, 'First argument set during second call');
        }
        assert.equal(b, 2, 'Second argument remains same');
        assert.equal(this['first'], 1, 'the target property was set');
    }
    var argObj = { first: 1 };
    bb.run(function () {
        bb.schedule('one', argObj, deferMethod, 1, 2);
        bb.schedule('one', argObj, deferMethod, 3, 2);
    });
    assert.equal(i, 2, 'function was called twice');
});
QUnit.test('when passed same function twice with different target and different arguments', function (assert) {
    assert.expect(7);
    var bb = new Backburner(['one']);
    var i = 0;
    function deferMethod(a, b) {
        i++;
        if (i === 1) {
            assert.equal(a, 1, 'First argument set during first call');
        }
        else {
            assert.equal(a, 3, 'First argument set during second call');
        }
        assert.equal(b, 2, 'Second argument remains same');
        assert.equal(this['first'], 1, 'the target property was set');
    }
    var argObj = { first: 1 };
    bb.run(function () {
        bb.schedule('one', { first: 1 }, deferMethod, 1, 2);
        bb.schedule('one', { first: 1 }, deferMethod, 3, 2);
    });
    assert.equal(i, 2, 'function was called twice');
});
QUnit.test('onError', function (assert) {
    assert.expect(1);
    function onError(error) {
        assert.equal('QUnit.test error', error.message);
    }
    var bb = new Backburner(['errors'], {
        onError: onError
    });
    bb.run(function () {
        bb.schedule('errors', function () {
            throw new Error('QUnit.test error');
        });
    });
});

QUnit.module('tests/events');
QUnit.test('end event should fire after runloop completes', function (assert) {
    assert.expect(3);
    var callNumber = 0;
    var bb = new Backburner(['one', 'two']);
    bb.on('end', function () { return callNumber++; });
    function funcOne() {
        assert.equal(callNumber, 0);
    }
    function funcTwo() {
        assert.equal(callNumber, 0);
    }
    bb.run(function () {
        bb.schedule('one', null, funcOne);
        bb.schedule('two', null, funcTwo);
    });
    assert.equal(callNumber, 1);
});
QUnit.test('end event should fire before onEnd', function (assert) {
    assert.expect(3);
    var callNumber = 0;
    var bb = new Backburner(['one', 'two'], {
        onEnd: function onEnd() {
            assert.equal(callNumber, 1);
        }
    });
    bb.on('end', function () { return callNumber++; });
    function funcOne() {
        assert.equal(callNumber, 0);
    }
    function funcTwo() {
        assert.equal(callNumber, 0);
    }
    bb.run(function () {
        bb.schedule('one', null, funcOne);
        bb.schedule('two', null, funcTwo);
    });
});
QUnit.test('end event should be passed the current and next instance', function (assert) {
    assert.expect(4);
    var callNumber = 0;
    var firstArgument = null;
    var secondArgument = null;
    var bb = new Backburner(['one'], {
        onEnd: function onEnd(first, second) {
            assert.equal(firstArgument, first);
            assert.equal(secondArgument, second);
        }
    });
    bb.on('end', function (first, second) {
        firstArgument = first;
        secondArgument = second;
    });
    bb.run(function () { return bb.schedule('one', null, function () { }); });
    bb.run(function () { return bb.schedule('one', null, function () { }); });
});
// blah
QUnit.test('begin event should fire before runloop begins', function (assert) {
    assert.expect(4);
    var callNumber = 0;
    var bb = new Backburner(['one', 'two']);
    bb.on('begin', function () { return callNumber++; });
    function funcOne() {
        assert.equal(callNumber, 1);
    }
    function funcTwo() {
        assert.equal(callNumber, 1);
    }
    assert.equal(callNumber, 0);
    bb.run(function () {
        bb.schedule('one', null, funcOne);
        bb.schedule('two', null, funcTwo);
    });
    assert.equal(callNumber, 1);
});
QUnit.test('begin event should fire before onBegin', function (assert) {
    assert.expect(1);
    var callNumber = 0;
    var bb = new Backburner(['one', 'two'], {
        onBegin: function onBegin() {
            assert.equal(callNumber, 1);
        }
    });
    bb.on('begin', function () { return callNumber++; });
    bb.run(function () {
        bb.schedule('one', null, function () { });
        bb.schedule('two', null, function () { });
    });
});
QUnit.test('begin event should be passed the current and previous instance', function (assert) {
    assert.expect(4);
    var callNumber = 0;
    var firstArgument = null;
    var secondArgument = null;
    var bb = new Backburner(['one'], {
        onBegin: function onBegin(first, second) {
            assert.equal(firstArgument, first);
            assert.equal(secondArgument, second);
        }
    });
    bb.on('begin', function (first, second) {
        firstArgument = first;
        secondArgument = second;
    });
    bb.run(function () { return bb.schedule('one', null, function () { }); });
    bb.run(function () { return bb.schedule('one', null, function () { }); });
});
// blah
QUnit.test('events should work with multiple callbacks', function (assert) {
    assert.expect(2);
    var firstCalled = false;
    var secondCalled = false;
    var bb = new Backburner(['one']);
    function first() {
        firstCalled = true;
    }
    function second() {
        secondCalled = true;
    }
    bb.on('end', first);
    bb.on('end', second);
    bb.run(function () { return bb.schedule('one', null, function () { }); });
    assert.equal(secondCalled, true);
    assert.equal(firstCalled, true);
});
QUnit.test('off should unregister specific callback', function (assert) {
    assert.expect(2);
    var firstCalled = false;
    var secondCalled = false;
    var bb = new Backburner(['one']);
    function first() {
        firstCalled = true;
    }
    function second() {
        secondCalled = true;
    }
    bb.on('end', first);
    bb.on('end', second);
    bb.off('end', first);
    bb.run(function () { return bb.schedule('one', null, function () { }); });
    assert.equal(secondCalled, true);
    assert.equal(firstCalled, false);
});

QUnit.module('tests/join');
function depth(bb) {
    return bb.instanceStack.length + (bb.currentInstance ? 1 : 0);
}
QUnit.test('outside of a run loop', function (assert) {
    assert.expect(4);
    var bb = new Backburner(['one']);
    assert.equal(depth(bb), 0);
    var result = bb.join(function () {
        assert.equal(depth(bb), 1);
        return 'result';
    });
    assert.equal(result, 'result');
    assert.equal(depth(bb), 0);
});
QUnit.test('inside of a run loop', function (assert) {
    assert.expect(4);
    var bb = new Backburner(['one']);
    assert.equal(depth(bb), 0);
    bb.run(function () {
        var result = bb.join(function () {
            assert.equal(depth(bb), 1);
            return 'result';
        });
        assert.equal(result, 'result');
    });
    assert.equal(depth(bb), 0);
});
QUnit.test('nested join calls', function (assert) {
    assert.expect(7);
    var bb = new Backburner(['one']);
    assert.equal(depth(bb), 0);
    bb.join(function () {
        assert.equal(depth(bb), 1);
        bb.join(function () {
            assert.equal(depth(bb), 1);
            bb.join(function () {
                assert.equal(depth(bb), 1);
            });
            assert.equal(depth(bb), 1);
        });
        assert.equal(depth(bb), 1);
    });
    assert.equal(depth(bb), 0);
});
QUnit.test('nested run loops', function (assert) {
    assert.expect(7);
    var bb = new Backburner(['one']);
    assert.equal(depth(bb), 0);
    bb.join(function () {
        assert.equal(depth(bb), 1);
        bb.run(function () {
            assert.equal(depth(bb), 2);
            bb.join(function () {
                assert.equal(depth(bb), 2);
            });
            assert.equal(depth(bb), 2);
        });
        assert.equal(depth(bb), 1);
    });
    assert.equal(depth(bb), 0);
});
QUnit.test('queue execution order', function (assert) {
    assert.expect(1);
    var bb = new Backburner(['one']);
    var items = [];
    bb.run(function () {
        items.push(0);
        bb.schedule('one', function () { return items.push(4); });
        bb.join(function () {
            items.push(1);
            bb.schedule('one', function () { return items.push(5); });
            items.push(2);
        });
        bb.schedule('one', function () { return items.push(6); });
        items.push(3);
    });
    assert.deepEqual(items, [0, 1, 2, 3, 4, 5, 6]);
});

QUnit.module('tests/multi-turn');
var queue = [];
var platform = {
    flushSync: function flushSync() {
        var current = queue.slice();
        queue.length = 0;
        current.forEach(function (task) { return task(); });
    },
    // TDB actually implement
    next: function next(cb) {
        queue.push(cb);
    }
};
QUnit.test('basic', function (assert) {
    var bb = new Backburner(['zomg'], {
        // This is just a place holder for now, but somehow the system needs to
        // know to when to stop
        mustYield: function mustYield() {
            return true; // yield after each step, for now.
        },
        _platform: platform
    });
    var order = -1;
    var tasks = {
        one: { count: 0, order: -1 },
        two: { count: 0, order: -1 },
        three: { count: 0, order: -1 }
    };
    bb.schedule('zomg', null, function () {
        tasks.one.count++;
        tasks.one.order = ++order;
    });
    bb.schedule('zomg', null, function () {
        tasks.two.count++;
        tasks.two.order = ++order;
    });
    bb.schedule('zomg', null, function () {
        tasks.three.count++;
        tasks.three.order = ++order;
    });
    assert.deepEqual(tasks, {
        one: { count: 0, order: -1 },
        two: { count: 0, order: -1 },
        three: { count: 0, order: -1 }
    }, 'no tasks have been run before the platform flushes');
    platform.flushSync();
    assert.deepEqual(tasks, {
        one: { count: 1, order: 0 },
        two: { count: 0, order: -1 },
        three: { count: 0, order: -1 }
    }, 'TaskOne has been run before the platform flushes');
    platform.flushSync();
    assert.deepEqual(tasks, {
        one: { count: 1, order: 0 },
        two: { count: 1, order: 1 },
        three: { count: 0, order: -1 }
    }, 'TaskOne and TaskTwo has been run before the platform flushes');
    platform.flushSync();
    assert.deepEqual(tasks, {
        one: { count: 1, order: 0 },
        two: { count: 1, order: 1 },
        three: { count: 1, order: 2 }
    }, 'TaskOne, TaskTwo and TaskThree has been run before the platform flushes');
});

var Queue = Backburner.Queue;
QUnit.module('tests/queue-push-unique');
var slice = [].slice;
QUnit.test('pushUnique: 2 different targets', function (assert) {
    var queue = new Queue('foo');
    var target1fooWasCalled = [];
    var target2fooWasCalled = [];
    var target1 = {
        foo: function foo() {
            target1fooWasCalled.push(slice.call(arguments));
        }
    };
    var target2 = {
        foo: function foo() {
            target2fooWasCalled.push(slice.call(arguments));
        }
    };
    queue.pushUnique(target1, target1.foo, ['a']);
    queue.pushUnique(target2, target2.foo, ['b']);
    assert.deepEqual(target1fooWasCalled, []);
    assert.deepEqual(target2fooWasCalled, []);
    queue.flush();
    assert.deepEqual(target1fooWasCalled.length, 1, 'expected: target 1.foo to be called only once');
    assert.deepEqual(target1fooWasCalled[0], ['a']);
    assert.deepEqual(target2fooWasCalled.length, 1, 'expected: target 2.foo to be called only once');
    assert.deepEqual(target2fooWasCalled[0], ['b']);
});
QUnit.test('pushUnique: 1 target, 2 different methods', function (assert) {
    var queue = new Queue('foo');
    var target1fooWasCalled = [];
    var target1barWasCalled = [];
    var target1 = {
        foo: function () {
            target1fooWasCalled.push(slice.call(arguments));
        },
        bar: function () {
            target1barWasCalled.push(slice.call(arguments));
        }
    };
    queue.pushUnique(target1, target1.foo, ['a']);
    queue.pushUnique(target1, target1.bar, ['b']);
    assert.deepEqual(target1fooWasCalled, []);
    assert.deepEqual(target1barWasCalled, []);
    queue.flush();
    assert.deepEqual(target1fooWasCalled.length, 1, 'expected: target 1.foo to be called only once');
    assert.deepEqual(target1fooWasCalled[0], ['a']);
    assert.deepEqual(target1barWasCalled.length, 1, 'expected: target 1.bar to be called only once');
    assert.deepEqual(target1barWasCalled[0], ['b']);
});
QUnit.test('pushUnique: 1 target, 1 different methods called twice', function (assert) {
    var queue = new Queue('foo');
    var target1fooWasCalled = [];
    var target1 = {
        foo: function () {
            target1fooWasCalled.push(slice.call(arguments));
        }
    };
    queue.pushUnique(target1, target1.foo, ['a']);
    queue.pushUnique(target1, target1.foo, ['b']);
    assert.deepEqual(target1fooWasCalled, []);
    queue.flush();
    assert.deepEqual(target1fooWasCalled.length, 1, 'expected: target 1.foo to be called only once');
    assert.deepEqual(target1fooWasCalled[0], ['b']);
});
QUnit.test('pushUnique: 2 different targets (GUID_KEY)', function (assert) {
    var queue = new Queue('foo', {}, { GUID_KEY: 'GUID_KEY' });
    var target1fooWasCalled = [];
    var target2fooWasCalled = [];
    var target1 = {
        GUID_KEY: 'target1',
        foo: function () {
            target1fooWasCalled.push(slice.call(arguments));
        }
    };
    var target2 = {
        GUID_KEY: 'target2',
        foo: function () {
            target2fooWasCalled.push(slice.call(arguments));
        }
    };
    queue.pushUnique(target1, target1.foo, ['a']);
    queue.pushUnique(target2, target2.foo, ['b']);
    assert.deepEqual(target1fooWasCalled, []);
    assert.deepEqual(target2fooWasCalled, []);
    queue.flush();
    assert.deepEqual(target1fooWasCalled.length, 1, 'expected: target 1.foo to be called only once');
    assert.deepEqual(target1fooWasCalled[0], ['a']);
    assert.deepEqual(target2fooWasCalled.length, 1, 'expected: target 2.foo to be called only once');
    assert.deepEqual(target2fooWasCalled[0], ['b']);
});
QUnit.test('pushUnique: 1 target, 2 different methods (GUID_KEY)', function (assert) {
    var queue = new Queue('foo', {}, { GUID_KEY: 'GUID_KEY' });
    var target1fooWasCalled = [];
    var target1barWasCalled = [];
    var target1 = {
        GUID_KEY: 'target1',
        foo: function () {
            target1fooWasCalled.push(slice.call(arguments));
        },
        bar: function () {
            target1barWasCalled.push(slice.call(arguments));
        }
    };
    queue.pushUnique(target1, target1.foo, ['a']);
    queue.pushUnique(target1, target1.bar, ['b']);
    assert.deepEqual(target1fooWasCalled, []);
    assert.deepEqual(target1barWasCalled, []);
    queue.flush();
    assert.deepEqual(target1fooWasCalled.length, 1, 'expected: target 1.foo to be called only once');
    assert.deepEqual(target1fooWasCalled[0], ['a']);
    assert.deepEqual(target1barWasCalled.length, 1, 'expected: target 1.bar to be called only once');
    assert.deepEqual(target1barWasCalled[0], ['b']);
});
QUnit.test('pushUnique: 1 target, 1 diffe`rent methods called twice (GUID_KEY)', function (assert) {
    var queue = new Queue('foo', {}, { GUID_KEY: 'GUID_KEY' });
    var target1fooWasCalled = [];
    var target1 = {
        GUID_KEY: 'target1',
        foo: function () {
            target1fooWasCalled.push(slice.call(arguments));
        }
    };
    queue.pushUnique(target1, target1.foo, ['a']);
    queue.pushUnique(target1, target1.foo, ['b']);
    assert.deepEqual(target1fooWasCalled, []);
    queue.flush();
    assert.deepEqual(target1fooWasCalled.length, 1, 'expected: target 1.foo to be called only once');
    assert.deepEqual(target1fooWasCalled[0], ['b']);
});
QUnit.test('pushUnique: 1 target, 2 different methods, second one called twice (GUID_KEY)', function (assert) {
    var queue = new Queue('foo', {}, { GUID_KEY: 'GUID_KEY' });
    var target1barWasCalled = [];
    var target1 = {
        GUID_KEY: 'target1',
        foo: function () {
        },
        bar: function () {
            target1barWasCalled.push(slice.call(arguments));
        }
    };
    queue.pushUnique(target1, target1.foo);
    queue.pushUnique(target1, target1.bar, ['a']);
    queue.pushUnique(target1, target1.bar, ['b']);
    assert.deepEqual(target1barWasCalled, []);
    queue.flush();
    assert.deepEqual(target1barWasCalled.length, 1, 'expected: target 1.bar to be called only once');
});
QUnit.test('pushUnique: 2 different targets (peekGuid)', function (assert) {
    var guidIndexer = [];
    var queue = new Queue('foo', {}, {
        peekGuid: function peekGuid(obj) {
            var guid = guidIndexer.indexOf(obj);
            if (guid === -1) {
                return null;
            }
            return guid;
        }
    });
    var target1fooWasCalled = [];
    var target2fooWasCalled = [];
    var target1 = {
        foo: function () {
            target1fooWasCalled.push(slice.call(arguments));
        }
    };
    guidIndexer.push(target1);
    var target2 = {
        foo: function () {
            target2fooWasCalled.push(slice.call(arguments));
        }
    };
    guidIndexer.push(target2);
    queue.pushUnique(target1, target1.foo, ['a']);
    queue.pushUnique(target2, target2.foo, ['b']);
    assert.deepEqual(target1fooWasCalled, []);
    assert.deepEqual(target2fooWasCalled, []);
    queue.flush();
    assert.deepEqual(target1fooWasCalled.length, 1, 'expected: target 1.foo to be called only once');
    assert.deepEqual(target1fooWasCalled[0], ['a']);
    assert.deepEqual(target2fooWasCalled.length, 1, 'expected: target 2.foo to be called only once');
    assert.deepEqual(target2fooWasCalled[0], ['b']);
});
QUnit.test('pushUnique: 1 target, 2 different methods (peekGuid)', function (assert) {
    var guidIndexer = [];
    var queue = new Queue('foo', {}, {
        peekGuid: function peekGuid(obj) {
            var guid = guidIndexer.indexOf(obj);
            if (guid === -1) {
                return null;
            }
            return guid;
        }
    });
    var target1fooWasCalled = [];
    var target1barWasCalled = [];
    var target1 = {
        foo: function () {
            target1fooWasCalled.push(slice.call(arguments));
        },
        bar: function () {
            target1barWasCalled.push(slice.call(arguments));
        }
    };
    guidIndexer.push(target1);
    queue.pushUnique(target1, target1.foo, ['a']);
    queue.pushUnique(target1, target1.bar, ['b']);
    assert.deepEqual(target1fooWasCalled, []);
    assert.deepEqual(target1barWasCalled, []);
    queue.flush();
    assert.deepEqual(target1fooWasCalled.length, 1, 'expected: target 1.foo to be called only once');
    assert.deepEqual(target1fooWasCalled[0], ['a']);
    assert.deepEqual(target1barWasCalled.length, 1, 'expected: target 1.bar to be called only once');
    assert.deepEqual(target1barWasCalled[0], ['b']);
});
QUnit.test('pushUnique: 1 target, 1 different methods called twice (peekGuid)', function (assert) {
    var guidIndexer = [];
    var queue = new Queue('foo', {}, {
        peekGuid: function peekGuid(obj) {
            var guid = guidIndexer.indexOf(obj);
            if (guid === -1) {
                return null;
            }
            return guid;
        }
    });
    var target1fooWasCalled = [];
    var target1 = {
        foo: function () {
            target1fooWasCalled.push(slice.call(arguments));
        }
    };
    guidIndexer.push(target1);
    queue.pushUnique(target1, target1.foo, ['a']);
    queue.pushUnique(target1, target1.foo, ['b']);
    assert.deepEqual(target1fooWasCalled, []);
    queue.flush();
    assert.deepEqual(target1fooWasCalled.length, 1, 'expected: target 1.foo to be called only once');
    assert.deepEqual(target1fooWasCalled[0], ['b']);
});
QUnit.test('pushUnique: 1 target, 2 different methods, second one called twice (peekGuid)', function (assert) {
    var guidIndexer = [];
    var queue = new Queue('foo', {}, {
        peekGuid: function peekGuid(obj) {
            var guid = guidIndexer.indexOf(obj);
            if (guid === -1) {
                return null;
            }
            return guid;
        }
    });
    var target1barWasCalled = [];
    var target1 = {
        foo: function () {
        },
        bar: function () {
            target1barWasCalled.push(slice.call(arguments));
        }
    };
    guidIndexer.push(target1);
    queue.pushUnique(target1, target1.foo);
    queue.pushUnique(target1, target1.bar, ['a']);
    queue.pushUnique(target1, target1.bar, ['b']);
    assert.deepEqual(target1barWasCalled, []);
    queue.flush();
    assert.deepEqual(target1barWasCalled.length, 1, 'expected: target 1.bar to be called only once');
});

QUnit.module('tests/queue');
QUnit.test('actions scheduled on previous queue, start over from beginning', function (assert) {
    assert.expect(5);
    var bb = new Backburner(['one', 'two']);
    var step = 0;
    bb.run(function () {
        assert.equal(step++, 0, '0');
        bb.schedule('two', null, function () {
            assert.equal(step++, 1, '1');
            bb.schedule('one', null, function () {
                assert.equal(step++, 3, '3');
            });
        });
        bb.schedule('two', null, function () {
            assert.equal(step++, 2, '2');
        });
    });
    assert.equal(step, 4, '4');
});
QUnit.test('Queue#flush should be recursive if new items are added', function (assert) {
    assert.expect(2);
    var bb = new Backburner(['one']);
    var count = 0;
    bb.run(function () {
        function increment() {
            if (++count < 3) {
                bb.schedule('one', increment);
            }
            if (count === 3) {
                bb.schedule('one', increment);
            }
        }
        increment();
        assert.equal(count, 1, 'should not have run yet');
        var currentInstance = bb.currentInstance;
        if (currentInstance) {
            currentInstance.queues.one.flush();
        }
        assert.equal(count, 4, 'should have run all scheduled methods, even ones added during flush');
    });
});
QUnit.test('Default queue is automatically set to first queue if none is provided', function (assert) {
    var bb = new Backburner(['one', 'two']);
    assert.equal(bb.options.defaultQueue, 'one');
});
QUnit.test('Default queue can be manually configured', function (assert) {
    var bb = new Backburner(['one', 'two'], {
        defaultQueue: 'two'
    });
    assert.equal(bb.options.defaultQueue, 'two');
});
QUnit.test('onBegin and onEnd are called and passed the correct parameters', function (assert) {
    assert.expect(2);
    var befores = [];
    var afters = [];
    var expectedBefores = [];
    var expectedAfters = [];
    var outer;
    var inner;
    var bb = new Backburner(['one'], {
        onBegin: function (current, previous) {
            befores.push(current);
            befores.push(previous);
        },
        onEnd: function (current, next) {
            afters.push(current);
            afters.push(next);
        }
    });
    bb.run(function () {
        outer = bb.currentInstance;
        bb.run(function () {
            inner = bb.currentInstance;
        });
    });
    expectedBefores = [outer, null, inner, outer];
    expectedAfters = [inner, outer, outer, null];
    assert.deepEqual(befores, expectedBefores, 'before callbacks successful');
    assert.deepEqual(afters, expectedAfters, 'after callback successful');
});

QUnit.module('tests/run');
QUnit.test('when passed a function', function (assert) {
    assert.expect(1);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    bb.run(function () { return functionWasCalled = true; });
    assert.ok(functionWasCalled, 'function was called');
});
QUnit.test('when passed a target and method', function (assert) {
    assert.expect(2);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    bb.run({ zomg: 'hi' }, function () {
        assert.equal(this.zomg, 'hi', 'the target was properly set');
        functionWasCalled = true;
    });
    assert.ok(functionWasCalled, 'function was called');
});
QUnit.test('when passed a target, method, and arguments', function (assert) {
    assert.expect(5);
    var bb = new Backburner(['one']);
    var functionWasCalled = false;
    bb.run({ zomg: 'hi' }, function (a, b, c) {
        assert.equal(this.zomg, 'hi', 'the target was properly set');
        assert.equal(a, 1, 'the first arguments was passed in');
        assert.equal(b, 2, 'the second arguments was passed in');
        assert.equal(c, 3, 'the third arguments was passed in');
        functionWasCalled = true;
    }, 1, 2, 3);
    assert.ok(functionWasCalled, 'function was called');
});
QUnit.test('nesting run loops preserves the stack', function (assert) {
    assert.expect(10);
    var bb = new Backburner(['one']);
    var outerBeforeFunctionWasCalled = false;
    var middleBeforeFunctionWasCalled = false;
    var innerFunctionWasCalled = false;
    var middleAfterFunctionWasCalled = false;
    var outerAfterFunctionWasCalled = false;
    bb.run(function () {
        bb.schedule('one', function () {
            outerBeforeFunctionWasCalled = true;
        });
        bb.run(function () {
            bb.schedule('one', function () {
                middleBeforeFunctionWasCalled = true;
            });
            bb.run(function () {
                bb.schedule('one', function () {
                    innerFunctionWasCalled = true;
                });
                assert.ok(!innerFunctionWasCalled, 'function is deferred');
            });
            assert.ok(innerFunctionWasCalled, 'function is called');
            bb.schedule('one', function () {
                middleAfterFunctionWasCalled = true;
            });
            assert.ok(!middleBeforeFunctionWasCalled, 'function is deferred');
            assert.ok(!middleAfterFunctionWasCalled, 'function is deferred');
        });
        assert.ok(middleBeforeFunctionWasCalled, 'function is called');
        assert.ok(middleAfterFunctionWasCalled, 'function is called');
        bb.schedule('one', function () {
            outerAfterFunctionWasCalled = true;
        });
        assert.ok(!outerBeforeFunctionWasCalled, 'function is deferred');
        assert.ok(!outerAfterFunctionWasCalled, 'function is deferred');
    });
    assert.ok(outerBeforeFunctionWasCalled, 'function is called');
    assert.ok(outerAfterFunctionWasCalled, 'function is called');
});
QUnit.test('runs can be nested', function (assert) {
    assert.expect(2);
    var bb = new Backburner(['one']);
    var step = 0;
    bb.run(function () {
        assert.equal(step++, 0);
        bb.run(function () {
            assert.equal(step++, 1);
        });
    });
});
QUnit.test('run returns value', function (assert) {
    var bb = new Backburner(['one']);
    var value = bb.run(function () {
        return 'hi';
    });
    assert.equal(value, 'hi');
});
QUnit.test('onError', function (assert) {
    assert.expect(1);
    function onError(error) {
        assert.equal('QUnit.test error', error.message);
    }
    var bb = new Backburner(['errors'], {
        onError: onError
    });
    bb.run(function () {
        throw new Error('QUnit.test error');
    });
});
QUnit.test('onError set after start', function (assert) {
    assert.expect(2);
    var bb = new Backburner(['errors']);
    bb.run(function () { return assert.ok(true); });
    bb.options.onError = function (error) {
        assert.equal('QUnit.test error', error.message);
    };
    bb.run(function () { throw new Error('QUnit.test error'); });
});
QUnit.test('onError with target and action', function (assert) {
    assert.expect(2);
    var target = {};
    var bb = new Backburner(['errors'], {
        onErrorTarget: target,
        onErrorMethod: 'onerror'
    });
    bb.run(function () { return assert.ok(true); });
    target['onerror'] = function (error) {
        assert.equal('QUnit.test error', error.message);
    };
    bb.run(function () { throw new Error('QUnit.test error'); });
});

var originalDateNow = Date.now;
var originalDateValueOf$1 = Date.prototype.valueOf;
QUnit.module('tests/set-timeout-test', {
    afterEach: function afterEach() {
        Date.now = originalDateNow;
        Date.prototype.valueOf = originalDateValueOf$1;
    }
});
QUnit.test('later', function (assert) {
    assert.expect(6);
    var bb = new Backburner(['one']);
    var step = 0;
    var instance;
    var done = assert.async();
    // Force +new Date to return the same result while scheduling
    // run.later timers. Otherwise: non-determinism!
    var now = +new Date();
    Date.prototype.valueOf = function () { return now; };
    bb.later(null, function () {
        instance = bb.currentInstance;
        assert.equal(step++, 0);
    }, 10);
    bb.later(null, function () {
        assert.equal(step++, 1);
        assert.equal(instance, bb.currentInstance, 'same instance');
    }, 10);
    Date.prototype.valueOf = originalDateValueOf$1;
    // spin so that when we execute timers (+new Date()) will be greater than the
    // time scheduled above; not a problem in real life as we will never 'wait'
    // 0ms
    while ((+new Date()) <= now + 10) { }
    
    bb.later(null, function () {
        assert.equal(step++, 2);
        bb.later(null, function () {
            assert.equal(step++, 3);
            assert.ok(true, 'Another later will execute correctly');
            done();
        }, 1);
    }, 20);
});
QUnit.test('later can continue when `Date.now` is monkey-patched', function (assert) {
    assert.expect(1);
    var arbitraryTime = +new Date();
    var bb = new Backburner(['one']);
    var done = assert.async();
    Date.now = function () { return arbitraryTime; };
    bb.later(function () {
        assert.ok(true);
        done();
    }, 1);
});
var bb;
QUnit.module('later arguments / arity', {
    beforeEach: function beforeEach() {
        bb = new Backburner(['one']);
    },
    afterEach: function afterEach() {
        bb = undefined;
    }
});
QUnit.test('[callback]', function (assert) {
    assert.expect(2);
    var done = assert.async();
    bb.later(function () {
        assert.equal(arguments.length, 0);
        assert.ok(true, 'was called');
        done();
    });
});
QUnit.test('[callback, undefined]', function (assert) {
    assert.expect(2);
    var done = assert.async();
    bb.later(function () {
        assert.equal(arguments.length, 1);
        assert.ok(true, 'was called');
        done();
    }, undefined);
});
QUnit.test('[null, callback, undefined]', function (assert) {
    assert.expect(2);
    var done = assert.async();
    bb.later(null, function () {
        assert.equal(arguments.length, 0);
        assert.ok(true, 'was called');
        done();
    });
});
QUnit.test('[null, callback, undefined]', function (assert) {
    assert.expect(2);
    var done = assert.async();
    bb.later(null, function () {
        assert.equal(arguments.length, 1);
        assert.ok(true, 'was called');
        done();
    }, undefined);
});
QUnit.test('[null, callback, null]', function (assert) {
    assert.expect(3);
    var done = assert.async();
    bb.later(null, function () {
        assert.equal(arguments.length, 1);
        assert.equal(arguments[0], null);
        assert.ok(true, 'was called');
        done();
    }, null);
});
QUnit.test('[callback, string, string, string]', function (assert) {
    assert.expect(5);
    var done = assert.async();
    bb.later(function () {
        assert.equal(arguments.length, 3);
        assert.equal(arguments[0], 'a');
        assert.equal(arguments[1], 'b');
        assert.equal(arguments[2], 'c');
        assert.ok(true, 'was called');
        done();
    }, 'a', 'b', 'c');
});
QUnit.test('[null, callback, string, string, string]', function (assert) {
    assert.expect(5);
    var done = assert.async();
    bb.later(null, function () {
        assert.equal(arguments.length, 3);
        assert.equal(arguments[0], 'a');
        assert.equal(arguments[1], 'b');
        assert.equal(arguments[2], 'c');
        assert.ok(true, 'was called');
        done();
    }, 'a', 'b', 'c');
});
QUnit.test('[null, callback, string, string, string, number]', function (assert) {
    assert.expect(5);
    var done = assert.async();
    bb.later(null, function () {
        assert.equal(arguments.length, 3);
        assert.equal(arguments[0], 'a');
        assert.equal(arguments[1], 'b');
        assert.equal(arguments[2], 'c');
        assert.ok(true, 'was called');
        done();
    }, 'a', 'b', 'c', 10);
});
QUnit.test('[null, callback, string, string, string, numericString]', function (assert) {
    assert.expect(5);
    var done = assert.async();
    bb.later(null, function () {
        assert.equal(arguments.length, 3);
        assert.equal(arguments[0], 'a');
        assert.equal(arguments[1], 'b');
        assert.equal(arguments[2], 'c');
        assert.ok(true, 'was called');
        done();
    }, 'a', 'b', 'c', '1');
});
QUnit.test('[obj, string]', function (assert) {
    assert.expect(1);
    var done = assert.async();
    bb.later({
        bro: function bro() {
            assert.ok(true, 'was called');
            done();
        }
    }, 'bro');
});
QUnit.test('[obj, string, value]', function (assert) {
    assert.expect(3);
    var done = assert.async();
    bb.later({
        bro: function bro() {
            assert.equal(arguments.length, 1);
            assert.equal(arguments[0], 'value');
            assert.ok(true, 'was called');
            done();
        }
    }, 'bro', 'value');
});
QUnit.test('[obj, string, value, number]', function (assert) {
    var done = assert.async();
    bb.later({
        bro: function bro() {
            assert.equal(arguments.length, 1);
            assert.equal(arguments[0], 'value');
            assert.ok(true, 'was called');
            done();
        }
    }, 'bro', 'value', 1);
});
QUnit.test('[obj, string, value, numericString]', function (assert) {
    var done = assert.async();
    bb.later({
        bro: function bro() {
            assert.equal(arguments.length, 1);
            assert.equal(arguments[0], 'value');
            assert.ok(true, 'was called');
            done();
        }
    }, 'bro', 'value', '1');
});
QUnit.test('onError', function (assert) {
    assert.expect(1);
    var done = assert.async();
    function onError(error) {
        assert.equal('test error', error.message);
        done();
    }
    bb = new Backburner(['errors'], { onError: onError });
    bb.later(function () { throw new Error('test error'); }, 1);
});
QUnit.test('later doesn\'t trigger twice with earlier later', function (assert) {
    assert.expect(3);
    bb = new Backburner(['one']);
    var called1 = 0;
    var called2 = 0;
    var calls = 0;
    var oldRun = bb.run;
    var done = assert.async();
    // Count run() calls and relay them to original function
    bb.run = function () {
        calls++;
        oldRun.apply(bb, arguments);
    };
    bb.later(function () { return called1++; }, 50);
    bb.later(function () { return called2++; }, 10);
    setTimeout(function () {
        assert.equal(called1, 1, 'timeout 1 was called once');
        assert.equal(called2, 1, 'timeout 2 was called once');
        assert.equal(calls, 2, 'run() was called twice');
        done();
    }, 100);
});
QUnit.test('later with two Backburner instances', function (assert) {
    assert.expect(8);
    var steps = 0;
    var done = assert.async();
    var bb1 = new Backburner(['one'], {
        onBegin: function onBegin() {
            assert.equal(++steps, 4);
        }
    });
    var bb2 = new Backburner(['one'], {
        onBegin: function onBegin() {
            assert.equal(++steps, 6);
        }
    });
    assert.equal(++steps, 1);
    bb1.later(function () { return assert.equal(++steps, 5); }, 10);
    assert.equal(++steps, 2);
    bb2.later(function () { return assert.equal(++steps, 7); }, 10);
    assert.equal(++steps, 3);
    setTimeout(function () {
        assert.equal(++steps, 8);
        done();
    }, 50);
});
QUnit.test('expired timeout doesn\'t hang when setting a new timeout', function (assert) {
    assert.expect(3);
    var called1At = 0;
    var called2At = 0;
    var done = assert.async();
    bb.later(function () { return called1At = Date.now(); }, 1);
    // Block JS to simulate https://github.com/ebryn/backburner.js/issues/135
    var waitUntil = Date.now() + 5;
    while (Date.now() < waitUntil) { }
    bb.later(function () { return called2At = Date.now(); }, 50);
    setTimeout(function () {
        assert.ok(called1At !== 0, 'timeout 1 was called');
        assert.ok(called2At !== 0, 'timeout 2 was called');
        assert.ok(called2At - called1At > 10, 'timeout 1 did not wait for timeout 2');
        done();
    }, 60);
});
QUnit.test('NaN timeout doesn\'t hang other timeouts', function (assert) {
    assert.expect(2);
    var done = assert.async();
    var called1At = 0;
    var called2At = 0;
    bb.later(function () { return called1At = Date.now(); }, 1);
    bb.later(function () { }, NaN);
    bb.later(function () { return called2At = Date.now(); }, 10);
    setTimeout(function () {
        assert.ok(called1At !== 0, 'timeout 1 was called');
        assert.ok(called2At !== 0, 'timeout 2 was called');
        done();
    }, 20);
});

QUnit.module('tests/throttle');
QUnit.test('throttle', function (assert) {
    assert.expect(18);
    var bb = new Backburner(['zomg']);
    var step = 0;
    var done = assert.async();
    var wasCalled = false;
    function throttler() {
        assert.ok(!wasCalled);
        wasCalled = true;
    }
    // let's throttle the function `throttler` for 40ms
    // it will be executed in 40ms
    bb.throttle(null, throttler, 40, false);
    assert.equal(step++, 0);
    // let's schedule `throttler` to run in 10ms
    setTimeout(function () {
        assert.equal(step++, 1);
        assert.ok(!wasCalled);
        bb.throttle(null, throttler, false);
    }, 10);
    // let's schedule `throttler` to run again in 20ms
    setTimeout(function () {
        assert.equal(step++, 2);
        assert.ok(!wasCalled);
        bb.throttle(null, throttler, false);
    }, 20);
    // let's schedule `throttler` to run yet again in 30ms
    setTimeout(function () {
        assert.equal(step++, 3);
        assert.ok(!wasCalled);
        bb.throttle(null, throttler, false);
    }, 30);
    // at 40ms, `throttler` will get called once
    // now, let's schedule an assertion to occur at 50ms,
    // 10ms after `throttler` has been called
    setTimeout(function () {
        assert.equal(step++, 4);
        assert.ok(wasCalled);
    }, 50);
    // great, we've made it this far, there's one more thing
    // we need to test. we want to make sure we can call `throttle`
    // again with the same target/method after it has executed
    // at the 60ms mark, let's schedule another call to `throttle`
    setTimeout(function () {
        wasCalled = false; // reset the flag
        // assert call order
        assert.equal(step++, 5);
        // call throttle for the second time
        bb.throttle(null, throttler, 100, false);
        // assert that it is called in the future and not blackholed
        setTimeout(function () {
            assert.equal(step++, 6);
            assert.ok(wasCalled, 'Another throttle call with the same function can be executed later');
        }, 110);
    }, 60);
    setTimeout(function () {
        wasCalled = false; // reset the flag
        // assert call order
        assert.equal(step++, 7);
        // call throttle again that time using a string number like time interval
        bb.throttle(null, throttler, '100', false);
        // assert that it is called in the future and not blackholed
        setTimeout(function () {
            assert.equal(step++, 8);
            assert.ok(wasCalled, 'Throttle accept a string number like time interval');
            done();
        }, 110);
    }, 180);
});
QUnit.test('throttle with cancelTimers', function (assert) {
    assert.expect(1);
    var count = 0;
    var bb = new Backburner(['zomg']);
    // Throttle a no-op 10ms
    bb.throttle(null, function () { }, 10, false);
    try {
        bb.cancelTimers();
    }
    catch (e) {
        count++;
    }
    assert.equal(count, 0, 'calling cancelTimers while something is being throttled does not throw an error');
});
QUnit.test('throttle leading edge', function (assert) {
    assert.expect(10);
    var bb = new Backburner(['zerg']);
    var throttle;
    var throttle2;
    var wasCalled = false;
    var done = assert.async();
    function throttler() {
        assert.ok(!wasCalled, 'throttler hasn\'t been called yet');
        wasCalled = true;
    }
    // let's throttle the function `throttler` for 40ms
    // it will be executed immediately, but throttled for the future hits
    throttle = bb.throttle(null, throttler, 40);
    assert.ok(wasCalled, 'function was executed immediately');
    wasCalled = false;
    // let's schedule `throttler` to run again, it shouldn't be allowed to queue for another 40 msec
    throttle2 = bb.throttle(null, throttler, 40);
    assert.equal(throttle, throttle2, 'No new throttle was inserted, returns old throttle');
    setTimeout(function () {
        assert.ok(!wasCalled, 'attempt to call throttle again didn\'t happen');
        throttle = bb.throttle(null, throttler, 40);
        assert.ok(wasCalled, 'newly inserted throttle after timeout functioned');
        assert.ok(bb.cancel(throttle), 'wait time of throttle was cancelled');
        wasCalled = false;
        throttle2 = bb.throttle(null, throttler, 40);
        assert.notEqual(throttle, throttle2, 'the throttle is different');
        assert.ok(wasCalled, 'throttle was inserted and run immediately after cancel');
        done();
    }, 60);
});
QUnit.test('throttle returns timer information usable for cancelling', function (assert) {
    assert.expect(3);
    var done = assert.async();
    var bb = new Backburner(['batman']);
    var wasCalled = false;
    function throttler() {
        assert.ok(false, 'this method shouldn\'t be called');
        wasCalled = true;
    }
    var timer = bb.throttle(null, throttler, 1, false);
    assert.ok(bb.cancel(timer), 'the timer is cancelled');
    // should return false second time around
    assert.ok(!bb.cancel(timer), 'the timer no longer exists in the list');
    setTimeout(function () {
        assert.ok(!wasCalled, 'the timer wasn\'t called after waiting');
        done();
    }, 60);
});
QUnit.test('throttler cancel after it\'s executed returns false', function (assert) {
    assert.expect(3);
    var bb = new Backburner(['darkknight']);
    var done = assert.async();
    var wasCalled = false;
    function throttler() {
        assert.ok(true, 'the throttled method was called');
        wasCalled = true;
    }
    var timer = bb.throttle(null, throttler, 1);
    setTimeout(function () {
        assert.ok(!bb.cancel(timer), 'no timer existed to cancel');
        assert.ok(wasCalled, 'the timer was actually called');
        done();
    }, 10);
});
QUnit.test('throttler returns the appropriate timer to cancel if the old item still exists', function (assert) {
    assert.expect(5);
    var bb = new Backburner(['robin']);
    var wasCalled = false;
    var done = assert.async();
    function throttler() {
        assert.ok(true, 'the throttled method was called');
        wasCalled = true;
    }
    var timer = bb.throttle(null, throttler, 1);
    var timer2 = bb.throttle(null, throttler, 1);
    assert.deepEqual(timer, timer2, 'the same timer was returned');
    setTimeout(function () {
        bb.throttle(null, throttler, 1);
        assert.ok(!bb.cancel(timer), 'the second timer isn\'t removed, despite appearing to be the same item');
        assert.ok(wasCalled, 'the timer was actually called');
        done();
    }, 10);
});
QUnit.test('onError', function (assert) {
    assert.expect(1);
    function onError(error) {
        assert.equal('test error', error.message);
    }
    var bb = new Backburner(['errors'], {
        onError: onError
    });
    bb.throttle(null, function () {
        throw new Error('test error');
    }, 20);
});
QUnit.test('throttle + immediate joins existing run loop instances', function (assert) {
    assert.expect(1);
    function onError(error) {
        assert.equal('test error', error.message);
    }
    var bb = new Backburner(['errors'], {
        onError: onError
    });
    bb.run(function () {
        var parentInstance = bb.currentInstance;
        bb.throttle(null, function () {
            assert.equal(bb.currentInstance, parentInstance);
        }, 20, true);
    });
});

});

//# sourceMappingURL=tests.js.map
