'use strict';

/* http://docs.angularjs.org/guide/dev_guide.e2e-testing */

describe('my app', function() {

  beforeEach(function() {
    browser().navigateTo('../../app/index.html');
  });

  it('should automatically redirect to /demo when location hash/fragment is empty', function() {
    expect(browser().location().url()).toBe("/demo");
  });

   describe('hearth', function() {
      beforeEach(function() {
         browser().navigateTo('#/hearth');
      });

      it('should render hearth when user navigates to /hearth', function() {
         expect(element('[ng-view] #feeds').count()).toBe(1);
      });
   });

   describe('demo', function() {
      beforeEach(function() {
         browser().navigateTo('#/demo');
      });

      it('should render demo when user navigates to /demo', function() {
         expect(element('[ng-view] #feeds').count()).toBe(1);
      });
   });

  describe('account', function() {
    beforeEach(function() {
      browser().navigateTo('#/account');
    });

     it('should render account when user navigates to /account', function() {
        expect(element('[ng-view] #account').count()).toBe(1);
     });
  });
});
