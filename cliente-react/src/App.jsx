import React, { useState, useEffect, useRef } from 'react';
import { connect, send } from './websocket';
import MessageWindow from './MessageWindow';
import TextBar from './TextBar';
import './App.css'; 

function App() {
    // ==========================================
    // BLOQUE 1: ESTADOS (VARIABLES MÁGICAS DE REACT)
    // ==========================================
    const [identificado, setIdentificado] = useState(false); // ¿Ya entró al chat?
    const [nombre, setNombre] = useState("");                // Nombre del usuario
    const [usuarios, setUsuarios] = useState([]);            // Lista de todos los conectados
    const [chatsAbiertos, setChatsAbiertos] = useState(["Todos"]); // Pestañas en la barra lateral
    const [vistaContactos, setVistaContactos] = useState(false);   // ¿Estamos viendo los contactos o los chats?
    const [busqueda, setBusqueda] = useState("");            // Texto del buscador de contactos
    const [chatActivo, setChatActivo] = useState("Todos");   // Chat que se está viendo en pantalla
    const [historiales, setHistoriales] = useState({ Todos: [] }); // Diccionario con los mensajes de cada chat
    const [noLeidos, setNoLeidos] = useState({});            // Contador del circulito verde

    // Referencia para saber siempre en qué chat estamos (útil para el WebSocket)
    const chatActivoRef = useRef(chatActivo);
    useEffect(() => {
        chatActivoRef.current = chatActivo;
    }, [chatActivo]);

    // Filtrado del buscador en tiempo real
    const usuariosFiltrados = usuarios.filter(u => 
        u.toLowerCase().includes(busqueda.toLowerCase())
    );

    // ==========================================
    // BLOQUE 2: CONEXIÓN AL SERVIDOR WEBSOCKET
    // ==========================================
    const iniciarConexion = () => {
        if (!nombre.trim()) return alert("Ingresa un nombre");

        connect(
            (incoming) => {
                // El servidor nos saluda y pide nombre
                if (incoming.mensaje === "IDENTIFICATE") send("IDENTIFICACION", nombre);
                
                // El servidor aprueba nuestro nombre
                if (incoming.mensaje === "IDENTIFICACION_EXITOSA") {
                    send("CONECTADOS");
                    setIdentificado(true);
                }
                
                // El servidor rechaza el nombre (está repetido)
                if (incoming.mensaje === "ERROR") alert(incoming.data); 
                
                // Actualiza la lista de conectados
                if (incoming.mensaje === "CONECTADOS" && incoming.data) setUsuarios(incoming.data);
                
                // Alguien nos envió un mensaje
                if (incoming.mensaje === "CHAT" && incoming.data) {
                    gestionarMensajeEntrante(incoming.data.emisor, incoming.data.mensaje, incoming.data.id, incoming.data.hora);
                }

                // El celular del otro usuario confirma que le LLEGÓ el mensaje (doble check gris)
                if (incoming.mensaje === "CONFIRMACION_RECEPCION" && incoming.data) {
                    actualizarEstadoMensaje(incoming.data.receptor, incoming.data.idMensaje, 'recibido');
                }

                // El otro usuario ABRIÓ nuestra ventana de chat (doble check azul)
                if (incoming.mensaje === "CONFIRMACION_LECTURA" && incoming.data) {
                    actualizarEstadoMensaje(incoming.data.lector, incoming.data.idMensaje, 'leido');
                }
            },
            () => { alert("Conexión perdida con el servidor."); window.location.reload(); }
        );

        // Pedimos actualización de usuarios cada 3 segundos
        setInterval(() => send("CONECTADOS"), 3000);
    };

    // ==========================================
    // BLOQUE 3: RECEPCIÓN DE MENSAJES Y ESTADOS
    // ==========================================
    
    // Función que cambia un check de 'enviado' a 'recibido' o 'leido'
    const actualizarEstadoMensaje = (sala, idMensaje, nuevoEstado) => {
        setHistoriales(prev => {
            if (!prev[sala]) return prev;
            return {
                ...prev,
                [sala]: prev[sala].map(msg => {
                    if (msg.id === idMensaje) {
                        // Evitamos que un check azul se vuelva gris por error de internet
                        if (msg.estado === 'leido') return msg;
                        return { ...msg, estado: nuevoEstado };
                    }
                    return msg;
                })
            };
        });
    };

    // Cuando recibes un mensaje de otra persona
    const gestionarMensajeEntrante = (emisor, texto, idMensaje, hora) => {
        let sala = emisor;
        let limpio = texto;

        if (texto.startsWith("[GLOBAL]")) {
            sala = "Todos";
            limpio = texto.replace("[GLOBAL]", "");
        } else if (texto.startsWith("[PRIVADO]")) {
            limpio = texto.replace("[PRIVADO]", "");
            // Avisamos DE INMEDIATO que el mensaje llegó a nuestro dispositivo
            send("MENSAJE_RECIBIDO", { idMensaje: idMensaje, autorOriginal: emisor });
        }

        // Abre la pestaña de ese chat si no existía
        setChatsAbiertos(prev => {
            if (!prev.includes(sala)) return [sala, ...prev];
            return prev;
        });

        // Guarda el mensaje en el historial
        setHistoriales(prev => ({
            ...prev,
            [sala]: [...(prev[sala] || []), { 
                id: idMensaje, 
                autor: emisor, 
                texto: limpio, 
                tipo: 'other', 
                hora: hora,
                reportadoComoLeido: false
            }]
        }));

        // LÓGICA DE NOTIFICACIONES (El circulito verde)
        if (sala !== chatActivoRef.current) {
            // Si NO estoy viendo ese chat, súmale 1 al círculo verde
            setNoLeidos(prev => ({ ...prev, [sala]: (prev[sala] || 0) + 1 }));
        } 
        else if (sala !== "Todos") {
            // Si SÍ estoy viendo el chat, le aviso al otro que ya lo leí (check azul)
            send("MENSAJE_LEIDO", { idMensaje: idMensaje, autorOriginal: emisor });
            setHistoriales(prev => ({
                ...prev,
                [sala]: prev[sala].map(m => m.id === idMensaje ? {...m, reportadoComoLeido: true} : m)
            }));
        }
    };

    // ==========================================
    // BLOQUE 4: ENVÍO DE MENSAJES (TUYOS)
    // ==========================================
    const handleSendMessage = (texto) => {
        const prefijo = chatActivo === "Todos" ? "[GLOBAL]" : "[PRIVADO]";
        const receptores = chatActivo === "Todos" ? usuarios : [chatActivo];
        
        // Creamos un ID único y sacamos la hora actual
        const idUnico = Date.now().toString() + Math.floor(Math.random() * 1000);
        const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Lo mandamos al servidor
        send("CHAT", { receptor: receptores, mensaje: prefijo + texto, id: idUnico, hora: horaActual });

        // Lo guardamos en nuestra propia pantalla con estado 'enviado' (1 palomita)
        setHistoriales(prev => ({
            ...prev,
            [chatActivo]: [...(prev[chatActivo] || []), { 
                id: idUnico, 
                autor: "Tú", 
                texto: texto, 
                tipo: 'me', 
                estado: 'enviado', 
                hora: horaActual
            }]
        }));
    };

    // ==========================================
    // BLOQUE 5: CAMBIO DE CHATS Y MENÚS
    // ==========================================
    
    // Cuando haces clic en una pestaña de chat
    const cambiarChat = (chat) => {
        setChatActivo(chat);
        setNoLeidos(prev => ({ ...prev, [chat]: 0 })); // Borra el círculo verde

        // Busca si hay mensajes sin leer en ese chat y manda el check azul
        if (chat !== "Todos") {
            setHistoriales(prev => {
                const chatHistory = prev[chat] || [];
                let huboCambios = false;
                
                const updatedHistory = chatHistory.map(msg => {
                    if (msg.tipo === 'other' && !msg.reportadoComoLeido) {
                        send("MENSAJE_LEIDO", { idMensaje: msg.id, autorOriginal: msg.autor });
                        huboCambios = true;
                        return { ...msg, reportadoComoLeido: true };
                    }
                    return msg;
                });

                if (huboCambios) return { ...prev, [chat]: updatedHistory };
                return prev;
            });
        }
    };

    // Cuando buscas a alguien nuevo e inicias chat
    const abrirChat = (usuario) => {
        setChatsAbiertos(prev => {
            if (!prev.includes(usuario)) return [usuario, ...prev];
            return prev;
        });
        cambiarChat(usuario); 
        setVistaContactos(false); // Cierra la pantalla de contactos
        setBusqueda("");          // Limpia el buscador
    };

    // ==========================================
    // BLOQUE 6: RENDERIZADO VISUAL (INTERFAZ HTML)
    // ==========================================
    
    // PANTALLA DE LOGIN
    if (!identificado) {
        return (
            <div className="login-container">
                <div className="card">
                    <h2>Chat Pro</h2>
                    <p>Ingresa tu nombre para comenzar</p>
                    <input 
                        type="text" 
                        value={nombre} 
                        onChange={e => setNombre(e.target.value)} 
                        onKeyPress={e => e.key === 'Enter' && iniciarConexion()}
                        placeholder="Ej: Angel04" 
                    />
                    <button onClick={iniciarConexion}>Entrar al Chat</button>
                </div>
            </div>
        );
    }

    // PANTALLA PRINCIPAL DEL CHAT
    return (
        <div className="app-container">
            {/* PANEL LATERAL IZQUIERDO */}
            <aside className="sidebar">
                {vistaContactos ? (
                    // VISTA 2: LISTA DE CONTACTOS PARA NUEVO CHAT
                    <>
                        <div className="sidebar-header slide-header">
                            <button className="icon-btn" onClick={() => { setVistaContactos(false); setBusqueda(""); }}>←</button>
                            <h3>Contactos</h3>
                        </div>
                        <div className="search-container">
                            <input 
                                type="text" 
                                placeholder="Buscar..." 
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                        <div className="user-list vertical-list">
                            {usuariosFiltrados.length === 0 ? (
                                <p className="empty-msg">No hay nadie más conectado</p>
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
                    // VISTA 1: CHATS ACTIVOS Y SALA GENERAL
                    <>
                        <div className="sidebar-header">
                            <h3>Mis Chats</h3>
                            <button className="new-chat-btn" onClick={() => setVistaContactos(true)}>➕</button>
                        </div>
                        <div className="user-list">
                            {chatsAbiertos.map(chat => (
                                <div 
                                    key={chat} 
                                    className={`tab ${chatActivo === chat ? "active-tab" : ""}`}
                                    onClick={() => cambiarChat(chat)}
                                >
                                    <div className="avatar">{chat === "Todos" ? "🌐" : "👤"}</div>
                                    <div className="tab-info">
                                        <span className="tab-name">{chat === "Todos" ? "Sala General" : chat}</span>
                                    </div>
                                    {noLeidos[chat] > 0 && (
                                        <div className="unread-badge">{noLeidos[chat]}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </aside>

            {/* PANEL DERECHO: CONVERSACIÓN */}
            <main className="chat-window">
                <header className="chat-header">
                    Chat con: <strong>{chatActivo === 'Todos' ? 'Sala General' : chatActivo}</strong>
                </header>
                {/* Dibuja las burbujas */}
                <MessageWindow messages={historiales[chatActivo] || []} />
                {/* Dibuja la barra de texto */}
                <TextBar onSend={handleSendMessage} />
            </main>
        </div>
    );
}

export default App;