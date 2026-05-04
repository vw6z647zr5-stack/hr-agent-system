const { request } = require('./api');

function login(username, password) {
  return request('/auth/login', {
    method: 'POST',
    data: {
      username,
      password,
    },
  });
}

function registerCandidate(payload) {
  return request('/auth/candidate-register', {
    method: 'POST',
    data: payload,
  });
}

function getCurrentUser() {
  return request('/auth/me');
}

module.exports = {
  login,
  registerCandidate,
  getCurrentUser,
};
