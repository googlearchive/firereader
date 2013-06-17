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

      /**
       * This can be invoked to add additional paths after initialization
       *
       * @param {Firebase|String} path
       * @return {Promise}
       */
      collection.addPath = function(path) {
         console.log('addPath', path); //debug
         var def = $q.defer();
         new Path(path, function(ss) { def.resolve(ss); });
         return def.promise;
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
       * @param {String|Firebase} collectionUrlOrRef
       * @param {Function} [initialCb]
       * @constructor
       */
      function Path(collectionUrlOrRef, initialCb) {
         var pathRef;
         if (typeof collectionUrlOrRef == "string") {
            pathRef = new Firebase(collectionUrlOrRef);
         } else {
            // if it is not a string, it is already a Firebase ref
            pathRef = collectionUrlOrRef;
         }

         pathRef.on('child_added', function(data, prevId) {
            $timeout(function() {
               var index = getIndex(prevId), item = processItem(data, index);
               addChild(index, item);
               updateIndexes(index);
               $scope.$broadcast('angulareFireAggregateChildAdded', {id: item.$id, index: index, item: item});
            });
         });

         pathRef.on('child_removed', function(data) {
            //todo broakdacst to scope
            $timeout(function() {
               var id = data.name();
               var pos = indexes[id];
               var item = collection[pos];
               removeChild(id);
               updateIndexes(pos);
               $scope.$broadcast('angulareFireAggregateChildRemoved', {id: id, index: pos, item: item});
            });
         });

         pathRef.on('child_changed', function(data, prevId) {
            //todo broadcast to scope
            $timeout(function() {
               var index = indexes[data.name()];
               var newIndex = getIndex(prevId);
               var item = processItem(data, index);

               updateChild(index, item);
               if (newIndex !== index) {
                  moveChild(index, newIndex, item);
               }
               $scope.$broadcast('angulareFireAggregateChildChanged', {id: item.$id, index: newIndex, oldIndex: index});
            });
         });

         pathRef.on('child_moved', function(ref, prevId) {
            $timeout(function() {
               var oldIndex = indexes[ref.name()];
               var newIndex = getIndex(prevId);
               var item = collection[oldIndex];
               moveChild(oldIndex, newIndex, item);
               $scope.$broadcast('angulareFireAggregateChildMoved', {id: item.$id, index: newIndex, oldIndex: oldIndex});
            });
         });

         // putting this at the end makes performance appear considerably faster
         // since child_added callbacks start immediately instead of after entire
         // data set is loaded on server
         if (initialCb && typeof initialCb == 'function') {
            pathRef.once('value', initialCb);
         }
      }

      ///////////// internal functions

      //todo this could have some unforseen side effects; the idea of using prevId with multiple paths
      //todo should be evaluated and tested against some different use cases
      function getIndex(prevId) {
         return prevId ? indexes[prevId] + 1 : 0;
      }

      function addChild(index, item) {
         indexes[item.$id] = index;
         collection.splice(index, 0, item);
      }

      function removeChild(id) {
         var index = indexes[id];
         // Remove the item from the collection.
         collection.splice(index, 1);
         indexes[id] = undefined;
      }

      function updateChild (index, item) {
         collection[index] = item;
      }

      function moveChild (from, to, item) {
         collection.splice(from, 1);
         collection.splice(to, 0, item);
         updateIndexes(from, to);
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

      function processItem(data, index) {
         var out = opts.factory(data, index);
         out.$id = data.name();
         out.$index = index;
         return out;
      }

      //////////////// process and create the aggregated Collection

      opts = angular.extend({
         factory: function(ref, index) { return new AngularFireItem(ref, index); },
         paths: null,
         callback: null
      }, opts);

      if( opts.paths ) {
         // if any paths were passed in via opts, then add and fetch them now
         var promises = [];
         for(var i = 0; i < opts.paths.length; i++) {
            promises.push(collection.addPath(opts.paths[i]));
         }
         // if there is a callback, wait for all the paths to initialize and then invoke it
         opts.callback && $q.all(promises).then(opts.callback);
      }

      return collection;
   };
}]);