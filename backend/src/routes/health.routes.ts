import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

const router = Router();

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    environment: string;
    version: string;
    uptime: number;
    checks?: Record<string, {
        status: 'pass' | 'fail';
        latency?: number;
        message?: string;
    }>;
}

// Versão da aplicação
const APP_VERSION = process.env.npm_package_version || '1.0.0';
const startTime = Date.now();

// GET /health - Health check básico (liveness)
router.get('/', (req: Request, res: Response) => {
    const health: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        version: APP_VERSION,
        uptime: Math.floor((Date.now() - startTime) / 1000),
    };

    res.json(health);
});

// GET /health/live - Liveness probe (K8s)
router.get('/live', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
    });
});

// GET /health/ready - Readiness probe (verifica dependências)
router.get('/ready', async (req: Request, res: Response) => {
    const checks: HealthStatus['checks'] = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check 1: Database
    try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const dbLatency = Date.now() - dbStart;

        checks.database = {
            status: 'pass',
            latency: dbLatency,
        };

        // Warn se latência > 500ms
        if (dbLatency > 500) {
            checks.database.message = 'High latency detected';
            if (overallStatus === 'healthy') {
                overallStatus = 'degraded';
            }
        }
    } catch (error) {
        checks.database = {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
        overallStatus = 'unhealthy';

        logger.error('Database health check failed', {}, error as Error);
    }

    // Check 2: Memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    checks.memory = {
        status: heapPercent < 90 ? 'pass' : 'fail',
        message: `${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%)`,
    };

    if (heapPercent >= 90) {
        overallStatus = 'degraded';
    }

    const health: HealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        version: APP_VERSION,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        checks,
    };

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);
});

// GET /health/detailed - Informações detalhadas (proteger em produção)
router.get('/detailed', async (req: Request, res: Response) => {
    // Em produção, requer header especial
    if (config.nodeEnv === 'production') {
        const authHeader = req.headers['x-health-secret'];
        if (authHeader !== process.env.HEALTH_SECRET) {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }

    const memUsage = process.memoryUsage();

    const detailed = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        version: APP_VERSION,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        process: {
            pid: process.pid,
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
        },
        memory: {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024),
            rss: Math.round(memUsage.rss / 1024 / 1024),
        },
    };

    res.json(detailed);
});

export default router;
