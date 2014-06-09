
# Firereader

Firereader is a fully functional, real-time content aggregator built using [Angular](http://www.angularjs.org) and [Firebase](http://www.firebase.com). It's also completly server-less!

It contains a fully functional client in the app/ directory, and a service that parses RSS data and pushes it into Firebase in the service/ directory.

<h1><a href="http://firebase.github.io/firereader/">See it in action</a></h1>

## Installation

 - `git clone https://github.com/firebase/firereader.git`
 - Open and configure `js/config.js` and set `FIREBASE_URL` to your own Firebase instance.
 - Import `setup/seed.json` into your Firebase.
 - Add `setup/security_rules.json` to your security rules

## Use this code as an example.

Firereader was built using [AngularFire-seed](https://github.com/firebase/angularFire-seed). If you want to build similar angularFire apps, check it out!

## Contributing

To contribute to Firereader, please fork this project on GitHub, then use the Pull Request feature to submit your changes. All contributions must pass the Travis integration tests before they will be merged. Please add appropriate tests to the e2e and test unit libs.

## Contact

Submit questions or bugs using the [issue tracker](http://github.com/firebase/firereader). For Firebase-releated questions, try the [mailing list](https://groups.google.com/forum/#!forum/firebase-talk).

## License

[MIT](http://firebase.mit-license.org/)
