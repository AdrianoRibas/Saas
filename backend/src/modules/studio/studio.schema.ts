import { z } from 'zod';

// ==============================================================================
// STUDIO SCHEMAS - Validação Zod para todas as gerações do Estúdio
// ==============================================================================

// --- Áudio ---
export const createAudioSchema = z.object({
    format: z.enum(['DETAILED_ANALYSIS', 'SUMMARY', 'CRITIQUE', 'DEBATE']),
    duration: z.enum(['SHORT', 'STANDARD']),
    language: z.string().min(2).max(10).default('pt-BR'),
});

// --- Slides (Professor only) ---
export const createSlidesSchema = z.object({
    format: z.enum(['DETAILED_PRESENTATION', 'PRESENTER_SLIDES']),
    duration: z.enum(['SHORT', 'STANDARD']),
    language: z.string().min(2).max(10).default('pt-BR'),
    // prompt NÃO é aceito do frontend — é injetado no backend
});

// --- Infográfico (Student only) ---
export const createInfographicSchema = z.object({
    language: z.string().min(2).max(10).default('pt-BR'),
    orientation: z.enum(['LANDSCAPE', 'PORTRAIT', 'SQUARE']),
    visual_style: z.enum([
        'SKETCH', 'KAWAII', 'PROFESSIONAL', 'SCIENTIFIC',
        'ANIME', 'CLAY', 'EDITORIAL', 'INSTRUCTIVE',
        'BENTO_GRID', 'BRICKS'
    ]),
    detail_level: z.enum(['CONCISE', 'STANDARD', 'DETAILED']),
});

// --- Quiz ---
export const createQuizSchema = z.object({
    questionCount: z.enum(['LESS', 'STANDARD', 'MORE']),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    topic: z.string().max(500).optional(), // Tema livre (opcional)
});

// --- Flashcards ---
export const createFlashcardsSchema = z.object({
    language: z.string().min(2).max(10).default('pt-BR'),
});

// --- Batch (Gerar Tudo) ---
export const createBatchSchema = z.object({
    types: z.array(z.enum([
        'AUDIO_SUMMARY', 'SLIDES', 'INFOGRAPHIC', 'QUIZ', 'FLASHCARDS'
    ])).min(1).max(5),
    // Configs individuais opcionais para cada tipo
    audioConfig: createAudioSchema.optional(),
    slidesConfig: createSlidesSchema.optional(),
    infographicConfig: createInfographicSchema.optional(),
    quizConfig: createQuizSchema.optional(),
    flashcardsConfig: createFlashcardsSchema.optional(),
});

// --- Quiz Attempt (submissão de respostas) ---
export const submitQuizAttemptSchema = z.object({
    answers: z.array(z.object({
        questionIndex: z.number().int().min(0),
        selectedOption: z.number().int().min(0),
    })).min(1),
});

// Tipos exportados para uso no service
export type CreateAudioInput = z.infer<typeof createAudioSchema>;
export type CreateSlidesInput = z.infer<typeof createSlidesSchema>;
export type CreateInfographicInput = z.infer<typeof createInfographicSchema>;
export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type CreateFlashcardsInput = z.infer<typeof createFlashcardsSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type SubmitQuizAttemptInput = z.infer<typeof submitQuizAttemptSchema>;
