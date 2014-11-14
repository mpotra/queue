var process_nextTick = (process && process.nextTick ? process.nextTick : function (fn) { fn(); });

var Queue = module.exports = function Queue() {

  Queue.init(this);
  
  return this;
}
/**
 * Prototype, empty Object.
 */
Queue.prototype = {};
/**
 * Define the constructor function for all newly created instances.
 */
Queue.prototype.constructor = Queue;
/**
 * The stack will hold all queued tasks, added through .push([task])
 */
Queue.prototype.stack = null;
/**
 * The context defines the current Queue instance, used for adding and executing tasks.
 */
Queue.prototype.context = null;
/**
 * The number of currenly pending tasks (tasks that have not been executed yet).
 */
Queue.prototype.length = 0;

/**
 * Initialize a Queue instance.
 *
 * - Sets up the 'stack' property to an empty Array
 * - References 'context' property to self.
 * - Defines the 'length' property using Object.defineProperty()
 *
 * @param {Queue} queue The Queue instance to initialize.
 * @returns {Queue} The instance on which initialize has been called.
 */
Queue.init = Queue.initialize = function initialize(queue, context) {
  if (queue) {
    // Create the array that will hold task functions.
    queue.stack = [];
    // Self-referencing context.
    queue.context = (context ? context : queue);
    // Define the .length property that will retrieve the number of items in the context stack.
    Object.defineProperty(queue, 'length', {
        'get': function() { return (this.context === this ? this.stack.length : this.context.length); }
      , 'set': function(v) { if (this.context === this) { this.stack.length = v; } else { this.context.length = v; } }
      , 'enumerable': true
      , 'configurable': true
    });
  }
  // Return
  return queue;
}

/**
 * Add a task to the queue.
 *
 * Task: A function with the following signature: function task(done, context) { ... }
 *       Where 'done' is a callback function that will be called when the task function finished.
 *             'context' is reference object to the Queue instance that will receive the task. 
 *                       Useful for entering child Queue instances, and exiting them.
 * @param {Function} task A function queued for execution.
 * @returns {Queue} This instance.
 */
Queue.prototype.pushTask = function pushTask(task) {
  if (this.context === this) {
    // If the context is the same as the Queue instance, directly add to the 'stack' Array.
    this.stack.push(task);
  } else {
    // Context is different. Pass the task to it.
    this.context.pushTask(task);
  }
  return this;
}

/**
 * Add a function to the queue. 
 * The function will be wrapped in a task function as defined by .pushTask
 *
 * 
 * @param {Function} fn A function queued for execution.
 * @returns {Queue} This instance.
 */
Queue.prototype.push = function push(fn) {
  // Create the task function, to be used by the Queue.
  var task = function task(done, context) {
  
    // Create a sub-context if fn is a function.
    if (typeof fn === 'function') {
      // Enter the sub-context, to allow queuing of other chain tasks.
      context.enter();
      
      // Execute the function.
      fn();
      
      // Once the function executed (returned), run the sub-context,
      // and then exit the sub-context, returning to the previous context.
      context.run(function() {
        // Sub-context queue finished. 
        // Exit to parent context; once sub-context has been released, 
        // signal that the task is done, by calling 'done' function (automatically by .exit()).
        context.exit(done);
      });
    } else {
      // Fn is not a function, just signal the task is done.
      done();
    }
  };
  
  // Queue the task.
  this.pushTask(task);
  
  // Return the task function.
  return task;
}

/**
 * Shift a task of the queue.
 *
 * Will remove and return the first item in the task list.
 * @returns {Task} The first item in the queued task list.
 */
Queue.prototype.shift = function shift() {
  // Determine the stack to use 
  // 'stack' property for current instance, delegate for other.
  var stack = (this.context === this ? this.stack : this.context);
  return stack.shift();
}

/**
 * Enters the currently selected context into a child context. Selects the child context.
 *
 * @param {Queue} context (optional) A Queue instance to use as a context for all further operations.
 *                                   If not provided, a new Queue instance will be created;
 * @returns {Queue} The newly selected Queue instance.
 */
Queue.prototype.enter = function enter(context) {
  if (this.context === this) {
    var _context = (context ? context : new Queue());
    _context.parent = this;
    this.context = _context;
    return _context;
  } else {
    return this.context = this.context.enter();
  }
}

/**
 * Exits the currently selected context (child Queue instance),
 * selecting the previously selected context.
 *
 * @param {Function} done (optional) A callback function, that will be executed after the child context has been deselected.
 *
 */
Queue.prototype.exit = function exit(done) {
  if (this.context.parent) {
    // Only if the current context is a sub-context of another context.
    this.context = this.context.parent;
  }
  
  if (typeof done === 'function') {
    done();
  }
  return this;
}

/**
 * Run the queued tasks.
 *
 * @param {Function} done (optional) A callback function, that will be executed once there are no more task items
 *                                  in the current selected context stack.
 *                                  The callback will be executed immediatelly when the stack is empty.
 * @returns {Queue} This running context.
 */
Queue.prototype.run = function run(done) {
  if (this.context === this) {
    // Quick reference to this, to be used in async functions.
    var context = this;

    if (!context.running) {
      // If the current context is not running, set the 'running' property to true.
      context.running = true;
      
      // Helper function, that will be called once there are no more items in the
      // stack task list.
      var finish = function finish() {
        // Set 'running' to false;
        context.running = false;
        // If there's been a 'done' callback provided to the run function, call it.
        if (typeof done === 'function') {
          done();
        }
      };
      
      if (context.length) {
        // If there are queued tasks in the stack.
        
        // Helper function that will loop through the stack, in FIFO order.
        var next = function next() {
          if (context.length) {
            // Still have items. Retrieve the first one, 
            // and remove it from the stack.
            var task = context.shift();
            
            if (task && typeof task === 'function') {
              // Call task function, providing 'next' as a done callback,
              // and 'context' object in use.
              task(next, context);
            } else {
              // Task item is not a function. Continue to next item in stack.
              next();
            }
          } else {
            // No more items in the stack. Signal finish.
            finish();
          }
        };

        // Start the loop on next tick, in order to allow any other seq requests
        // to add tasks to the queue.
        process_nextTick(next);
        
      } else {
        // No items in the stack. Queue is empty, just finish here.
        finish();
      }
    }
    
    // Always return the current Queue instance.
    return this;
    
  } else {
    // Currently selected context differs from this instance. 
    // Pass the call to it.
    return this.context.run(done);
  }
}