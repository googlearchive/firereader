(function(angular) {
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
         var filteredArticles = {};
         var filterMap = new FilterMap(applyFilter, unapplyFilter);

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
         collection.addPath = function(feedId, factory, path, filterPath) {
            return new Path(feedId, factory, path, null, filterPath);
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
            collection = []; // ordered list of records
            paths = [];      // Path objects containing the feeds being monitored
            indexes = {};    // Map of record ids to indices in collection
            listeners = [];  // event listeners attached to this collection
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
         function Path(feedId, factory, urlOrRef, initialCb, filterPath) {
            var subs = [];
            var pathRef = angular.isArray(urlOrRef)? urlOrRef[0] : urlOrRef;
            if (typeof pathRef == "string") {
               pathRef = new Firebase(pathRef);
            }

            this._init = function() {
               subs.push(['child_added', pathRef.on('child_added', function(ss, prevId) {
                  var id = ss.name();
                  var item = new AngularFireItem(factory, ss, getIndex(prevId));
                  if( filterMap.isFiltered(item.$feed, item.$id) ) {
                     filteredArticles[id] = [item, prevId];
                  }
                  else {
                     addChild(item, prevId);
                  }
               }, function(e) { $log.debug(e); })]);

               subs.push(['child_removed', pathRef.on('child_removed', function(snap) {
                  delete filteredArticles[snap.name()];
                  removeChild(snap.name());
               }, function(e) { $log.warn(e); })]);

               subs.push(['child_changed', pathRef.on('child_changed', function(snap, prevId) {
                  var id = snap.name();
                  if( filteredArticles[id] ) {
                     _.extend(filteredArticles[id][0], snap.val());
                     filteredArticles[id][0].$priority = snap.getPriority();
                  }
                  else if( indexes.hasOwnProperty(id) ) {
                     var index = indexes[id];
                     var newIndex = getIndex(prevId);
                     updateChild(index, factory(snap, index), snap.getPriority());
                     if (newIndex !== index) {
                        moveChild(index, newIndex, collection[index]);
                     }
                  }
               })]);

               subs.push(['child_moved', pathRef.on('child_moved', function(snap, prevId) {
                  var id = snap.name();
                  if( filteredArticles[id] ) {
                     filteredArticles[id].$priority = snap.getPriority();
                  }
                  else if( indexes.hasOwnProperty(id) ) {
                     var oldIndex = indexes[id];
                     var newIndex = getIndex(prevId);
                     var item = collection[oldIndex];
                     item.$priority = snap.getPriority();
                     moveChild(oldIndex, newIndex, item);
                  }
               })]);
            };

            if( filterPath ) {
               filterMap.addPath(filterPath);
               filterPath.once('value', this._init.bind(this));
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
               filterPath && filterMap.removePath(filterPath.ref().name());
               _.each(subs, function(s) {
                  pathRef.off(s[0], s[1]);
               });
               pathRef = null;
               //todo this will not work if using two refs that access the same path
               //todo which seems unlikely but remotely possible
               angular.forEach(collection.slice(), function(item) {
                  if( item.$feed === feedId ) {
                     removeChild(item.$id);
                  }
               });
            };
         }

         function applyFilter(articleId) {
            if( indexes.hasOwnProperty(articleId) ) {
               var index = indexes[articleId];
               var item = collection[index];
               var prevId = index > 0? collection[index-1].$id : null;
               filteredArticles[articleId] = [item, prevId];
               removeChild(articleId);
            }
         }

         function unapplyFilter(articleId) {
            if(filteredArticles[articleId]) {
               var item = filteredArticles[articleId][0], prevId = filteredArticles[articleId][1];
               addChild(item, prevId);
               delete filteredArticles[articleId];
            }
         }

         ///////////// internal functions

         function getIndex(prevId) {
            return prevId? (indexes.hasOwnProperty(prevId)? + 1 : collection.length) : 0;
         }

         function addChild(item, prevId) {
            if( !indexes[item.$id] ) {
               var index = getIndex(prevId);
               item.$index = index;
               indexes[item.$id] = index;
               collection.splice(index, 0, item);
               updateIndexes(index);
               // add item to the collection inside angular scope by using $timeout
               $timeout(function() {
                  notify('added', item, index);
               });
            }
         }

         function removeChild(id) {
            if( indexes.hasOwnProperty(id) ) {
               var index = indexes[id];
               var item = (collection.splice(index, 1)||[])[0];
               delete indexes[id];
               updateIndexes(Math.max(index-1, 0));
               notify('removed', item, index);
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
            $timeout(function() {
               angular.forEach(listeners, function(props) {
                  var fn = props[0];
                  var type = props[1];
                  (type === 'all' || type === event) && fn(item, event, index, oldIndex);
               });
            })
         }

         return collection;
      };

   }]);

   function Filter(ref, filterFn, unfilterFn) {
      var id = this.id = ref.ref().name();
      var subs = [];

      this.added = function(snap) {
         filterFn(id, snap.name());
      }.bind(this);

      this.removed = function(snap) {
         unfilterFn(id, snap.name());
      }.bind(this);

      this.dispose = function(snap) {
         angular.forEach(subs, function(parts) {
            ref.off(parts[0], parts[1]);
         });
      }.bind(this);

      subs.push(['child_added', ref.on('child_added', this.added)]);
      subs.push(['child_removed', ref.on('child_removed', this.removed)]);
   }

   function FilterMap(applyFilter, unapplyFilter) {
      this.addFn = applyFilter;
      this.remFn = unapplyFilter;
      this.filtered = {};
      this.filters = {};
   }

   FilterMap.prototype = {
      isFiltered: function(feedId, articleId) {
         return !!(this.filtered[feedId] && this.filtered[feedId][articleId]);
      },

      applyFilter: function(feedId, articleId) {
         this.filtered[feedId][articleId] = true;
         this.addFn(articleId, feedId);
      },

      unapplyFilter: function(feedId, articleId) {
         delete this.filtered[feedId][articleId];
         this.remFn(articleId, feedId);
      },

      addPath: function(feedRef) {
         var id = feedRef.ref().name();
         this.filtered[id] = {};
         var f = new Filter(feedRef, this.applyFilter.bind(this), this.unapplyFilter.bind(this));
         this.filters[id] = f;
         return f;
      },

      removePath: function(feedId) {
         var unapply = this.unapplyFilter.bind(this);
         if( this.filters[feedId] ) {
            this.filters[feedId].dispose();
            delete this.filters[feedId];
         }
         if( this.filtered[feedId] ) {
            angular.forEach(this.filtered[feedId], function(b, articleId) {
               unapply(feedId, articleId);
            });
            delete this.filtered[feedId];
         }
      },

      dispose: function() {
         angular.forEach(this.filters, function(f) {
            f.dispose();
         });
      }
   };
})(angular);