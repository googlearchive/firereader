(function(angular) {
   var module = angular.module('fr.feedManager', ['myApp.utils', 'firebase.utils']);

   /**
    * A common set of controller logic used by DemoCtrl and HearthCtrl for managing
    * scope and synching feeds and articles with Firebase
    */
   module.factory('feedManager', ['syncData', '$parse', 'ArticleManager', 'feedLoader', function (syncData, $parse, ArticleManager, feedLoader) {
      var feedChoices = syncData('meta');
      return function (provider, userId, disposeOnLogout) {
         var feeds = syncData(['user', provider, userId, 'feeds']);
         disposeOnLogout && disposeOnLogout(feeds);

         var inst = {
            getChoices: function() {
               return feedChoices;
            },

            getFeeds: function () {
               return feeds;
            },

            getArticles: function() {
               return inst.articleManager.articles;
            },

            feedProps: function (choiceOrId) {
               var choice = angular.isObject(choiceOrId) ? choiceOrId : findChoice(choiceOrId);
               var out = {
                  title: choice.title,
                  url: choice.url
//                  "$id": choice.$id || feeds.$getRef().push().name()
               };
               if( choice.$id ) {
                  out.$id = choice.$id;
               }
               return out;
            },

            removeFeed: function (feedId) {
               feeds.$remove(feedId);
            },

            addFeed: function (idOrProps) {
               var props = inst.feedProps(idOrProps);
               if( typeof(idOrProps) === 'string' ) {
                  feeds[idOrProps] = props;
                  feeds.$save(idOrProps);
               }
               else {
                  feeds.$add(props, function(ref) {
                     feedLoader.testFeed(props.url, function(errCode, errMsg) {
                        if( errCode ) {
                           alert(errCode+' '+errMsg);
                           inst.removeFeed(ref.name());
                        }
                     });
                  });
               }
            },

            getFeed: function (feedId) {
               return feeds[feedId];
            },

            feedName: function(article) {
               var feed = inst.getFeed(article.$feed);
               return feed? feed.title : article.$feed;
            }
         };

         var findChoice = _.memoize(function (feedId) {
            return _.find(feedChoices, function (f, id) {
               return id === feedId
            }) || {};
         });

         inst.articleManager = new ArticleManager(inst, provider === 'demo').syncToFeeds(feeds);
         inst.feedLoader = feedLoader.trackFeeds(feeds);

         return inst;
      };
   }]);

   module.service('ArticleManager', ['angularFireAggregate', 'articlesUrl', 'readUrl', 'articleFactory', function (angularFireAggregate, articlesUrl, readUrl, articleFactory) {
      function ArticleManager(feedMgr, isDemo) {
         var self = this;
         self.isDemo = isDemo;
         self.feeds = {};
         self.counts = {};
         self.articles = angularFireAggregate();
         self.articles.on('added', incFeed);
         self.articles.on('removed', decFeed);
         self.feedMgr = feedMgr;

         function incFeed(article) {
            self.counts[article.$feed]++;
         }

         function decFeed(article) {
            self.counts[article.$feed] = Math.max(0, self.counts[article.$feed] - 1);
         }
      }

      ArticleManager.prototype = {
         syncToFeeds: function(feeds) {
            feeds.$on('child_added', this.addFeed.bind(this));
            feeds.$on('child_removed', this.removeFeed.bind(this));
            return this;
         },

         on: function(event, callback) {
            return this.articles.on(event, callback);
         },

         addFeed: function(feed) {
            if( feed.hasOwnProperty('snapshot') ) {
               feed.snapshot.value.$id = feed.snapshot.name;
               feed = feed.snapshot.value;
            }
            if (!_.has(this.feeds, feed.$id)) {
               this.counts[feed.$id] = 0;
               this.feeds[feed.$id] = this.articles.addPath(
                  feed.$id,
                  articleFactory(feed),
                  articlesUrl(feed.url, this.isDemo),
                  readUrl(feed.$id, this.isDemo)
               );
            }
         },

         removeFeed: function(feed) {
            if( feed.hasOwnProperty('snapshot') ) {
               feed.snapshot.value.$id = feed.snapshot.name;
               feed = feed.snapshot.value;
            }
            var id = angular.isString(feed) ? feed : feed.$id;
            this.feeds[id] && this.feeds[id].dispose();
            delete this.counts[id];
            delete this.feeds[id];
         },

         dispose: function() {
            this.articles.dispose();
         }
      };

      return ArticleManager;
   }]);

   /**
    * A simple Factory pattern to create the article objects from JSON data
    */
   module.factory('articleFactory', [function () {
      // we use a custom article factory because Angular becomes very slow when a Firebase reference
      // is included in the object; $scope.$watch becomes completely unstable and results in recursion errors;
      // so don't include any of that in our objects; also gives us a chance to parse dates and such
      return function(feed) {
         return function (snapshot/*, index*/) {
            return _.extend({}, _.pick(snapshot.val(), 'title', 'description', 'summary', 'link', 'date'), {'$feed': feed.$id});
         }
      }
   }]);

   module.factory('feedLoader', ['FeedTracker', function(FeedTracker) {
      var trackedFeeds = {};

      var inst = {
         testFeed: function(feedUrl, callback) {
            $.ajax({
               url      : feedUrl,
               dataType : 'json',
               success  : function (data) {
                  if( data.responseStatus >= 400 ) {
                     callback(data.responseStatus+'', data.responseDetails+''||'Could not find that feed');
                  }
                  else {
                     callback();
                  }
               },
               error: function(err) {
                  callback(err||'Unable to load feed');
               }
            });
         },

         trackFeeds: function(feeds) {
            feeds.$on('child_added', inst.trackFeed);
            feeds.$on('child_removed', inst.untrackFeed);
            feeds.$on('child_changed', function(snap) {
               inst.untrackFeed(snap);
               inst.trackFeed(snap);
            });
         },

         trackFeed: function(snap) {
            var id = snap.snapshot.name;
            if( !trackedFeeds.hasOwnProperty(id) ) {
               var dat = snap.snapshot.value;
               trackedFeeds[id] = new FeedTracker(dat.url);
            }
         },

         untrackFeed: function(snapOrId) {
            var id = angular.isObject(snapOrId)? snapOrId.snapshot.name : snapOrId;
            if( trackedFeeds.hasOwnProperty(id) ) {
               trackedFeeds[id].dispose();
               delete trackedFeeds[id];
            }
         },

         dispose: function() {
            angular.forEach(trackedFeeds, function(t) {
               t.dispose();
            });
            trackedFeeds = {};
         }
      };

      return inst;
   }]);

   module.service('FeedTracker', ['firebaseRef', 'encodeFirebaseKey', 'CHECK_INTERVAL', 'NUMBER_TO_FETCH', function(firebaseRef, encodeFirebaseKey, CHECK_INTERVAL, NUMBER_TO_FETCH) {
      function FeedTracker(sourceUrl) {
         var encodedKey = encodeFirebaseKey(sourceUrl);
         this.metaRef = firebaseRef(['articles_meta', encodedKey]);
         this.indexRef = firebaseRef(['articles', encodedKey, 'index']);
         this.dataRef = firebaseRef(['articles', encodedKey, 'entries']);
         this.sourceUrl = sourceUrl;
         this.checkInterval = CHECK_INTERVAL;
         this.to = null;
         this.subs = []; // used for disposing connections
         this._init();
      }

      FeedTracker.prototype = {
         checkTime: function(snap) {
            this.clearNext();
            if( snap.val() === null ) {
               console.warn('no meta found for feed', this.sourceUrl);
               this.dispose();
            }
            else {
               var last = snap.val()||0;
               if( last < Date.now() - this.checkInterval ) {
                  this.fetch();
               }
               else {
                  this.startNext(this.checkInterval - (Date.now() - last));
               }
            }
         },

         clearNext: function() {
            if( this.to ) {
               clearTimeout(this.to);
               this.to = null;
            }
         },

         startNext: function(waitFor) {
            this.to = setTimeout(this.fetch.bind(this), waitFor);
         },

         fetch: function() {
            var self = this;
            var url = document.location.protocol +
               '//ajax.googleapis.com/ajax/services/feed/load?v=1.0' +
               '&num=' + NUMBER_TO_FETCH + '&n=' + NUMBER_TO_FETCH +
               '&callback=?&q=' + encodeURIComponent(self.sourceUrl);
           self.clearNext();
            $.ajax({
               url      : url,
               dataType : 'json',
               success  : function (data) {
                  if( data.responseStatus < 400 && data.responseData && data.responseData.feed ) {
                     if (data.responseData.feed && data.responseData.feed.entries) {
                        self.load(data.responseData.feed.entries);
                     }
                  }
                  else {
                     console.error(data);
                     if( data.responseStatus >= 400 ) {
                        self.metaRef.child('error').set({
                           statusCode: data.responseStatus,
                           error: data.responseDetails||null,
                           ts: Date.now()
                        });
                        self.dispose();
                        return;
                     }
                  }
                  self.startNext(self.checkInterval);
               },
               error: function() {
                  console.error('failed to load feed', self.sourceUrl, arguments);
                  self.startNext(self.checkInterval);
               }
            });
         },

         load: function(entries) {
            var self = this;
            console.log('grabbing latest articles', self.sourceUrl);
            self.metaRef.child('last').set(Date.now());
            angular.forEach(entries, function(entry) {
               var out = processArticle(entry, encodeFirebaseKey(entry.link));
               // check to see if this record already exists in the index
               // we assume that the record's url will always be unique (one per article)
               self.indexRef.child(out.indexId).once('value', function(snap) {
                  if( snap.val() === null ) {
                     // get the id so we can set the index
                     var ref = self.dataRef.push(out, function(err) {
                        if( err ) {
                           console.error(err);
                           self.metaRef.child('error').set(err+'');
                        }
                        else {
                           // we must create the index before we can write the data
                           self.indexRef.child(out.indexId).set(ref.name());
                        }
                     });
                  }
               })
            });
         },

         _init: function() {
            var self = this;
            var fn = self.metaRef.child('last').on('value', self.checkTime.bind(self));
            self.subs.push(function() {
               self.metaRef.off('value', fn);
            });
         },

         dispose: function() {
            this.clearNext();
            angular.forEach(this.subs, function(fn) {
               fn();
            })
         }
      };

      function processArticle(feedData, uniqueId) {
         var date = parseDate(feedData);
         var baseLink = baseUrl(feedData.link);
         return {
            title: feedData.title||null,
            summary: fixRelativeLinks(feedData.summary||feedData.description||feedData.contentSnippet||feedData.content||null, baseLink),
            description: fixRelativeLinks(feedData.content||feedData.description||null, baseLink),
            link: feedData.link,
            indexId: uniqueId,
            date: date,
            author: feedData.author||null
         }
      }

      function baseUrl(url) {
         return url.replace(/\/[^\/]+$/, '/');
      }

      function fixRelativeLinks(txt, baseUrl) {
         if (!baseUrl || !txt) {
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

      function parseDate(feedData) {
         try {
            return new Date(feedData.date||feedData.publishedDate||Date.now()).valueOf();
         }
         catch(e) {
            return Date.now();
         }
      }

      return FeedTracker;
   }]);

})(angular);