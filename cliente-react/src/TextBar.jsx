import React, { useState, useRef } from 'react';
import './TextBar.css';

const TextBar = ({ onSend }) => {
    // ==========================================
    // BLOQUE 1: REFERENCIAS Y LÍMITES
    // ==========================================
    const [text, setText] = useState("");
    const textareaRef = useRef(null); // Nos permite tocar el HTML de la caja directamente
    const MAX_CHARS = 250;            // Límite inamovible de la app

    // ==========================================
    // BLOQUE 2: LÓGICA DE ENVÍO
    // ==========================================
    const handleSend = () => {
        // Valida que no esté vacío y no pase de 250 caracteres
        if (text.trim() !== "" && text.length <= MAX_CHARS) {
            onSend(text);
            setText("");
            
            // Regresamos la caja a su tamaño original después de enviar
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    // Validaciones para saber si debemos "apagar" (poner gris) el botón de enviar
    const isButtonDisabled = text.trim() === "" || text.length > MAX_CHARS;

    // ==========================================
    // BLOQUE 3: CRECIMIENTO DE LA CAJA (MULTILÍNEA)
    // ==========================================
    // Esta función hace que la caja crezca hacia arriba mientras escribes o pegas párrafos
    const handleInput = (e) => {
        setText(e.target.value);
        e.target.style.height = 'auto'; // Resetea la altura
        e.target.style.height = `${e.target.scrollHeight}px`; // La ajusta al texto interno
    };

    // ==========================================
    // BLOQUE 4: INTERFAZ DE LA BARRA DE TEXTO
    // ==========================================
    return (
        <div className="text-bar">
            <div className="input-wrapper">
                <textarea 
                    ref={textareaRef}
                    value={text} 
                    onChange={handleInput} 
                    onKeyDown={(e) => {
                        // Si presiona "Enter" SIN presionar "Shift", se envía
                        // Si presiona "Shift + Enter", hace un salto de línea normal
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault(); // Evita el salto de línea
                            handleSend();
                        }
                    }}
                    placeholder="Escribe un mensaje..."
                    maxLength={MAX_CHARS}
                    rows={1}
                />
                
                {/* Contador de caracteres (Se pone rojo gracias a la clase limit-reached) */}
                <span className={`char-counter ${text.length >= MAX_CHARS ? 'limit-reached' : ''}`}>
                    {text.length}/{MAX_CHARS}
                </span>
            </div>
            
            <button 
                onClick={handleSend} 
                disabled={isButtonDisabled}
            >
                {/* Icono de Avión de Papel */}
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                </svg>
            </button>
        </div>
    );
};

export default TextBar;