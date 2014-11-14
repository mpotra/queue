queue
============

Task runner for [nodeJS](http://nodejs.org)


## Features
* queue tasks (functions)
* tasks are run in order
* sub-contexts that allow inner tasks to run before outter tasks

## Examples
Automatically using sub-context.
```javascript

// Create a task list.
var pending = new Queue();

// Some sort of function that uses the queue
var insert = function insert(callback) {
  // Add the callback as a task.
  var task = pending.push(callback);
  
  // Check if queue is already running.
  if (!pending.running) {
    // Run the queue.
    pending.run();
  }
};

// Start using insert()

insert(function first() {
   // First callback that will run.
  insert(function second() {
    // Second callback that will run, due to auto sub-contexts.
  });
});

insert(function third() {
  // Third callback that will run
});
```

Example using sub-contexts, and manually generated tasks.
```javascript
var pending = new Queue();

// Some sort of function that does something async, for example some I/O.
var somethingAsync = function somethingAsync(callback) {
    // Execute function 'onTimeout' after 500 ms.
    setTimeout(function onTimeout() {
        // After 500ms, call 'callback' with some results.
        callback(new Error('Something went wrong'));
    }, 500);
};

// Some function that allows for queuing calls to somethingASync().
var insert = function insert(callback) {
  var task = function task(done, context) {
    // When the task is executed
    somethingAsync(function asyncFinished(err) {
        // The async finished.
        // Process results and then signal that the task finished.
        if (typeof callback === 'function') {
            // A callback has been provided to 'insert()'
            // Allow for inside calls to 'insert()' to be queued, by enabling sub-contexts.
            context.enter();
            
            // Now execute the callback.
            callback(err);
            
            // Once the callback finished, run the sub-context to ensure that all 'insert()' calls
            // are honored.
            context.run(function afterContextRun() {
                // Once the sub-context finished running, exit it.
                // Detailed way of writing: context.exit(done);
                context.exit(function onContextExit() {
                    // Sub-context released, we can now signal task finished.
                    done();
                });
            });
        } else {
            // No callback provided to 'insert()'
            // Just signal task finished.
            done();
        }
    });
  };
  pending.pushTask(task);
  
  // Check if queue is already running.
  if(!pending.running) {
    // If queue is not running start it.
    pending.run();
  }
};

// Start using insert()
insert(function first() {
  // First callback that will run.
  insert(function second() {
    // Second callback that will run.
  });
});

insert(function third() {
  // Third callback that will run.
});
```

## Contact

* [Issues](https://github.com/mpotra/queue/issues) for this repo
* [@mpotra](https://twitter.com/mpotra) on Twitter
* [mpotra](https://github.com/mpotra) on GitHub
