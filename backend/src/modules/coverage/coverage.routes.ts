import { Router } from 'express';
import { coverageController } from './coverage.controller.js';
import { tenantGuard } from '../../middleware/tenantGuard.js';

const router = Router();

// Todas as rotas de Coverage são protegidas por Tenant
router.use(tenantGuard);

router.get('/risk-map', (req, res) => coverageController.getRiskMap(req, res));
router.get('/students', (req, res) => coverageController.getStudentMonitoring(req, res));
router.get('/library', (req, res) => coverageController.getLibrary(req, res));

export default router;
