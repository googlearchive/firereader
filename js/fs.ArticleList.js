(function(angular) {

   var module = angular.module('fs.articleList', ['firebase.utils']);

   module.factory('articleList', ['syncData', function(syncData) {
      return function(feedUrl) {
         return new ArticleList(feedUrl, syncData);
      }
   }]);

   function ArticleList(feedUrl) {

   }

   ArticleList.prototype = {
      _download: function(feedUrl) {
         //todo
         //todo
         //todo
         //todo

            $.ajax({
               url      : document.location.protocol + '//ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=10&callback=?&q=' + encodeURIComponent(feedUrl),
               dataType : 'json',
               success  : function (data) {
                  if (data.responseData.feed && data.responseData.feed.entries) {
                     $.each(data.responseData.feed.entries, function (i, e) {
                        console.log("------------------------");
                        console.log("title      : " + e.title);
                        console.log("author     : " + e.author);
                        console.log("description: " + e.description);
                     });
                  }
               }
            });
      }
   };

})(angular);