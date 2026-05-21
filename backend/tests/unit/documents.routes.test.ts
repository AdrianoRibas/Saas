import { Request, Response } from 'express';
import { updateDocumentStatusHandler, completeDocumentHandler } from '../../src/modules/documents/documents.routes';
import * as docService from '../../src/modules/documents/documents.service';

// Mock dependencies
jest.mock('../../src/modules/documents/documents.service');

describe('Documents Routes Security', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });

        mockRes = {
            status: statusMock,
            json: jsonMock,
        } as unknown as Response;
    });

    describe('updateDocumentStatusHandler', () => {
        it('should allow ADMIN to update status', async () => {
            mockReq = {
                organizationId: 'org-1',
                params: { id: 'doc-1' },
                user: { id: 'user-admin', role: 'ADMIN', email: 'admin@test.com', organizationId: 'org-1' },
                body: { status: 'COMPLETED' }
            } as any;

            // Mock getDocument to return a doc owned by someone else
            (docService.getDocument as jest.Mock).mockResolvedValue({
                id: 'doc-1',
                userId: 'user-other',
                organizationId: 'org-1'
            });

            // Mock updateDocumentStatus
            (docService.updateDocumentStatus as jest.Mock).mockResolvedValue({});

            await updateDocumentStatusHandler(mockReq as Request, mockRes as Response);

            expect(docService.getDocument).toHaveBeenCalledWith('doc-1', 'org-1');
            expect(docService.updateDocumentStatus).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Status atualizado com sucesso'
            }));
        });

        it('should allow OWNER to update status', async () => {
             mockReq = {
                organizationId: 'org-1',
                params: { id: 'doc-1' },
                user: { id: 'user-owner', role: 'OWNER', email: 'owner@test.com', organizationId: 'org-1' },
                body: { status: 'COMPLETED' }
            } as any;

            (docService.getDocument as jest.Mock).mockResolvedValue({
                id: 'doc-1',
                userId: 'user-other',
                organizationId: 'org-1'
            });

             (docService.updateDocumentStatus as jest.Mock).mockResolvedValue({});

            await updateDocumentStatusHandler(mockReq as Request, mockRes as Response);

            expect(statusMock).not.toHaveBeenCalledWith(403);
        });

        it('should allow document creator (MEMBER) to update status', async () => {
            mockReq = {
                organizationId: 'org-1',
                params: { id: 'doc-1' },
                user: { id: 'user-creator', role: 'MEMBER', email: 'creator@test.com', organizationId: 'org-1' },
                body: { status: 'COMPLETED' }
            } as any;

            (docService.getDocument as jest.Mock).mockResolvedValue({
                id: 'doc-1',
                userId: 'user-creator', // Same ID
                organizationId: 'org-1'
            });

             (docService.updateDocumentStatus as jest.Mock).mockResolvedValue({});

            await updateDocumentStatusHandler(mockReq as Request, mockRes as Response);

            expect(statusMock).not.toHaveBeenCalledWith(403);
        });

        it('should DENY unrelated MEMBER from updating status', async () => {
            mockReq = {
                organizationId: 'org-1',
                params: { id: 'doc-1' },
                user: { id: 'user-attacker', role: 'MEMBER', email: 'attacker@test.com', organizationId: 'org-1' },
                body: { status: 'COMPLETED' }
            } as any;

            (docService.getDocument as jest.Mock).mockResolvedValue({
                id: 'doc-1',
                userId: 'user-victim', // Different ID
                organizationId: 'org-1'
            });

            await updateDocumentStatusHandler(mockReq as Request, mockRes as Response);

            expect(docService.getDocument).toHaveBeenCalledWith('doc-1', 'org-1');
            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Acesso negado' });
            expect(docService.updateDocumentStatus).not.toHaveBeenCalled();
        });
    });

    describe('completeDocumentHandler', () => {
        it('should DENY unrelated MEMBER from completing document', async () => {
            mockReq = {
                organizationId: 'org-1',
                params: { id: 'doc-1' },
                user: { id: 'user-attacker', role: 'MEMBER', email: 'attacker@test.com', organizationId: 'org-1' },
                body: {}
            } as any;

            (docService.getDocument as jest.Mock).mockResolvedValue({
                id: 'doc-1',
                userId: 'user-victim', // Different ID
                organizationId: 'org-1'
            });

            await completeDocumentHandler(mockReq as Request, mockRes as Response);

            expect(docService.getDocument).toHaveBeenCalledWith('doc-1', 'org-1');
            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Acesso negado' });
            expect(docService.updateDocumentStatus).not.toHaveBeenCalled();
        });
        
        it('should allow document creator to complete document', async () => {
             mockReq = {
                organizationId: 'org-1',
                params: { id: 'doc-1' },
                user: { id: 'user-creator', role: 'MEMBER', email: 'creator@test.com', organizationId: 'org-1' },
                body: {}
            } as any;

            (docService.getDocument as jest.Mock).mockResolvedValue({
                id: 'doc-1',
                userId: 'user-creator',
                organizationId: 'org-1'
            });
            
            (docService.updateDocumentStatus as jest.Mock).mockResolvedValue({});

            await completeDocumentHandler(mockReq as Request, mockRes as Response);

            expect(statusMock).not.toHaveBeenCalledWith(403);
            expect(docService.updateDocumentStatus).toHaveBeenCalledWith('doc-1', 'org-1', 'COMPLETED');
        });
    });
});
