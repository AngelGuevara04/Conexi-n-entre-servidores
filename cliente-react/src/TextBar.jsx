import React, { useState } from 'react';
import './TextBar.css';

const TextBar = ({ onSend }) => {
    const [text, setText] = useState("");

    const handleSend = () => {
        if (text.trim() !== "") {
            onSend(text);
            setText("");
        }
    };

    return (
        <div className="text-bar">
            <input 
                type="text" 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Escribe un mensaje..."
            />
            <button onClick={handleSend} title="Enviar">
                {/* Aquí está el código de la flechita (Avión de papel) */}
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                </svg>
            </button>
        </div>
    );
};

export default TextBar;