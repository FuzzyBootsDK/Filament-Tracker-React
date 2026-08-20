const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

// Auth
export const auth = {
  login: (u, p) => api.post('/auth/login', { username: u, password: p }),
  logout: () => api.post('/auth/logout', {}),
  me: () => api.get('/auth/me'),
  setup: (u, p) => api.post('/auth/setup', { username: u, password: p }),
  users: () => api.get('/auth/users'),
  createUser: (d) => api.post('/auth/users', d),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  changePassword: (id, password) => api.put(`/auth/users/${id}/password`, { password }),
};

// Filaments
export const filaments = {
  list: () => api.get('/filaments'),
  get: (id) => api.get(`/filaments/${id}`),
  create: (d) => api.post('/filaments', d),
  update: (id, d) => api.put(`/filaments/${id}`, d),
  delete: (id) => api.delete(`/filaments/${id}`),
  deleteAll: () => api.delete('/filaments/all'),
  exportCSV: () => fetch('/api/filaments/export', { credentials: 'include' }).then(r => r.text()),
  importCSV: (csv) => api.post('/filaments/import', { csv }),
};

// Spools
export const spools = {
  list: (filament_id) => api.get(`/spools${filament_id ? `?filament_id=${filament_id}` : ''}`),
  get: (id) => api.get(`/spools/${id}`),
  create: (d) => api.post('/spools', d),
  update: (id, d) => api.put(`/spools/${id}`, d),
  use: (id, grams) => api.post(`/spools/${id}/use`, { grams }),
  load: (id, reusable_spool_id) => api.put(`/spools/${id}`, { spool_type: 'reusable', reusable_spool_id }),
  unload: (id) => api.put(`/spools/${id}`, { spool_type: 'refill', reusable_spool_id: null }),
  delete: (id) => api.delete(`/spools/${id}`),
  reusable: {
    list: () => api.get('/spools/reusable'),
    create: (d) => api.post('/spools/reusable', d),
    delete: (id) => api.delete(`/spools/reusable/${id}`),
  },
};

// Brands
export const brands = {
  list: () => api.get('/brands'),
  create: (name) => api.post('/brands', { name }),
  update: (id, name) => api.put(`/brands/${id}`, { name }),
  delete: (id) => api.delete(`/brands/${id}`),
};

// Printers
export const printers = {
  list: () => api.get('/printers'),
  get: (id) => api.get(`/printers/${id}`),
  create: (d) => api.post('/printers', d),
  update: (id, d) => api.put(`/printers/${id}`, d),
  delete: (id) => api.delete(`/printers/${id}`),
};

// AMS
export const ams = {
  slots: (printer_id) => api.get(`/ams/${printer_id}`),
  link: (printer_id, ams_unit, slot_index, spool_id) =>
    api.put(`/ams/${printer_id}/${ams_unit}/${slot_index}/link`, { spool_id }),
  unlink: (printer_id, ams_unit, slot_index) =>
    api.delete(`/ams/${printer_id}/${ams_unit}/${slot_index}/link`),
};

// Print jobs
export const printJobs = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/print-jobs${q ? '?' + q : ''}`);
  },
  stats: () => api.get('/print-jobs/stats'),
  get: (id) => api.get(`/print-jobs/${id}`),
  create: (d) => api.post('/print-jobs', d),
  update: (id, d) => api.put(`/print-jobs/${id}`, d),
  delete: (id) => api.delete(`/print-jobs/${id}`),
};

// Settings
export const settings = {
  get: () => api.get('/settings'),
  update: (d) => api.put('/settings', d),
};
