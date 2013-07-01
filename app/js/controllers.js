'use strict';

/* Controllers */

angular.module('myApp.controllers', ['firebase'])
   .controller('LoginCtrl', ['$log', '$rootScope', '$scope', 'firebaseAuth', 'authProviders', '$location', function($log, $rootScope, $scope, firebaseAuth, authProviders, $location) {
      $scope.providers = {};
      angular.forEach(authProviders, function(p) {
         $scope.providers[p.id] = angular.extend({preferred: $scope.auth.provider === p.id}, p);
      });

      $scope.$watch('auth.provider', setPreferred);
      setPreferred($scope.auth.provider);

      $scope.filteredProviders = function() {
         return _.filter($scope.providers, function(v,k) {
            return k !== $scope.auth.provider;
         });
      };

      function setPreferred(provider) {
         $scope.preferred = provider? angular.extend({}, $scope.providers[provider]) : null;
         angular.forEach($scope.providers, function(p, k) {p.preferred = (k === provider)});
      }
   }])

   .controller('NavCtrl', ['$scope',  'localStorage', '$location', function($scope, localStorage, $location) {
      //todo NavCtrl is attached to <body> tag, use a pseudo element to limit scope?
      $scope.showInfo = localStorage.get('hideInfo')? false : true;
      $scope.toggleInfo = function() {
         $scope.showInfo = !$scope.showInfo;
         localStorage.set('hideInfo', $scope.showInfo? null : 1);
      };
      $scope.isActive = function(page) {
         return !!$location.path().match('/'+page);
      }
   }])

   .controller('AccountCtrl', ['$scope', function($scope) {
      $scope.deleteAccount = function() {
         if( confirm('Permanently delete this account, including all your reading history?') ) {

         }
      }
   }])

   .controller('AboutCtrl', ['$scope', function($scope) {
      //todo
      //todo
      //todo
   }])

   .controller('HearthCtrl', ['$log', '$scope', 'FeedManager', 'ArticleManager', 'SortManager', '$timeout', function($log, $scope, FeedManager, ArticleManager, SortManager, $timeout) {
      var feedMgr = new FeedManager($scope, $scope.auth.user);
      new ArticleManager(feedMgr, $scope);
      new SortManager($scope);

      $scope.showArticle = function(article) {
         $log.debug('showArticle', article);
      };

      $scope.activateAllFeeds = function() {
         $timeout(function() {
            angular.forEach($scope.feeds, function(f) {f.active = true;});
         });
      };

      $scope.deactivateAllFeeds = function() {
         $timeout(function() {
            angular.forEach($scope.feeds, function(f) {f.active = false;});
         });
      };

      $scope.addCustomFeed = function() {
         window.alert('I don\'t know how to do custom feeds yet; I\'ll probably learn soon.');
      };

      $scope.addFeed = function(feedId) {
         $log.debug('addFeed', feedId, _.keys($scope.feedChoices)); //debug
         $scope.feeds[feedId] = feedMgr.makeFeed(feedId);
      };

      $scope.activateOneFeed = function(feedId) {
         $timeout(function() {
            angular.forEach($scope.feeds, function(f) { f.active = f.id === feedId; })
         })
      };

      $scope.removeFeed = function(feedId, $event) {
         if( $event ) {
            $event.preventDefault();
            $event.stopPropagation();
         }
         $timeout(function() {
            delete $scope.feeds[feedId];
         })
      };
   }])

   .controller('DemoCtrl', ['$log', '$scope', '$timeout', 'DemoFeedManager', 'ArticleManager', 'SortManager', function($log, $scope, $timeout, DemoFeedManager, ArticleManager, SortManager) {
      var feedMgr = new DemoFeedManager($scope);
      new ArticleManager(feedMgr, $scope);
      new SortManager($scope);

      $scope.activateAllFeeds = function() {
         $timeout(function() {
            angular.forEach($scope.feeds, function(f) {f.active = true;});
         });
      };

      $scope.activateOneFeed = function(feedId) {
         $timeout(function() {
            angular.forEach($scope.feeds, function(f) { f.active = f.id === feedId; })
         })
      };

      $scope.deactivateAllFeeds = function() {
         $timeout(function() {
            angular.forEach($scope.feeds, function(f) {f.active = false;});
         });
      };
   }]);
