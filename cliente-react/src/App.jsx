import React, { useState, useEffect } from 'react';
import { connect, send } from './websocket';
import MessageWindow from './MessageWindow';
import TextBar from './TextBar';
import './App.css'; 

function App() {
    // --- ESTADOS ---
    const [identificado, setIdentificado] = useState(false);
    const [nombre, setNombre] = useState("");
    const [usuarios, setUsuarios] = useState([]); // Todos los conectados
    
    // NUEVOS ESTADOS: Estilo WhatsApp
    const [chatsAbiertos, setChatsAbiertos] = useState(["Todos"]); // Solo los chats activos
    const [vistaContactos, setVistaContactos] = useState(false);   // Para alternar la barra lateral
    const [busqueda, setBusqueda] = useState("");                  // Para el buscador de contactos
    
    const [chatActivo, setChatActivo] = useState("Todos");
    const [historiales, setHistoriales] = useState({ Todos: [] });

    // --- LÓGICA DE BÚSQUEDA ---
    // Filtramos los usuarios en tiempo real basados en lo que se escriba en el buscador
    const usuariosFiltrados = usuarios.filter(u => 
        u.toLowerCase().includes(busqueda.toLowerCase())
    );

    // --- CONEXIÓN ---
    const iniciarConexion = () => {
        if (!nombre.trim()) return alert("Ingresa un nombre");

        connect(
            (incoming) => {
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
            () => { alert("Desconectado"); window.location.reload(); }
        );

        setInterval(() => send("CONECTADOS"), 3000);
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

        // MAGIA WHATSAPP: Si alguien te escribe y no tenías su chat abierto, se abre automáticamente
        setChatsAbiertos(prev => {
            if (!prev.includes(sala)) return [sala, ...prev];
            return prev;
        });

        setHistoriales(prev => ({
            ...prev,
            [sala]: [...(prev[sala] || []), { autor: emisor, texto: limpio, tipo: 'other' }]
        }));
    };

    const handleSendMessage = (texto) => {
        const prefijo = chatActivo === "Todos" ? "[GLOBAL]" : "[PRIVADO]";
        const receptores = chatActivo === "Todos" ? usuarios : [chatActivo];

        send("CHAT", { receptor: receptores, mensaje: prefijo + texto });

        setHistoriales(prev => ({
            ...prev,
            [chatActivo]: [...(prev[chatActivo] || []), { autor: "Tú", texto: texto, tipo: 'me' }]
        }));
    };

    // ACCIÓN WHATSAPP: Iniciar un nuevo chat desde la lista de contactos
    const abrirChat = (usuario) => {
        setChatsAbiertos(prev => {
            if (!prev.includes(usuario)) return [usuario, ...prev]; // Lo pone hasta arriba
            return prev;
        });
        setChatActivo(usuario);
        setVistaContactos(false); // Regresa a la vista normal de chats
        setBusqueda("");          // Limpia el buscador para la próxima vez
    };

    // --- RENDERIZADO VISUAL ---
    if (!identificado) {
        return (
            <div className="login-container">
                <div className="card">
                    <h2>Bienvenido al Chat</h2>
                    <input 
                        type="text" 
                        value={nombre} 
                        onChange={e => setNombre(e.target.value)} 
                        onKeyPress={e => e.key === 'Enter' && iniciarConexion()}
                        placeholder="Tu nombre..." 
                    />
                    <button onClick={iniciarConexion}>Entrar</button>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            {/* --- BARRA LATERAL ESTILO WHATSAPP --- */}
            <aside className="sidebar">
                
                {vistaContactos ? (
                    /* VISTA 2: LISTA DE CONTACTOS PARA NUEVO CHAT (CON BUSCADOR) */
                    <>
                        <div className="sidebar-header slide-header">
                            <button className="icon-btn" onClick={() => { setVistaContactos(false); setBusqueda(""); }}>←</button>
                            <h3>Nuevo Chat</h3>
                        </div>
                        
                        {/* CONTENEDOR DEL BUSCADOR */}
                        <div className="search-container">
                            <input 
                                type="text" 
                                placeholder="Buscar contacto..." 
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>

                        {/* LISTA VERTICAL FILTRADA */}
                        <div className="user-list vertical-list">
                            {usuariosFiltrados.length === 0 ? (
                                <p className="empty-msg">No se encontraron usuarios</p>
                            ) : (
                                usuariosFiltrados.map(u => (
                                    <div key={u} className="tab" onClick={() => abrirChat(u)}>
                                        <div className="avatar">👤</div>
                                        <div className="tab-info">
                                            <span className="tab-name">{u}</span>
                                            <span className="tab-status">Disponible</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    /* VISTA 1: CHATS ACTIVOS (HISTORIAL) */
                    <>
                        <div className="sidebar-header">
                            <h3>Chats</h3>
                            <button className="new-chat-btn" onClick={() => setVistaContactos(true)} title="Nuevo Chat">
                                ➕
                            </button>
                        </div>
                        <div className="user-list">
                            {chatsAbiertos.map(chat => (
                                <div 
                                    key={chat} 
                                    className={`tab ${chatActivo === chat ? "active-tab" : ""}`}
                                    onClick={() => setChatActivo(chat)}
                                >
                                    <div className="avatar">{chat === "Todos" ? "🌐" : "👤"}</div>
                                    <div className="tab-info">
                                        <span className="tab-name">{chat === "Todos" ? "Sala General" : chat}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </aside>

            {/* --- VENTANA DE CHAT --- */}
            <main className="chat-window">
                <header className="chat-header">
                    Conversando con: <strong>{chatActivo === 'Todos' ? 'Sala General' : chatActivo}</strong>
                </header>
                <MessageWindow messages={historiales[chatActivo] || []} />
                <TextBar onSend={handleSendMessage} />
            </main>
        </div>
    );
}

export default App;