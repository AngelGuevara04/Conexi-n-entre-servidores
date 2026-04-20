import React, { useState, useEffect } from 'react';
import { connect, send } from './websocket';
import MessageWindow from './MessageWindow';
import TextBar from './TextBar';

function App() {
    const [messages, setMessages] = useState([]);
    const [nombre] = useState("UsuarioReact"); // Aquí podrías usar un prompt

    useEffect(() => {
        connect((incoming) => {
            // Lógica para manejar IDENTIFICATE, CONECTADOS y CHAT
            if (incoming.mensaje === "IDENTIFICATE") {
                send("IDENTIFICACION", nombre);
            } else if (incoming.mensaje === "CHAT") {
                const nuevoMsg = { 
                    autor: incoming.data.emisor, 
                    texto: incoming.data.mensaje, 
                    tipo: 'other' 
                };
                setMessages(prev => [...prev, nuevoMsg]);
            }
        });
    }, []);

    const onSendMessage = (text) => {
        // Adaptado a tu lógica de CHAT masivo por defecto
        send("CHAT", { receptor: "Todos", mensaje: text });
        setMessages(prev => [...prev, { autor: "Tú", texto: text, tipo: 'me' }]);
    };

    return (
        <div className="app">
            <MessageWindow messages={messages} />
            <TextBar onSend={onSendMessage} />
        </div>
    );
}