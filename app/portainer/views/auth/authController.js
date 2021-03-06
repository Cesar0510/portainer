angular.module('portainer.app')
.controller('AuthenticationController', ['$q', '$scope', '$state', '$stateParams', '$sanitize', 'Authentication', 'UserService', 'EndpointService', 'ExtensionService', 'StateManager', 'Notifications', 'SettingsService', 'URLHelper',
function($q, $scope, $state, $stateParams, $sanitize, Authentication, UserService, EndpointService, ExtensionService, StateManager, Notifications, SettingsService, URLHelper) {
  $scope.logo = StateManager.getState().application.logo;

  $scope.formValues = {
    Username: '',
    Password: ''
  };

  $scope.state = {
    AuthenticationError: '',
    isInOAuthProcess: true,
    OAuthProvider: ''
  };

  function retrieveAndSaveEnabledExtensions() {
    try {
      ExtensionService.retrieveAndSaveEnabledExtensions();
    } catch (err) {
      Notifications.error('Failure', err, 'Unable to retrieve enabled extensions');
    }
  }

  $scope.authenticateUser = function() {
    var username = $scope.formValues.Username;
    var password = $scope.formValues.Password;

    Authentication.login(username, password)
    .then(function success() {
      retrieveAndSaveEnabledExtensions();
      checkForEndpoints();
    })
    .catch(function error() {
      SettingsService.publicSettings()
      .then(function success(settings) {
        if (settings.AuthenticationMethod === 1) {
          return Authentication.login($sanitize(username), $sanitize(password));
        }
        return $q.reject();
      })
      .then(function success() {
        retrieveAndSaveEnabledExtensions();
        $state.go('portainer.updatePassword');
      })
      .catch(function error() {
        $scope.state.AuthenticationError = 'Invalid credentials';
      });
    });
  };

  function unauthenticatedFlow() {
    EndpointService.endpoints()
    .then(function success(endpoints) {
      if (endpoints.length === 0) {
        $state.go('portainer.init.endpoint');
      } else {
        $state.go('portainer.home');
      }
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to retrieve endpoints');
    });
  }

  function authenticatedFlow() {
    UserService.administratorExists()
    .then(function success(exists) {
      if (!exists) {
        $state.go('portainer.init.admin');
      }
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to verify administrator account existence');
    });
  }

  function checkForEndpoints() {
    EndpointService.endpoints()
    .then(function success(data) {
      var endpoints = data;

      if (endpoints.length === 0 && Authentication.isAdmin()) {
        $state.go('portainer.init.endpoint');
      } else {
        $state.go('portainer.home');
      }
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to retrieve endpoints');
    });
  }

  function determineOauthProvider(LoginURI) {
    if (LoginURI.indexOf('login.microsoftonline.com') !== -1) {
      return 'Microsoft';
    }
    else if (LoginURI.indexOf('accounts.google.com') !== -1) {
      return 'Google';
    }
    else if (LoginURI.indexOf('github.com') !== -1) {
      return 'Github';
    }
    return 'OAuth';
  }

  function initView() {
    SettingsService.publicSettings()
    .then(function success(settings) {
      $scope.AuthenticationMethod = settings.AuthenticationMethod;
      $scope.OAuthLoginURI = settings.OAuthLoginURI;
      $scope.state.OAuthProvider = determineOauthProvider(settings.OAuthLoginURI);
    });

    if ($stateParams.logout || $stateParams.error) {
      Authentication.logout();
      $scope.state.AuthenticationError = $stateParams.error;
      $scope.state.isInOAuthProcess = false;
      return;
    }

    if (Authentication.isAuthenticated()) {
      $state.go('portainer.home');
    }

    var authenticationEnabled = $scope.applicationState.application.authentication;
    if (!authenticationEnabled) {
      unauthenticatedFlow();
    } else {
      authenticatedFlow();
    }

    var code = URLHelper.getParameter('code');
    if (code) {
      oAuthLogin(code);
    } else {
      $scope.state.isInOAuthProcess = false;
    }
  }

  function oAuthLogin(code) {
    return Authentication.OAuthLogin(code)
    .then(function success() {
      retrieveAndSaveEnabledExtensions();
      URLHelper.cleanParameters();
    })
    .catch(function error() {
      $scope.state.AuthenticationError = 'Unable to login via OAuth';
      $scope.state.isInOAuthProcess = false;
    });
  }


  initView();
}]);
