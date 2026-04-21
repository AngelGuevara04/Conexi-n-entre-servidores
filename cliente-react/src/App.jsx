import React, { useState, useEffect } from 'react';
import { connect, send } from './websocket';
import MessageWindow from './MessageWindow';
import TextBar from './TextBar';
import './App.css'; // Usaremos el CSS que ya tenías configurado

function App() {
    // --- ESTADOS ---
    const [identificado, setIdentificado] = useState(false);
    const [nombre, setNombre] = useState("");
    const [usuarios, setUsuarios] = useState([]);
    const [chatActivo, setChatActivo] = useState("Todos");
    const [historiales, setHistoriales] = useState({ Todos: [] });

    // --- CONEXIÓN INICIAL ---
    const iniciarConexion = () => {
        if (!nombre.trim()) return alert("Ingresa un nombre para conectarte");

        connect(
            (incoming) => {
                // Manejador de eventos que vienen del servidor
                if (incoming.mensaje === "IDENTIFICATE") {
                    send("IDENTIFICACION", nombre);
                    send("CONECTADOS");
                    setIdentificado(true);
                }

                if (incoming.mensaje === "CONECTADOS" && incoming.data) {
                    setUsuarios(incoming.data);
                }

                if (incoming.mensaje === "CHAT" && incoming.data) {
                    gestionarMensajeEntrante(incoming.data.emisor, incoming.data.mensaje);
                }
            },
            () => {
                alert("Te has desconectado del servidor");
                window.location.reload();
            }
        );

        // Iniciamos el polling: Pedir lista de conectados cada 3 segundos
        setInterval(() => {
            send("CONECTADOS");
        }, 3000);
    };

    // --- GESTIÓN DE MENSAJES ---
    const gestionarMensajeEntrante = (emisor, texto) => {
        let sala = emisor;
        let limpio = texto;

        if (texto.startsWith("[GLOBAL]")) {
            sala = "Todos";
            limpio = texto.replace("[GLOBAL]", "");
        } else if (texto.startsWith("[PRIVADO]")) {
            limpio = texto.replace("[PRIVADO]", "");
        }

        setHistoriales(prev => ({
            ...prev,
            [sala]: [...(prev[sala] || []), { autor: emisor, texto: limpio, tipo: 'other' }]
        }));
    };

    const handleSendMessage = (texto) => {
        const prefijo = chatActivo === "Todos" ? "[GLOBAL]" : "[PRIVADO]";
        const receptores = chatActivo === "Todos" ? usuarios : [chatActivo];

        // Se lo enviamos al servidor
        send("CHAT", { receptor: receptores, mensaje: prefijo + texto });

        // Lo guardamos en nuestro propio historial visual
        setHistoriales(prev => ({
            ...prev,
            [chatActivo]: [...(prev[chatActivo] || []), { autor: "Tú", texto: texto, tipo: 'me' }]
        }));
    };

    // --- RENDERIZADO VISUAL ---
    if (!identificado) {
        return (
            <div className="login-container">
                <div className="card">
                    <h2>Bienvenido al Chat</h2>
                    <p>Ingresa tu nombre para conectarte</p>
                    <input 
                        type="text" 
                        value={nombre} 
                        onChange={e => setNombre(e.target.value)} 
                        onKeyPress={e => e.key === 'Enter' && iniciarConexion()}
                        placeholder="Ej. Mario, Carlos..." 
                    />
                    <button onClick={iniciarConexion}>Entrar</button>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            {/* Barra Lateral Modularizada */}
            <aside className="sidebar">
                <h3>Chats ({usuarios.length})</h3>
                <div className="user-list">
                    <div 
                        className={`tab ${chatActivo === "Todos" ? "active-tab" : ""}`}
                        onClick={() => setChatActivo("Todos")}
                    >
                        🌐 Sala General
                    </div>
                    {usuarios.map(u => (
                        <div 
                            key={u} 
                            className={`tab ${chatActivo === u ? "active-tab" : ""}`}
                            onClick={() => setChatActivo(u)}
                        >
                            👤 {u}
                        </div>
                    ))}
                </div>
            </aside>

            {/* Ventana de Chat Dinámica */}
            <main className="chat-window">
                <header className="chat-header">
                    Conversando en: <strong>{chatActivo === 'Todos' ? 'Sala General' : chatActivo}</strong>
                </header>
                
                {/* Aquí inyectamos el componente MessageWindow que descargaste */}
                <MessageWindow messages={historiales[chatActivo] || []} />
                
                {/* Aquí inyectamos el componente TextBar que descargaste */}
                <TextBar onSend={handleSendMessage} />
            </main>
        </div>
    );
}

export default App;