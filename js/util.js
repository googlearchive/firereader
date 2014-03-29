/*! service.util.js
 *************************************/
(function (angular) {
   "use strict";

   var appUtils = angular.module('myApp.utils', ['firebase', 'firebase.utils']);

   /**
    * A utility to store variables in local storage, with a fallback to cookies if localStorage isn't supported.
    */
   appUtils.factory('localStorage', ['$log', function($log) {
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

   appUtils.factory('articlesUrl', ['firebaseRef', 'FB_DEMO_LIMIT', 'FB_LIVE_LIMIT', 'encodeFirebaseKey', function(firebaseRef, FB_DEMO_LIMIT, FB_LIVE_LIMIT, encodeFirebaseKey) {
      return function(feedUrl, isDemo) {
         var limit = isDemo? FB_DEMO_LIMIT : FB_LIVE_LIMIT;
         return firebaseRef('articles', encodeFirebaseKey(feedUrl), 'entries').endAt().limit(limit);
      }
   }]);

   appUtils.factory('articlesMetaUrl', ['firebaseRef', 'encodeFirebaseKey', function(firebaseRef, encodeFirebaseKey) {
      return function(feedUrl) {
         return firebaseRef('articles_meta', encodeFirebaseKey(feedUrl));
      }
   }]);

   appUtils.factory('articlesIndexUrl', ['firebaseRef', 'encodeFirebaseKey', function(firebaseRef, encodeFirebaseKey) {
      return function(feedUrl) {
         return firebaseRef('articles', encodeFirebaseKey(feedUrl), 'index');
      }
   }]);

   appUtils.factory('feedUrl', ['firebaseRef', function(firebaseRef) {
      return function(feedId) {
         return firebaseRef('feeds', feedId);
      }
   }]);

   appUtils.factory('readUrl', ['FIREBASE_URL', 'Firebase', '$rootScope', function(URL, Firebase, $rootScope) {
      return function(opts, isDemo) {
         if( isDemo ) { return null; }
         var feedId = opts.id;
         var path = URL + ['user', $rootScope.auth.provider, $rootScope.auth.user, 'read', feedId].join('/');
         return new Firebase(path).limit(250);
      }
   }]);

   appUtils.factory('updateScope', ['$timeout', '$parse', function($timeout, $parse) {
      return function(scope, name, val, cb) {
         $timeout(function() {
            $parse(name).assign(scope, val);
            cb && cb();
         });
      }
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