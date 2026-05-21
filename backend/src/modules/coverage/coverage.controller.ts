import { Request, Response } from 'express';
import { coverageService } from './coverage.service.js';
import { z } from 'zod';

export class CoverageController {
    
    // GET /api/coverage/risk-map
    async getRiskMap(req: Request, res: Response) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) return res.status(403).json({ error: 'Organization ID missing' });

            const data = await coverageService.getRiskMap(organizationId);
            return res.json(data);
        } catch (error) {
            console.error('Risk Map Error:', error);
            return res.status(500).json({ error: 'Failed to fetch risk map' });
        }
    }

    // GET /api/coverage/students
    async getStudentMonitoring(req: Request, res: Response) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) return res.status(403).json({ error: 'Organization ID missing' });

            const data = await coverageService.getStudentMonitoring(organizationId);
            return res.json(data);
        } catch (error) {
            console.error('Student Monitoring Error:', error);
            return res.status(500).json({ error: 'Failed to fetch student monitoring' });
        }
    }

    // GET /api/coverage/library
    async getLibrary(req: Request, res: Response) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) return res.status(403).json({ error: 'Organization ID missing' });

            const querySchema = z.object({
                q: z.string().optional()
            });

            const { q } = querySchema.parse(req.query);
            const data = await coverageService.getLibrary(organizationId, q);
            return res.json(data);
        } catch (error) {
            console.error('Library Error:', error);
            return res.status(500).json({ error: 'Failed to fetch library' });
        }
    }
}

export const coverageController = new CoverageController();
