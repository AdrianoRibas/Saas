import { api } from './apiService.js';

export const coverageApi = {
    getRiskMap: async () => {
        return api.get('/coverage/risk-map');
    },
    getStudents: async () => {
        return api.get('/coverage/students');
    },
    getLibrary: async (query = '') => {
        return api.get(`/coverage/library?q=${encodeURIComponent(query)}`);
    }
};
