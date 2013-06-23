basePath = '../';

files = [
  JASMINE,
  JASMINE_ADAPTER,
  'http://static.firebase.com/v0/firebase.js',
  'https://cdn.firebase.com/v0/firebase-auth-client.js',
  'app/lib/angular/angular.js',
  'app/lib/angular/angular-*.js',
  'app/lib/util/*.js',
  'app/lib/firebase/*.js',
  'test/lib/angular/angular-mocks.js',
  'app/js/**/*.js',
  'test/unit/**/*.js'
];

autoWatch = true;

browsers = ['Chrome'];

junitReporter = {
  outputFile: 'test_out/unit.xml',
  suite: 'unit'
};
