(function(angular) {
   "use strict";
   var appServices = angular.module('myApp.services', ['myApp.utils', 'firebase', 'firebase.utils']);

   /**
    * A service that authenticates against Fireabase using simple login
    */
   appServices.factory('authManager', ['firebaseRef', '$firebaseSimpleLogin', 'authScopeUtil', 'authProviders', '$rootScope', function(firebaseRef, $firebaseSimpleLogin, authScopeUtil, authProviders, $rootScope) {
      var auth = $firebaseSimpleLogin(firebaseRef());
      var providers = {};
      angular.forEach(authProviders, function(p) {
         providers[p.id] = angular.extend({preferred: false}, p);
      });

      // provide some convenience wrappers on $firebaseSimpleLogin so it's easy to extend behavior and isolate upgrades
      var inst = {
         login: function(providerId) {
            auth.$login(providerId, { rememberMe: true, scope: 'email'});
         },

         logout: function() {
            $rootScope.$broadcast('authManager:beforeLogout', auth);
            auth.$logout();
         },

         getProviders: function() {
            return providers;
         },

         setPreferred: function(newProvider) {
            angular.forEach(providers, function(p, k) {p.preferred = (k === newProvider)});
         },

         addToScope: function($scope) {
            authScopeUtil($scope);
            $scope.login = inst.login;
            $scope.logout = inst.logout;
            $scope.providers = providers;
         }
      };

      return inst;
   }]);

   /**
    * A simple utility to monitor changes to authentication and set some values in scope for use in bindings/directives/etc
    */
   appServices.factory('authScopeUtil', ['$log', 'updateScope', 'localStorage', '$location', function($log, updateScope, localStorage, $location) {
      return function($scope) {
         $scope.auth = {
            authenticated: false,
            user: null,
            name: null,
            provider: localStorage.get('authProvider')
         };

         $scope.$on('$firebaseSimpleLogin:login', _loggedIn);
         $scope.$on('$firebaseSimpleLogin:error', function(err) {
            $log.error(err);
            _loggedOut();
         });
         $scope.$on('$firebaseSimpleLogin:logout', _loggedOut);

         function parseName(user) {
            return user.id;
         }

         function _loggedIn(evt, user) {
            localStorage.set('authProvider', user.provider);
            $scope.auth = {
               authenticated: true,
               user: user.id,
               name: parseName(user),
               provider: user.provider
            };
            updateScope($scope, 'auth', $scope.auth, function() {
               if( !($location.path()||'').match('/hearth') ) {
                  $location.path('/hearth');
               }
            });
         }

         function _loggedOut() {
            $scope.auth = {
               authenticated: false,
               user: null,
               name: null,
               provider: $scope.auth && $scope.auth.provider
            };
            updateScope($scope, 'auth', $scope.auth, function() {
               $location.search('feed', null);
               $location.path('/demo');
            });
         }
      }
   }]);

   /**
    * Some straightforward scope methods for dealing with feeds and articles; these have no dependencies
    */
   appServices.factory('feedScopeUtils', ['localStorage', '$timeout', '$location', function (localStorage, $timeout, $location) {
      return function ($scope, feedMgr) {
         $scope.showRead = false;
         $scope.feedName = feedMgr.feedName.bind(feedMgr);
         $scope.feeds = feedMgr.getFeeds();
         $scope.articles = feedMgr.getArticles();
         $scope.counts = feedMgr.articleManager.counts;
         $scope.feedChoices = feedMgr.getChoices();

         $scope.feeds.$on('change', function() {
            $scope.noFeeds = $scope.feeds.$getIndex().length === 0;
         });

         //todo snag this from $location?
         $scope.link = $scope.isDemo ? 'demo' : 'hearth';

         $scope.isActive = function (feedId) {
            return $scope.activeFeed === feedId;
         };

         $scope.showAllFeeds = function () {
            return !$scope.activeFeed;
         };

         $scope.openFeedBuilder = function ($event) {
            $event && $event.preventDefault();
            $scope.$broadcast('modal:customFeed');
         };

         $scope.openArticle = function (article, $event) {
            if ($event) {
               $event.preventDefault();
               $event.stopPropagation();
            }
            $scope.$broadcast('modal:article', article);
         };

         $scope.filterMethod = function (article) {
            return passesFilter(article) && notRead(article) && activeFeed(article);
         };

         $scope.orderMethod = function (article) {
            var v = article[$scope.sortField];
            return $scope.sortDesc ? 0 - parseInt(v) : parseInt(v);
         };

         $scope.markArticleRead = function (article, $event, noSave) {
            if ($scope.isDemo) {
               return;
            }
            if ($event) {
               $event.preventDefault();
               $event.stopPropagation();
            }
            var f = article.$feed;
            if (!_.has($scope.readArticles, f)) {
               $scope.readArticles[f] = {};
            }
            $scope.readArticles[f][article.$id] = Date.now();
            noSave || $scope.readArticles.$save(f);
         };

         $scope.markFeedRead = function (feedId, $event) {
            if ($event) {
               $event.preventDefault();
               $event.stopPropagation();
            }
            angular.forEach($scope.articles, function(article) {
               if (article.$feed === feedId) {
                  $scope.markArticleRead(article, null, true);
               }
            });
            $scope.counts[feedId] = 0;
            $scope.readArticles.$save();
         };

         $scope.markAllFeedsRead = function ($event) {
            if ($event) {
               $event.preventDefault();
               $event.stopPropagation();
            }
            angular.forEach($scope.feeds, function (feed) {
               $scope.markFeedRead(feed.$id, $event);
            });
         };

         $scope.noVisibleArticles = function () {
            return !$scope.loading && !$scope.noFeeds && countActiveArticles() === 0;
         };

         var to;
         $scope.startLoading = function () {
            $scope.loading = true;
            to && $timeout.cancel(to);
            to = $timeout(function () {
               $scope.loading = false;
            }, 4000);
            return to;
         };

         $scope.stopLoading = function () {
            to && $timeout.cancel(to);
            to = null;
            if ($scope.loading) {
               $timeout(function () {
                  $scope.loading = false;
               });
            }
         };

         $scope.sortField = 'date';

         $scope.$watch('sortDesc', function () {
            //todo store in firebase
            localStorage.set('sortDesc', $scope.sortDesc);
         });

         $scope.sortDesc = !!localStorage.get('sortDesc');

         function passesFilter(article) {
            if (_.isEmpty($scope.articleFilter)) {
               return true;
            }
            var txt = ($scope.articleFilter || '').toLowerCase();
            return _.find(article, function (v, k) {
               return !!(v && (v + '').toLowerCase().indexOf(txt) >= 0);
            });
         }

         function notRead(article) {
            return $scope.showRead || !$scope.readArticles || !_.has($scope.readArticles, article.$feed) || !_.has($scope.readArticles[article.$feed], article.$id);
         }

         function activeFeed(article) {
            return !$scope.activeFeed || $scope.activeFeed === article.$feed;
         }

         function countActiveArticles() {
            if ($scope.activeFeed) {
               return $scope.counts[$scope.activeFeed] || 0;
            }
            else {
               return _.reduce($scope.counts, function (memo, num) {
                  return memo + num;
               }, 0);
            }
         }

         $scope.feeds.$on('loaded', checkSearchPath);
         $scope.feeds.$on('child_removed', checkSearchPath);
         function checkSearchPath() {
            // if a feed is currently selected and that feed does not exist anymore
            // then clear the selection
            var feed = ($location.search() || {}).feed;
            if (feed && !($scope.feeds || {})[feed]) {
               $location.replace();
               $location.search('feed', null);
            }
         }

         $scope.startLoading();
         $scope.feeds.$on('loaded', function() {
            $scope.stopLoading();
         });
      }
   }]);

   appServices.factory('disposeOnLogout', ['$rootScope', function($rootScope) {
      var disposables = [];

      $rootScope.$on('authManager:beforeLogout', function() {
         angular.forEach(disposables, function(fn) {
            fn();
         });
         disposables = [];
      });

      return function(fnOrRef, event, callback) {
         var fn;
         if( arguments.length === 3 ) {
            fn = function() {
               fnOrRef.off(event, callback);
            }
         }
         else if( angular.isObject(fnOrRef) && fnOrRef.hasOwnProperty('$off') ) {
            fn = function() {
               fnOrRef.$off();
            }
         }
         else {
            fn = fnOrRef;
         }
         disposables.push(fn);
         return fnOrRef;
      }
   }]);

})(angular);
