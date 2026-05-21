import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Inicializa o cliente do Supabase somente quando as variáveis existem.
// Isso evita quebrar testes/unit que não usam storage diretamente.
const supabase =
    config.supabase.url && config.supabase.anonKey
        ? createClient(config.supabase.url, config.supabase.anonKey)
        : null;
const BUCKET_NAME = config.supabase.bucket;

function getSupabaseClient() {
    if (!supabase) {
        console.warn('⚠️ [STORAGE] Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY. Retornando mock para fallback local.');
        // Retorna mock simples para não quebrar a aplicação (suporte a testes locais)
        return {
            storage: {
                from: () => ({
                    upload: async () => ({ data: { path: "mock-path" }, error: null }),
                    download: async () => ({ data: new Blob(["mock data"]), error: null }),
                    remove: async () => ({ error: null }),
                    createSignedUrl: async () => ({ data: { signedUrl: "http://mock-url" }, error: null }),
                    getPublicUrl: () => ({ data: { publicUrl: "http://mock-url" } })
                })
            }
        } as any;
    }

    return supabase;
}

// Gerar uma chave única para o arquivo
export function generateFileKey(organizationId: string, originalName: string, type: 'original' | 'braille' | 'high-legibility' | 'autism'): string {
    const timestamp = Date.now();
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    // Supabase Storage aceita caminhos com barras para pastas
    return `${organizationId}/${type}-${timestamp}-${sanitizedName}`;
}

// Upload de arquivo para o Supabase Storage
export async function uploadFile(key: string, body: Buffer | NodeJS.ReadableStream | string, contentType: string): Promise<{ url: string }> {
    const client = getSupabaseClient();
    const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .upload(key, body, {
            contentType,
            upsert: true,
            duplex: 'half'
        });

    if (error) {
        console.error('[STORAGE_ERROR] Erro no upload Supabase:', error);
        throw new Error(`Erro no upload para Supabase: ${error.message}`);
    }


    // Retorna a URL pública (se o bucket for público) ou a chave
    const { data: { publicUrl } } = client.storage
        .from(BUCKET_NAME)
        .getPublicUrl(key);

    return { url: publicUrl };
}

// Download de arquivo do Supabase Storage
export async function downloadFile(key: string): Promise<Buffer> {
    const client = getSupabaseClient();
    const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .download(key);

    if (error) {
        throw new Error(`Erro no download do Supabase: ${error.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// Deletar arquivo
export async function deleteFile(key: string): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.storage
        .from(BUCKET_NAME)
        .remove([key]);

    if (error) {
        console.error(`Erro ao deletar arquivo no Supabase: ${key}`, error);
    }
}

// Gerar uma URL assinada para download privado (válida por 1 hora)
export async function getSignedDownloadUrl(key: string): Promise<string> {
    const client = getSupabaseClient();
    const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .createSignedUrl(key, 3600); // 1 hora de validade

    if (error) {
        throw new Error(`Erro ao gerar URL assinada: ${error.message}`);
    }

    return data.signedUrl;
}
