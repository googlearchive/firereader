(function(angular) {

   "use strict";

   var appServices = angular.module('myApp.services', ['myApp.utils']);

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
         var authClient = new FirebaseSimpleLogin(new Firebase(FIREBASE_URL), _statusChange);
         var initialized = false;

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
               initialized && $location.path('/demo');
            }
            initialized = true;
         }

         // provide some convenience methods to log in and out
         var fns = {
            login: function(providerId) {
               $log.log('logging in', providerId);
               switch(providerId) {
                  case 'persona':
                     authClient.login('persona', { rememberMe: true });
                     break;
                  case 'github':
                     authClient.login('github', {
                        rememberMe: true,
                        scope: 'user:email'
                     });
                     break;
                  case 'twitter':
                     authClient.login('twitter', { rememberMe: true });
                     break;
                  case 'facebook':
                     authClient.login('facebook', {
                        rememberMe: true,
                        scope: 'email'
                     });
                     break;
                  default:
                     throw new Error('I do not know this provider: '+providerId);
               }
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
    * A common set of controller logic used by DemoCtrl and HearthCtrl for managing
    * scope and synching feeds and articles with Firebase
    */
   appServices.factory('FeedManager', ['feedChangeApplier', 'feedScopeUtils', 'feedTheFire', '$timeout', '$location', function(feedChangeApplier, feedScopeUtils, feedTheFire, $timeout, $location) {
      return function($scope, provider, userId) {
         var inst = {
            getFeeds: function() {
               return $scope.feeds;
            },
            fromChoice: function(choiceOrId) {
               var choice = angular.isObject(choiceOrId)? choiceOrId : findChoice(choiceOrId);
               return {
                  title: choice.title,
                  id: choice.$id,
                  last: Date.now()
               };
            },
            removeFeed: function(feedId) {
               var auth = $scope.auth||{};
               var f = $scope.feeds[feedId];
               if( f ) {
                  delete $scope.feeds[feedId];
                  f.isCustom && feedTheFire.remove(auth.provider, auth.user, feedId);
               }
            },
            addFeed: function(title, url) {
               // create a custom feed
               var auth = $scope.auth||{};
               feedTheFire.add(auth.provider, auth.user, url, function(error, id) {
                  $scope.$log.debug('addFeed callabck', error, id); //debug
                  if( error ) {
                     //todo put this in the interface?
                     $scope.$log.error(error);
                     alert(error);
                  }
                  else {
                     $timeout(function() {
                        $scope.feeds[id] = {
                           id: id,
                           title: title,
                           last: Date.now(),
                           isCustom: true
                        };
                        $location.search('feed', id);
                     })
                  }
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

         feedScopeUtils($scope);
         feedChangeApplier($scope, inst, provider, userId);

         $scope.feedManager = inst;

         return inst;
      }
   }]);

   /**
    * Some straightforward scope methods for dealing with feeds and articles; these have no dependencies
    */
   appServices.factory('feedScopeUtils', ['localStorage', '$log', function(localStorage, $log) {
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

         $scope.openFeedBuilder = function($event) {
            $event && $event.preventDefault();
            $scope.$broadcast('modal:customFeed');
         };

         $scope.openArticle = function(article, $event) {
            $event && $event.preventDefault();
            $scope.$broadcast('modal:article', article);
         };

         $scope.filterMethod = function(article) {
            return passesFilter(article) && (!$scope.activeFeed || $scope.activeFeed === article.feed);
         };

         $scope.orderMethod = function(article) {
            var v = article[$scope.sortField];
            return $scope.sortDesc? 0 - parseInt(v) : parseInt(v);
         };

         $scope.sortField = 'date';

         $scope.$watch('sortDesc', function() {
            //todo store in firebase
            localStorage.set('sortDesc', $scope.sortDesc);
            $scope.$emit('masonry:resort');
            $scope.$broadcast('masonry:resort');
         });

         $scope.sortDesc = !!localStorage.get('sortDesc');

         function passesFilter(article) {
            if(_.isEmpty($scope.articleFilter)) {
               return true;
            }
            var txt = ($scope.articleFilter||'').toLowerCase();
            return _.find(article, function(v,k) {
               return !!(v && (v+'').toLowerCase().indexOf(txt) >= 0);
            });
         }
      }
   }]);

   /**
    * A change listener that updates the feedManager and articleManager, as well as
    * making some minor scope manipulations
    */
   appServices.factory('feedChangeApplier', ['$log', 'ArticleManager', 'treeDiff', 'fbUrl', 'angularFire', '$timeout', '$location',
      function($log, ArticleManager, treeDiff, fbUrl, angularFire, $timeout, $location) {
         return function($scope, feedManager, provider, userId) {
            var articleManager = new ArticleManager(feedManager, $scope);

            $scope.feeds = {};

            // treeDiff gives a change list for the feeds object
            treeDiff($scope, 'feeds').watch(changed);

            function changed(changes, newVals, orig) {
//               $log.debug('FeedManager::changes', changes, newVals, orig);
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
//            $scope.$watch('activeFeed', setFilter);
//            function setFilter() {
//               $scope.sortFilter = $scope.activeFeed? '[data-feed="'+$scope.activeFeed+'"]' : false;
//            }
//            setFilter();

            var path = fbUrl('user', provider, userId, 'list');
            if( userId === 'demo' && provider === 'demo' ) {
               // read only
               new Firebase(path).once('value', function(ss) {
                  $timeout(function() {
                     $scope.feeds = ss.val();
                  })
               });
            }
            else {
               // 2-way synchronize
               angularFire(path, $scope, 'feeds', {}).then(function() {
                  var feed = ($location.search()||{}).feed;
                  if( feed && !($scope.feeds||{})[feed] ) {
                     $location.replace();
                     $location.search(null);
                  }
               });
            }
         }
      }]);

   appServices.factory('ArticleManager', ['angularFireAggregate', 'articleFactory', 'feedUrl', function(angularFireAggregate, articleFactory, feedUrl) {
      return function(feedManager, $scope) {
         var feeds = {};

         $scope.counts = {};
         $scope.articles = angularFireAggregate($scope, { factory: articleFactory(feedManager) });

         $scope.articles.on('added', incFeed);
         angular.forEach(feedManager.getFeeds(), initFeed);

         function incFeed(article) {
            $scope.counts[article.feed]++;
         }

         function initFeed(feed) {
            if( !_.has(feeds, feed.id)) {
//               $log.debug('initFeed', feed);
               feeds[feed.id] = $scope.articles.addPath(feedUrl(feed, $scope.isDemo));
               $scope.counts[feed.id] = 0;
            }
         }

         function removeFeed(feed) {
            var id = angular.isString(feed)? feed : feed.id;
            feeds[id] && feeds[id].dispose();
            delete feeds[id];
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
            out.summary = fixRelativeLinks(out.summary || out.description, baseLink);
            out.description = fixRelativeLinks(out.description, baseLink);
            return out;
         }
      };
   }]);

})(angular);
