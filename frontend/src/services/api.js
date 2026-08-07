const BASE = '/api';

function userId() {
  let id = localStorage.getItem('manoa_user_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('manoa_user_id', id);
  }
  return id;
}

function userName() {
  return localStorage.getItem('manoa_user_name') || 'Visiteur';
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId(),
      'x-user-name': userName(),
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export const api = {
  chat(question) {
    return request('/chat', { method: 'POST', body: JSON.stringify({ question }) });
  },
  roadmap(question) {
    return request('/roadmap', { method: 'POST', body: JSON.stringify({ question }) });
  },
  knowledgeStats() {
    return request('/knowledge/stats');
  },
  getUser() {
    return request(`/progress/user/${userId()}`);
  },
  getProgress() {
    return request(`/progress/${userId()}`);
  },
  saveRoadmap(question, roadmap) {
    return request('/progress/save', {
      method: 'POST',
      body: JSON.stringify({ question, roadmap }),
    });
  },
  completeStep(progressId, stepIndex) {
    return request(`/progress/${userId()}/complete`, {
      method: 'POST',
      body: JSON.stringify({ progressId, stepIndex }),
    });
  },
  adminStats(token) {
    return request('/admin/stats', { headers: { 'x-admin-token': token } });
  },
  adminChats(token) {
    return request('/admin/chats', { headers: { 'x-admin-token': token } });
  },
};

export { userId, userName };
