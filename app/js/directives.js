'use strict';

/* Directives */


angular.module('myApp.directives', [])
   .directive('appVersion', ['version', function(version) {
      return function(scope, elm, attrs) {
         elm.text(version);
      };
   }])
   .directive('preventDefault', function() {
      return function(scope, element, attrs) {
         $(element).click(function(event) {
            event.preventDefault();
         });
      }
   })
   .directive('fbIsotope', ['listDiff', '$log', '$interpolate', function (listDiff, $log, $interpolate) {
      // derived from this fiddle: http://jsfiddle.net/macfee/spUM6/
      $log.debug('fbIsotope'); //debug

      var itemTpl = $interpolate('<article data-time="{{timestamp(article)}}" id="{{article.feed}}-{{article.$id}}" data-feed="{{article.feed}}" ng-class="{filtered:isFiltered(article)}" class="span3">\
                  <h2 title="{{article.title}}"><a href="{{article.link}}" class="pull-right" target="_blank"><i class="icon-external-link"></i></a> {{article.title}}</h2>\
                     <div>{{article.description}}</div>\
                     <p>&nbsp;{{article.filtered}}</p>\
                  </article>');

      return {
//         scope: {
//            items: '=fbIsotope',
//            sort: '=fbSort',
//            desc: '=fbDesc',
//            fbFiltered: '&',
//            fbTimestamp: '&'
//         },
//         transclude: true,
         compile: function(containerElement, attrs/*, transcludeFn*/) {
            return function(scope, element, attrs) {
               var articleKey = attrs.fbIsotope;
               var options = {
                  animationEngine : 'jquery',
                  itemSelector: 'article',
                  resizable: true,
                  layoutMode: 'masonry',
                  masonry: {
                     columnWidth:  10,
                     columnHeight: 10
                  },
                  getSortData : {
                     time: function(elem) {
                        return parseInt(elem.attr('data-time'));
                     },
                     title: function(elem) {
                        return elem.find('h2').text();
                     }
                  },
                  sortBy: scope.sortField,
                  sortAscending: !scope.sortDesc
               };

               function build(list) {
                  var articles = angular.element('<div />');
                  list.forEach(function (item) {
                     articles.append(buildItem(item));
                  });
                  return articles.children();
               }

               function buildItem(article) {
                  var s = scope.$new();
                  s.article = article;
                  return angular.element(s.$eval(itemTpl));
               }

               function findEls(list) {
                  return angular.element(_.map(list, function(item) { return '#'+ item.feed + '-' + item.$id }).join(','));
               }

               var resort = _.debounce(function() {
                  $log.debug('fbIsotope.resort', scope.sortField, scope.sortDesc);
                  element.isotope({ sortBy: scope.sortField, sortAscending: !scope.sortDesc });
               }, 100);

               var setup = _.debounce(function () {
                  $log.debug('fbIsotope:setup', adds.length, deletes.length);
                  adds.length && element.isotope('insert', build(adds)) && (adds = []);
                  deletes.length && element.isotope('remove', findEls(deletes)) && (deletes = []);
               }, 100);

               var refilter = _.debounce(function() {
                  var filter = '';
                  if( scope.filters && scope.filters.length ) {
                     filter = ':not('+_.map(scope.filters, function(f) { return '[data-feed="'+f+'"]'; }).join(',')+')';
                  }
                  $log.debug('fbIsotope:refilter', filter, scope.filters);
                  element.isotope({ filter: filter });
               }, 100);

               var adds = [];
               var deletes = [];
               function changes(changes) {
                  if( changes.count ) {
//                     $log.log('fbIsotope:changes found', {added: changes.added.length, removed: changes.removed.length});
                     adds = adds.concat(changes.added);
                     deletes = deletes.concat(changes.removed);
                     setup();
                  }
               }

               function hashFn(article) { return article.$id; }

               // initialize the grid
               element.isotope(options);

               // add any existing items
               scope[articleKey].length && setup(listDiff.diff(null, scope[articleKey], hashFn));

               // watch for any changes
               listDiff.watch(scope, articleKey, changes, hashFn);

               // resort as necessary
               scope.$watch('sortField', resort);
               scope.$watch('sortDesc', resort);
               scope.$watch('filters', refilter);
            }
         }
      };
   }]);
