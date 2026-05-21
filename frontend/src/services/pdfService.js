import * as pdfjsLib from 'pdfjs-dist';

export function initPdfWorker() {
    // Isso força o navegador a baixar o motor do PDF do local correto
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.mjs';
    }
}

export async function getPdfDocument(data) {
    initPdfWorker(); // Garante que o motor está pronto antes de abrir o PDF
    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        return await pdfjsLib.getDocument({ data }).promise;
    }
    throw new Error("Tipo de dado inválido para PDF");
}

export async function extractImagesFromPage(page, forPreview = false) {
    const imageRunsData = [];
    const previewImageUrls = [];

    try {
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (context) {
            const renderContext = { canvasContext: context, viewport: viewport };
            await page.render(renderContext).promise;

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) {
                throw new Error("Falha ao criar blob da imagem do canvas.");
            }

            if (forPreview) {
                const dataUrl = URL.createObjectURL(blob);
                previewImageUrls.push(dataUrl);
            } else {
                const buffer = await blob.arrayBuffer();

                const imageWidth = 500;
                const imageHeight = (canvas.height / canvas.width) * imageWidth;
                imageRunsData.push({
                    type: 'png',
                    data: buffer,
                    transformation: { width: imageWidth, height: imageHeight },
                });
            }
        }
    } catch (fallbackError) {
        console.error("Erro durante a renderização da página para extração de imagem:", fallbackError);
    }

    return forPreview ? previewImageUrls : imageRunsData;
}

