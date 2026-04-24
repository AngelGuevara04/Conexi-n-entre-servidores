import React, { useEffect, useRef } from 'react';
import './MessageWindow.css';

/**
 * COMPONENTE MESSAGE_WINDOW: Responsable del renderizado de la conversación activa.
 * Es un componente "Tonto" (Presentacional), solo recibe datos (props) y los dibuja.
 * NUEVO PROP: onReply (Función que se ejecuta al presionar el botón de responder)
 */
const MessageWindow = ({ messages, onReply }) => {
    // Referencia al final del contenedor DOM para gestionar el scroll automático
    const endOfMessagesRef = useRef(null);

    /**
     * EFECTO DE DESPLAZAMIENTO (Scroll)
     * Se activa cada vez que el array de 'messages' cambia de longitud.
     */
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="message-window">
            {messages.length === 0 ? (
                // Pantalla de bienvenida si el chat está vacío
                <div className="empty-chat-msg">
                    <span>Envía un mensaje para iniciar la conversación.</span>
                </div>
            ) : (
                messages.map((msg, idx) => (
                    // message-wrapper agrupa la burbuja + el botón de responder
                    <div key={msg.id || idx} className={`message-wrapper ${msg.tipo}`}>
                        
                        {/* La burbuja visual del mensaje (Verde o Blanca) */}
                        <div className={`message ${msg.tipo}`}>
                            
                            {/* Renderizado Condicional: Solo mostramos autor en mensajes ajenos */}
                            {msg.tipo === 'other' && <span className="author">{msg.autor}</span>}
                            
                            {/*
                                BLOQUE CITA: Dibuja la cajita si el mensaje responde a alguien
                                Verifica si el objeto del mensaje tiene la propiedad 'replyTo'
                                */}
                            {msg.replyTo && (
                                <div className="quoted-message">
                                    <span className="quoted-author">{msg.replyTo.autor}</span>
                                    <p className="quoted-text">{msg.replyTo.texto}</p>
                                </div>
                            )}
                            
                            {/* El texto real que envió el usuario */}
                            <div className="text-content">{msg.texto}</div>
                            
                            {/* Metadatos: Hora y Estado de Entrega */}
                            <div className="message-meta">
                                <span className="time">{msg.hora}</span>
                                
                                {/* Lógica de dibujo de Tildes (Checks) basada en el estado */}
                                {msg.tipo === 'me' && msg.estado && (
                                    <span className={`message-status ${msg.estado}`}>
                                        {msg.estado === 'enviado' && '✓'}
                                        {msg.estado === 'recibido' && '✓✓'}
                                        {msg.estado === 'leido' && '✓✓ (Visto)'}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Botón flotante lateral para activar la respuesta */}
                        {/* Al hacer clic, pasa el objeto completo 'msg' a la función padre */}
                        <button 
                            className="reply-action-btn" 
                            onClick={() => onReply(msg)}
                            title="Responder a este mensaje"
                        >
                            ↩️
                        </button>
                    </div>
                ))
            )}
            {/* Elemento ancla invisible usado por el useEffect para forzar el scroll inferior */}
            <div ref={endOfMessagesRef} />
        </div>
    );
};

export default MessageWindow;