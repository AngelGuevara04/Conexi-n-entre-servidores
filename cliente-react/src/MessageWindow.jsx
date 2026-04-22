import React, { useEffect, useRef } from 'react';
import './MessageWindow.css';

const MessageWindow = ({ messages }) => {
    const endOfMessagesRef = useRef(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="message-window">
            {messages.length === 0 ? (
                <div className="empty-chat-msg">
                    <span>Envía un mensaje para iniciar la conversación.</span>
                </div>
            ) : (
                messages.map((msg, idx) => (
                    <div key={msg.id || idx} className={`message ${msg.tipo}`}>
                        {msg.tipo === 'other' && <span className="author">{msg.autor}</span>}
                        
                        <div className="text-content">{msg.texto}</div>
                        
                        <div className="message-meta">
                            <span className="time">{msg.hora}</span>
                            
                            {/* LOGICA DE CHECKMARKS TIPO WHATSAPP */}
                            {msg.tipo === 'me' && msg.estado && (
                                <span className={`check-status ${msg.estado === 'leido' ? 'read' : ''}`}>
                                    {msg.estado === 'enviado' ? '✓' : '✓✓'}
                                </span>
                            )}
                        </div>
                    </div>
                ))
            )}
            <div ref={endOfMessagesRef} />
        </div>
    );
};

export default MessageWindow;