
// Read-only collection that monitors multiple paths
// This is an ALPHA / EXPERIMENTAL concept and probably not suitable for general use
angular.module('angularFireAggregate', []).factory('angularFireAggregate', ['$timeout', '$q', '$log', function($timeout, $q, $log) {

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
      //todo remove $scope and opts--we only use opts.factory at present
      var collection = [];
      var indexes = {};
      var listeners = [];
      var paths = [];

      /**
       * This can be invoked to add additional paths after initialization
       *
       * The path can be an array so that you can pass a unique id, which will be used later if dispose() is called
       * on the path. This is necessary when using limit() because Firebase.toString() no longer returns a unique path.
       *
       * @param {Function} factory generates the data for each entry in this path
       * @param {Firebase|String|Array} path see above
       * @param {Firebase|String} filterPath a path whose ids match ids in `path` and remove values from results
       * @return {Path}
       */
      collection.addPath = function(factory, path, filterPath) {
         return new Path(factory, path, null, filterPath);
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

      collection.dispose = function() {
         notify('dispose');
         angular.forEach(paths, function(p) {p.dispose();});
         collection = [];
         paths = [];
         indexes = {};
         listeners = [];
      };

      /**
       * The default object for representing a data item in the Collection. This can be overridden by
       * setting opts.factory.
       *
       * @param {Path} path
       * @param {Firebase} ref
       * @param priority
       * @param {int} index
       * @constructor
       */
      function AngularFireItem(factory, snap, index) {
         this.$ref = snap.ref().ref();
         this.$id = snap.name();
         this.$index = index;
         this.$priority = snap.getPriority();
         angular.extend(this, factory(snap));
      }

      /**
       * A single Firebase path from which data objects are going to be aggregated into the Collection. Each
       * item in the path is converted using  into an object by using opts.factory.
       *
       * The urlOrRef can be an array so that you can pass a unique id, which will be used later if dispose() is called
       * on the path. This is necessary when using limit() because Firebase.toString() no longer returns a unique path.
       *
       * @param {Function} factory generates the data for each entry in this path
       * @param {String|Firebase|Array} urlOrRef
       * @param {Firebase|String} filterPath a path whose ids match ids in `path` and remove values from results
       * @param {Function} [initialCb]
       * @constructor
       */
      function Path(factory, urlOrRef, initialCb, filterPath) {
         var subs = [], filters = {}, filtered = {};
         var pathRef = angular.isArray(urlOrRef)? urlOrRef[0] : urlOrRef;
         if (typeof pathRef == "string") {
            pathRef = new Firebase(pathRef);
         }
         var pathString = angular.isArray(urlOrRef)? urlOrRef[1] : pathRef.ref().toString();

         this._init = function() {
            subs.push(['child_added', pathRef.on('child_added', function(ss, prevId) {
               var id = ss.name();
               var item = new AngularFireItem(factory, ss, getIndex(prevId));
               if( filters[id] ) {
                  filtered[id] = [item, prevId];
               }
               else {
                  addChild(item, prevId);
               }
            }, function(e) { $log.debug(e); })]);

            subs.push(['child_removed', pathRef.on('child_removed', removeChild, function(e) { $log.warn(e); })]);

            subs.push(['child_changed', pathRef.on('child_changed', function(data, prevId) {
               $timeout(function() {
                  var index = indexes[data.name()];
                  var newIndex = getIndex(prevId);

                  updateChild(index, factory(data, index), data.getPriority());
                  if (newIndex !== index) {
                     moveChild(index, newIndex, collection[index]);
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
         };

         this._initFilter = function(filterPath, callback) {
            var ref = _.isString(filterPath)? new Firebase(filterPath) : filterPath;
            ref.once('value', function(ss) {
               filters = ss.val()||{};
               subs.push(['child_added', ref.on('child_added', function(ss) {
                  var id = ss.name();
                  filters[id] = true;
                  removeChild(id);
               }.bind(this), $log.debug.bind($log))]);
               subs.push(['child_removed', ref.on('child_removed', function(ss) {
                  var id = ss.name();
                  delete filters[id];
                  if(filtered[id]) {
                     var item = filtered[id][0], prevId = filtered[id][1];
                     item.$index = getIndex(prevId);
                     addChild(item, prevId);
                     delete filtered[id];
                  }
               }.bind(this), $log.debug.bind($log))]);
               callback();
            }.bind(this), function(err) {
               console.error(err);
            });
         };

         if( filterPath ) {
            this._initFilter(filterPath, this._init);
         }
         else {
            this._init();
         }

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
               //todo which seems unlikely but remotely possible
               angular.forEach(collection.slice(), function(item) {
                  if( item.$path === pathString ) {
                     removeChild(item.$id);
                  }
               });
            })
         };
      }

      ///////////// internal functions

      function getIndex(prevId) {
         return prevId ? indexes[prevId] + 1 : 0;
      }

      function addChild(item, prevId) {
         if( !indexes[item.$id] ) {
            // add item to the collection inside angular scope by using $timeout
            $timeout(function() {
               var index = getIndex(prevId);
               indexes[item.$id] = index;
               collection.splice(index, 0, item);
               updateIndexes(index);
               notify('added', item, index);
            });
         }
      }

      function removeChild(id) {
         var index = indexes[id];
         if( index >= 0 ) {
            // Remove the item from the collection inside angular scope by using $timeout
            $timeout(function() {
               index = indexes[id];
               if( index >= 0 ) {
                  var item = (collection.splice(index, 1)||[])[0];
                  delete indexes[id];
         //         console.log('removing child', item.$id, item.$path);
                  updateIndexes(index);
                  notify('removed', item, index);
               }
            })
         }
      }

      function updateChild (index, processedData, priority) {
         _.extend(collection[index], processedData);
         collection[index].$priority = priority;
         notify('updated', collection[index], index);
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

      function notify(event, item, index, oldIndex) {
         angular.forEach(listeners, function(props) {
            var fn = props[0];
            var type = props[1];
            (type === 'all' || type === event) && fn(item, event, index, oldIndex);
         });
      }

      return collection;
   };
}]);