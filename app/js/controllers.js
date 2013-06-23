'use strict';

/* Controllers */

angular.module('myApp.controllers', ['firebase'])
   .controller('LoginCtrl', ['$log', '$scope', 'firebaseAuth', 'authProviders', '$location', function($log, $scope, firebaseAuth, authProviders, $location) {
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

      var fn = $scope.$watch('auth.authenticated', function(auth) {
         if( auth ) {
            fn();
            var redirect = !$scope.redirectPath||$scope.redirectPath==='/login'? '/hearth' : $scope.redirectPath;
            $log.debug('LoginCtrl auth event received', redirect, $scope.redirectPath); //debug
            $location.path(redirect);
         }
      });

   }])

   .controller('NavCtrl', ['$scope',  'localStorage', function($scope, localStorage) {
      //todo NavCtrl is attached to <body> tag, use a pseudo element to limit scope?
      $scope.showInfo = localStorage.get('hideInfo')? false : true;
      $scope.toggleInfo = function() {
         $scope.showInfo = !$scope.showInfo;
         localStorage.set('hideInfo', $scope.showInfo? null : 1);
      };
   }])

   .controller('AccountCtrl', ['$scope', function($scope) {
      //todo
      //todo
      //todo
   }])

   .controller('HearthCtrl', ['$log', '$scope', 'FeedManager', 'ArticleManager', 'SortManager', '$timeout', function($log, $scope, FeedManager, ArticleManager, SortManager, $timeout) {
      var feedMgr = new FeedManager($scope, $scope.auth.user);
      new ArticleManager(feedMgr, $scope);
      new SortManager($scope);

//      var resort = masonry('#feeds', $scope.sortField, $scope.sortDesc);
//      $.resort = resort;
//      sortMgr.sortWhen(resort, 'articleFilter');
//      artMgr.on(sortMgr.sortCallback(resort));
//      feedMgr.on(sortMgr.sortCallback(resort));

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

      $scope.addFeed = function(choice) {
         $log.debug('addFeed', choice); //debug
         $scope.feeds[choice.$id] = feedMgr.makeFeed(choice.$id);
      };

      $scope.removeFeed = function(feedId) {
         delete $scope.feeds[feedId];
      };

      $scope.timestamp = function(article) {
         return new Date(article.date).getTime();
      };
   }])

   .controller('DemoCtrl', ['$log', '$scope', '$timeout', 'DemoFeedManager', 'ArticleManager', 'SortManager', function($log, $scope, $timeout, DemoFeedManager, ArticleManager, SortManager) {

      var feedMgr = new DemoFeedManager($scope, $scope.auth.user);
      new ArticleManager(feedMgr, $scope);
      new SortManager($scope);

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

      $scope.timestamp = function(article) {
         return new Date(article.date).getTime();
      };
   }]);
