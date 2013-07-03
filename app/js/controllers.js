'use strict';

/* Controllers */

angular.module('myApp.controllers', ['firebase'])
   .controller('LoginCtrl', ['$log', '$rootScope', '$scope', 'firebaseAuth', 'authProviders', '$location', function($log, $rootScope, $scope, firebaseAuth, authProviders) {
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
      $scope.showAbout = !localStorage.get('hideAbout');

      $scope.toggleAbout = function() {
         $scope.showAbout = !$scope.showAbout;
         localStorage.set('hideAbout', !$scope.showAbout);
      };

      $scope.dismissAbout = function() {
         $scope.showAbout = false;
         localStorage.set('hideAbout', true);
      };
   }])

   .controller('HearthCtrl', ['$log', '$scope', 'FeedManager', 'showArticle', '$location', function($log, $scope, FeedManager, showArticle, $location) {
      var feedMgr = new FeedManager($scope, $scope.auth.user);

      showArticle.init($scope);

      $scope.addCustomFeed = function() {
         window.alert('I don\'t know how to do custom feeds yet; I\'ll probably learn soon.');
      };

      $scope.addFeed = function(feedId) {
         $scope.feeds[feedId] = feedMgr.makeFeed(feedId);
      };

      $scope.removeFeed = function(feedId, $event) {
         if( $scope.activeFeed === feedId ) {
            $scope.activeFeed = null;
            $location.search('feed', null);
         }
         if( $event ) {
            $event.preventDefault();
            $event.stopPropagation();
         }
         feedMgr.removeFeed(feedId);
      };
   }])

   .controller('DemoCtrl', ['$log', '$scope', 'FeedManager', 'showArticle', function($log, $scope, FeedManager, showArticle) {
      $scope.isDemo = true;
      var fm = new FeedManager($scope, 'demo');
      showArticle.init($scope);
   }]);
