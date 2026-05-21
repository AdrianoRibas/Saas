// Mock prisma
jest.mock('../../src/lib/prisma', () => ({
    prisma: {
        teacher: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
        user: {
            findFirst: jest.fn(),
        },
    },
}));

import { prisma } from '../../src/lib/prisma';
import * as teacherService from '../../src/modules/teachers/teachers.service';

describe('Teachers Service', () => {
    const mockOrgId = 'org-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('listTeachers', () => {
        it('should return paginated teachers list', async () => {
            const mockTeachers = [
                { id: 't1', user: { name: 'Teacher 1', email: 't1@test.com' } },
                { id: 't2', user: { name: 'Teacher 2', email: 't2@test.com' } },
            ];

            (prisma.teacher.findMany as jest.Mock).mockResolvedValue(mockTeachers);
            (prisma.teacher.count as jest.Mock).mockResolvedValue(2);

            const result = await teacherService.listTeachers(mockOrgId, {
                page: 1,
                limit: 20,
            });

            expect(result.teachers).toHaveLength(2);
            expect(result.pagination.total).toBe(2);
            expect(result.pagination.page).toBe(1);
        });

        it('should apply search filter', async () => {
            (prisma.teacher.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.teacher.count as jest.Mock).mockResolvedValue(0);

            await teacherService.listTeachers(mockOrgId, {
                page: 1,
                limit: 20,
                search: 'João',
            });

            expect(prisma.teacher.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: mockOrgId,
                        OR: expect.any(Array),
                    }),
                })
            );
        });
    });

    describe('getTeacherById', () => {
        it('should throw error if teacher not found', async () => {
            (prisma.teacher.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(
                teacherService.getTeacherById(mockOrgId, 'nonexistent')
            ).rejects.toThrow('Professor não encontrado');
        });

        it('should return teacher data', async () => {
            const mockTeacher = {
                id: 't1',
                userId: 'u1',
                user: { name: 'Teacher', email: 'teacher@test.com' },
            };

            (prisma.teacher.findFirst as jest.Mock).mockResolvedValue(mockTeacher);

            const result = await teacherService.getTeacherById(mockOrgId, 't1');

            expect(result.id).toBe('t1');
        });
    });

    describe('createTeacher', () => {
        it('should throw error if user not found', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(
                teacherService.createTeacher(mockOrgId, { userId: 'nonexistent' })
            ).rejects.toThrow('Usuário não encontrado');
        });

        it('should throw error if user already is a teacher', async () => {
            // User exists
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({
                id: 'u1',
                organizationId: mockOrgId,
            });
            // Teacher already exists for this user
            (prisma.teacher.findUnique as jest.Mock).mockResolvedValue({
                id: 't1',
                userId: 'u1',
            });

            await expect(
                teacherService.createTeacher(mockOrgId, { userId: 'u1' })
            ).rejects.toThrow('Este usuário já está cadastrado como professor');
        });

        it('should create teacher successfully', async () => {
            // User exists
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({
                id: 'u1',
                organizationId: mockOrgId,
            });
            // No existing teacher
            (prisma.teacher.findUnique as jest.Mock).mockResolvedValue(null);

            const mockCreated = {
                id: 't1',
                userId: 'u1',
                user: { id: 'u1', name: 'Test', email: 'test@test.com' },
            };
            (prisma.teacher.create as jest.Mock).mockResolvedValue(mockCreated);

            const result = await teacherService.createTeacher(mockOrgId, {
                userId: 'u1',
                department: 'Math',
            });

            expect(result.id).toBe('t1');
            expect(prisma.teacher.create).toHaveBeenCalled();
        });
    });

    describe('deleteTeacher', () => {
        it('should throw error if teacher not found', async () => {
            (prisma.teacher.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(
                teacherService.deleteTeacher(mockOrgId, 'nonexistent')
            ).rejects.toThrow('Professor não encontrado');
        });

        it('should delete teacher successfully', async () => {
            (prisma.teacher.findFirst as jest.Mock).mockResolvedValue({
                id: 't1',
                _count: { disciplines: 0, documents: 0 },
            });
            (prisma.teacher.delete as jest.Mock).mockResolvedValue({ id: 't1' });

            const result = await teacherService.deleteTeacher(mockOrgId, 't1');

            expect(result.message).toContain('sucesso');
        });
    });
});
