import { cleanTextForSpeech } from '../utils/utils.js';

let synth = window.speechSynthesis;
let isSpeaking = false;
let voices = [];

export function loadVoices() {
    voices = synth.getVoices();
}

export function initTTS() {
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }
}

export function speakText(text, onEnd, onError) {
    if (isSpeaking) {
        stopSpeaking();
        return;
    }

    if (!text) return;

    // Clean text to avoid reading symbols like "asterisco"
    const cleanedText = cleanTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'pt-BR';

    // Attempt to improve fluidity by selecting a better voice if available
    const ptVoice = voices.find(v => v.lang.includes('pt-BR') && (v.name.includes('Google') || v.name.includes('Microsoft')));
    if (ptVoice) {
        utterance.voice = ptVoice;
    }

    // Adjust rate slightly for better flow
    utterance.rate = 1.1;

    utterance.onend = () => {
        isSpeaking = false;
        if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
        console.error("Erro no TTS:", e);
        isSpeaking = false;
        if (onError) onError(e);
    };


    synth.speak(utterance);
    isSpeaking = true;
}

export function stopSpeaking() {
    if (synth.speaking) {
        synth.cancel();
    }
    isSpeaking = false;
}

export function getIsSpeaking() {
    return isSpeaking;
}
