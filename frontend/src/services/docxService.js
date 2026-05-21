import { getPdfDocument, extractImagesFromPage } from './pdfService.js';

export async function generateAndDownloadDocx({
    text,
    person,
    metadata,
    fontSize,
    isDyslexia,
    originalFileName,
    fileObject,
    headerConfig,
    onStart,
    onSuccess,
    onError
}) {
    if (!text || !originalFileName) return;

    if (onStart) onStart();

    try {
        const baseName = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
        const versionType = person === 'braille' ? 'braille' : 'alta-legibilidade';
        const finalFileName = `${baseName}-${versionType}-adaptado${isDyslexia ? '-dislexia' : ''}.docx`;

        let imagePlaceholders = [];

        // Extract images if person is alta-legibilidade
        if (person === 'alta-legibilidade') {
            if (!fileObject) {
                throw new Error("Arquivo PDF original não encontrado para gerar o DOCX com imagens.");
            }
            const fileBuffer = await fileObject.arrayBuffer();
            const pdf = await getPdfDocument(fileBuffer);

            const placeholderRegex = /\[IMAGEM_PAGINA_(\d+)\]/g;
            const matches = [...text.matchAll(placeholderRegex)];

            const pagePromises = matches.map(async match => {
                const pageNum = parseInt(match[1], 10);
                if (!isNaN(pageNum) && pageNum > 0 && pageNum <= pdf.numPages) {
                    try {
                        const page = await pdf.getPage(pageNum);
                        const imageRunsData = await extractImagesFromPage(page, false);
                        return { pageNum, imageRunsData };
                    } catch (pageError) {
                        console.error(`Erro ao processar a página ${pageNum} para extração de imagem:`, pageError);
                        return { pageNum, imageRunsData: [] };
                    }
                }
                return null;
            });
            imagePlaceholders = (await Promise.all(pagePromises)).filter(p => p !== null);
        }

        const docxWorkerString = `
            self.importScripts('https://unpkg.com/docx@8.5.0/build/index.umd.js');

            const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } = docx;

            self.onmessage = async (e) => {
                try {
                    const { person, text, metadata, fontSize, finalFileName, imagePlaceholders, isDyslexia, headerConfig } = e.data;

                    const { disciplina, professor, data, titulo } = metadata;
                    const paragraphs = [];
                    
                    const fontName = isDyslexia ? 'Comic Sans MS' : 'Arial';
                    const lineSpacing = isDyslexia ? 480 : 240;
                
                    // Cabeçalho configurável - usa valores passados ou padrões genéricos
                    const headerTitle = headerConfig?.title || 'Documento Adaptado para Acessibilidade';
                    const headerLegalText = headerConfig?.legalText || 'Esta é uma adaptação de texto para acessibilidade, de acordo com a Lei Brasileira de Inclusão Nº 13.146, de 6 de julho de 2015.';
                    const headerExtraInfo = headerConfig?.extraInfo || '';
                    
                    const headerLines = [
                        headerTitle,
                        headerLegalText,
                        headerExtraInfo,
                        '------------------------------',
                        'Disciplina: ' + disciplina,
                        'Professor: ' + professor,
                        'Data da adaptação: ' + data,
                        'Título: ' + titulo
                    ].filter(line => line && line.trim() !== '');

                    headerLines.forEach(line => {
                        paragraphs.push(new Paragraph({
                            children: [new TextRun({ text: line, font: fontName, size: 24, bold: true })],
                            spacing: { line: lineSpacing }
                        }));
                    });

                    paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })] }));

                    if (person === 'braille') {
                        const rawParagraphs = text.split('\\n').filter(p => p.trim() !== '');
                        rawParagraphs.forEach(p => {
                            const isBold = p.startsWith('**') && p.endsWith('**');
                            const cleanText = p.replace(/\\*\\*/g, '');
                            const isPageNumber = isBold && cleanText.toLowerCase().startsWith('página');
                            const isTitle = isBold && !isPageNumber;
                
                            if (isPageNumber) {
                                paragraphs.push(new Paragraph({
                                    children: [new TextRun({ text: cleanText, font: fontName, size: 24, bold: true })],
                                    alignment: AlignmentType.JUSTIFIED,
                                    spacing: { line: lineSpacing }
                                }));
                            } else if (isTitle) {
                                paragraphs.push(new Paragraph({
                                    children: [new TextRun({ text: cleanText, font: fontName, size: 28, bold: true })],
                                    alignment: AlignmentType.JUSTIFIED,
                                    spacing: { line: lineSpacing }
                                }));
                            } else {
                                paragraphs.push(new Paragraph({
                                    children: [new TextRun({ text: cleanText, font: fontName, size: 24 })],
                                    indent: { firstLine: 709 },
                                    alignment: AlignmentType.JUSTIFIED,
                                    spacing: { line: lineSpacing }
                                }));
                            }
                        });
                    } else { // Alta Legibilidade
                        const docxFontSize = (!isNaN(fontSize) && fontSize >= 10) ? fontSize * 2 : 40;
                        const spacingForHighLegibility = isDyslexia ? 480 : 360;
                
                        const placeholderRegex = /\\[IMAGEM_PAGINA_(\\d+)\\]/g;
                        const parts = text.split(placeholderRegex);
                
                        for (let i = 0; i < parts.length; i++) {
                            const part = parts[i];
                
                            if (i % 2 === 0) { // Text part
                                const textParagraphs = part.split('\\n').filter(p => p.trim() !== '');
                                textParagraphs.forEach(p => {
                                    const isBold = p.startsWith('**') && p.endsWith('**');
                                    const cleanText = p.replace(/\\*\\*/g, '');
                
                                    paragraphs.push(new Paragraph({
                                        children: [
                                            new TextRun({ text: cleanText, font: fontName, size: docxFontSize, bold: isBold })
                                        ],
                                        alignment: AlignmentType.JUSTIFIED,
                                        spacing: { line: spacingForHighLegibility }
                                    }));
                                });
                            } else { // Image part
                                const pageNum = parseInt(part, 10);
                                const placeholderData = imagePlaceholders.find(p => p.pageNum === pageNum);

                                if (placeholderData && placeholderData.imageRunsData.length > 0) {
                                    placeholderData.imageRunsData.forEach(imgData => {
                                        paragraphs.push(new Paragraph({
                                            children: [new ImageRun({
                                                data: imgData.data,
                                                transformation: imgData.transformation
                                            })],
                                            alignment: AlignmentType.CENTER,
                                            spacing: { after: 200 },
                                        }));
                                    });
                                } else {
                                    paragraphs.push(new Paragraph({
                                        children: [new TextRun({ text: '[Nenhuma imagem encontrada na página ' + pageNum + ']', italics: true, font: fontName, size: 24 })]
                                    }));
                                }
                            }
                        }
                    }
                
                    const doc = new Document({
                        sections: [{
                            properties: {},
                            children: paragraphs,
                        }],
                    });
                
                    const blob = await Packer.toBlob(doc);
                    const arrayBuffer = await blob.arrayBuffer();

                    self.postMessage({ type: 'docx-generated', arrayBuffer, finalFileName }, [arrayBuffer]);

                } catch (error) {
                    console.error('Worker error:', error);
                    self.postMessage({
                        type: 'error',
                        message: error instanceof Error ? error.message : String(error),
                    });
                }
            };
        `;

        const workerBlob = new Blob([docxWorkerString], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerUrl);

        const workerPayload = {
            person,
            text,
            metadata,
            fontSize,
            finalFileName,
            imagePlaceholders,
            isDyslexia,
            headerConfig
        };

        const transferables = imagePlaceholders.flatMap(p => p.imageRunsData.map(d => d.data));
        worker.postMessage(workerPayload, transferables);

        worker.onmessage = (e) => {
            const { type, arrayBuffer, finalFileName: workerFileName, message } = e.data || {};

            if (type === 'docx-generated') {
                const blob = new Blob([arrayBuffer], {
                    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = workerFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                if (onSuccess) onSuccess();
            } else if (type === 'error') {
                if (onError) onError(message);
            }
            URL.revokeObjectURL(workerUrl);
            worker.terminate();
        };

        worker.onerror = (error) => {
            if (onError) onError(error.message);
            URL.revokeObjectURL(workerUrl);
            worker.terminate();
        };

    } catch (error) {
        if (onError) onError(error.message);
    }
}
