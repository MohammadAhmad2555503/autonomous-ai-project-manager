import axios from 'axios';

const API_BASE_URL = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

const getAuthHeader = () => {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const auth = {
  signup: (data) => apiClient.post('/auth/signup', data),
  login: (data) => apiClient.post('/auth/login', data),
  logout: () => apiClient.post('/auth/logout', {}, { headers: getAuthHeader() }),
  getMe: () => apiClient.get('/auth/me', { headers: getAuthHeader() }),
};

export const users = {
  getAll: () => apiClient.get('/users', { headers: getAuthHeader() }),
  getById: (id) => apiClient.get(`/users/${id}`, { headers: getAuthHeader() }),
};

export const projects = {
  getAll: () => apiClient.get('/projects', { headers: getAuthHeader() }),
  getById: (id) => apiClient.get(`/projects/${id}`, { headers: getAuthHeader() }),
  create: (data) => apiClient.post('/projects', data, { headers: getAuthHeader() }),
  update: (id, data) => apiClient.patch(`/projects/${id}`, data, { headers: getAuthHeader() }),
  delete: (id) => apiClient.delete(`/projects/${id}`, { headers: getAuthHeader() }),
};

export const tasks = {
  getAll: (projectId) => apiClient.get(`/tasks${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''}`, { headers: getAuthHeader() }),
  getById: (id) => apiClient.get(`/tasks/${id}`, { headers: getAuthHeader() }),
  create: (data) => apiClient.post('/tasks', data, { headers: getAuthHeader() }),
  update: (id, data) => apiClient.patch(`/tasks/${id}`, data, { headers: getAuthHeader() }),
  delete: (id) => apiClient.delete(`/tasks/${id}`, { headers: getAuthHeader() }),
};

export const dependencies = {
  getAll: (projectId) => apiClient.get(`/dependencies${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''}`, { headers: getAuthHeader() }),
  create: (data) => apiClient.post('/dependencies', data, { headers: getAuthHeader() }),
  delete: (id) => apiClient.delete(`/dependencies/${id}`, { headers: getAuthHeader() }),
};

export const comments = {
  getByTaskId: (taskId) => apiClient.get(`/comments/${taskId}`, { headers: getAuthHeader() }),
  create: (data) => apiClient.post('/comments', data, { headers: getAuthHeader() }),
};

export const analytics = {
  getProjectAnalytics: (projectId) => apiClient.get(`/analytics/project/${projectId}`, { headers: getAuthHeader() }),
  getTaskRisk: (taskId) => apiClient.get(`/analytics/task-risk/${taskId}`, { headers: getAuthHeader() }),
};

export const ai = {
  generateProjectHealth: (projectId) => apiClient.post(`/ai/project-health/${projectId}`, {}, { headers: getAuthHeader() }),
  generateTopRisks: (projectId) => apiClient.post(`/ai/top-risks/${projectId}`, {}, { headers: getAuthHeader() }),
  generateRecommendations: (projectId) => apiClient.post(`/ai/recommendations/${projectId}`, {}, { headers: getAuthHeader() }),
  generateStakeholderSummary: (projectId) => apiClient.post(`/ai/stakeholder-summary/${projectId}`, {}, { headers: getAuthHeader() }),
  getInsights: (projectId) => apiClient.get(`/ai/insights/${projectId}`, { headers: getAuthHeader() }),
};

