const { request, upload } = require('./api');

function getSelfServiceDashboard() {
  return request('/self-service/dashboard');
}

function createLeaveRequest(payload) {
  return request('/self-service/leave-requests', {
    method: 'POST',
    data: payload,
  });
}

function createOvertimeRequest(payload) {
  return request('/self-service/overtime-requests', {
    method: 'POST',
    data: payload,
  });
}

function createProfileChangeRequest(payload) {
  return request('/self-service/profile-change-requests', {
    method: 'POST',
    data: payload,
  });
}

function chatWithEmployeeService(message) {
  return request('/agent/employee-service/chat', {
    method: 'POST',
    data: { message },
  });
}

function listPublicJobs() {
  return request('/career/job-postings?page=1&limit=20');
}

function getCandidateProfile() {
  return request('/career/me');
}

function submitCareerApplication(payload, filePath) {
  return upload('/career/applications', filePath, {
    ...payload,
    skills: JSON.stringify(payload.skills || []),
  });
}

module.exports = {
  getSelfServiceDashboard,
  createLeaveRequest,
  createOvertimeRequest,
  createProfileChangeRequest,
  chatWithEmployeeService,
  listPublicJobs,
  getCandidateProfile,
  submitCareerApplication,
};
