/*! animations.js
 *************************************/
(function (angular, $) {
   "use strict";

   var ngModule = angular.module('myApp.animate', []);

   ngModule.animation('animate-enter', ['$timeout', function($timeout) {
      return {
         setup : function(element) {
            //prepare the element for animation
            element.css('opacity', 0);
//            return 1;
         },
         start : animateMove.bind(null, $timeout)
      }
   }]);

   ngModule.animation('animate-leave', ['$timeout', function($timeout) {
      return {
         setup : function(element) {
            //prepare the element for animation
            return 0;
         },
         start : opacityTo
      }
   }]);

   ngModule.animation('animate-move', ['$timeout', function($timeout) {
      return {
         setup : function(element) {
            var old = element.parent().offset()/*element.data('oldOffset')*/, curr = element.offset();
//            element/*.offset(old)*/.css({'opacity': 0});
            return { sop: 1 };
         },
         start : animateMove.bind(null, $timeout)
      }
   }]);

   function opacityTo(element, done, amt) {
      element.animate({opacity: amt}, {
         duration: 500,
         complete: done
      });
   }

   function animateMove($timeout, element, done, opts) {
//      element.parent().css('height', element.parent().height()+'px');
         element.css('opacity', 0);
      $timeout(function() {
         opts = _.extend({ duration: 750, to: element.position()||{top: 0, left: 0}, from: element.data('oldPosition') || {top: 0, left: 0}, sop: 0, eop: 1 }, opts);
         element.attr('id') === '7e933e67582c961befd4895d7d0164368802217c' && console.log('animateMove', opts.from, opts.to, element.position()); //debug
         var copy = element.clone();
         copy
            .stop()
            .css({
               'position': 'absolute',
               'opacity': opts.sop,
               'z-index': 10,
               'top': opts.from.top,
               'left': opts.from.left
            })
            .appendTo(element.parent())
            .animate({
               'queue': false,
               'top': opts.to.top,
               'left': opts.to.left,
               'opacity': opts.eop
            }, {
   //            queue: false,
               duration: opts.duration,
               complete: function() {
                  //               element.parent().css('height', 'auto');
                  element.data('oldPosition', element.position());
                  element.css({opacity: 1});
                  element.attr('id') === '7e933e67582c961befd4895d7d0164368802217c' && console.log('animate done', element.position()); //debug
                  copy.remove();
                  //call when the animation is complete
                  done()
               }
            });
      }, 100);
   }

})(angular, jQuery);