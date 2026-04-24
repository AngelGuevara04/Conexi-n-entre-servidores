import React, { useState, useRef } from 'react';
import './TextBar.css';

/**
 * COMPONENTE TEXTBAR: Responsable de la creación y formato del texto saliente.
 */
const TextBar = ({ onSend, replyingTo, onCancelReply }) => {

    // BLOQUE 1: ESTADOS Y REFERENCIAS

    const [text, setText] = useState("");
    const textareaRef = useRef(null); 
    
    //CONSTANTE DE SEGURIDAD: Límite global del chat
    const MAX_CHARS = 250;            


    // BLOQUE 2: LÓGICA DE VALIDACIÓN Y ENVÍO

    const handleSend = () => {
        // Valida que no exceda y no esté en blanco antes de llamar al padre
        if (text.trim() !== "" && text.length <= MAX_CHARS) {
            onSend(text);
            setText("");
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const isButtonDisabled = text.trim() === "" || text.length > MAX_CHARS;


    // BLOQUE 3: MANEJO DE INTERFAZ DINÁMICA

    const handleInput = (e) => {
        // Si el usuario pega un texto gigante, cortarlo manualmente
        let newText = e.target.value;
        if (newText.length > MAX_CHARS) {
            newText = newText.substring(0, MAX_CHARS);
        }

        setText(newText);
        e.target.style.height = 'auto'; 
        e.target.style.height = `${e.target.scrollHeight}px`; 
    };


    // BLOQUE 4: RENDERIZADO VISUAL

    return (
        <div className="text-bar-outer-container">
            <div className="text-bar-inner-wrapper">
                
                {/* VISTA PREVIA DE LA CITA */}
                {replyingTo && (
                    <div className="reply-preview-container">
                        <div className="reply-preview-content">
                            <span className="reply-preview-author">
                                Respondiendo a: {replyingTo.autor}
                            </span>
                            <p className="reply-preview-text">{replyingTo.texto}</p>
                        </div>
                        <button className="cancel-reply-btn" onClick={onCancelReply}>
                            ✖
                        </button>
                    </div>
                )}

                {/* Zona de escritura normal */}
                <div className="input-row">
                    <div className="input-wrapper">
                        <textarea 
                            ref={textareaRef}
                            value={text} 
                            onChange={handleInput} 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Escribe un mensaje..."
                            maxLength={MAX_CHARS} //SEGURIDAD EN HTML
                            rows={1}
                        />
                        
                        {/* Contador visual de límite */}
                        <span className={`char-counter ${text.length >= MAX_CHARS ? 'limit-reached' : ''}`}>
                            {text.length}/{MAX_CHARS}
                        </span>
                    </div>
                    
                    <button 
                        className="send-button" 
                        onClick={handleSend} 
                        disabled={isButtonDisabled}
                    >
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TextBar;