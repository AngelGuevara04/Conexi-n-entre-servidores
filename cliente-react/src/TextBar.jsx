import React, { useState } from 'react';
import './TextBar.css';

const TextBar = ({ onSend }) => {
    const [text, setText] = useState("");
    const MAX_CHARS = 250; 

    const handleSend = () => {
        // Validación: No vacío y no mayor al límite
        if (text.trim() !== "" && text.length <= MAX_CHARS) {
            onSend(text);
            setText("");
        }
    };

    return (
        <div className="text-bar">
            <div className="input-wrapper">
                <input 
                    type="text" 
                    value={text} 
                    onChange={(e) => setText(e.target.value)} 
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Escribe un mensaje..."
                    maxLength={MAX_CHARS}
                />
                {/* Contador de caracteres dinámico */}
                <span className={`char-counter ${text.length >= MAX_CHARS ? 'limit-reached' : ''}`}>
                    {text.length}/{MAX_CHARS}
                </span>
            </div>
            
            <button 
                onClick={handleSend} 
                disabled={text.trim() === "" || text.length > MAX_CHARS}
            >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                </svg>
            </button>
        </div>
    );
};

export default TextBar;