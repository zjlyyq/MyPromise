const PENDING = 'PENDING';
const FULFILLED = 'FULFILLED';
const REJECTED = 'REJECTED';
let globalPromiseId = 0;
class MyPromise {
    constructor(executor) {
        this.PID = ++globalPromiseId;   // 没用，只不过有利于调试的时候查看
        this.value = null
        this.reason = null
        this.state = PENDING;
        this.onFullfilledCallbacks = [];
        this.onRejectedCallbacks = [];

        const resolve = (value) => {
            this.value = value
            this.state = FULFILLED
            console.log(`Promise ${this.PID}  state is ` + this.state)
            this.onFullfilledCallbacks.forEach(onFullfilledCallback => {
                onFullfilledCallback(this.value)
            })
        }
        const reject = (reason) => {
            this.reason = reason
            this.state = REJECTED
            console.log(`Promise ${this.PID}  state is ` + this.state)
            this.onRejectedCallbacks.forEach(onRejectedCallback => {
                onRejectedCallback(this.reason)
            })
        }
        try {
            executor(resolve, reject)
        } catch (reason) {
            this.reject(reason)
        }
    }

    then(onFulfilled, onRejected) {
        console.log(`Promise ${this.PID} then is called`)
        const promise2 = new MyPromise((resolve, reject) => {
            // 如果当前promise状态还是pending，封装回调函数进数组，等到promise状态转换后，自然会
            // 调用相应的回调函数，并开始解析promise2
            if (this.state === PENDING) {
                this.onFullfilledCallbacks.push(() => {
                    try {
                        // 如果 onFulfilled 不是函数， 忽略， 将value原封不动传递下去
                        let x = typeof onFulfilled === 'function' ?
                            onFulfilled(this.value) :
                            this.value;
                        this.resolvePromise(promise2, x, resolve, reject);
                    } catch (error) {
                        reject(error);
                    }
                })
                this.onRejectedCallbacks.push(() => {
                    try {
                        // 如果 onRejected 不是函数， 忽略， 将reason原封不动传递下去
                        let x = typeof onRejected === 'function' ?
                            onRejected(this.reason) :
                            this.reason;
                        this.resolvePromise(promise2, x, this.state, resolve, reject);
                    } catch (error) {
                        reject(error)
                    }
                })
            }
            else if (this.state === FULFILLED) {
                try {
                    let x = onFulfilled(this.value);
                    this.resolvePromise(promise2, x, this.state, resolve, reject);
                } catch (error) {
                    reject(error)
                }
            }
            else if (this.state === REJECTED) {
                try {
                    let x = onRejected(this.reason);
                    this.resolvePromise(promise2, x, this.state, resolve, reject);
                } catch (error) {
                    reject(error)
                }
            }
        })

        return promise2;
    }

    resolvePromise(promise2, x, state, resolve, reject) {
        if (promise2 === x) {
            reject(new TypeError('Chaining Cycle'));
        }
        if (x && typeof x === 'object' || typeof x === 'function') {
            let used;
            try {
                let then = x.then;
                // x.then 是 function 说明 x 是promise
                if (typeof then === 'function') {
                    then.call(x, (y) => {
                        if (used) return;
                        used = true;
                        this.resolvePromise(promise2, y, state, resolve, reject)
                    }, (r) => {
                        if (used) return;
                        used = true;
                        reject(r);
                    })
                } else {
                    if (used) return;
                    used = true;
                    if (state === FULFILLED)
                        resolve(x);
                    else
                        reject(x);
                    // resolve(x);
                }
            } catch (error) {
                // 如果已调用resolvePromise或rejectPromise，忽略异常
                if (used) return;
                used = true
                reject(error)
            }
        } else {
            if (state === FULFILLED)
                resolve(x);
            else
                reject(x);
            // resolve(x);
        }
    }
    // 最后的catch, 只传onRejected即可
    catch(onRejected) {
        return this.then(null, onRejected);
    }
}

let p1 = new MyPromise((resolve, reject) => {
    setTimeout(() => {
        reject(2)
    })
})
p1.then().then(res => {
    console.log(res)
}, err => {
    console.log('err', err)
}).catch(error => {
    console.log(`error: ${error}`)
})

