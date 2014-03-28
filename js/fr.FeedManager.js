(function(angular) {
   var module = angular.module('feedManager', ['fr.articleList', 'firebase.utils']);

   /**
    * A common set of controller logic used by DemoCtrl and HearthCtrl for managing
    * scope and synching feeds and articles with Firebase
    */
   module.factory('feedManager', ['feedChangeApplier', 'feedScopeUtils', 'syncData', '$timeout', '$location', function (feedChangeApplier, feedScopeUtils, syncData, $timeout, $location) {
      var feedChoices = syncData('meta');
      return function (provider, userId, disposeOnLogout) {
         var feeds = syncData(['user', provider, userId, 'feeds']);
         disposeOnLogout && disposeOnLogout(feeds);

         var inst = {
            getChoices: function() {
               return _.extend({}, feedChoices);
            },

            syncFeeds: function($scope, name) {
               feeds.$bind($scope, name);
            },

            getFeeds: function () {
               return _.extend({}, feeds);
            },

            feedProps: function (choiceOrId) {
               var choice = angular.isObject(choiceOrId) ? choiceOrId : findChoice(choiceOrId);
               return {
                  title: choice.title,
                  last: Date.now(),
                  url: choice.url,
                  "$id": choice.$id || feeds.$getRef().push().name()
               };
            },

            removeFeed: function (feedId) {
               delete feeds[feedId];
            },

            addFeed: function (idOrProps) {
               var props = inst.feedProps(idOrProps);
               feeds[props.$id] = props;
            },

            getFeed: function (feedId) {
               return feeds[feedId];
            },

            baseLink: function (feedId) {
               return findChoice(feedId).link;
            }
         };

         var findChoice = _.memoize(function (feedId) {
            return _.find(feedChoices, function (f) {
               return f.$id === feedId
            }) || {};
         });

         feedScopeUtils(feeds, provider, userId);
         feedChangeApplier(feeds, inst, provider, userId);

         return inst;
      }
   }]);

   /**
    * A change listener that updates the feedManager and articleManager, as well as
    * making some minor scope manipulations
    */
   module.factory('feedChangeApplier', ['$log', 'ArticleManager', 'treeDiff', 'syncData', '$timeout', '$location',
      function ($log, ArticleManager, treeDiff, syncData, $timeout, $location) {
         return function ($scope, feedManager, provider, userId) {
            var articleManager = new ArticleManager(feedManager, $scope);
            $scope.feeds = {};

            // treeDiff gives a change list for the feeds object
            treeDiff($scope, 'feeds').watch(changed);

            function changed(changes, newVals, orig) {
               _.each(['added', 'updated', 'removed'], function (type) {
                  _.each(changes[type], function (key) {
                     var feed = type === 'removed' ? orig[key] : newVals[key];
                     switch (type) {
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
         }
      }]);

   module.factory('ArticleManager', ['angularFireAggregate', 'articleFactory', 'feedUrl', 'readUrl', function (angularFireAggregate, articleFactory, feedUrl, readUrl) {
      return function (feedManager, $scope) {
         var feeds = {};

         $scope.counts = {};
         $scope.articles = angularFireAggregate(articleFactory(feedManager));
         $scope.readArticles = {};

         $scope.articles.on('added', incFeed);
         $scope.articles.on('removed', decFeed);
         angular.forEach(feedManager.getFeeds(), initFeed);

         function incFeed(article) {
            $scope.counts[article.feed]++;
            $scope.stopLoading();
         }

         function decFeed(article) {
            $scope.counts[article.feed] = Math.max(0, $scope.counts[article.feed] - 1);
         }

         function initFeed(feed) {
            if (!_.has(feeds, feed.id)) {
               feeds[feed.id] = $scope.articles.addPath(feedUrl(feed, $scope.isDemo), readUrl(feed, $scope.isDemo));
               $scope.counts[feed.id] = 0;
            }
         }

         function removeFeed(feed) {
            var id = angular.isString(feed) ? feed : feed.id;
            feeds[id] && feeds[id].dispose();
            delete feeds[id];
         }

         $scope.feedName = function (article) {
            return feedManager.getFeed(article.feed).title || article.feed;
         };

         return {
            on: $scope.articles.on,
            addFeed: initFeed,
            removeFeed: removeFeed
         }
      }
   }]);

   /**
    * A simple Factory pattern to create the article objects from JSON data
    */
   module.factory('articleFactory', [function () {
      //todo move to an article parser service
      function fixRelativeLinks(txt, baseUrl) {
         if (!baseUrl) {
            return txt;
         }
         return txt.replace(/(href|src)=(['"])([^'"]+)['"]/g, function (match, p1, p2, p3) {
            if (!p3.match(/^(mailto:|[a-z][-a-z0-9\+\.]*:\/\/)/)) {
               match = p1 + '=' + p2 + _prefix(baseUrl, p3) + p2;
            }
            return match;
         });
      }

      function _prefix(base, url) {
         while (url.match(/^..\//)) {
            url = url.substr(3);
            base = base.replace(/[^/]+\/$/, '');
         }
         return base + url.replace(/^\//, '');
      }

      // we use a custom article factory because Angular becomes very slow when a Firebase reference
      // is included in the object; $scope.$watch becomes completely unstable and results in recursion errors;
      // so don't include any of that in our objects; also gives us a chance to parse dates and such
      return function (feedManager) {
         return function (snapshot, index) {
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