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
          'dilbert': {"title": "Dilbert Daily Strip", active: true},
          'engadget': {"title":"Engadget RSS Feed", active: true},
          'firebase': {'title': 'Firebase Blog', active: true},
          'techcrunch': {"title":"TechCrunch", active: true},
          'xkcd': {"title":"xkcd.com", active: false}
       };

      $scope.searchText = null;

      $scope.timestamp = function(article) {
         return new Date(article.date).getTime();
      };

      $scope.articles = angularFireAggregate($scope, _.map($scope.feeds, function(v,k) {
         //todo make limits configurable by feed? by user?
         return new Firebase('https://feeds.firebaseio.com/'+k+'/articles').limit(5);
      }), function() {
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

         $scope.$on('angulareFireAggregate-child_added', resort);
         $scope.$on('angulareFireAggregate-child_changed', resort);
         $scope.$on('angulareFireAggregate-child_removed', resort);
         $scope.$on('angulareFireAggregate-child_moved', resort);

         $scope.$watch('searchText', resort);

         $scope.$watch('sortBy', function() {
            localStorage.set('sortBy', $scope.sortBy);
            resort();
         });

         $scope.$watch('feeds', resort, true);
      });

      function getFeedFor(article) {
         var n = article.$ref.parent().parent().name()||'';
         return $scope.feeds[n] || {active: false, title: $scope.feedChoices[n]};
      }

      $scope.isFiltered = function(article) {
         return !getFeedFor(article).active;
      };

      $scope.feedChoices =
         {"xkcd":{"title":"xkcd.com","url":"http://xkcd.com/","description":"xkcd.com: A webcomic of romance and math humor."},"techcrunch":{"title":"TechCrunch","url":"http://techcrunch.com","description":"TechCrunch is a group-edited blog that profiles the companies, products and events defining and transforming the new web."},"gizmodo":{"title":"Gizmodo","url":"http://gizmodo.com","description":"The Gadget Guide"},"ars":{"title":"Ars Technica","url":"http://arstechnica.com","description":"The Art of Technology"},"lifehacker":{"title":"Lifehacker","url":"http://lifehacker.com","description":"Tips and downloads for getting things done"},"newsblur":{"title":"The NewsBlur Blog","url":"http://blog.newsblur.com/","description":"NewsBlur is a personal news reader that brings people together to talk about the world. A new sound of an old instrument."},"google":{"title":"The Official Google Blog","url":"http://googleblog.blogspot.com/","description":"Insights from Googlers into our products, technology, and the Google culture."},"slashdot":{"title":"Slashdot","url":"http://slashdot.org/","description":"News for nerds, stuff that matters"},"fireball":{"title":"Daring Fireball","url":"http://daringfireball.net/","description":"Mac and web curmudgeonry/nerdery. By John Gruber."},"engadget":{"title":"Engadget RSS Feed","url":"http://www.engadget.com","description":"Engadget"},"wired":{"title":"Wired Top Stories","url":"http://www.wired.com","description":"Top Stories"},"boing":{"title":"Boing Boing","url":"http://boingboing.net","description":"Brain candy for Happy Mutants"},"bigpicture":{"title":"The Big Picture","url":"http://www.boston.com/bigpicture/","description":"News Stories in Photographs from the Boston Globe"},"oatmeal":{"title":"The Oatmeal - Comics, Quizzes, & Stories","url":"http://theoatmeal.com/","description":"The oatmeal tastes better than stale skittles found under the couch cushions"},"codinghorror":{"title":"Coding Horror","url":"http://www.codinghorror.com/blog/","description":"programming and human factors - Jeff Atwood"},"kottke":{"title":"kottke.org","url":"http://kottke.org/","description":"Jason Kottke's weblog, home of fine hypertext products"},"smbc":{"title":"Saturday Morning Breakfast Cereal (updated daily)","url":"http://www.smbc-comics.com","description":"The Saturday Morning Breakfast Cereal Blog"},"smashing":{"title":"Smashing Magazine Feed","url":"http://www.smashingmagazine.com/","description":"For Professional Web Designers and Developers"},"tuaw":{"title":"TUAW - The Unofficial Apple Weblog","url":"http://www.tuaw.com","description":"TUAW - The Unofficial Apple Weblog"},"gmail":{"title":"Gmail Blog","url":"http://gmailblog.blogspot.com/","description":"News, tips and tricks from Google's Gmail team and friends."},"macrumors":{"title":"MacRumors: Mac News and Rumors - All Stories","url":"http://www.macrumors.com","description":"the mac news you care about"},"make":{"title":"MAKE","url":"http://blog.makezine.com","description":"DIY projects, how-tos, and inspiration from geeks, makers, and hackers"},"joel":{"title":"Joel on Software","url":"http://www.joelonsoftware.com","description":"Painless Software Management"},"reader":{"title":"Official Google Reader Blog","url":"http://googlereader.blogspot.com/","description":"News, tips and tricks from the Google reader team."},"dilbert":{"title":"Dilbert Daily Strip","url":"http://dilbert.com/","description":"The Official Dilbert Daily Comic Strip RSS Feed"},"nyt":{"title":"NYT > U.S.","url":"http://www.nytimes.com/pages/national/index.html?partner=rss&emc=rss","description":"US"},"bbc":{"title":"BBC News - Home","url":"http://www.bbc.co.uk/news/#sa-ns_mchannel=rss&ns_source=PublicRSS20-sa","description":"The latest stories from the Home section of the BBC News web site."},"failblog":{"title":"FAIL Blog","url":"http://failblog.cheezburger.com/","description":"Funny FAIL Pictures and Videos"},"alistapart":{"title":"A List Apart: The Full Feed","url":"http://alistapart.com","description":"Articles, columns, and blog posts for people who make web sites."},"marco":{"title":"Marco.org","url":"http://www.marco.org/","description":"I’m Marco Arment, creator of Instapaper, technology writer, and coffee enthusiast."},"verge":{"title":"The Verge -  All Posts","url":"http://www.theverge.com/"},"zenhabits":{"title":"zenhabits","url":"http://zenhabits.net","description":"breathe"},"dailywtf":{"title":"The Daily WTF","url":"http://thedailywtf.com/","description":"Curious Perversions in Information Technology"},"seth":{"title":"Seth Godin's Blog on marketing, tribes and respect","url":"http://sethgodin.typepad.com/seths_blog/","description":"Seth Godin's riffs on marketing, respect, and the ways ideas spread."},"penny":{"title":"Penny Arcade","url":"http://www.penny-arcade.com","description":"News Fucker 5000"},"whatif":{"title":"What If?","url":"http://what-if.xkcd.com/"},"readwrite":{"title":"ReadWrite","url":"http://readwrite.com"},"qc":{"title":"QC RSS","url":"http://www.questionablecontent.net","description":"The Official QC RSS Feed"},"cooltools":{"title":"Cool Tools","url":"http://kk.org/cooltools","description":"Cool tools really work. A cool tool can be any book, gadget, software, video, map, hardware, material, or website that is tried and true. All reviews on this site are written by readers who have actually used the tool and others like it. Items can be either old or new as long as they are wonderful. We only post things we like and ignore the rest. Suggestions for tools much better than what is recommended here are always wanted. Tell me what you love."},"googleos":{"title":"Google Operating System","url":"http://googlesystem.blogspot.com/","description":"Unofficial news and tips about Google. A blog that watches Google's latest developments and the attempts to move your operating system online."},"smitten":{"title":"smitten kitchen","url":"http://smittenkitchen.com"},"cnn":{"title":"CNN.com - Top Stories","url":"http://www.cnn.com/index.html?eref=rss_topstories","description":"CNN.com delivers up-to-the-minute news and information on the latest top stories, weather, entertainment, politics and more."},"hn":{"title":"Hacker News","url":"https://news.ycombinator.com/","description":"Links for the intellectually curious, ranked by readers."},"rands":{"title":"Rands In Repose","url":"http://www.randsinrepose.com/"},"waxy":{"title":"Waxy.org","url":"http://waxy.org/","description":"Andy Baio lives here"},"venturebeat":{"title":"VentureBeat","url":"http://venturebeat.com","description":"News About Tech, Money and Innovation"},"apartment":{"title":"Apartment Therapy | Saving the world, one room at a time","url":"http://www.apartmenttherapy.com/feedburnermain","description":"Saving the world, one room at a time"},"hyperbole":{"title":"Hyperbole and a Half","url":"http://hyperboleandahalf.blogspot.com/","description":"Blog of Indescribable Awesomeness"},"gigaom":{"title":"GigaOM","url":"http://gigaom.com"},"schneier":{"title":"Schneier on Security","url":"http://www.schneier.com/blog/","description":"A blog covering security and security technology."}}
      ;
   }]);


function randomDescription() {
   var choices = [
      '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque a gravida lectus, et malesuada dui. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>',
      '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque a gravida lectus, et malesuada dui. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas porta lectus nulla, non rhoncus est tincidunt eget. Proin pellentesque consequat augue, at suscipit ipsum rutrum et.</p>',
      '<p>Praesent accumsan lacus at enim viverra, ut mollis ipsum dignissim. Vestibulum blandit dolor in lectus sodales, a rhoncus mi convallis. Nunc imperdiet elit quis ante convallis, at gravida erat scelerisque. Suspendisse at nisl eget leo volutpat vulputate. Praesent pharetra nec nunc vel pellentesque. Praesent facilisis sem eros, non imperdiet libero mollis in. Donec et varius dui, non cursus lacus. Cras ultricies ipsum sit amet sodales dignissim.</p><p>Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Donec ac velit gravida eros cursus aliquam. Suspendisse odio magna, sodales ac nisl pellentesque, viverra facilisis augue. Mauris ac lacus eget justo tristique dapibus eget vitae risus. Mauris tincidunt nunc sit amet nunc convallis fermentum. Morbi fermentum porttitor fringilla. Etiam urna neque, condimentum a sapien commodo, vestibulum sagittis nulla. Donec porttitor purus viverra ornare dictum. Praesent porttitor neque ut ipsum vestibulum, sed pulvinar sem laoreet.</p>',
      '<p>Nulla ut ultrices nulla. Sed arcu magna, tempus id mollis ut, imperdiet ac ante. Aenean eros urna, ornare at tempus ut, interdum et libero. Aenean ut imperdiet arcu. Nam nec massa quis nisl cursus sodales. Curabitur mollis neque ut dolor gravida faucibus. Duis quis euismod libero.</p><p>Maecenas malesuada interdum leo. Quisque nec lacus sollicitudin, venenatis dui rutrum, hendrerit elit. Aliquam eu euismod lorem, sed laoreet orci. Vivamus nec porttitor nibh. Praesent semper tristique facilisis. Fusce quis laoreet leo, egestas auctor urna. Sed mattis ac nulla ut mollis. Vestibulum sed risus aliquam dolor rhoncus hendrerit. Mauris eu interdum metus. Donec nec mollis ligula, aliquet tincidunt nisl. Maecenas nulla mauris, egestas sed porttitor bibendum, convallis ac turpis. Curabitur sodales bibendum elit, ut suscipit ipsum rutrum non. Integer consequat elit a iaculis rutrum. Aenean metus velit, varius ac lacus nec, mollis condimentum tellus. Sed egestas elit sed justo eleifend cursus. Nunc vel porttitor lacus.</p><p>Proin tristique nulla et elementum lobortis. Pellentesque lectus nisi, dapibus et enim ut, auctor condimentum turpis. Phasellus vitae fringilla tortor. Nulla consequat consectetur enim, a bibendum ipsum consequat a. Proin nunc mauris, dapibus a lectus ut, cursus lobortis risus. In vestibulum, augue ut cursus convallis, nibh arcu imperdiet tellus, et gravida odio nibh nec leo. Praesent non luctus leo. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec sit amet lorem imperdiet libero laoreet fermentum. Morbi sapien tellus, bibendum non dui non, fringilla varius purus. Sed aliquam, velit sed iaculis interdum, neque turpis porttitor enim, nec accumsan elit dolor sagittis lectus. Phasellus commodo urna nunc, rutrum tempus nunc accumsan in. Sed risus quam, consectetur sit amet ullamcorper ac, laoreet eu arcu. Aenean id congue nisl.</p><p>Integer iaculis sem id hendrerit imperdiet. Phasellus lacinia dolor eu ultrices blandit. Vivamus porttitor ligula at scelerisque bibendum. Phasellus quis cursus lectus, id scelerisque sapien. Etiam eget purus suscipit lorem placerat varius. Vivamus vestibulum sollicitudin erat, ac convallis neque dictum nec. Nam dapibus magna eu magna feugiat suscipit. Aliquam erat volutpat. Nunc eu ultricies lorem, a elementum tellus. Curabitur facilisis, erat nec consectetur bibendum, lorem dolor dapibus est, vel accumsan quam orci ut lorem. Donec volutpat massa tristique nisi dapibus ultrices. Fusce pellentesque, augue eu ornare consectetur, magna leo fermentum nunc, id tempus ante purus ut dolor. Duis lectus urna, sollicitudin sit amet viverra et, rutrum a lectus. Integer non orci bibendum, viverra odio vitae, egestas velit.</p><p>Ut eleifend lobortis turpis. Suspendisse vehicula sodales convallis. Maecenas ullamcorper congue tellus et luctus. Fusce imperdiet pharetra facilisis. Curabitur eu semper urna, placerat commodo sem. Suspendisse potenti. Aenean vestibulum erat eu congue consectetur. Fusce sed tempus mi. Pellentesque eros eros, accumsan at tincidunt a, rhoncus sed felis. Donec feugiat justo sed ante semper, sed bibendum justo iaculis. Morbi a leo adipiscing massa commodo blandit.</p>'
   ];

   return choices[_.random(0, choices.length-1)];
}