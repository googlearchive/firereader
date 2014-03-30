/*! animations.js
 *************************************/
(function (angular, $) {
   "use strict";

   var ngModule = angular.module('myApp.animate', ['ngAnimate']);

   ngModule.animation('.animate-articles', function() {
      return {
         enter: animateMove,
         leave: opacityTo,
         move: animateMove
      };
   });

   function opacityTo(element, done) {
      element.animate({opacity: 0}, {
         duration: 250,
         complete: done
      });
   }

   function animateMove(element, done, opts) {
      element.css('opacity', 0);
      opts = _.extend({ duration: 750, to: element.position()||{top: 0, left: 0}, from: element.data('oldPosition') || {top: 0, left: 0}, sop: 0, eop: 1 }, opts);
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
            'top': opts.to.top,
            'left': opts.to.left,
            'opacity': opts.eop
         }, {
            queue: false,
            duration: opts.duration,
            complete: function() {
               element.data('oldPosition', element.position());
               element.css({opacity: 1});
               copy.remove();
               //an angular function that must be called when animation completes
               done()
            }
         });
   }

})(angular, jQuery);