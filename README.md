
# Firereader

Firereader is a fully functional, real-time content aggregator built using [Angular](http://www.angularjs.org) and [Firebase](http://www.firebase.com).

It contains a fully functional client in the app/ directory, and a service that parses RSS data and pushes it into Firebase in the service/ directory.

<h1><a href="http://firereader.io">Visit Firereader.io and see it in action</a></h1>

## Installation

To install a Firereader service, follow these steps:
* open app/js/config.js and set the `FIREBASE_URL` to your namespace
* cd into service/
* run `npm install` to configure dependencies
* start feeds.js: `FBURL="https://<NAMESPACE>.firebaseio.com/user" SECRET="xxx" node ./feeds.js`

## Use this code in your project

Firereader was built using [angularFire](https://github.com/firebase/angularFire) as a demo app. If you are looking for a working example project to build AngularFire apps, check out [AngularFire-seed](https://github.com/firebase/angularFire-seed)!

## Contributing

To contribute to Firereader, please fork this project on GitHub, then use the Pull Request feature to submit your changes. All contributions must pass the Travis integration tests before they will be merged. Please add appropriate tests to the e2e and test unit libs.

### Testing your changes

You can test your changes using the Angular built-in tests. See the [angular-seed e2e tests doc](https://github.com/angular/angular-seed#end-to-end-testing)

## Contact

Submit questions or bugs using the [issue tracker](http://github.com/firebase/firereader). For Firebase-releated questions, try the [mailing list](https://groups.google.com/forum/#!forum/firebase-talk).

## License

[MIT](http://firebase.mit-license.org/)