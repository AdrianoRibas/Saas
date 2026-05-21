import { prisma } from '../../config/database.js';
import { StudioArtifactType, StudioStatus } from '@prisma/client';
import type {
    CreateAudioInput,
    CreateSlidesInput,
    CreateInfographicInput,
    CreateQuizInput,
    CreateFlashcardsInput,
    SubmitQuizAttemptInput,
} from './studio.schema.js';

// ==============================================================================
// STUDIO SERVICE - Lógica de Negócio do Estúdio NotebookLM
// ==============================================================================

export async function createArtifact(
    documentId: string,
    userId: string,
    organizationId: string,
    type: StudioArtifactType,
    config: Record<string, any>
) {
    const document = await prisma.document.findFirst({
        where: { id: documentId, organizationId },
    });
    if (!document) throw new Error('Documento não encontrado');
    const artifact = await prisma.studioArtifact.create({
        data: { type, status: 'QUEUED', config, documentId, userId, organizationId },
    });
    console.log(`📦 [studio] Artefato ${type} criado: ${artifact.id} para doc ${documentId}`);
    return artifact;
}

export async function generateAudio(documentId: string, userId: string, organizationId: string, input: CreateAudioInput) {
    return createArtifact(documentId, userId, organizationId, 'AUDIO_SUMMARY', { format: input.format, duration: input.duration, language: input.language });
}

export async function generateSlides(documentId: string, userId: string, organizationId: string, input: CreateSlidesInput, teacherId: string) {
    const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, organizationId }, include: { disciplines: { select: { name: true }, take: 1 } } });
    const disciplineName = teacher?.disciplines?.[0]?.name || 'geral';
    const injectedPrompt = `Crie uma apresentação para estudantes do curso ${disciplineName} usando um estilo ousado e divertido com foco em didática`;
    return createArtifact(documentId, userId, organizationId, 'SLIDES', { format: input.format, duration: input.duration, language: input.language, prompt: injectedPrompt, disciplineName });
}

export async function generateInfographic(documentId: string, userId: string, organizationId: string, input: CreateInfographicInput) {
    return createArtifact(documentId, userId, organizationId, 'INFOGRAPHIC', { language: input.language, orientation: input.orientation, visual_style: input.visual_style, detail_level: input.detail_level });
}

export async function generateQuiz(documentId: string, userId: string, organizationId: string, input: CreateQuizInput) {
    return createArtifact(documentId, userId, organizationId, 'QUIZ', { questionCount: input.questionCount, difficulty: input.difficulty, topic: input.topic || null });
}

export async function generateFlashcards(documentId: string, userId: string, organizationId: string, input: CreateFlashcardsInput) {
    return createArtifact(documentId, userId, organizationId, 'FLASHCARDS', { language: input.language });
}

export async function generateBatch(documentId: string, userId: string, organizationId: string, types: StudioArtifactType[], configs: Record<string, any>) {
    const artifacts = [];
    for (const type of types) {
        let config: Record<string, any> = {};
        switch (type) {
            case 'AUDIO_SUMMARY': config = configs.audioConfig || { format: 'SUMMARY', duration: 'STANDARD', language: 'pt-BR' }; break;
            case 'SLIDES': config = configs.slidesConfig || { format: 'DETAILED_PRESENTATION', duration: 'STANDARD', language: 'pt-BR' }; break;
            case 'INFOGRAPHIC': config = configs.infographicConfig || { language: 'pt-BR', orientation: 'LANDSCAPE', visual_style: 'PROFESSIONAL', detail_level: 'STANDARD' }; break;
            case 'QUIZ': config = configs.quizConfig || { questionCount: 'STANDARD', difficulty: 'MEDIUM' }; break;
            case 'FLASHCARDS': config = configs.flashcardsConfig || { language: 'pt-BR' }; break;
        }
        const artifact = await createArtifact(documentId, userId, organizationId, type, config);
        artifacts.push(artifact);
    }
    return artifacts;
}

export async function getArtifactsByDocument(documentId: string, organizationId: string) {
    return prisma.studioArtifact.findMany({ where: { documentId, organizationId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { quizAttempts: true, favorites: true } } } });
}

export async function getArtifactById(artifactId: string, organizationId: string) {
    const artifact = await prisma.studioArtifact.findFirst({ where: { id: artifactId, organizationId }, include: { document: { select: { id: true, originalName: true } }, _count: { select: { quizAttempts: true, favorites: true } } } });
    if (!artifact) throw new Error('Artefato não encontrado');
    return artifact;
}

export async function submitQuizAttempt(artifactId: string, userId: string, organizationId: string, input: SubmitQuizAttemptInput) {
    const artifact = await prisma.studioArtifact.findFirst({ where: { id: artifactId, organizationId, type: 'QUIZ', status: 'COMPLETED' } });
    if (!artifact) throw new Error('Quiz não encontrado ou ainda não processado');
    const quizData = artifact.resultData as any;
    if (!quizData?.questions) throw new Error('Dados do quiz inválidos');
    const questions = quizData.questions as Array<{ correctOption: number }>;
    const totalQuestions = questions.length;
    let correctAnswers = 0;
    for (const answer of input.answers) {
        if (answer.questionIndex < totalQuestions) {
            const question = questions[answer.questionIndex];
            if (question.correctOption === answer.selectedOption) correctAnswers++;
        }
    }
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    return prisma.quizAttempt.create({ data: { score, totalQuestions, correctAnswers, answers: input.answers, artifactId, userId, organizationId } });
}

export async function toggleFavorite(artifactId: string, userId: string, organizationId: string) {
    const existing = await prisma.favorite.findUnique({ where: { userId_artifactId: { userId, artifactId } } });
    if (existing) { await prisma.favorite.delete({ where: { id: existing.id } }); return { favorited: false }; }
    const artifact = await prisma.studioArtifact.findFirst({ where: { id: artifactId, organizationId } });
    if (!artifact) throw new Error('Artefato não encontrado');
    await prisma.favorite.create({ data: { artifactId, userId, organizationId } });
    return { favorited: true };
}

export async function getFavorites(userId: string, organizationId: string) {
    return prisma.favorite.findMany({ where: { userId, organizationId }, include: { artifact: { include: { document: { select: { id: true, originalName: true } } } } }, orderBy: { createdAt: 'desc' } });
}

export async function getAnalytics(organizationId: string) {
    const [artifactCounts, quizStats, recentActivity] = await Promise.all([
        prisma.studioArtifact.groupBy({ by: ['type'], where: { organizationId }, _count: { id: true } }),
        prisma.quizAttempt.aggregate({ where: { organizationId }, _avg: { score: true }, _count: { id: true } }),
        prisma.studioArtifact.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { name: true, email: true } }, document: { select: { originalName: true } } } }),
    ]);
    return { artifactCounts, quizStats: { totalAttempts: quizStats._count.id, averageScore: quizStats._avg.score ? Math.round(quizStats._avg.score) : 0 }, recentActivity };
}
