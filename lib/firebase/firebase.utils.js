
angular.module('firebase.utils', ['firebase'])

// a simple utility to create references to Firebase paths
    .factory('firebaseRef', ['Firebase', 'FIREBASE_URL', function(Firebase, FIREBASE_URL) {
        /**
         * @function
         * @name firebaseRef
         * @param {String|Array...} path
         * @return a Firebase instance
         */
        return function(path) {
            return new Firebase(pathRef([FIREBASE_URL].concat(Array.prototype.slice.call(arguments))));
        }
    }])

    // a simple utility to create $firebase objects from angularFire
    .service('syncData', ['$firebase', 'firebaseRef', function($firebase, firebaseRef) {
        /**
         * @function
         * @name syncData
         * @param {String|Array...} path
         * @param {int} [limit]
         * @return a Firebase instance
         */
        return function(path, limit) {
            var ref = firebaseRef(path);
            limit && (ref = ref.limit(limit));
            return $firebase(ref);
        }
    }]);

function pathRef(args) {
    for(var i=0; i < args.length; i++) {
        if( args[i] && angular.isArray(args[i]) ) {
            args[i] = pathRef(args[i]);
        }
    }
    return args.join('/');
}