// angelguevara04/conexi-n-entre-servidores/cliente-react/src/TextBar.jsx
import React, { useState, useRef } from 'react';
import './TextBar.css';

const TextBar = ({ onSend }) => {
    const [text, setText] = useState("");
    const textareaRef = useRef(null); 
    const MAX_CHARS = 250;            

    const handleSend = () => {
        if (text.trim() !== "" && text.length <= MAX_CHARS) {
            onSend(text);
            setText("");
            
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const isButtonDisabled = text.trim() === "" || text.length > MAX_CHARS;

    const handleInput = (e) => {
        setText(e.target.value);
        e.target.style.height = 'auto'; 
        e.target.style.height = `${e.target.scrollHeight}px`; 
    };

    return (
        <div className="text-bar-outer-container">
            <div className="text-bar-inner-wrapper">
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
                        maxLength={MAX_CHARS}
                        rows={1}
                    />
                    
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
    );
};

export default TextBar;