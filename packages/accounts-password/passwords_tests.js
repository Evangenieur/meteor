if (Meteor.isClient) (function () {

  // XXX note, only one test can do login/logout things at once! for
  // now, that is this test.

  Accounts._isolateLoginTokenForTest();

  var logoutStep = function (test, expect) {
    Meteor.logout(expect(function (error) {
      test.equal(error, undefined);
      test.equal(Meteor.user(), null);
    }));
  };

  var verifyUsername = function (someUsername, test, expect) {
    var callWhenLoaded = expect(function() {
      test.equal(Meteor.user().username, someUsername);
    });
    return function () {
      Meteor._autorun(function(handle) {
        if (Meteor.userLoading()) return;
        handle.stop();
        callWhenLoaded();
      });
    };
  };
  var loggedInAs = function (someUsername, test, expect) {
    var quiesceCallback = verifyUsername(someUsername, test, expect);
    return expect(function (error) {
      test.equal(error, undefined);
      Meteor.default_connection.onQuiesce(quiesceCallback);
    });
  };

  // declare variable outside the testAsyncMulti, so we can refer to
  // them from multiple tests, but initialize them to new values inside
  // the test so when we use the 'debug' link in the tests, they get new
  // values and the tests don't fail.
  var username, username2, username3;
  var email;
  var password, password2, password3;

  testAsyncMulti("passwords - long series", [
    function (test, expect) {
      username = Meteor.uuid();
      username2 = Meteor.uuid();
      username3 = Meteor.uuid();
      // use -intercept so that we don't print to the console
      email = Meteor.uuid() + '-intercept@example.com';
      password = 'password';
      password2 = 'password2';
      password3 = 'password3';
    },

    function (test, expect) {
      Accounts.createUser(
        {username: username, email: email, password: password},
        loggedInAs(username, test, expect));
    },
    logoutStep,
    function (test, expect) {
      Meteor.loginWithPassword(username, password,
                               loggedInAs(username, test, expect));
    },
    logoutStep,
    function (test, expect) {
      Meteor.loginWithPassword({username: username}, password,
                               loggedInAs(username, test, expect));
    },
    logoutStep,
    function (test, expect) {
      Meteor.loginWithPassword(email, password,
                               loggedInAs(username, test, expect));
    },
    logoutStep,
    function (test, expect) {
      Meteor.loginWithPassword({email: email}, password,
                               loggedInAs(username, test, expect));
    },
    logoutStep,
    // plain text password. no API for this, have to send a raw message.
    function (test, expect) {
      Meteor.call(
        // wrong password
        'login', {user: {email: email}, password: password2},
        expect(function (error, result) {
          test.isTrue(error);
          test.isFalse(result);
          test.isFalse(Meteor.user());
      }));
    },
    function (test, expect) {
      var quiesceCallback = verifyUsername(username, test, expect);
      Meteor.call(
        // right password
        'login', {user: {email: email}, password: password},
        expect(function (error, result) {
          test.equal(error, undefined);
          test.isTrue(result.id);
          test.isTrue(result.token);
          // emulate the real login behavior, so as not to confuse test.
          Accounts._makeClientLoggedIn(result.id, result.token);
          Meteor.default_connection.onQuiesce(quiesceCallback);
      }));
    },
    // change password with bad old password. we stay logged in.
    function (test, expect) {
      var quiesceCallback = verifyUsername(username, test, expect);
      Accounts.changePassword(password2, password2, expect(function (error) {
        test.isTrue(error);
        Meteor.default_connection.onQuiesce(quiesceCallback);
      }));
    },
    // change password with good old password.
    function (test, expect) {
      Accounts.changePassword(password, password2,
                              loggedInAs(username, test, expect));
    },
    logoutStep,
    // old password, failed login
    function (test, expect) {
      Meteor.loginWithPassword(email, password, expect(function (error) {
        test.isTrue(error);
        test.isFalse(Meteor.user());
      }));
    },
    // new password, success
    function (test, expect) {
      Meteor.loginWithPassword(email, password2,
                               loggedInAs(username, test, expect));
    },
    logoutStep,
    // create user with raw password
    function (test, expect) {
      var quiesceCallback = verifyUsername(username2, test, expect);
      Meteor.call('createUser', {username: username2, password: password2},
                  expect(function (error, result) {
                    test.equal(error, undefined);
                    test.isTrue(result.id);
                    test.isTrue(result.token);
                    // emulate the real login behavior, so as not to confuse test.
                    Accounts._makeClientLoggedIn(result.id, result.token);
                    Meteor.default_connection.onQuiesce(quiesceCallback);
                  }));
    },
    logoutStep,
    function(test, expect) {
      Meteor.loginWithPassword({username: username2}, password2,
                               loggedInAs(username2, test, expect));
    },
    logoutStep,
    // test Accounts.validateNewUser
    function(test, expect) {
      Accounts.createUser({username: username3, password: password3},
                        {invalid: true}, // should fail the new user validators
                        expect(function (error) {
                          test.equal(error.error, 403);
                        }));
    },
    // test Accounts.onCreateUser
    function(test, expect) {
      Accounts.createUser(
        {username: username3, password: password3},
        {testOnCreateUserHook: true},
        loggedInAs(username3, test, expect));
    },
    function(test, expect) {
      test.equal(Meteor.user().profile.touchedByOnCreateUser, true);
    },

    // test Meteor.user(). This test properly belongs in
    // accounts-base/accounts_tests.js, but this is where the tests that
    // actually log in are.
    function(test, expect) {
      var clientUser = Meteor.user();
      Meteor.call('testMeteorUser', expect(function (err, result) {
        test.equal(result._id, clientUser._id);
        test.equal(result.profile.touchedByOnCreateUser, true);
        test.equal(err, undefined);
      }));
    },
    logoutStep,
    function(test, expect) {
      var clientUser = Meteor.user();
      test.equal(clientUser, null);
      Meteor.call('testMeteorUser', expect(function (err, result) {
        test.equal(err, undefined);
        test.equal(result, null);
      }));
    }

  ]);

}) ();


if (Meteor.isServer) (function () {

  Tinytest.add(
    'passwords - setup more than one onCreateUserHook',
    function (test) {
      test.throws(function() {
        Accounts.onCreateUser(function () {});
      });
    });


  Tinytest.add(
    'passwords - createUser hooks',
    function (test) {
      var email = Meteor.uuid() + '@example.com';
      test.throws(function () {
        Accounts.createUser({email: email},
                            {invalid: true}); // should fail the new user validators
        });

      // disable sending emails
      var oldEmailSend = Email.send;
      Email.send = function() {};
      var userId = Accounts.createUser({email: email},
                                       {testOnCreateUserHook: true});
      Email.send = oldEmailSend;

      test.isTrue(userId);
      var user = Meteor.users.findOne(userId);
      test.equal(user.profile.touchedByOnCreateUser, true);
    });


  Tinytest.add(
    'passwords - setPassword',
    function (test) {
      var username = Meteor.uuid();

      var userId = Accounts.createUser({username: username}, {});

      var user = Meteor.users.findOne(userId);
      // no services yet.
      test.equal(user.services.password, undefined);

      // set a new password.
      Meteor.setPassword(userId, 'new password');
      user = Meteor.users.findOne(userId);
      var oldVerifier = user.services.password.srp;
      test.isTrue(user.services.password.srp);

      // reset with the same password, see we get a different verifier
      Meteor.setPassword(userId, 'new password');
      user = Meteor.users.findOne(userId);
      var newVerifier = user.services.password.srp;
      test.notEqual(oldVerifier.salt, newVerifier.salt);
      test.notEqual(oldVerifier.identity, newVerifier.identity);
      test.notEqual(oldVerifier.verifier, newVerifier.verifier);

      // cleanup
      Meteor.users.remove(userId);
    });


  // This test properly belongs in accounts-base/accounts_tests.js, but
  // this is where the tests that actually log in are.
  Tinytest.add('accounts - user() out of context', function (test) {
    // basic server context, no method.
    test.throws(function () {
      Meteor.user();
    });
  });

  // XXX would be nice to test Accounts.config({forbidSignups: true})
}) ();
