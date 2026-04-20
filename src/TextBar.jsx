import React, { useState } from 'react';
import './TextBar.css';

const TextBar = ({ onSend }) => {
    // El estado local para guardar lo que el usuario está escribiendo
    const [text, setText] = useState("");

    const handleSend = () => {
        if (text.trim() !== "") {
            onSend(text); // Le enviamos el texto a App.jsx
            setText("");  // Limpiamos la caja de texto
        }
    };

    return (
        <div className="text-bar">
            <input 
                type="text" 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Escribe tu mensaje..."
            />
            <button onClick={handleSend}>Enviar</button>
        </div>
    );
};

export default TextBar;