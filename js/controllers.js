'use strict';

/* Controllers */

angular.module('myApp.controllers', ['myApp.utils', 'fr.feedManager'])

   .controller('LoginCtrl', ['$scope', 'authManager', function($scope, authManager) {
      $scope.$watch('auth.provider', setPreferred);
      setPreferred($scope.auth.provider);

      $scope.filteredProviders = function() {
         return _.filter($scope.providers, function(v,k) {
            return k !== $scope.auth.provider;
         });
      };

      $scope.colorMe = function(id) {
         var c;
         switch(id) {
            case 'facebook':
               c = 'btn-primary';
               break;
            case 'github':
               c = 'btn-inverse';
               break;
            case 'twitter':
               c = 'btn-info';
               break;
            case 'persona':
               c = 'btn-success';
               break;
            default:
               c = '';
         }
         return !$scope.preferred || $scope.preferred.id === id? c : '';
      };

      function setPreferred(provider) {
         $scope.preferred = provider? angular.extend({}, $scope.providers[provider]) : null;
         authManager.setPreferred(provider);
      }
   }])

   .controller('NavCtrl', ['$scope',  'localStorage', function($scope, localStorage) {
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

   .controller('HearthCtrl', ['$scope', 'feedManager', '$location', '$dialog', 'disposeOnLogout', 'feedScopeUtils', 'syncData', function($scope, feedManager, $location, $dialog, disposeOnLogout, feedScopeUtils, syncData) {
      var pid = $scope.auth.provider;
      var uid = $scope.auth.user;
      var feedMgr = $scope.feedManager = new feedManager(pid, uid, disposeOnLogout);
      feedScopeUtils($scope, feedMgr);

      // 2-way synchronize of the articles this user has marked as read
      $scope.readArticles = syncData(['user', pid, uid, 'read'], 250);

      $scope.addFeed = function(feedId) {
         feedMgr.addFeed(feedId);
         $scope.startLoading();
         $location.search('feed', feedId);
      };

      $scope.removeFeed = function(feedId, $event) {
         $dialog.dialog({
            backdrop: true,
            keyboard: true,
            backdropClick: true,
            templateUrl: 'partials/confirmDialog.html',
            controller: 'ConfirmDialogCtrl'
         }).open().then(function(confirmed) {
            if( confirmed ) {
               if( $scope.activeFeed === feedId ) {
                  $scope.activeFeed = null;
                  $location.replace();
                  $location.search('feed', null);
               }
               if( $event ) {
                  $event.preventDefault();
                  $event.stopPropagation();
               }
               feedMgr.removeFeed(feedId);
               //todo remove from $user/read as well
            }
         });
      };
   }])

   .controller('DemoCtrl', ['$scope', 'feedManager', 'feedScopeUtils', function($scope, feedManager, feedScopeUtils) {
      $scope.isDemo = true;
      $scope.readArticles = {};
      var feedMgr = $scope.feedManager = new feedManager('demo', 'demo');
      feedScopeUtils($scope, feedMgr);
   }])

   .controller('ArticleCtrl', ['$scope', function($scope) {
      var ABSOLUTE_WIDTH = 850;

      $scope.opts = {
         dialogClass: 'modal article'
      };

      $scope.open = function(article) {
         if( !article ) { $scope.close(); }
         else {
            $scope.article = article;
            setNext(article);
            setPrev(article);
            $scope.isOpen = true;
            resize();
            if( angular.element(window).width() <= ABSOLUTE_WIDTH ) {
               window.scrollTo(0,0);
            }
            $scope.markArticleRead(article);
         }
      };

      $scope.close = function() {
         $scope.isOpen = false;
      };

      $scope.closed = function() {
         $scope.article = null;
         $scope.isOpen = false;
      };

      // resize height of element dynamically
      var resize = _.debounce(function() {
         if( $scope.isOpen ) {
            var $article = angular.element('div.modal.article');
            var maxHeight = 'none';
            if( angular.element(window).width() > ABSOLUTE_WIDTH ) {
               var windowHeight = angular.element(window).height();
               var headHeight = $article.find('.modal-header').outerHeight() + $article.find('.modal-footer').outerHeight();
               maxHeight = (windowHeight * .8 - headHeight)+'px';
            }
            $article.find('.modal-body').css('max-height', maxHeight);
         }
      }, 50);

      function setNext(article) {
         var next = angular.element('#'+article.$id).next('article');
         $scope.next = next.length? $scope.articles.find(next.attr('id')) : null;
      }

      function setPrev(article) {
         var prev = angular.element('#'+article.$id).prev('article');
         $scope.prev = prev.length? $scope.articles.find(prev.attr('id')) : null;
      }

      angular.element(window).bind('resize', resize);

      $scope.$on('modal:article', function(event, article) {
         $scope.open(article);
      });

   }])

   .controller('CustomFeedCtrl', ['$scope', function($scope) {
      var $log = $scope.$log;
      $scope.isOpen = false;

      $scope.$on('modal:customFeed', function() {
         $scope.open();
      });

      $scope.open = function() {
         $scope.isOpen = true;
      };

      $scope.close = function() {
         $scope.isOpen = false;
      };

      $scope.add = function() {
         $log.debug('adding custom feed', $scope.title, $scope.url);
         $scope.feedManager.addFeed({url: $scope.url, title: $scope.title});
         $scope.close();
         $scope.title = null;
         $scope.url = null;
      };
   }])

   .controller('ConfirmDialogCtrl', ['$scope', 'dialog', function($scope, dialog) {
      $scope.close = function(result) {
         dialog.close(result);
      }
   }]);