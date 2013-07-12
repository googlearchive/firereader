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

   .directive('fbIsotope', ['listDiff', '$log', function (listDiff, $log) {
      // requires jquery.isotope.js: http://isotope.metafizzy.co
      // derived from ideas in this fiddle: http://jsfiddle.net/macfee/spUM6/
      return {
//         scope: {
//            items: '=fbIsotope',
//            sort: '=fbSort',
//            desc: '=fbDesc',
//            fbFiltered: '&',
//            fbTimestamp: '&'
//         },
         transclude: true,
         compile: function(containerElement, attrs, transcludeFn) {
            return function(scope, element, attrs) {
               // you can override these by adding fb-* attributes to the HTML element
               // e.g. fb-isotope="widgets" fb-selector="selectorName" and so on
               var articleKey = attrs.fbIsotope;
               var selector = attrs.fbSelector || 'article';
               var sortKey = attrs.fbSort || 'sortField';
               var sortDescKey = attrs.fbDesc || 'sortDesc';
               var filterKey = attrs.fbFilter || 'sortFilter';
               var initialized = false;

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
                  var c = null;
                  transcludeFn(s, function(clone) {
                     c = clone;
                     s.$apply();
                     _.defer(function() { s.$apply() });
                  });
                  //return angular.element();
                  return c;
               }

               function findEls(list) {
                  //todo assumes that all feeds have unique ids
//                  $log.debug('removing', _.map(list, function(item) { return '#'+ item.$id }).join(',')); //debug
                  return angular.element(_.map(list, function(item) { return '#'+ item.$id }).join(','));
               }

               var redraw = _.debounce(function() {
                  var opts = getOpts();
//                  $log.debug('fbIsotope:redraw', opts); //debug
                  element.isotope(opts);
                  initialized = true;
               }, 250);

               var setup = _.debounce(function () {
//                  $log.debug('fbIsotope:setup', adds.length, deletes.length);
                  adds.length && element.isotope('insert', build(adds)) && (adds = []);
                  deletes.length && element.isotope('remove', findEls(deletes)) && (deletes = []);
                  redraw();
               }, 500);

               function getOpts() {
                  return {
                     animationEngine : 'jquery',
                     itemSelector: selector,
                     resizable: true,
                     filter: buildFilter(),
                     layoutMode: 'masonry',
                     masonry: {
                        columnWidth: 10,
                        columnHeight: 10
                     },
                     getSortData : {
                        time: function(elem) {
//                           $log.log('sort by time', elem.attr('id'), parseInt(elem.attr('data-time')), elem.attr('data-time')); //debug
                           return parseInt(elem.attr('data-time'));
                        }
                     },
                     sortBy: scope[sortKey],
                     sortAscending: !scope[sortDescKey]
                  };
               }

               function buildFilter() {
                  var filters = scope[filterKey];
                  if( filters && !angular.isArray(filters) ) {
                     filters = [filters];
                  }
                  return filters? filters.join(',') : '*'
               }

               var adds = [];
               var deletes = [];
               function changes(changes) {
                  if( changes.count ) {
                     adds = adds.concat(changes.added);
                     deletes = deletes.concat(changes.removed);
                     setup();
                  }
               }

               function hashFn(article) { return article.$id; }

               // initialize the grid
               redraw();
               element.isotope(getOpts());

               // add any existing items
               scope[articleKey].length && setup(listDiff.diff(null, scope[articleKey], hashFn));

               // watch for any changes
               listDiff.watch(scope, articleKey, changes, hashFn);

               // resort as necessary
               scope.$watch(sortKey, redraw);
               scope.$watch(sortDescKey, redraw);
               scope.$watch(filterKey, redraw);
            }
         }
      };
   }])

   .directive("masonry", ['$parse', '$timeout', '$log', function($parse, $timeout, $log) {
      return {
         restrict: 'A',
         link: function (scope, elem, attrs) {
            elem.masonry({ itemSelector: attrs.masonry });
            // Opitonal Params, delimited in class name like:
            // class="masonry:70;"
            //elem.masonry({ itemSelector: '.masonry-brick', columnWidth: 200 /*$parse(attrs.gutter)(scope)*/ });
         },
         controller : function($scope,$element){
            var addBricks = [], dropBricks = [], brickIndex = {};

            $scope.$on('grid:resort', function() {
               console.log('grid:resort controller');
            });

            var runAppend = _.debounce(function() {
               $element.masonry('addItems', addBricks);
               addBricks = [];
               $timeout(function(){
                  $element.masonry('resize');
               }, 25);
            }, 50);

            var runRemove = _.debounce(function() {
               $element.masonry('remove', dropBricks);
               dropBricks = [];
               $timeout(function() {
                  $element.masonry('resize');
               }, 25);
            }, 50);

            var reload = _.debounce(function() {
               $log.debug('masonry::reload');
               $scope.$evalAsync(function(){
                  $element.masonry();
               });
            }, 50);

            this.appendBrick = function(child, brickId, waitForImage){
               function addBrick() {
                  // Store the brick id
                  if (!_.has(brickIndex, brickId)) {
                     brickIndex[brickId] = true;
                     runAppend();
                  }
               }

               if (waitForImage) {
                  child.imagesLoaded(reload);
               } else {
                  reload();
               }
//               if (waitForImage) {
//                  child.imagesLoaded(addBrick);
//               } else {
//                  addBrick();
//               }
            };

            this.removeBrick = function(brick, brickId){
               if(_.has(brickIndex, brickId)) {
                  dropBricks.push(brickIndex[brickId]);
                  delete brickIndex[brickId];
//                  runRemove();
                  reload();
               }
            };

            $scope.$on('masonry:resort', reload);
         }
      };
   }])
   .directive('masonryBrick', function ($compile) {
      return {
         restrict: 'AC',
         require : '^masonry',
         link: function (scope, elem, attrs, MasonryCtrl) {
            MasonryCtrl.appendBrick(elem, scope.$id, true);

            scope.$on("$destroy",function(){
               MasonryCtrl.removeBrick(elem);
            });
         }
      };
   });
