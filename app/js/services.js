(function(angular) {

   "use strict";

   angular.module('myApp.services', [])
      .value('version', '0.1')

      .value('debugLevel', 0)// 0=log, 1=info, 2=warn, 3=error, 99=off

      .value('FIREBASE_URL', 'https://fireplace.firebaseio.com/')

      .value('authProviders', [
         { id: 'persona',  name: 'Persona',  icon: 'icon-user'     },
         { id: 'twitter',  name: 'Twitter',  icon: 'icon-twitter'  },
         { id: 'facebook', name: 'Facebook', icon: 'icon-facebook' },
         { id: 'github',   name: 'GitHub',   icon: 'icon-github'   }
//         { id: 'email',    name: 'Email',    icon: 'icon-envelope' }
      ])

      /**
       * A simple utility to create Firebase URLs from a list of parameters
       * by joining them to the base URL for this instance (defined in FIREBASE_URL above)
       */
      .factory('fbUrl', ['FIREBASE_URL', function(URL) {
         /**
          * Any number of arguments may be passed into this function. They can be strings or arrays
          */
         return function() {
            var args = _.flatten(_.toArray(arguments));
            return URL + args.join('/');
         }
      }])

      /**
       * A rudimentary logging tool that allows logging to be filtered on the fly by changing
       * debugLevel above.
       */
      .factory('logger', ['debugLevel', '$rootScope', function(debugLevel, $rootScope) {
         return $rootScope.logger = new Logger(debugLevel);
      }])

      /**
       * A utility to store variables in local storage, with a fallback to cookies if localStorage isn't supported.
       */
      .factory('localStorage', ['logger', function(logger) {
         //todo should handle booleans and integers more intelligently?
         var loc = {
            /**
             * @param {string} key
             * @param value  objects are converted to json strings, undefined is converted to null (removed)
             * @returns {localStorage}
             */
            set: function(key, value) {
               logger('localStorage.set', key, value);
               var undefined;
               if( value === undefined || value === null ) {
                  // storing a null value returns "null" (a string) when get is called later
                  // so to make it actually null, just remove it, which returns null
                  loc.remove(key);
               }
               else {
                  value = angular.toJson(value);
                  if( typeof(localStorage) === 'undefined' ) {
                     cookie(key, value);
                  }
                  else {
                     localStorage.setItem(key, value);
                  }
               }
               return loc;
            },
            /**
             * @param {string} key
             * @returns {*} the value or null if not found
             */
            get: function(key) {
               logger('localStorage.get', key);
               var v = null;
               if( typeof(localStorage) === 'undefined' ) {
                  v = cookie(key);
               }
               else {
                  //todo should reconstitute json values upon retrieval
                  v = localStorage.getItem(key);
               }
               return angular.fromJson(v);
            },
            /**
             * @param {string} key
             * @returns {localStorage}
             */
            remove: function(key) {
               logger('localStorage.remove', key);
               if( typeof(localStorage) === 'undefined' ) {
                  cookie(key, null);
               }
               else {
                  localStorage.removeItem(key);
               }
               return loc;
            }
         };

         //debug just a temporary tool for debugging and testing
         angular.resetLocalStorage = function() {
            logger('resetting localStorage values');
            _.each(['authUser', 'authProvider', 'sortBy'], loc.remove);
         };

         return loc;
      }])

      .factory('observable', function() {
         return function(inst) {
            var listeners = [];
            var obs = {
               on: function(event, callback) {
                  if( angular.isFunction(event) ) {
                     callback = event;
                     event = 'all';
                  }
                  angular.forEach(event.split(' '), function(e) {
                     listeners.push([callback, e]);
                  });
               },
               notify: function(event, data) {
                  angular.forEach(listeners, function(props) {
                     var fn = props[0];
                     var t = props[1];
                     if( t === 'all' || t === event ) {
                        //todo should we defer here
                       fn(data, event);
                     }
                  });
               }
            };
            inst && angular.extend(inst, obs);
            return obs;
         }
      })

      .factory('treeDiff', function() {
         return function($scope, variableName) {
            var orig = copy($scope[variableName]);
            var listeners = [];

            function copy(orig) {
               var cloned = {};
               orig && _.each(orig, function(v,k) {
                  cloned[k] = _.isArray(v)? v.slice(0) : (_.isObject(v)? _.clone(v) : v);
               });
               return cloned;
            }


            function update(newVal) {
               newVal || (newVal = {});
               var changes = diff(orig, newVal);
               if( changes.count ) {
                  notify(changes, newVal, orig);
                  orig = copy(newVal);
               }
            }

            function diff(orig, updated) {
               var newKeys = _.keys(updated), oldKeys = _.keys(orig);
               var removed = _.difference(oldKeys, newKeys);
               var added = _.difference(newKeys, oldKeys);
               var union = _.union(newKeys, oldKeys);

               var changes = {
                  count: removed.length+added.length,
                  added: added,
                  removed: removed,
                  updated: []
               };

               _.each(union, function(k) {
                  if( !_.isEqual(orig[k], updated[k]) ) {
                     changes.updated.push(k);
                     changes.count++;
                  }
               });

               return changes;
            }

            function notify(changes, newVal, orig) {
               _.each(listeners, function(fn) { fn(changes, newVal, orig); });
            }

            $scope.$watch(variableName, update, true);

            return {
               orig: function() {
                  return orig;
               },
               diff: diff,
               watch: function(callback) {
                  listeners.push(callback);
               }
            }
         }
      })

      .factory('authScopeManager', ['$rootScope', '$timeout', 'localStorage', function($rootScope, $timeout, localStorage) {
         $rootScope.auth = {
            authenticated: false,
            user: localStorage.get('authUser'),
            provider: localStorage.get('authProvider')
         };

         $rootScope.$on('firebaseAuth::login', _set);
         $rootScope.$on('firebaseAuth::error', _unset);
         $rootScope.$on('firebaseAuth::logout', _unset);

         function _set(evt, args) {
            $timeout(function() {
               $rootScope.auth = {
                  authenticated: true,
                  user: args.user.id,
                  provider: args.user.provider
               };
               localStorage.set('authProvider', args.user.provider);
               localStorage.set('authUser', args.user.id);
            });
         }

         function _unset() {
            $timeout(function(evt, args) {
               $rootScope.auth.authenticated = false;
            });
         }
      }])

      .factory('firebaseAuth', ['$rootScope', 'FIREBASE_URL', function($rootScope, FIREBASE_URL) {

         var logger = $rootScope.logger;

         // establish Firebase auth monitoring
         var authClient = new FirebaseAuthClient(new Firebase(FIREBASE_URL), _statusChange);

         // whenever authentication status changes, broadcast change to all scopes
         function _statusChange(error, user) {
            if( error ) {
               logger.error('FirebaseAuth::error', error, user);
               $rootScope.$broadcast('firebaseAuth::error', {error: error, user: user});
            }
            else if( user ) {
               logger.info('FirebaseAuth::login', user);
               $rootScope.$broadcast('firebaseAuth::login', {user: user});
            }
            else {
               logger.info('FirebaseAuth::logout');
               $rootScope.$broadcast('firebaseAuth::logout', {});
            }
         }

         // provide some convenience methods to log in and out
         var fns = {
            login: function(providerId) {
               logger('logging in', providerId);
               authClient.login(providerId, { rememberMe: true });
            },
            logout: function() {
               logger('logging out');
               authClient.logout();
            }
         };

         angular.extend($rootScope, fns);

         return fns;
      }])

      .factory('FeedManager', ['angularFire', 'fbUrl', 'localStorage', '$timeout', 'observable', 'treeDiff', function(angularFire, fbUrl, localStorage, $timeout, observable, treeDiff) {
         return function($scope, userId) {
            var activatedFeeds = {};
            var inst = {
               getFeeds: function() {
                  return $scope.feeds;
               },
               makeFeed: function(choiceOrId) {
                  var choice = angular.isObject(choiceOrId)? choiceOrId : findChoice(choiceOrId);
                  return {
                     title: choice.title,
                     id: choice.$id,
                     active: true,
                     last: Date.now()
                  };
               },
               getFeed: function(feedId) {
                  return $scope.getFeed(feedId);
               },
               baseLink: _.memoize(function(feedId) {
                  return findChoice(feedId).link;
               }),
               isActive: function(feedId) {
                  return $scope.getFeed(feedId).active;
               }
            };
            var obs = observable(inst);

            $scope.noFeeds = false;
            _.delay(function() {
               $scope.noFeeds = _.isEmpty($scope.feeds);
            }, 1000);

            $scope.getFeed = function(feedId) {
               return $scope.feeds[feedId]||{};
            };
            angularFire(fbUrl('myfeeds', userId), $scope, 'feeds', {});

            treeDiff($scope, 'feeds').watch(changed);

            // observer model
            function changed(changes, newVals, orig) {
               $scope.logger('FeedManager::changes', changes, newVals, orig);
               _.each(['added', 'updated', 'removed'], function(type) {
                  _.each(changes[type], function(key) {
                     var feed = type === 'removed'? orig[key] : newVals[key];
                     obs.notify(type, feed);
                     if( wasActivated(newVals[key]) ) {
                        activatedFeeds[feed.id] = true;
                        obs.notify('activated', newVals[key]);
                     }
                  });
               });
               $scope.noFeeds = _.isEmpty($scope.feeds);
            }

            function wasActivated(feed) {
               return feed && feed.active && !activatedFeeds[feed.id];
            }

            var findChoice = _.memoize(function(feedId) {
               return _.find($scope.feedChoices, function(f) { return f.$id === feedId })||{};
            });

            return inst;
         }
      }])

      .factory('ArticleManager', ['angularFireAggregate', function(angularFireAggregate) {
         return function(feedManager, $scope) {
            // we use a custom article factory because all the isotope and angular iterators run very slowly
            // when the Firebase reference is included in the object; $scope.$watch becomes completely unstable
            // and results in recursion errors; so don't include any of that in our objects
            function articleFactory(snapshot, index) {
               var out = _.extend({
                  feed: snapshot.ref().parent().parent().name()
               }, _.pick(snapshot.val(), 'title', 'description', 'link', 'date'));
               out.date = new Date(out.date).getTime();
               out.description = fixRelativeLinks(out.description, feedManager.baseLink(out.feed));
               return out;
            }

            function feedPath(id) {
               return new Firebase('https://feeds.firebaseio.com/'+id+'/articles').limit(5); //todo set limit from config?
            }

            $scope.counts = {};
            $scope.articles = angularFireAggregate($scope, { factory: articleFactory });

            feedManager.on('added activated', initFeed);
            $scope.articles.on('added', incFeed);

            angular.forEach(feedManager.getFeeds(), initFeed);

            function incFeed(article) {
               $scope.counts[article.feed]++;
            }

            function initFeed(feed) {
               if( feed.active && !_.has($scope.counts, feed.id)) {
                  $scope.logger('initFeed', feed);
                  $scope.articles.addPath(feedPath(feed.id));
                  $scope.counts[feed.id] = 0;
               }
            }

            $scope.isFiltered = function(article) {
               return !feedManager.isActive(article.feed);
            };

            function fixRelativeLinks(txt, baseUrl) {
               if( !baseUrl ) { return txt; }
               return txt.replace(/(href|src)=(['"])([^'"]+)['"]/g, function(match, p1, p2, p3) {
                  if( !p3.match(/^(mailto:|[a-z][-a-z0-9\+\.]*:\/\/)/) ) {
                     match = p1 + '=' + p2 + _prefix(baseUrl, p3) + p2;
                  }
                  return match;
               });
            }

            function _prefix(base, url) {
               while(url.match(/^..\//)) {
                  url = url.substr(3);
                  base = base.replace(/[^/]+\/$/, '');
               }
               return base+url.replace(/^\//, '');
            }

            return {
               on: $scope.articles.on
            }
         }
      }])

      .factory('SortManager', ['localStorage', function(localStorage) {
         return function($scope) {
            $scope.sortBy = localStorage.get('sortBy')||'Newest';
            $scope.sortField = 'time';
            $scope.sortDesc = true;

            $scope.$watch('sortBy', setSortField);
            setSortField();

            function setSortField() {
               $scope.sortField = $scope.sortBy === 'Title'? 'title' : 'time';
               $scope.sortDesc = $scope.sortBy === 'Newest';
            }

            return {
               sortCallback: function(sortFn) {
                  return function() {
                     sortFn($scope.sortField, $scope.sortDesc);
                  }
               },
               sortWhen: function(sortFn) {
                  _.each(['sortField', 'sortDesc'].concat(_.toArray(arguments).slice(1)), function(key) {
                     console.log('watching', key); //debug
                     $scope.$watch(key, function() {
                        console.log('resorted by', key); //debug
                        sortFn($scope.sortField, $scope.sortDesc, true);
                     })
                  });
               }
            }
         }
      }])

      .factory('masonry', ['logger', function(logger) {
         return function(elementSelector, sortBy, sortDescending) {
            logger('masonry loaded', elementSelector);

            var $el = $(elementSelector);

            logger('$el', $el);

            $el.isotope({
               itemSelector : 'article',
               resizable: true,
               layoutMode: 'masonry',
               masonry: {
                  columnWidth:  10,
                  columnHeight: 10
               },
               filter: ":not(.filtered)",
               sortBy: sortBy,
               sortAscending: !sortDescending,
               getSortData: {
                  time: function($elem) {
                     return parseInt($elem.attr('data-time'));
                  },
                  title: function($elem) {
                     return $elem.find('h2').text();
                  }
               }
            });

            // allows the grid to be resorted at any time by calling this function
            // since it is throttled (via _.debounce) there is no concern about performance
            // if it is called repeatedly
            return _.debounce(function(sortBy, sortDescending) {
               logger('resorting', elementSelector, sortBy, sortDescending); //debug
               $el.isotope( 'reloadItems' ).isotope({ sortBy: sortBy, sortAscending: !sortDescending });
            }, 250);
         }
      }])

      .factory('DemoFeedManager', ['FeedManager', function(FeedManager) {
         return function($scope) {
            $scope.isDemoFeed = true;
            return angular.extend(new FeedManager($scope, 'demo'), {
               addFeed: function() { throw new Error('addFeed not available for demo mode'); },
               addCustomFeed: function() { throw new Error('addCustomFeed not available for demo mode'); }
            });
         }
      }])

      //todo-hack get these services that set rootScope items initialized
      //todo-hack should probably be their own modules?
      //todo-hack or maybe give these init() methods and put them in app.run()
      .run(['logger', /*'userScopeManager',*/ 'authScopeManager', 'firebaseAuth', function() {}]);

   function cookie(key, value, options) {
      // key and at least value given, set cookie...
      if (arguments.length > 1 && String(value) !== "[object Object]") {
         options = angular.extend({ path: '/', expires: 365 }, options);

         if (value === null || value === undefined) {
            options.expires = -1;
         }

         if (typeof options.expires === 'number') {
            var days = options.expires, t = options.expires = new Date();
            t.setDate(t.getDate() + days);
         }

         value = String(value);

         return (document.cookie = [
            encodeURIComponent(key), '=',
            options.raw ? value : encodeURIComponent(value),
            options.expires ? '; expires=' + options.expires.toUTCString() : '', // use expires attribute, max-age is not supported by IE
            options.path ? '; path=' + options.path : '',
            options.domain ? '; domain=' + options.domain : '',
            options.secure ? '; secure' : ''
         ].join(''));
      }

      // key and possibly options given, get cookie...
      options = value || {};
      var result, decode = options.raw ? function (s) { return s; } : decodeURIComponent;
      return (result = new RegExp('(?:^|; )' + encodeURIComponent(key) + '=([^;]*)').exec(document.cookie)) ? decode(result[1]) : null;
   }

   function Logger(debugLevel) {
      var fn = function() {
         debugLevel <= 0 && console.log.apply(console, Array.prototype.slice.call(arguments, 0));
      };
      fn.log = fn;
      fn.info = function() {
         debugLevel <= 1 && console.info.apply(console, Array.prototype.slice.call(arguments, 0));
      };
      fn.warn = function() {
         debugLevel <= 2 && console.warn.apply(console, Array.prototype.slice.call(arguments, 0));
      };
      fn.error = function() {
         debugLevel <= 3 && console.error.apply(console, Array.prototype.slice.call(arguments, 0));
      };
      return fn;
   }

})(angular);
