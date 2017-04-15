const NUMBER = /\d+/;
const now = Date.now;
function each(collection, callback) {
    for (let i = 0; i < collection.length; i++) {
        callback(collection[i]);
    }
}
function isString(suspect) {
    return typeof suspect === 'string';
}
function isFunction(suspect) {
    return typeof suspect === 'function';
}
function isNumber(suspect) {
    return typeof suspect === 'number';
}
function isCoercableNumber(suspect) {
    return isNumber(suspect) || NUMBER.test(suspect);
}
function noSuchQueue(name) {
    throw new Error(`You attempted to schedule an action in a queue (${name}) that doesn\'t exist`);
}
function noSuchMethod(name) {
    throw new Error(`You attempted to schedule an action in a queue (${name}) for a method that doesn\'t exist`);
}
function getOnError(options) {
    return options.onError || (options.onErrorTarget && options.onErrorTarget[options.onErrorMethod]);
}
function findDebouncee(target, method, debouncees) {
    return findItem(target, method, debouncees);
}
function findThrottler(target, method, throttlers) {
    return findItem(target, method, throttlers);
}
function findItem(target, method, collection) {
    let item;
    let index = -1;
    for (let i = 0, l = collection.length; i < l; i++) {
        item = collection[i];
        if (item[0] === target && item[1] === method) {
            index = i;
            break;
        }
    }
    return index;
}

function binarySearch(time, timers) {
    let start = 0;
    let end = timers.length - 2;
    let middle;
    let l;
    while (start < end) {
        // since timers is an array of pairs 'l' will always
        // be an integer
        l = (end - start) / 2;
        // compensate for the index in case even number
        // of pairs inside timers
        middle = start + l - (l % 2);
        if (time >= timers[middle]) {
            start = middle + 2;
        }
        else {
            end = middle;
        }
    }
    return (time >= timers[start]) ? start + 2 : start;
}

class Queue {
    constructor(name, options, globalOptions) {
        this._queue = []; // TODO: should be private
        this._queueBeingFlushed = [];
        this.targetQueues = {};
        this.index = 0;
        this.name = name;
        this.globalOptions = globalOptions || {};
        this.options = options;
    }
    push(target, method, args, stack) {
        let queue = this._queue;
        queue.push(target, method, args, stack);
        return {
            queue: this,
            target,
            method
        };
    }
    pushUnique(target, method, args, stack) {
        let guid = this.guidForTarget(target);
        if (guid) {
            return this.pushUniqueWithGuid(guid, target, method, args, stack);
        }
        this.pushUniqueWithoutGuid(target, method, args, stack);
        return {
            queue: this,
            target,
            method
        };
    }
    flush(sync) {
        let globalOptions = this.globalOptions;
        let options = this.options;
        let before = options && options.before;
        let after = options && options.after;
        let onError = globalOptions.onError || (globalOptions.onErrorTarget &&
            globalOptions.onErrorTarget[globalOptions.onErrorMethod]);
        let target;
        let method;
        let args;
        let errorRecordedForStack;
        let invoke = onError ? this.invokeWithOnError : this.invoke;
        this.targetQueues = Object.create(null);
        let queue = this._queue;
        let queueItems;
        if (this._queueBeingFlushed && this._queueBeingFlushed.length > 0) {
            queueItems = this._queueBeingFlushed;
        }
        else {
            queueItems = this._queueBeingFlushed = this._queue;
            this._queue = [];
        }
        if (before) {
            before();
        }
        for (let i = this.index; i < queueItems.length; i += 4) {
            this.index += 4;
            target = queueItems[i];
            method = queueItems[i + 1];
            args = queueItems[i + 2];
            errorRecordedForStack = queueItems[i + 3]; // Debugging assistance
            if (isString(method)) {
                method = target[method];
            }
            // method could have been nullified / canceled during flush
            if (method) {
                //
                //    ** Attention intrepid developer **
                //
                //    To find out the stack of this task when it was scheduled onto
                //    the run loop, add the following to your app.js:
                //
                //    Ember.run.backburner.DEBUG = true; // NOTE: This slows your app, don't leave it on in production.
                //
                //    Once that is in place, when you are at a breakpoint and navigate
                //    here in the stack explorer, you can look at `errorRecordedForStack.stack`,
                //    which will be the captured stack when this job was scheduled.
                //
                //    One possible long-term solution is the following Chrome issue:
                //       https://bugs.chromium.org/p/chromium/issues/detail?id=332624
                //
                invoke(target, method, args, onError, errorRecordedForStack);
            }
            if (this.index !== this._queueBeingFlushed.length &&
                this.globalOptions.mustYield && this.globalOptions.mustYield()) {
                return 1 /* Pause */;
            }
        }
        if (after) {
            after();
        }
        this._queueBeingFlushed.length = 0;
        this.index = 0;
        if (sync !== false &&
            this._queue.length > 0) {
            // check if new items have been added
            this.flush(true);
        }
    }
    hasWork() {
        return this._queueBeingFlushed.length > 0 || this._queue.length > 0;
    }
    cancel(actionToCancel) {
        let queue = this._queue;
        let currentTarget;
        let currentMethod;
        let i;
        let l;
        let { target, method } = actionToCancel;
        if (this.targetQueues && target) {
            let guid = this.guidForTarget(target);
            let targetQueue = this.targetQueues[guid];
            if (targetQueue) {
                for (i = 0, l = targetQueue.length; i < l; i++) {
                    if (targetQueue[i] === method) {
                        targetQueue.splice(i, 1);
                    }
                }
            }
        }
        for (i = 0, l = queue.length; i < l; i += 4) {
            currentTarget = queue[i];
            currentMethod = queue[i + 1];
            if (currentTarget === target &&
                currentMethod === method) {
                queue.splice(i, 4);
                return true;
            }
        }
        // if not found in current queue
        // could be in the queue that is being flushed
        queue = this._queueBeingFlushed;
        if (!queue) {
            return;
        }
        for (i = 0, l = queue.length; i < l; i += 4) {
            currentTarget = queue[i];
            currentMethod = queue[i + 1];
            if (currentTarget === target &&
                currentMethod === method) {
                // don't mess with array during flush
                // just nullify the method
                queue[i + 1] = null;
                return true;
            }
        }
    }
    guidForTarget(target) {
        if (!target) {
            return;
        }
        let peekGuid = this.globalOptions.peekGuid;
        if (peekGuid) {
            return peekGuid(target);
        }
        let KEY = this.globalOptions.GUID_KEY;
        if (KEY) {
            return target[KEY];
        }
    }
    pushUniqueWithoutGuid(target, method, args, stack) {
        let queue = this._queue;
        for (let i = 0, l = queue.length; i < l; i += 4) {
            let currentTarget = queue[i];
            let currentMethod = queue[i + 1];
            if (currentTarget === target && currentMethod === method) {
                queue[i + 2] = args; // replace args
                queue[i + 3] = stack; // replace stack
                return;
            }
        }
        queue.push(target, method, args, stack);
    }
    targetQueue(targetQueue, target, method, args, stack) {
        let queue = this._queue;
        for (let i = 0, l = targetQueue.length; i < l; i += 2) {
            let currentMethod = targetQueue[i];
            let currentIndex = targetQueue[i + 1];
            if (currentMethod === method) {
                queue[currentIndex + 2] = args; // replace args
                queue[currentIndex + 3] = stack; // replace stack
                return;
            }
        }
        targetQueue.push(method, queue.push(target, method, args, stack) - 4);
    }
    pushUniqueWithGuid(guid, target, method, args, stack) {
        let hasLocalQueue = this.targetQueues[guid];
        if (hasLocalQueue) {
            this.targetQueue(hasLocalQueue, target, method, args, stack);
        }
        else {
            this.targetQueues[guid] = [
                method,
                this._queue.push(target, method, args, stack) - 4
            ];
        }
        return {
            queue: this,
            target: target,
            method: method
        };
    }
    invoke(target, method, args /*, onError, errorRecordedForStack */) {
        if (args && args.length > 0) {
            method.apply(target, args);
        }
        else {
            method.call(target);
        }
    }
    invokeWithOnError(target, method, args, onError, errorRecordedForStack) {
        try {
            if (args && args.length > 0) {
                method.apply(target, args);
            }
            else {
                method.call(target);
            }
        }
        catch (error) {
            onError(error, errorRecordedForStack);
        }
    }
}

class DeferredActionQueues {
    constructor(queueNames, options) {
        this.queueNameIndex = 0;
        let queues = this.queues = {};
        this.queueNames = queueNames = queueNames || [];
        this.options = options;
        each(queueNames, function (queueName) {
            queues[queueName] = new Queue(queueName, options[queueName], options);
        });
    }
    /*
      @method schedule
      @param {String} queueName
      @param {Any} target
      @param {Any} method
      @param {Any} args
      @param {Boolean} onceFlag
      @param {Any} stack
      @return queue
    */
    schedule(queueName, target, method, args, onceFlag, stack) {
        let queues = this.queues;
        let queue = queues[queueName];
        if (!queue) {
            noSuchQueue(queueName);
        }
        if (!method) {
            noSuchMethod(queueName);
        }
        if (onceFlag) {
            return queue.pushUnique(target, method, args, stack);
        }
        else {
            return queue.push(target, method, args, stack);
        }
    }
    /*
      @method flush
      DeferredActionQueues.flush() calls Queue.flush()
    */
    flush() {
        let queue;
        let queueName;
        let numberOfQueues = this.queueNames.length;
        while (this.queueNameIndex < numberOfQueues) {
            queueName = this.queueNames[this.queueNameIndex];
            queue = this.queues[queueName];
            if (queue.hasWork() === false) {
                this.queueNameIndex++;
            }
            else {
                if (queue.flush(false /* async */) === 1 /* Pause */) {
                    return 1 /* Pause */;
                }
                this.queueNameIndex = 0; // only reset to first queue if non-pause break
            }
        }
    }
}

// accepts a function that when invoked will return an iterator
// iterator will drain until completion
// accepts a function that when invoked will return an iterator
var iteratorDrain = function (fn) {
    let iterator = fn();
    let result = iterator.next();
    while (result.done === false) {
        result.value();
        result = iterator.next();
    }
};

class Backburner {
    constructor(queueNames, options) {
        this.DEBUG = false;
        this._autorun = null;
        this.queueNames = queueNames;
        this.options = options || {};
        if (!this.options.defaultQueue) {
            this.options.defaultQueue = queueNames[0];
        }
        this.currentInstance = null;
        this.instanceStack = [];
        this._debouncees = [];
        this._throttlers = [];
        this._eventCallbacks = {
            end: [],
            begin: []
        };
        this._boundClearItems = (item) => {
            this._platform.clearTimeout(item[2]);
        };
        this._timerTimeoutId = undefined;
        this._timers = [];
        this._platform = this.options._platform || {
            setTimeout(fn, ms) {
                return setTimeout(fn, ms);
            },
            clearTimeout(id) {
                clearTimeout(id);
            },
            next(fn) {
                // TODO: asap
                return setTimeout(fn, 0);
            },
            clearNext(fn) {
                clearTimeout(fn);
            }
        };
        this._boundRunExpiredTimers = () => {
            this._runExpiredTimers();
        };
        this._boundAutorunEnd = () => {
            this._autorun = null;
            this.end();
        };
    }
    /*
      @method begin
      @return instantiated class DeferredActionQueues
    */
    begin() {
        let options = this.options;
        let onBegin = options && options.onBegin;
        let previousInstance = this.currentInstance;
        let current;
        if (this._autorun) {
            current = previousInstance;
            this._cancelAutorun();
        }
        else {
            if (previousInstance) {
                this.instanceStack.push(previousInstance);
            }
            current = this.currentInstance = new DeferredActionQueues(this.queueNames, options);
            this._trigger('begin', current, previousInstance);
        }
        if (onBegin) {
            onBegin(current, previousInstance);
        }
        return current;
    }
    end() {
        let options = this.options;
        let onEnd = options && options.onEnd;
        let currentInstance = this.currentInstance;
        let nextInstance = null;
        if (!currentInstance) {
            throw new Error(`end called without begin`);
        }
        // Prevent double-finally bug in Safari 6.0.2 and iOS 6
        // This bug appears to be resolved in Safari 6.0.5 and iOS 7
        let finallyAlreadyCalled = false;
        let result;
        try {
            result = currentInstance.flush();
        }
        finally {
            if (!finallyAlreadyCalled) {
                finallyAlreadyCalled = true;
                if (result === 1 /* Pause */) {
                    const next = this._platform.next;
                    this._autorun = next(this._boundAutorunEnd);
                }
                else {
                    this.currentInstance = null;
                    if (this.instanceStack.length) {
                        nextInstance = this.instanceStack.pop();
                        this.currentInstance = nextInstance;
                    }
                    this._trigger('end', currentInstance, nextInstance);
                    if (onEnd) {
                        onEnd(currentInstance, nextInstance);
                    }
                }
            }
        }
    }
    on(eventName, callback) {
        if (typeof callback !== 'function') {
            throw new TypeError(`Callback must be a function`);
        }
        let callbacks = this._eventCallbacks[eventName];
        if (callbacks) {
            callbacks.push(callback);
        }
        else {
            throw new TypeError(`Cannot on() event ${eventName} because it does not exist`);
        }
    }
    off(eventName, callback) {
        if (eventName) {
            let callbacks = this._eventCallbacks[eventName];
            let callbackFound = false;
            if (!callbacks) {
                return;
            }
            if (callback) {
                for (let i = 0; i < callbacks.length; i++) {
                    if (callbacks[i] === callback) {
                        callbackFound = true;
                        callbacks.splice(i, 1);
                        i--;
                    }
                }
            }
            if (!callbackFound) {
                throw new TypeError(`Cannot off() callback that does not exist`);
            }
        }
        else {
            throw new TypeError(`Cannot off() event ${eventName} because it does not exist`);
        }
    }
    run(target, method, ...args) {
        let length = arguments.length;
        let _method;
        let _target;
        if (length === 1) {
            _method = target;
            _target = null;
        }
        else {
            _method = method;
            _target = target;
        }
        if (isString(_method)) {
            _method = _target[_method];
        }
        let onError = getOnError(this.options);
        this.begin();
        if (onError) {
            try {
                return _method.apply(_target, args);
            }
            catch (error) {
                onError(error);
            }
            finally {
                this.end();
            }
        }
        else {
            try {
                return _method.apply(_target, args);
            }
            finally {
                this.end();
            }
        }
    }
    join() {
        if (!this.currentInstance) {
            return this.run.apply(this, arguments);
        }
        let length = arguments.length;
        let method;
        let target;
        if (length === 1) {
            method = arguments[0];
            target = null;
        }
        else {
            target = arguments[0];
            method = arguments[1];
        }
        if (isString(method)) {
            method = target[method];
        }
        if (length === 1) {
            return method();
        }
        else if (length === 2) {
            return method.call(target);
        }
        else {
            let args = new Array(length - 2);
            for (let i = 0, l = length - 2; i < l; i++) {
                args[i] = arguments[i + 2];
            }
            return method.apply(target, args);
        }
    }
    defer() {
        return this.schedule.apply(this, arguments);
    }
    schedule(queueName) {
        let length = arguments.length;
        let method;
        let target;
        let args;
        if (length === 2) {
            method = arguments[1];
            target = null;
        }
        else {
            target = arguments[1];
            method = arguments[2];
        }
        if (isString(method)) {
            method = target[method];
        }
        let stack = this.DEBUG ? new Error() : undefined;
        if (length > 3) {
            args = new Array(length - 3);
            for (let i = 3; i < length; i++) {
                args[i - 3] = arguments[i];
            }
        }
        else {
            args = undefined;
        }
        return this._ensureInstance().schedule(queueName, target, method, args, false, stack);
    }
    /*
      Defer the passed iterable of functions to run inside the specified queue.
  
      @method scheduleIterable
      @param {String} queueName
      @param {Iterable} an iterable of functions to execute
      @return method result
    */
    scheduleIterable(queueName, iterable) {
        let stack = this.DEBUG ? new Error() : undefined;
        let _iteratorDrain = iteratorDrain;
        return this._ensureInstance().schedule(queueName, null, _iteratorDrain, [iterable], false, stack);
    }
    deferOnce() {
        return this.scheduleOnce.apply(this, arguments);
    }
    scheduleOnce(queueName /* , target, method, args */) {
        let length = arguments.length;
        let method;
        let target;
        let args;
        if (length === 2) {
            method = arguments[1];
            target = null;
        }
        else {
            target = arguments[1];
            method = arguments[2];
        }
        if (isString(method)) {
            method = target[method];
        }
        let stack = this.DEBUG ? new Error() : undefined;
        if (length > 3) {
            args = new Array(length - 3);
            for (let i = 3; i < length; i++) {
                args[i - 3] = arguments[i];
            }
        }
        else {
            args = undefined;
        }
        let currentInstance = this._ensureInstance();
        return currentInstance.schedule(queueName, target, method, args, true, stack);
    }
    setTimeout() {
        return this.later.apply(this, arguments);
    }
    later() {
        let l = arguments.length;
        let args = new Array(l);
        for (let x = 0; x < l; x++) {
            args[x] = arguments[x];
        }
        let length = args.length;
        let method;
        let wait;
        let target;
        let methodOrTarget;
        let methodOrWait;
        let methodOrArgs;
        if (length === 0) {
            return;
        }
        else if (length === 1) {
            method = args.shift();
            wait = 0;
        }
        else if (length === 2) {
            methodOrTarget = args[0];
            methodOrWait = args[1];
            if (isFunction(methodOrWait) || isFunction(methodOrTarget[methodOrWait])) {
                target = args.shift();
                method = args.shift();
                wait = 0;
            }
            else if (isCoercableNumber(methodOrWait)) {
                method = args.shift();
                wait = args.shift();
            }
            else {
                method = args.shift();
                wait = 0;
            }
        }
        else {
            let last = args[args.length - 1];
            if (isCoercableNumber(last)) {
                wait = args.pop();
            }
            else {
                wait = 0;
            }
            methodOrTarget = args[0];
            methodOrArgs = args[1];
            if (isFunction(methodOrArgs) || (isString(methodOrArgs) &&
                methodOrTarget !== null &&
                methodOrArgs in methodOrTarget)) {
                target = args.shift();
                method = args.shift();
            }
            else {
                method = args.shift();
            }
        }
        let executeAt = now() + parseInt(wait !== wait ? 0 : wait, 10);
        if (isString(method)) {
            method = target[method];
        }
        let onError = getOnError(this.options);
        function fn() {
            if (onError) {
                try {
                    method.apply(target, args);
                }
                catch (e) {
                    onError(e);
                }
            }
            else {
                method.apply(target, args);
            }
        }
        return this._setTimeout(fn, executeAt);
    }
    throttle(target, method /* , args, wait, [immediate] */) {
        let backburner = this;
        let args = new Array(arguments.length);
        for (let i = 0; i < arguments.length; i++) {
            args[i] = arguments[i];
        }
        let immediate = args.pop();
        let wait;
        let throttler;
        let index;
        let timer;
        if (isNumber(immediate) || isString(immediate)) {
            wait = immediate;
            immediate = true;
        }
        else {
            wait = args.pop();
        }
        wait = parseInt(wait, 10);
        index = findThrottler(target, method, this._throttlers);
        if (index > -1) {
            return this._throttlers[index];
        } // throttled
        timer = this._platform.setTimeout(function () {
            if (!immediate) {
                backburner.run.apply(backburner, args);
            }
            index = findThrottler(target, method, backburner._throttlers);
            if (index > -1) {
                backburner._throttlers.splice(index, 1);
            }
        }, wait);
        if (immediate) {
            this.join.apply(this, args);
        }
        throttler = [target, method, timer];
        this._throttlers.push(throttler);
        return throttler;
    }
    debounce(target, method /* , args, wait, [immediate] */) {
        let backburner = this;
        let args = new Array(arguments.length);
        for (let i = 0; i < arguments.length; i++) {
            args[i] = arguments[i];
        }
        let immediate = args.pop();
        let wait;
        let index;
        let debouncee;
        let timer;
        if (isNumber(immediate) || isString(immediate)) {
            wait = immediate;
            immediate = false;
        }
        else {
            wait = args.pop();
        }
        wait = parseInt(wait, 10);
        // Remove debouncee
        index = findDebouncee(target, method, this._debouncees);
        if (index > -1) {
            debouncee = this._debouncees[index];
            this._debouncees.splice(index, 1);
            this._platform.clearTimeout(debouncee[2]);
        }
        timer = this._platform.setTimeout(function () {
            if (!immediate) {
                backburner.run.apply(backburner, args);
            }
            index = findDebouncee(target, method, backburner._debouncees);
            if (index > -1) {
                backburner._debouncees.splice(index, 1);
            }
        }, wait);
        if (immediate && index === -1) {
            backburner.run.apply(backburner, args);
        }
        debouncee = [
            target,
            method,
            timer
        ];
        backburner._debouncees.push(debouncee);
        return debouncee;
    }
    cancelTimers() {
        each(this._throttlers, this._boundClearItems);
        this._throttlers = [];
        each(this._debouncees, this._boundClearItems);
        this._debouncees = [];
        this._clearTimerTimeout();
        this._timers = [];
        if (this._autorun) {
            this._platform.clearNext(this._autorun);
            this._autorun = null;
        }
        this._cancelAutorun();
    }
    hasTimers() {
        return !!this._timers.length || !!this._debouncees.length || !!this._throttlers.length || this._autorun;
    }
    cancel(timer) {
        let timerType = typeof timer;
        if (timer && timerType === 'object' && timer.queue && timer.method) {
            return timer.queue.cancel(timer);
        }
        else if (timerType === 'function') {
            for (let i = 0, l = this._timers.length; i < l; i += 2) {
                if (this._timers[i + 1] === timer) {
                    this._timers.splice(i, 2); // remove the two elements
                    if (i === 0) {
                        this._reinstallTimerTimeout();
                    }
                    return true;
                }
            }
        }
        else if (Object.prototype.toString.call(timer) === '[object Array]') {
            return this._cancelItem(findThrottler, this._throttlers, timer) ||
                this._cancelItem(findDebouncee, this._debouncees, timer);
        }
        else {
            return; // timer was null or not a timer
        }
    }
    _cancelAutorun() {
        if (this._autorun) {
            this._platform.clearTimeout(this._autorun);
            this._autorun = null;
        }
    }
    _setTimeout(fn, executeAt) {
        if (this._timers.length === 0) {
            this._timers.push(executeAt, fn);
            this._installTimerTimeout();
            return fn;
        }
        // find position to insert
        let i = binarySearch(executeAt, this._timers);
        this._timers.splice(i, 0, executeAt, fn);
        // we should be the new earliest timer if i == 0
        if (i === 0) {
            this._reinstallTimerTimeout();
        }
        return fn;
    }
    _cancelItem(findMethod, array, timer) {
        let item;
        let index;
        if (timer.length < 3) {
            return false;
        }
        index = findMethod(timer[0], timer[1], array);
        if (index > -1) {
            item = array[index];
            if (item[2] === timer[2]) {
                array.splice(index, 1);
                this._platform.clearTimeout(timer[2]);
                return true;
            }
        }
        return false;
    }
    /**
     Trigger an event. Supports up to two arguments. Designed around
     triggering transition events from one run loop instance to the
     next, which requires an argument for the first instance and then
     an argument for the next instance.
  
     @private
     @method _trigger
     @param {String} eventName
     @param {any} arg1
     @param {any} arg2
     */
    _trigger(eventName, arg1, arg2) {
        let callbacks = this._eventCallbacks[eventName];
        if (callbacks) {
            for (let i = 0; i < callbacks.length; i++) {
                callbacks[i](arg1, arg2);
            }
        }
    }
    _runExpiredTimers() {
        this._timerTimeoutId = undefined;
        this.run(this, this._scheduleExpiredTimers);
    }
    _scheduleExpiredTimers() {
        let n = now();
        let timers = this._timers;
        let i = 0;
        let l = timers.length;
        for (; i < l; i += 2) {
            let executeAt = timers[i];
            let fn = timers[i + 1];
            if (executeAt <= n) {
                this.schedule(this.options.defaultQueue, null, fn);
            }
            else {
                break;
            }
        }
        timers.splice(0, i);
        this._installTimerTimeout();
    }
    _reinstallTimerTimeout() {
        this._clearTimerTimeout();
        this._installTimerTimeout();
    }
    _clearTimerTimeout() {
        if (!this._timerTimeoutId) {
            return;
        }
        this._platform.clearTimeout(this._timerTimeoutId);
        this._timerTimeoutId = undefined;
    }
    _installTimerTimeout() {
        if (!this._timers.length) {
            return;
        }
        let minExpiresAt = this._timers[0];
        let n = now();
        let wait = Math.max(0, minExpiresAt - n);
        this._timerTimeoutId = this._platform.setTimeout(this._boundRunExpiredTimers, wait);
    }
    _ensureInstance() {
        let currentInstance = this.currentInstance;
        if (!currentInstance) {
            const next = this._platform.next || this._platform.setTimeout; // TODO: remove the fallback
            currentInstance = this.begin();
            this._autorun = next(this._boundAutorunEnd);
        }
        return currentInstance;
    }
}
Backburner.Queue = Queue;

export default Backburner;

//# sourceMappingURL=backburner.js.map
