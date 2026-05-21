
// Mock prisma before importing the service
const mockFindFirst = jest.fn();

jest.mock('../../src/config/database', () => ({
    prisma: {
        document: {
            findFirst: mockFindFirst,
        },
    },
}));

import { prisma } from '../../src/config/database';
import { getDocument } from '../../src/modules/documents/documents.service';
import { AppError } from '../../src/middleware/errorHandler';
import * as storage from '../../src/lib/storage';

jest.mock('../../src/lib/storage', () => ({
    getSignedDownloadUrl: jest.fn()
}));

describe('Documents Service - getDocument', () => {
    const mockOrgId = 'org-123';
    const mockDocId = 'doc-456';

    beforeEach(() => {
        jest.clearAllMocks();
        mockFindFirst.mockReset();
    });

    it('should return the document when it exists and belongs to the organization', async () => {
        const mockDocument = {
            id: mockDocId,
            organizationId: mockOrgId,
            originalKey: 'org-123/original-test.pdf',
            brailleKey: 'org-123/braille.txt',
            status: 'COMPLETED',
            user: { name: 'Test User', email: 'test@example.com' }
        };

        mockFindFirst.mockResolvedValue(mockDocument);
        (storage.getSignedDownloadUrl as jest.Mock).mockResolvedValue('https://signed.url');

        const result = await getDocument(mockDocId, mockOrgId);

        expect(prisma.document.findFirst).toHaveBeenCalledWith({
            where: {
                id: mockDocId,
                organizationId: mockOrgId,
            },
            select: expect.any(Object),
        });
        
        // Verifica as substituições por Signed URLs corretamente
        expect(result.id).toEqual(mockDocId);
        expect(result.originalUrl).toEqual('https://signed.url');
        expect(result.brailleUrl).toEqual('https://signed.url');
        expect(storage.getSignedDownloadUrl).toHaveBeenCalledTimes(2);
    });

    it('should throw a 404 AppError when the document is not found', async () => {
        mockFindFirst.mockResolvedValue(null);

        await expect(getDocument(mockDocId, mockOrgId)).rejects.toThrow(AppError);
        
        try {
            await getDocument(mockDocId, mockOrgId);
        } catch (error: any) {
            expect(error.statusCode).toBe(404);
            expect(error.message).toBe('Documento não encontrado');
            expect(error.code).toBe('DOC_NOT_FOUND');
        }
    });

    it('should throw a 404 AppError when the document belongs to another organization', async () => {
        // Even if the document exists in DB, findFirst with organizationId filter will return null
        mockFindFirst.mockResolvedValue(null);

        await expect(getDocument(mockDocId, 'other-org')).rejects.toThrow(AppError);

        try {
            await getDocument(mockDocId, 'other-org');
        } catch (error: any) {
            expect(error.statusCode).toBe(404);
            expect(error.code).toBe('DOC_NOT_FOUND');
        }
    });
});
