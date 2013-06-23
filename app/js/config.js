
angular.module('myApp.config', [])
   .value('version', '0.1')

   .value('FIREBASE_URL', 'https://fireplace.firebaseio.com/')

   .value('authProviders', [
      { id: 'persona',  name: 'Persona',  icon: 'icon-user'     },
      { id: 'twitter',  name: 'Twitter',  icon: 'icon-twitter'  },
      { id: 'facebook', name: 'Facebook', icon: 'icon-facebook' },
      { id: 'github',   name: 'GitHub',   icon: 'icon-github'   }
//         { id: 'email',    name: 'Email',    icon: 'icon-envelope' }
   ])

   .config(function($logProvider) {
      // set these to false to turn off non-essential console logging
      $logProvider.debugEnabled && $logProvider.debugEnabled(true);
   });