import React, { useEffect, useRef } from 'react';
import './MessageWindow.css';

const MessageWindow = ({ messages = [] }) => {
    const bottomRef = useRef(null);

    // Esto hará que la pantalla baje automáticamente cuando llegue un mensaje nuevo
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="message-window">
            {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.tipo}`}>
                    <span className="author">{msg.autor}</span>
                    <p style={{ margin: "5px 0 0 0" }}>{msg.texto}</p>
                </div>
            ))}
            {/* Div invisible para forzar el scroll hacia abajo */}
            <div ref={bottomRef} />
        </div>
    );
};

export default MessageWindow;
