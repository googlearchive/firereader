if (!Date.now) {
   Date.now = function now() {
      return new Date().getTime();
   };
}

// le sigh, IE, oh IE, how we fight... fix Function.prototype.bind as needed
if (!Function.prototype.bind) {
   //credits: taken from bind_even_never in this discussion: https://prototype.lighthouseapp.com/projects/8886/tickets/215-optimize-bind-bindaseventlistener#ticket-215-9
   Function.prototype.bind = function(context) {
      var fn = this, args = Array.prototype.slice.call(arguments, 1);
      return function(){
         return fn.apply(context, Array.prototype.concat.apply(args, arguments));
      };
   };
}

if( typeof(console) === 'undefined' ) {
   window.console = (function() {
      function f() {}
      return { debug: f, info: f, log: f, warn: f, error: f };
   })();
}

// IE 9 won't allow us to call console.log.apply (WTF IE!) It also reports typeof(console.log) as 'object' (UNH!)
// but together, those two errors can be useful in allowing us to fix stuff so it works right
if( typeof(console.log) === 'object' ) {
   // Array.forEach doesn't work in IE 8 so don't try that :(
   console.log = Function.prototype.call.bind(console.log, console);
   console.info = Function.prototype.call.bind(console.info, console);
   console.warn = Function.prototype.call.bind(console.warn, console);
   console.error = Function.prototype.call.bind(console.error, console);
}

if ( !Array.prototype.forEach ) {
   // credits: https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/forEach
   Array.prototype.forEach = function(fn, scope) {
      for(var i = 0, len = this.length; i < len; ++i) {
         fn.call(scope, this[i], i, this);
      }
   }
}