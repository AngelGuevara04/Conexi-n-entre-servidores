import React, { useEffect, useRef } from 'react';
import './MessageWindow.css';

const MessageWindow = ({ messages }) => {
    const endOfMessagesRef = useRef(null);

    // Auto-scroll al recibir o enviar mensajes
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
                        {/* Autor (solo si es de otra persona) */}
                        {msg.tipo === 'other' && <span className="author">{msg.autor}</span>}
                        
                        {/* Contenido del mensaje */}
                        <div className="text-content">{msg.texto}</div>
                        
                        {/* Metadatos (Hora y Estado) */}
                        <div className="message-meta">
                            <span className="time">{msg.hora}</span>
                            
                            {/* NUEVA LÓGICA DE ESTADO EN TEXTO */}
                            {msg.tipo === 'me' && msg.estado && (
                                <span className={`message-status ${msg.estado}`}>
                                    {msg.estado === 'enviado' && 'Mensaje enviado'}
                                    {msg.estado === 'recibido' && 'Mensaje entregado'}
                                    {msg.estado === 'leido' && 'Mensaje leído'}
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