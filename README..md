# 手写一个符合PromiseA+规范的Promise

### [Promise/A+规范](https://promisesaplus.com/)

规范规定了几个重要信息：
1. promise是一个状态机

    ![状态机](https://ftp.bmp.ovh/imgs/2020/09/8d0c3e0ceb2cae66.png)

2. promise 必须提供一个 **`then`** 方法来处理其最终返回的值或出错的原因，`**then**`方法拥有两个参数：`**promise.then(onFulfilled, onRejected)**`，其中：
    - `onFulfilled` 和 `onRejected` 都是可选参数， 如果不是函数，必须被忽略
    - 当 `onFulfilled` 是一个函数
        - 必须在promise的状态转为 fulfilled 后被执行，并且将promise的value作为第一个参数
        - 只能被执行一次
    - 当 `onRejected` 是一个函数
        - 必须在promise的状态转为 rejected 后被执行，并且将promise的value作为第一个参数
        - 只能被执行一次
    - 在执行上下文堆栈仅包含平台代码之前，不得调用**onFulfilled**或**onRejected**。（不太理解这段，大概是支持异步吧？）
    - `then` 可以被执行多次，当promise的状态转为fulfilled/rejected 后，`**onFulfilled`** 和 `**onRejected`** 会按原来被绑定的顺序被执行。
    - `then` 必须返回一个promise `promise2 = promise1.then(onFulfilled, onRejected)`
        - 当 **onFulfilled**或**onRejected** 返回一个值x，运行promise解析程序 `[[Resolve]]（promise2，x）`
        - 当 **onFulfilled**或**onRejected** 抛出异常e，promise2必须转为rejected，并把e作为reason
        - 当 `**onFulfilled`** 不是函数，并且promise1的状态为fulfilled, promise2 必须以相同的value值完成状态转换。
        - 当 `**onRejected`** 不是函数，并且promise1的状态为rejected, promise2 必须以相同的reason完成状态转换。


1. `[[Resolve]]（promise2，x` promise解析程序

    Promise解析过程是一个抽象操作，将Promise和一个值作为输入，我们将其表示为`[[Resolve]](promise，x)` 。总体而言，如果x是thenable，也就是包含了then方法，会在x至少表现得像Promise的假设下，令promise采纳x的状态。否则，promise将以值 x fulfill。

    执行的细节按照如下步骤

    - 如果 x 和 promise指向同一个对象，则以 `TypeError` 作为原因reject promise
    - 如果 x 是 promise，采纳其状态
    - 如果 x 是 object 或 function
        1. let then = x.then
        2. 如果检索属性x.then导致抛出异常e，请拒绝promise，原因为e。
        3. 如果then是一个函数，则使用x作为this调用，第一个参数resolvePromise，第二个参数rejectPromise
            1. 如果使用值 y 调用resolvePromise时，运行**`[[Resolve]](promise，y)`**
            2. 如果使用原因r调用rejectPromise时，使用r拒绝promise
            3. 如果同时调用resolvePromise和rejectPromise，或者对同一参数进行了多次调用，则第一个调用具有优先权，而任何其他调用都将被忽略。
            4. 如果 then 调用发生异常
                1. 如果已调用resolvePromise或rejectPromise，忽略异常
                2. 否则，以e为理由拒绝promise。


清楚了PromiseA+规范，下面开始一步一步地实现。

### 实现框架

Promise构造函数接受一个函数作为参数，该函数的两个参数分别是resolve和reject。它们是两个函数，由 JavaScript 引擎提供，因此这里我们首先写出构造函数骨架。其中 resolve和reject是需要内部实现的部分， resolve函数的作用是，将Promise对象的状态从“未完成”变为“成功”（即从 pending 变为 resolved），reject函数的作用是，将Promise对象的状态从“未完成”变为“失败”（即从 pending 变为 rejected）。

```jsx
const PENDING = 'PENDING';
const FULFILLED = 'FULFILLED';
const REJECTED = 'REJECTED';

class Mypromise {
	constructor(executor) {
        this.value = null;
        this.reason = null;
        this.state = PENDING;

        const resolve = (value) => {
            this.value = value
            this.state = FULFILLED
        }
        const reject = (reason) => {
            this.reason = reason
            this.state = REJECTED          
        }
        try {
            executor(resolve, reject)
        }catch (reason){
            reject(reason)
        }
    }
}
```

### 实现then方法

then 方法接受两个函数，实现延时绑定的功能，并能支持多次调用，因此我们需要在内部用两个数组保存相应的回调函数，从而，在执行resolve和reject时，只需要从相应数组中取出回调函数依次执行。

```jsx
const PENDING = 'PENDING';
const FULFILLED = 'FULFILLED';
const REJECTED = 'REJECTED';

class Mypromise {
	constructor(executor) {
        this.value = null;
        this.reason = null;
        this.state = PENDING;
				this.onFullfilledCallbacks = [];   // 保存成功的回调
        this.onRejectedCallbacks = [];     // 保存失败的回调

        const resolve = (value) => {
            this.value = value
            this.state = FULFILLED
						// 从成功的回调数组中取出回调函数依次执行。
						this.onFullfilledCallbacks.forEach(onFullfilledCallback => {
                onFullfilledCallback(this.value)
            })
        }
        const reject = (reason) => {
            this.reason = reason
            this.state = REJECTED  
						// 从失败的回调数组中取出回调函数依次执行
						this.onRejectedCallbacks.forEach(onRejectedCallback => {
                onRejectedCallback(this.reason)
            })        
        }
        try {
            executor(resolve, reject)
        }catch (reason){
            reject(reason)
        }
    }

    then(onFulfilled, onRejected) {
        if (this.state === FULFILLED) {
            onFulfilled(this.value)
        }else if (this.state === REJECTED) {
            onRejected(this.reason)
        }else {
            this.onFullfilledCallbacks.push(onFulfilled);
            this.onRejectedCallbacks.push(onRejected);
        }
    }
}
```

以上构造方法保证了回调函数的延时绑定，并且确保了按绑定顺序使用回调函数。所有的promise都是一样的，不同的就是`executor`这个立即执行的函数所决定的resolve或reject的时机。因此，下面then方法返回新promise2也是这个思路，让新promise2的`executor` 和当前的promise强相关。

### then方法返回一个promise

```tsx
then(onFulfilled, onRejected) {
    console.log('then called')
    const promise2 = new MyPromise((resolve, reject) => {
        // 如果当前promise状态还是pending，封装回调函数进数组，
        // 等到promise状态转换后，自然会调用相应的回调函数，之后收集返回值开始解析promise2
        if (this.state === PENDING) {
            this.onFullfilledCallbacks.push(() => {
                try {
                    let x = onFulfilled(this.value);
                    this.resolvePromise(promise2, x, resolve, reject);
                }catch(error) {
                    reject(error);
                }
            })

            this.onRejectedCallbacks.push(() => {
                try {
                    let x = onRejected(this.reason);
                    this.resolvePromise(promise2, x, resolve, reject);
                }catch(error) {
                    reject(error)
                }
            })
        }
        else if (this.state === FULFILLED) {
            try {
                let x = onFulfilled(this.value);
                this.resolvePromise(promise2, x, resolve, reject);
            }catch (error) {
                reject(error)
            }
        }
        else if (this.state === REJECTED) {
            try {
                let x = onRejected(this.value);
                this.resolvePromise(promise2, x, resolve, reject);
            }catch (error) {
                reject(error)
            }
        }
    })
    return promise2;
}
```

### Promise解析函数

```tsx
resolvePromise(promise2, x, resolve, reject) {
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
                    this.resolvePromise(promise2, y, resolve, reject)
                }, (r) => {
                    if (used) return;
                    used = true;
                    reject(r);
                })
            } else {
                if (used) return;
                used = true;
                resolve(x);
            }
        }catch (error) {
            if (used) return;
            used = true
            reject(error)
        }
    } else {
        resolve(x);
    }
}
```

### 完整代码示例

```jsx
const PENDING = 'PENDING';
const FULFILLED = 'FULFILLED';
const REJECTED = 'REJECTED';

class MyPromise {
    constructor(executor) {
        this.PID = Math.random();   // 没用，只不过有利于调试的时候查看
        this.value = null
        this.reason = null
        this.state = PENDING;
        this.onFullfilledCallbacks = [];
        this.onRejectedCallbacks = [];

        const resolve = (value) => {
            this.value = value
            this.state = FULFILLED
            this.onFullfilledCallbacks.forEach(onFullfilledCallback => {
                onFullfilledCallback(this.value)
            })
            console.log('Promise state is ' + this.state)
        }
        const reject = (reason) => {
            this.reason = reason
            this.state = REJECTED
            this.onRejectedCallbacks.forEach(onRejectedCallback => {
                onRejectedCallback(this.reason)
            })
            console.log('Promise state is ' + this.state)
        }
        try {
            executor(resolve, reject)
        }catch (reason){
            this.reject(reason)
        }
    }

    then(onFulfilled, onRejected) {
        console.log('then called')
        const promise2 = new MyPromise((resolve, reject) => {
            // 如果当前promise状态还是pending，封装回调函数进数组，等到promise状态转换后，自然会
            // 调用相应的回调函数，并开始解析promise2
            if (this.state === PENDING) {
                this.onFullfilledCallbacks.push(() => {
                    try {
                        let x = onFulfilled(this.value);
                        this.resolvePromise(promise2, x, resolve, reject);
                    }catch(error) {
                        reject(error);
                    }
                })
                this.onRejectedCallbacks.push(() => {
                    try {
                        let x = onRejected(this.reason);
                        this.resolvePromise(promise2, x, resolve, reject);
                    }catch(error) {
                        reject(error)
                    }
                })
            }
            else if (this.state === FULFILLED) {
                try {
                    let x = onFulfilled(this.value);
                    this.resolvePromise(promise2, x, resolve, reject);
                }catch (error) {
                    reject(error)
                }
            }
            else if (this.state === REJECTED) {
                try {
                    let x = onRejected(this.value);
                    this.resolvePromise(promise2, x, resolve, reject);
                }catch (error) {
                    reject(error)
                }
            }
        })

        return promise2;
    }

    resolvePromise(promise2, x, resolve, reject) {
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
                        this.resolvePromise(promise2, y, resolve, reject)
                    }, (r) => {
                        if (used) return;
                        used = true;
                        reject(r);
                    })
                } else {
                    if (used) return;
                    used = true;
                    resolve(x);
                }
            }catch (error) {
                // 如果已调用resolvePromise或rejectPromise，忽略异常
                if (used) return;
                used = true
                reject(error)
            }
        } else {
            resolve(x);
        }
    }
    // 最后的catch, 只传onRejected即可
    catch(onRejected) {
        return this.then(null, onRejected);
    }
}
```


