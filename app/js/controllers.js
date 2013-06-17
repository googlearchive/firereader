'use strict';

/* Controllers */

angular.module('myApp.controllers', ['firebase'])
   .controller('NavCtrl', ['$scope',  'localStorage', 'firebaseAuth', function($scope, localStorage) {
      //todo NavCtrl is attached to <body> tag, use a pseudo element to limit scope?
      $scope.showInfo = localStorage.get('hideInfo')? false : true;
      $scope.toggleInfo = function() {
         $scope.showInfo = !$scope.showInfo;
         localStorage.set('hideInfo', $scope.showInfo? null : 1);
      };
   }])
   .controller('AccountCtrl', [function() {
      //todo
      //todo
      //todo
   }])
   .controller('HearthCtrl', [function() {
      //todo
      //todo
      //todo
   }])
   .controller('DemoCtrl', ['$scope', '$timeout', 'angularFireAggregate', 'localStorage', function($scope, $timeout, angularFireAggregate, localStorage) {
       $scope.sortBy = localStorage.get('sortBy')||'Newest';

       $scope.feeds = {
          'dilbert': {"id": 'dilbert', "title": "Dilbert Daily Strip", active: false, init: false, link: "", count: 0},
          'engadget': {'id': 'engadget', "title":"Engadget RSS Feed", active: false, init: false, link: "", count: 0},
          'firebase': {'id': 'firebase', 'title': 'Firebase Blog', active: true, init: false, link: "http://www.firebase.com/blog/", count: 0},
          'techcrunch': {'id': 'techcrunch', "title":"TechCrunch", active: false, init: false, link: "", count: 0},
          'xkcd': {'id': 'xkcd', "title":"xkcd.com", active: true, init: false, link: "", count: 0}
       };

      $scope.searchText = null;

      $scope.timestamp = function(article) {
         return new Date(article.date).getTime();
      };

      $scope.initFeed = initFeed;

      $scope.allFeeds = function() {
         $timeout(function() {
            angular.forEach($scope.feeds, function(f) {f.active = true; initFeed(f)});
         });
      };

      $scope.noFeeds = function() {
         $timeout(function() {
            angular.forEach($scope.feeds, function(f) {f.active = false;});
         });
      };

      // declare this before we init the feeds because otherwise they will read zero until every feed loads completely
      $scope.$on('angulareFireAggregateChildAdded', function(evt, args) { incFeed(args.item); });

      function initMasonry() {
         function sortByField() {
            switch($scope.sortBy) {
               case 'Title':
                  return 'title';
               default:
                  return 'time';
            }
         }

         console.log('articles done');

         var resort = _.debounce(function() {
            console.log('resort'); //debug
            $('#feeds').isotope( 'reloadItems' ).isotope({ sortBy: sortByField(), sortAscending: $scope.sortBy !== 'Newest' });
         }, 250);

         $('#feeds').isotope({
            itemSelector : 'article',
            resizable: true,
            layoutMode: 'masonry',
            masonry: {
               columnWidth:  10,
               columnHeight: 10
            },
            filter: ":not(.filtered)",
            sortBy: sortByField(),
            sortAscending: $scope.sortBy !== 'Newest',
            getSortData: {
               time: function($elem) {
                  return parseInt($elem.attr('data-time'));
               },
               title: function($elem) {
                  return $elem.find('h2').text();
               }
            }
         });

         //angular.forEach($scope.articles, incFeed);

         //todo these can probably be replaced with $scope.$watch now that we're using a custom factory
         $scope.$on('angulareFireAggregateChildAdded', function(e, a) { hasActiveFeed(a) && resort(); });
         $scope.$on('angulareFireAggregateChildChanged', function(e, a) { hasActiveFeed(a) && resort(); });
         $scope.$on('angulareFireAggregateChildRemoved', function(e, a) { hasActiveFeed(a) && resort(); });
         $scope.$on('angulareFireAggregateChildMoved', function(e, a) { hasActiveFeed(a) && resort(); });

         $scope.$watch('searchText', resort);

         $scope.$watch('sortBy', function() {
            localStorage.set('sortBy', $scope.sortBy);
            resort();
         });

         $scope.$watch('feeds', resort, true);
      }

      // we use a custom article factory because all the isotope and angular iterators run very slowly
      // when the Firebase reference is included in the object; $scope.$watch becomes completely unstable
      // and results in recursion errors; so don't include any of that in our objects
      function articleFactory(snapshot, index) {
         var out = _.extend({
            feed: snapshot.ref().parent().parent().name()
         }, _.pick(snapshot.val(), 'title', 'description', 'link', 'date'));
         out.date = new Date(out.date).getTime();
         out.description = fixRelativeLinks(out.description, getFeedFor(out).link);
         return out;
      }

      function feedPath(id) {
         return new Firebase('https://feeds.firebaseio.com/'+id+'/articles').limit(5); //todo set limit from config?
      }

      function hasActiveFeed(article) {
         return getFeedFor(article).active;
      }

      var paths = [];
      _.each($scope.feeds, function(feed) {
         if( feed.active ) {
            feed.init = true;
            paths.push(feedPath(feed.id));
         }
      });

      initMasonry();
      $scope.articles = angularFireAggregate($scope, {paths: paths, /*callback: initMasonry,*/ factory: articleFactory});

      function getFeedFor(article) {
         var n = article.feed||'';
         return $scope.feeds[n] || {active: false, title: $scope.feedChoices[n]};
      }

      function incFeed(article) {
         var f = getFeedFor(article);
         f && f.count++;
      }

      function initFeed(feed) {
         if( !feed.init ) {
            console.log('initFeed', feed);
            feed.init = true;
            $scope.articles.addPath(feedPath(feed.id));
         }
      }

      $scope.isFiltered = function(article) {
         return !getFeedFor(article).active;
      };

      function fixRelativeLinks(txt, baseUrl) {
         if( !baseUrl ) { return txt; }
         return txt.replace(/(href|src)=(['"])([^'"]+)['"]/g, function(match, p1, p2, p3) {
            if( !p3.match(/^(mailto:|[a-z][-a-z0-9\+\.]*:\/\/)/) ) {
               console.log('link', match, p1 + '=' + p2 + _prefix(baseUrl, p3) + p2); //debug
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
   }]);
