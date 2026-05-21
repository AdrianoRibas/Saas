import { config } from '../config/index.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    requestId?: string;
    userId?: string;
    organizationId?: string;
    [key: string]: any;
}

// Campos que devem ser censurados nos logs (LGPD)
const SENSITIVE_FIELDS = [
    'password', 'passwordHash', 'token', 'refreshToken',
    'cpf', 'rg', 'document', 'creditCard', 'email', 'name', 'phone'
];

function redactPii(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Se for array, mapear
    if (Array.isArray(obj)) {
        return obj.map(redactPii);
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        if (SENSITIVE_FIELDS.includes(key) && typeof value === 'string') {
            // Ofuscar string (ex: secret@email.com => s***t@email.com ou simplesmente ***)
            result[key] = value.length > 5 ? `${value.substring(0, 2)}***${value.substring(value.length - 2)}` : '***';
        } else if (typeof value === 'object' && value !== null) {
            result[key] = redactPii(value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

// Verificar se deve logar com esse level
const logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) ||
    (config.nodeEnv === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
    return logLevels[level] >= logLevels[currentLevel];
}

// Formatar log entry
function formatLog(entry: LogEntry): string {
    if (config.nodeEnv === 'production') {
        // JSON para produção (facilita parsing por ferramentas)
        return JSON.stringify(entry);
    }

    // Formato legível para desenvolvimento
    const { timestamp, level, message, context, error } = entry;
    const levelStr = level.toUpperCase().padEnd(5);
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const errorStr = error ? `\n  Error: ${error.message}${error.stack ? '\n' + error.stack : ''}` : '';

    return `[${timestamp}] ${levelStr} ${message}${contextStr}${errorStr}`;
}

// Log base function
function log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context: context ? redactPii(context) : undefined,
    };

    if (error) {
        entry.error = {
            name: error.name,
            message: error.message,
            stack: config.nodeEnv !== 'production' ? error.stack : undefined,
        };
    }

    const formatted = formatLog(entry);

    switch (level) {
        case 'error':
            console.error(formatted);
            break;
        case 'warn':
            console.warn(formatted);
            break;
        default:
            console.log(formatted);
    }
}

// Logger exports
export const logger = {
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext, error?: Error) => log('warn', message, context, error),
    error: (message: string, context?: LogContext, error?: Error) => log('error', message, context, error),
};

// Request logger helper
export function logRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    context?: LogContext
) {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = `${method} ${path} ${statusCode} ${durationMs}ms`;

    log(level, message, {
        ...context,
        method,
        path,
        statusCode,
        durationMs,
    });
}
