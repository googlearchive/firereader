// Read-only collection that monitors multiple paths
angular.module('firebase').factory('angularFireAggregate', ['$timeout', '$q', function($timeout, $q) {

   /**
    * Opts parms (all optional):
    *     {Array<Firebase|String>} paths - a set of paths to be monitored, additional paths can be added via collection.addPath()
    *     {Function} callback - invoked when all the paths have been initialized
    *     {Function(snapshot, index)} factory - converts a Firebase snapshot into an object, defaults to AngularFireItem (see below)
    *
    * @param {Scope} $scope
    * @param {Object} opts - see above
    */
   return function($scope, opts) {
      var collection = [];
      var indexes = {};
      var listeners = [];

      /**
       * This can be invoked to add additional paths after initialization
       *
       * The path can be an array so that you can pass a unique id, which will be used later if dispose() is called
       * on the path. This is necessary when using limit() because Firebase.toString() no longer returns a unique path.
       *
       * @param {Firebase|String|Array} path see above
       * @return {Path}
       */
      collection.addPath = function(path) {
         return new Path(path);
      };

      /**
       * Observer pattern, notify types are
       * @param {string} [type] 'all' (default), 'child_added', 'child_removed', 'child_changed', or 'child_moved'
       * @param {Function} callback
       */
      collection.on = function(type, callback) {
         if( angular.isFunction(type) ) {
            callback = type;
            type = 'all';
         }
         angular.forEach(type.split(' '), function(t) {
            listeners.push([callback, t]);
         });
      };

      collection.find = function(id, index) {
         if( angular.isNumber(index) && indexes[index] && indexes[index].$id === id ) {
            return collection[index];
         }
         else {
            var i = collection.length;
            while(i--) {
               if( collection[i].$id === id ) {
                  return collection[i];
               }
            }
            return null;
         }
      };

      /**
       * The default object for representing a data item in the Collection. This can be overridden by
       * setting opts.factory.
       *
       * @param {Firebase} ref
       * @param {int} index
       * @constructor
       */
      function AngularFireItem(ref, index) {
         this.$ref = ref.ref();
         this.$id = ref.name();
         this.$index = index;
         angular.extend(this, {priority:ref.getPriority()}, ref.val());
      }

      /**
       * A single Firebase path from which data objects are going to be aggregated into the Collection. Each
       * item in the path is converted using  into an object by using opts.factory.
       *
       * The urlOrRef can be an array so that you can pass a unique id, which will be used later if dispose() is called
       * on the path. This is necessary when using limit() because Firebase.toString() no longer returns a unique path.
       *
       * @param {String|Firebase|Array} urlOrRef
       * @param {Function} [initialCb]
       * @constructor
       */
      function Path(urlOrRef, initialCb) {
         var subs = [];
         var pathRef = angular.isArray(urlOrRef)? urlOrRef[0] : urlOrRef;
         if (typeof pathRef == "string") {
            pathRef = new Firebase(pathRef);
         }
         var pathString = angular.isArray(urlOrRef)? urlOrRef[1] : pathRef.toString();

         console.log('new Path', pathString); //debug

         subs.push(['child_added', pathRef.on('child_added', function(data, prevId) {
            $timeout(function() {
               var index = getIndex(prevId), item = processItem(data, index, pathString);
               addChild(index, item);
            });
         })]);

         subs.push(['child_removed', pathRef.on('child_removed', function(data) {
            //todo broakdacst to scope
            $timeout(function() {
               removeChild(data.name);
            });
         })]);

         subs.push(['child_changed', pathRef.on('child_changed', function(data, prevId) {
            //todo broadcast to scope
            $timeout(function() {
               var index = indexes[data.name()];
               var newIndex = getIndex(prevId);
               var item = processItem(data, index, pathString);

               updateChild(index, item);
               if (newIndex !== index) {
                  moveChild(index, newIndex, item);
               }
            });
         })]);

         subs.push(['child_moved', pathRef.on('child_moved', function(ref, prevId) {
            $timeout(function() {
               var oldIndex = indexes[ref.name()];
               var newIndex = getIndex(prevId);
               var item = collection[oldIndex];
               moveChild(oldIndex, newIndex, item);
            });
         })]);

         // putting this at the end makes performance appear considerably faster
         // since child_added callbacks start immediately instead of after entire
         // data set is loaded on server
         if (initialCb && typeof initialCb == 'function') {
            pathRef.once('value', initialCb);
         }

         this.dispose = function() {
            _.each(subs, function(s) {
               pathRef.off(s[0], s[1]);
            });
            pathRef = null;
            $timeout(function() {
               //todo this will not work if using two refs that access the same path
               //todo which seems unlikely but certainly valid
               angular.forEach(collection.slice(), function(item) {
                  if( item.$path === pathString ) {
                     removeChild(item.$id);
                  }
               });
            })
         };

      }

      ///////////// internal functions

      //todo this could have some unforseen side effects; the idea of using prevId with multiple paths
      //todo should be evaluated and tested against some different use cases
      function getIndex(prevId) {
         return prevId ? indexes[prevId] + 1 : 0;
      }

      function addChild(index, item) {
//         console.log('adding child', item.$id, item.$path);
         indexes[item.$id] = index;
         collection.splice(index, 0, item);
         updateIndexes(index);
         notify('added', item, index);
      }

      function removeChild(id) {
         var index = indexes[id];
         // Remove the item from the collection.
         var item = (collection.splice(index, 1)||[])[0];
         delete indexes[id];
//         console.log('removing child', item.$id, item.$path);
         updateIndexes(index);
         notify('removed', item, index);
      }

      function updateChild (index, item) {
         collection[index] = item;
         notify('updated', item, index);
      }

      function moveChild (from, to, item) {
         collection.splice(from, 1);
         collection.splice(to, 0, item);
         updateIndexes(from, to+1);
         notify('moved', item, to, from);
      }

      function updateIndexes(from, to) {
         var length = collection.length;
         to = to || length;
         if (to > length) {
            to = length;
         }
         for (var index = from; index < to; index++) {
            var item = collection[index];
            item.$index = indexes[item.$id] = index;
         }
      }

      function processItem(data, index, pathString) {
         var out = opts.factory(data, index);
         out.$id = data.name();
         out.$index = index;
         out.$path = pathString;
         return out;
      }

      function notify(event, item, index, oldIndex) {
         angular.forEach(listeners, function(props) {
            var fn = props[0];
            var type = props[1];
            (type === 'all' || type === event) && fn(item, event, index, oldIndex);
         });
      }

      //////////////// process and create the aggregated Collection

      opts = angular.extend({
         factory: function(ref, index) { return new AngularFireItem(ref, index); },
         paths: null,
         callback: null
      }, opts);

      if( opts.paths && opts.callback ) {
         // if any paths were passed in via opts, then add and fetch them now
         var promises = [];
         for(var i = 0; i < opts.paths.length; i++) {
            (function(def, path) {
               new Path(path, function() { def.resolve() });
               promises.push(def.promise());
            })($q.defer(), opts.paths[i]);
         }
         // if there is a callback, wait for all the paths to initialize and then invoke it
         $q.all(promises).then(opts.callback);
      }
      else if( opts.path ) {
         angular.forEach(opts.paths, function(p) {
            new Path(p);
         });
      }

      return collection;
   };
}]);