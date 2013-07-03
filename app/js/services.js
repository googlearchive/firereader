(function(angular) {

   "use strict";

   // number of articles to show per feed
   var FB_DEMO_LIMIT = 5;
   var FB_LIVE_LIMIT = 25;

   var appServices = angular.module('myApp.services', []);

   /**
    * A simple utility to create Firebase URLs from a list of parameters
    * by joining them to the base URL for this instance (defined in FIREBASE_URL above)
    */
   appServices.factory('fbUrl', ['FIREBASE_URL', function(URL) {
      /**
       * Any number of arguments may be passed into this function. They can be strings or arrays
       */
      return function() {
         var args = _.flatten(_.toArray(arguments));
         return URL + args.join('/');
      }
   }]);

   /**
    * A utility to store variables in local storage, with a fallback to cookies if localStorage isn't supported.
    */
   appServices.factory('localStorage', ['$log', function($log) {
      //todo should handle booleans and integers more intelligently?
      var loc = {
         /**
          * @param {string} key
          * @param value  objects are converted to json strings, undefined is converted to null (removed)
          * @returns {localStorage}
          */
         set: function(key, value) {
//               $log.debug('localStorage.set', key, value);
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
//               $log.debug('localStorage.remove', key);
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
         $log.info('resetting localStorage values');
         _.each(['authUser', 'authProvider', 'sortBy'], loc.remove);
      };

      return loc;
   }]);

   /**
    * A diff utility that compares arrays and returns a list of added, removed, and updated items
    */
   appServices.factory('listDiff', ['$log', function($log) {
      function _map(list, hashFn) {
         var out = {};
         _.each(list, function(x) {
            out[ hashFn(x) ] = x;
         });
         return out;
      }

      function diff(old, curr, hashFn) {
         var out = {
            count: 0,
            added: [],
            removed: []
         };

         if( !old && curr ) {
            out.added = curr.slice(0);
         }
         else if( !curr && old ) {
            out.removed = old.slice(0);
         }
         else if( hashFn ) {
            //todo this could be more efficient (it's possibly worse than o(n) right now)
            var oldMap = _map(old, hashFn), newMap = _map(curr, hashFn);
            out.removed = _.filter(oldMap, function(x,k) { return !_.has(newMap, k); });
            out.added = _.filter(newMap, function(x,k) { return !_.has(oldMap, k); });
         }
         else {
            // these don't work for angularFire because it returns different objects in each set and === is used to compare
            out.removed = _.difference(old, curr);
            out.added = _.difference(curr, old);
         }
         out.count = out.removed.length + out.added.length;
         return out;
      }

      return {
         diff: diff,
         watch: function($scope, varName, callback, hashFn) {
            //todo add a dispose method
            return $scope.$watch(varName, function(newVal, oldVal) {
               var out = diff(oldVal, newVal, hashFn);
//                  console.log('listDiff', out);
               if( out.count ) {
                  callback(out);
               }
            }, true);
         }
      };
   }]);

   /**
    * A diff utility that compares objects (only one level deep) and returns a list
    * of added, removed, and updated elements.
    */
   appServices.factory('treeDiff', function() {
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
   });

   /**
    * A simple utility to monitor changes to authentication and store the results
    * in the $rootScope for global access
    */
   appServices.factory('authScopeManager', ['$rootScope', '$timeout', 'localStorage', function($rootScope, $timeout, localStorage) {
      return function() {
         $rootScope.auth = {
            authenticated: false,
            user: null,
            name: null,
            provider: localStorage.get('authProvider')
         };

         $rootScope.$on('firebaseAuth::login', _set);
         $rootScope.$on('firebaseAuth::error', _unset);
         $rootScope.$on('firebaseAuth::logout', _unset);

         function parseName(user) {
            switch(user.provider) {
               case 'persona':
                  return (user.id||'').replace(',', '.');
               default:
                  return user.id;
            }
         }

         function _set(evt, args) {
            $timeout(function() {
               $rootScope.auth = {
                  authenticated: true,
                  user: args.user.id,
                  name: parseName(args.user),
                  provider: args.user.provider
               };
               localStorage.set('authProvider', args.user.provider);
            });
         }

         function _unset() {
            $timeout(function() {
               $rootScope.auth = {
                  authenticated: false,
                  user: null,
                  provider: $rootScope.auth && $rootScope.auth.provider
               };
            });
         }
      }
   }]);

   /**
    * A service that authenticates against Fireabase using simple login
    */
   appServices.factory('firebaseAuth', ['$log', '$rootScope', 'FIREBASE_URL', '$location', 'authScopeManager', function($log, $rootScope, FIREBASE_URL, $location, authScopeManager) {
      return function() {
         authScopeManager();

         // establish Firebase auth monitoring
         var authClient = new FirebaseAuthClient(new Firebase(FIREBASE_URL), _statusChange);

         // whenever authentication status changes, broadcast change to all scopes
         function _statusChange(error, user) {
            if( error ) {
               $log.error('FirebaseAuth::error', error, user);
               $rootScope.$broadcast('firebaseAuth::error', {error: error, user: user});
            }
            else if( user ) {
               $log.info('FirebaseAuth::login', user);
               $rootScope.$broadcast('firebaseAuth::login', {user: user});
               if( !($location.path()||'').match('/hearth') ) {
                  $location.path('/hearth');
               }
            }
            else {
               $log.info('FirebaseAuth::logout');
               $rootScope.$broadcast('firebaseAuth::logout', {});
               $location.path('/demo');
            }
         }

         // provide some convenience methods to log in and out
         var fns = {
            login: function(providerId) {
               $log.log('logging in', providerId);
               authClient.login(providerId, { rememberMe: true });
            },
            logout: function() {
               $log.log('logging out');
               authClient.logout();
            }
         };

         angular.extend($rootScope, fns);

         return fns;
      }
   }]);

   /**
    * A service that shows full article content as a popup
    */
   appServices.factory('showArticle', ['$log', '$compile', '$http', function($log, $compile, $http) {
      return {
         init: function($scope, articleManager) {
            $scope.showArticle = function(article) {
               $scope.article = article;
               $scope.openArticle = true;
               if( $(window).width() <= 480 ) {
                  window.scrollTo(0,0);
               }
            };
            $scope.closeArticle = function() {
               $scope.article = null;
               $scope.openArticle = false;
            };
            $scope.nextArticle = function(id) {
               // we can't look these up using $scope.filteredArticles because they
               // are not sorted until they get to isotope, so look at actual dom elements
               var els = angular.element('#feeds').data('isotope').$filteredAtoms;
               var i = els.length, nextId;
               while(i--) {
                  if( els[i].id === id ) {
                     nextId = els[i+1] && els[i+1].id;
                     break;
                  }
               }
               if( nextId ) {
                  //todo this requires two iterations of the list; one as isotope objects
                  //todo and a second inside angularFireAggregate's find() method; optimize?
                  $scope.article = $scope.articles.find(nextId);
               }
               else {
                  $scope.closeArticle();
               }
            };
            $scope.prevArticle = function(id) {
               // we can't look these up using $scope.filteredArticles because they
               // are not sorted until they get to isotope, so look at actual dom elements
               var els = angular.element('#feeds').data('isotope').$filteredAtoms;
               var i = els.length, prevId;
               while(i--) {
                  if( els[i].id === id ) {
                     prevId = els[i-1] && els[i-1].id;
                     break;
                  }
               }
               if( prevId ) {
                  //todo this requires two iterations of the list; one as isotope objects
                  //todo and a second inside angularFireAggregate's find() method; optimize?
                  $scope.article = $scope.articles.find(prevId);
               }
               else {
                  $scope.closeArticle();
               }
            }
         }
      }
   }]);

   /**
    * A common set of controller logic used by DemoCtrl and HearthCtrl for managing
    * scope and synching feeds and articles with Firebase
    */
   appServices.factory('FeedManager', ['$log', '$timeout', 'ArticleManager', 'feedChangeApplier', 'initScopeUtils', function($log, $timeout, ArticleManager, feedChangeApplier, initScopeUtils) {
      return function($scope, userId) {
         var inst = {
            getFeeds: function() {
               return $scope.feeds;
            },
            makeFeed: function(choiceOrId) {
               var choice = angular.isObject(choiceOrId)? choiceOrId : findChoice(choiceOrId);
               return {
                  title: choice.title,
                  id: choice.$id,
                  last: Date.now()
               };
            },
            removeFeed: function(feedId) {
               $timeout(function() {
                  delete $scope.feeds[feedId];
               });
            },
            getFeed: function(feedId) {
               return $scope.getFeed(feedId);
            },
            baseLink: _.memoize(function(feedId) {
               return findChoice(feedId).link;
            })
         };

         var findChoice = _.memoize(function(feedId) {
            return _.find($scope.feedChoices, function(f) { return f.$id === feedId })||{};
         });

         initScopeUtils($scope);
         feedChangeApplier($scope, inst, new ArticleManager(inst, $scope), userId);

         return inst;
      }
   }]);

   /**
    * Some straightforward scope methods for dealing with feeds and articles; these have no dependencies
    */
   appServices.factory('initScopeUtils', ['localStorage', function(localStorage) {
      return function($scope) {
         //todo shouldn't need this; can't get feeds.length === 0 to work from directives
         $scope.noFeeds = true;
         //todo snag this from $location?
         $scope.link = $scope.isDemo? 'demo' : 'hearth';

         $scope.getFeed = function(feedId) {
            return $scope.feeds[feedId]||{};
         };

         $scope.isActive = function(feedId) {
            return $scope.activeFeed === feedId;
         };

         $scope.showAllFeeds = function() {
            return !$scope.activeFeed;
         };

         $scope.sortField = 'time';

         $scope.$watch('sortDesc', function() {
            //todo store in firebase
            localStorage.set('sortDesc', $scope.sortDesc);
         });

         $scope.sortDesc = localStorage.get('sortDesc');
         if( $scope.sortDesc === null ) {
            $scope.sortDesc = true;
         }
      }
   }]);

   /**
    * A change listener that updates the feedManager and articleManager, as well as
    * making some minor scope manipulations
    */
   appServices.factory('feedChangeApplier', ['$log', 'treeDiff', 'fbUrl', 'angularFire', '$timeout',
      function($log, treeDiff, fbUrl, angularFire, $timeout) {
         return function($scope, feedManager, articleManager, userId) {
            // treeDiff gives a change list for the feeds object
            treeDiff($scope, 'feeds').watch(changed);

            function changed(changes, newVals, orig) {
               $log.debug('FeedManager::changes', changes, newVals, orig);
               _.each(['added', 'updated', 'removed'], function(type) {
                  _.each(changes[type], function(key) {
                     var feed = type === 'removed'? orig[key] : newVals[key];
                     switch(type) {
                        case 'removed':
                           articleManager.removeFeed(feed);
                           break;
                        case 'added':
                           articleManager.addFeed(feed);
                           break;
                        default:
                        // do nothing
                     }
                  });
               });
               $scope.noFeeds = _.isEmpty($scope.feeds);
            }

            // when the active feed is changed (generally by url hash; see app.js routing) then
            // we update the sort filter used by isotope
            $scope.$watch('activeFeed', setFilter);
            function setFilter() {
               $scope.sortFilter = $scope.activeFeed? '[data-feed="'+$scope.activeFeed+'"]' : false;
            }
            setFilter();

            if( userId === 'demo' ) {
               // read only
               new Firebase(fbUrl('myfeeds', 'demo')).once('value', function(ss) {
                  $timeout(function() {
                     $scope.feeds = ss.val();
                  })
               });
            }
            else {
               // 2-way synchronize
               angularFire(fbUrl('myfeeds', userId), $scope, 'feeds', {});
            }
         }
      }]);

   appServices.factory('ArticleManager', ['$log', 'angularFireAggregate', 'articleFactory', 'articleFilter', function($log, angularFireAggregate, articleFactory, articleFilter) {
      return function(feedManager, $scope) {
         var feeds = {};

         function feedPath(id) {
            var x = $scope.isDemo? FB_DEMO_LIMIT : FB_LIVE_LIMIT;
            return [new Firebase('https://feeds.firebaseio.com/'+id+'/articles').limit(x), id];
         }

         $scope.counts = {};
         $scope.articles = angularFireAggregate($scope, { factory: articleFactory(feedManager) });

         articleFilter($scope);

         $scope.articles.on('added', incFeed);
         angular.forEach(feedManager.getFeeds(), initFeed);

         function incFeed(article) {
            $scope.counts[article.feed]++;
         }

         function initFeed(feed) {
            if( !_.has(feeds, feed.id)) {
               $log.debug('initFeed', feed);
               feeds[feed.id] = $scope.articles.addPath(feedPath(feed.id));
               $scope.counts[feed.id] = 0;
            }
         }

         function removeFeed(feed) {
            var id = angular.isString(feed)? feed : feed.id;
            console.log('removing a path', id, feeds[id]); //debug
            feeds[id] && feeds[id].dispose();
         }

         $scope.feedName = function(article) {
            return feedManager.getFeed(article.feed).title || article.feed;
         };

         return {
            on: $scope.articles.on,
            addFeed: initFeed,
            removeFeed: removeFeed
         }
      }
   }]);

   appServices.factory('articleFilter', ['$timeout', '$filter', function($timeout, $filter) {
      return function($scope) {
         $scope.filteredArticles = [];
         var filterArticles = _.debounce(function() {
            $timeout(function() {
               $scope.filteredArticles = $filter('filter')($scope.articles, $scope.articleFilter);
            });
         }, 100);
         $scope.articles.on('added removed', filterArticles);
         $scope.$watch('articleFilter', filterArticles);
      };
   }]);

   appServices.factory('articleFactory', [function() {
      //todo move to an article parser service
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

      // we use a custom article factory because all the isotope and angular iterators run very slowly
      // when the Firebase reference is included in the object; $scope.$watch becomes completely unstable
      // and results in recursion errors; so don't include any of that in our objects
      return function(feedManager) {
         return function(snapshot, index) {
            var out = _.extend({
               feed: snapshot.ref().parent().parent().name()
            }, _.pick(snapshot.val(), 'title', 'description', 'summary', 'link', 'date'));
            var baseLink = feedManager.baseLink(out.feed);
            out.date = new Date(out.date).getTime();
            out.summary = fixRelativeLinks(out.summary, baseLink);
            out.description = fixRelativeLinks(out.description, baseLink);
            return out;
         }
      };
   }]);

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

})(angular);
