import React, { useEffect, useRef } from 'react';
import './MessageWindow.css';

/**
 * COMPONENTE MESSAGE_WINDOW: Responsable del renderizado de la conversación activa.
 * Es un componente "Tonto" (Presentacional), solo recibe datos (props) y los dibuja.
 */
const MessageWindow = ({ messages }) => {
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
                <div className="empty-chat-msg">
                    <span>Envía un mensaje para iniciar la conversación.</span>
                </div>
            ) : (
                messages.map((msg, idx) => (
                    // Asignación dinámica de clases CSS según si el mensaje es 'me' u 'other'
                    <div key={msg.id || idx} className={`message ${msg.tipo}`}>
                        {/* Renderizado Condicional: Solo mostramos autor en mensajes ajenos */}
                        {msg.tipo === 'other' && <span className="author">{msg.autor}</span>}
                        
                        <div className="text-content">{msg.texto}</div>
                        
                        <div className="message-meta">
                            <span className="time">{msg.hora}</span>
                            
                            {/* RENDERIZADO DEL ESTADO (Tildes / Checks)
                                Evaluamos la variable estado: 'enviado', 'recibido', 'leido' */}
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
            {/* Elemento ancla invisible usado por el useEffect para forzar el scroll inferior */}
            <div ref={endOfMessagesRef} />
        </div>
    );
};

export default MessageWindow;