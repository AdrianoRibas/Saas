export function cleanTextForSpeech(text) {
    if (!text) return '';
    return text
        .replace(/\*/g, '')
        .replace(/#/g, '')
        .replace(/\[IMAGEM_PAGINA_(\d+)\]/g, 'Imagem da página $1.')
        .replace(/[[\]{}]/g, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

let toastContainer = null;

export function initToast() {
    if (!document.querySelector('.toast-container')) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    } else {
        toastContainer = document.querySelector('.toast-container');
    }
}

export function showToast(message, type = 'info') {
    if (!toastContainer) initToast();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success'
        ? '<svg height="20" viewBox="0 0 24 24" width="20" fill="#4caf50"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
        : type === 'error'
            ? '<svg height="20" viewBox="0 0 24 24" width="20" fill="#f44336"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
            : '<svg height="20" viewBox="0 0 24 24" width="20" fill="#2196f3"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';

    toast.innerHTML = `${icon}<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toast-out 0.3s forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}
