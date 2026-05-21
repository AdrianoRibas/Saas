// API Service for Admin Panel - CRUD operations
const API_BASE = 'https://saas-teste-dn2u.onrender.com/api';

// Generic fetch with auth
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('ada_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
}

// ========== Teachers ==========
export const teachersApi = {
    list: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/teachers${query ? `?${query}` : ''}`);
    },
    get: (id) => apiRequest(`/teachers/${id}`),
    getById: (id) => apiRequest(`/teachers/${id}`),
    create: (data) => apiRequest('/teachers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/teachers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => apiRequest(`/teachers/${id}`, { method: 'DELETE' }),
};

// ========== Disciplines ==========
export const disciplinesApi = {
    list: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/disciplines${query ? `?${query}` : ''}`);
    },
    get: (id) => apiRequest(`/disciplines/${id}`),
    getById: (id) => apiRequest(`/disciplines/${id}`),
    create: (data) => apiRequest('/disciplines', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/disciplines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => apiRequest(`/disciplines/${id}`, { method: 'DELETE' }),
};

// ========== Classes ==========
export const classesApi = {
    list: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/classes${query ? `?${query}` : ''}`);
    },
    get: (id) => apiRequest(`/classes/${id}`),
    getById: (id) => apiRequest(`/classes/${id}`),
    create: (data) => apiRequest('/classes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => apiRequest(`/classes/${id}`, { method: 'DELETE' }),
    enrollStudent: (id, studentId) => apiRequest(`/classes/${id}/enroll`, { method: 'POST', body: JSON.stringify({ studentId }) }),
    unenrollStudent: (id, studentId) => apiRequest(`/classes/${id}/unenroll`, { method: 'POST', body: JSON.stringify({ studentId }) }),
};

// ========== Students ==========
export const studentsApi = {
    list: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/students${query ? `?${query}` : ''}`);
    },

    get: (id) => apiRequest(`/students/${id}`),
    getById: (id) => apiRequest(`/students/${id}`),
    create: (data) => apiRequest('/students', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => apiRequest(`/students/${id}`, { method: 'DELETE' }),
};

// ========== Organization Members ==========
export const membersApi = {
    list: () => apiRequest('/organizations/members'),
    remove: (id) => apiRequest(`/organizations/members/${id}`, { method: 'DELETE' }),
    changeRole: (id, role) => apiRequest(`/organizations/members/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
};

// ========== Invites ==========
export const invitesApi = {
    list: () => apiRequest('/invites'),
    create: (data) => apiRequest('/invites', { method: 'POST', body: JSON.stringify(data) }),
    revoke: (id) => apiRequest(`/invites/${id}/revoke`, { method: 'POST' }),
    resend: (id) => apiRequest(`/invites/${id}/resend`, { method: 'POST' }),
};

// ========== Dashboard / Reports ==========
export const dashboardApi = {
    getStats: () => apiRequest('/reports/dashboard'),
    getReportStats: (period = 'month') => apiRequest(`/reports/stats?period=${period}`),
    getCoverage: () => apiRequest('/reports/coverage'),
};

export const notificationsApi = {
    list: () => apiRequest('/notifications'),
    markRead: (id) => apiRequest(`/notifications/${id}/read`, 'PUT'),
    markAllRead: () => apiRequest('/notifications/mark-all-read', 'POST'),
};

// ========== Knowledge Base ==========
export const knowledgeApi = {
    list: () => apiRequest('/knowledge'),
    create: (data) => apiRequest('/knowledge', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => apiRequest(`/knowledge/${id}`, { method: 'DELETE' }),
};
