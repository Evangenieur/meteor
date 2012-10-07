(function () {

  Meteor.userId = function () {
    return Meteor.default_connection.userId();
  };

  // Only call this in a context where you've already checked
  // Meteor.userLoading().
  Meteor.user = function () {
    var userId = Meteor.userId();
    if (!userId)
      return null;
    return Meteor.users.findOne(userId);
  };

  Meteor.logout = function (callback) {
    Meteor.apply('logout', [], {wait: true}, function(error, result) {
      if (error) {
        callback && callback(error);
      } else {
        Accounts._makeClientLoggedOut();
        callback && callback();
      }
    });
  };

  // If we're using Handlebars, register the {{currentUser}} and
  // {{currentUserLoading}} global helpers.
  if (window.Handlebars) {
    Handlebars.registerHelper('currentUser', function () {
      // This lets us do "{{#if currentUser}}" outside of "{{#if
      // currentUserLoading}}".
      if (Meteor.userLoading()) return true;
      return Meteor.user();
    });
    Handlebars.registerHelper('currentUserLoading', function () {
      return Meteor.userLoading();
    });
  }

  // XXX this can be simplified if we merge in
  // https://github.com/meteor/meteor/pull/273
  var loginServicesConfigured = false;
  var loginServicesConfiguredListeners = new Meteor.deps._ContextSet;
  Meteor.subscribe("meteor.loginServiceConfiguration", function () {
    loginServicesConfigured = true;
    loginServicesConfiguredListeners.invalidateAll();
  });

  // A reactive function returning whether the
  // loginServiceConfiguration subscription is ready. Used by
  // accounts-ui to hide the login button until we have all the
  // configuration loaded
  Accounts.loginServicesConfigured = function () {
    if (loginServicesConfigured)
      return true;

    // not yet complete, save the context for invalidation once we are.
    loginServicesConfiguredListeners.addCurrentContext();
    return false;
  };
})();
