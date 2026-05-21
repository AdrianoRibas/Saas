/**
 * Serviço de API para comunicação com o backend do SaaS
 */

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3001/api' 
    : 'https://saas-teste-dn2u.onrender.com/api';

class ApiService {
    constructor() {
        this.token = localStorage.getItem('ada_token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('ada_token', token);
        } else {
            localStorage.removeItem('ada_token');
        }
    }

    async request(endpoint, options = {}) {
        const { responseType = 'json', ...fetchOptions } = options;
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {
            ...fetchOptions.headers,
        };

        if (!(fetchOptions.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
            ...fetchOptions,
            headers,
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const error = new Error(data.error || 'Erro na requisição');
            error.status = response.status;
            error.code = data.code;
            throw error;
        }

        if (responseType === 'blob') {
            return response.blob();
        }

        return response.json();
    }

    // Auth
    async register(name, email, password, organizationName) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, organizationName }),
        });
        this.setToken(data.token);
        return data;
    }

    async login(email, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        this.setToken(data.token);
        return data;
    }

    async getMe() {
        return this.request('/auth/me');
    }

    logout() {
        this.setToken(null);
    }

    // Organizations
    async getOrgCurrent() {
        return this.request('/organizations/current');
    }

    async updateSettings(settings) {
        return this.request('/organizations/settings', {
            method: 'PUT',
            body: JSON.stringify(settings),
        });
    }

    // Billing
    async getBillingStatus() {
        return this.request('/billing/status');
    }

    async createCheckoutSession() {
        return this.request('/billing/checkout', {
            method: 'POST',
        });
    }

    async createPortalSession() {
        return this.request('/billing/portal', {
            method: 'POST',
        });
    }

    // Documents
    async listDocuments(page = 1) {
        return this.request(`/documents?page=${page}`);
    }

    async uploadDocument(file, metadata = {}) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', JSON.stringify(metadata));

        return this.request('/documents/upload', {
            method: 'POST',
            body: formData,
        });
    }

    async completeDocument(documentId) {
        return this.request(`/documents/${documentId}/complete`, {
            method: 'PATCH',
        });
    }

    async markDownload(documentId, type) {
        return this.request(`/documents/${documentId}/download`, {
            method: 'PATCH',
            body: JSON.stringify({ type }),
        });
    }

    async sendDocumentEmail(documentId) {
        return this.request(`/documents/${documentId}/email`, {
            method: 'POST',
        });
    }

    // Academic Data (for cascading dropdowns)
    async listDisciplines(page = 1, limit = 100) {
        return this.request(`/disciplines?page=${page}&limit=${limit}`);
    }

    async listClasses(disciplineId, page = 1, limit = 100) {
        const params = new URLSearchParams({ page, limit });
        if (disciplineId) params.set('disciplineId', disciplineId);
        return this.request(`/classes?${params}`);
    }

    async listStudents(page = 1, limit = 100, isPcd) {
        const params = new URLSearchParams({ page, limit });
        if (isPcd !== undefined) params.set('isPcd', isPcd);
        return this.request(`/students?${params}`);
    }

    async listAllStudents() {
        return this.request('/students/pcd');
    }

    // Dashboard stats (admin)
    async getDashboardStats() {
        return this.request('/reports/dashboard');
    }

    // Reports
    async getReportStats(period = 'month') {
        return this.request(`/reports/stats?period=${period}`);
    }

    async downloadReport() {
        const blob = await this.request('/reports/export', {
            responseType: 'blob',
        });

        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'relatorio-acessibilidade.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
    }

    // ==================================================================
    // STUDIO — Geração de Conteúdo Educacional
    // ==================================================================

    async studioGenerateAudio(documentId, config) {
        return this.request(`/studio/${documentId}/audio`, {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }

    async studioGenerateSlides(documentId, config) {
        return this.request(`/studio/${documentId}/slides`, {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }

    async studioGenerateInfographic(documentId, config) {
        return this.request(`/studio/${documentId}/infographic`, {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }

    async studioGenerateQuiz(documentId, config) {
        return this.request(`/studio/${documentId}/quiz`, {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }

    async studioGenerateFlashcards(documentId, config) {
        return this.request(`/studio/${documentId}/flashcards`, {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }

    async studioGenerateBatch(documentId, types, config = {}) {
        return this.request(`/studio/${documentId}/batch`, {
            method: 'POST',
            body: JSON.stringify({ types, ...config }),
        });
    }

    async studioListArtifacts(documentId) {
        return this.request(`/studio/${documentId}/artifacts`);
    }

    async studioGetArtifact(artifactId) {
        return this.request(`/studio/artifact/${artifactId}`);
    }

    async studioSubmitQuiz(artifactId, answers) {
        return this.request(`/studio/artifact/${artifactId}/quiz-attempt`, {
            method: 'POST',
            body: JSON.stringify({ answers }),
        });
    }

    async studioToggleFavorite(artifactId) {
        return this.request(`/studio/artifact/${artifactId}/favorite`, {
            method: 'POST',
        });
    }

    async studioGetFavorites() {
        return this.request('/studio/favorites');
    }

    async studioGetAnalytics() {
        return this.request('/studio/analytics');
    }
}

export const api = new ApiService();
