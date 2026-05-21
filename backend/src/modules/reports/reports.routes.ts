import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth, requireOrganization } from '../../middleware/auth.js';
import * as reportService from './reports.service.js';

const router = Router();

// Todas as rotas de relatórios requerem autenticação e organização
router.use(requireAuth, requireOrganization);

// GET /api/reports/dashboard - Dashboard completo da organização
router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
    const stats = await reportService.getDashboardStats(req.organizationId!);
    res.json(stats);
}));

// GET /api/reports/stats - Obter estatísticas da organização
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
    const period = (req.query.period as any) || 'month';
    const stats = await reportService.getOrganizationStats(req.organizationId!, period);
    res.json(stats);
}));

// GET /api/reports/export - Exportar relatório CSV
router.get('/export', asyncHandler(async (req: Request, res: Response) => {
    const csv = await reportService.exportReportCsv(req.organizationId!);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio-acessibilidade.csv');
    res.send(csv);
}));

// GET /api/reports/coverage - Cobertura de acessibilidade por aluno PCD
router.get('/coverage', asyncHandler(async (req: Request, res: Response) => {
    const coverage = await reportService.getStudentCoverage(req.organizationId!);
    res.json(coverage);
}));

export default router;
