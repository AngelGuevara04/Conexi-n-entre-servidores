import React, { useState, useEffect, useRef } from 'react';
import { connect, send } from './websocket';
import MessageWindow from './MessageWindow';
import TextBar from './TextBar';
import './App.css'; 

function App() {
    const [identificado, setIdentificado] = useState(false);
    const [nombre, setNombre] = useState("");
    const [usuarios, setUsuarios] = useState([]);
    const [chatsAbiertos, setChatsAbiertos] = useState(["Todos"]);
    const [vistaContactos, setVistaContactos] = useState(false);
    const [busqueda, setBusqueda] = useState("");
    const [chatActivo, setChatActivo] = useState("Todos");
    const [historiales, setHistoriales] = useState({ Todos: [] });
    const [noLeidos, setNoLeidos] = useState({});
    
    const chatActivoRef = useRef(chatActivo);
    useEffect(() => {
        chatActivoRef.current = chatActivo;
    }, [chatActivo]);

    const usuariosFiltrados = usuarios.filter(u => 
        u.toLowerCase().includes(busqueda.toLowerCase())
    );

    const iniciarConexion = () => {
        if (!nombre.trim()) return alert("Ingresa un nombre");

        connect(
            (incoming) => {
                if (incoming.mensaje === "IDENTIFICATE") send("IDENTIFICACION", nombre);
                if (incoming.mensaje === "IDENTIFICACION_EXITOSA") {
                    send("CONECTADOS");
                    setIdentificado(true);
                }
                if (incoming.mensaje === "ERROR") alert(incoming.data); 
                if (incoming.mensaje === "CONECTADOS" && incoming.data) setUsuarios(incoming.data);
                
                if (incoming.mensaje === "CHAT" && incoming.data) {
                    gestionarMensajeEntrante(
                        incoming.data.emisor, 
                        incoming.data.mensaje, 
                        incoming.data.id, 
                        incoming.data.hora
                    );
                }

                // NUEVO: Escuchamos cuando el otro recibe en su celular (2 palomitas grises)
                if (incoming.mensaje === "CONFIRMACION_RECEPCION" && incoming.data) {
                    actualizarEstadoMensaje(incoming.data.receptor, incoming.data.idMensaje, 'recibido');
                }

                // Escuchamos cuando el otro abre el chat (2 palomitas azules)
                if (incoming.mensaje === "CONFIRMACION_LECTURA" && incoming.data) {
                    actualizarEstadoMensaje(incoming.data.lector, incoming.data.idMensaje, 'leido');
                }
            },
            () => { alert("Conexión perdida con el servidor."); window.location.reload(); }
        );

        setInterval(() => send("CONECTADOS"), 3000);
    };

    // FUNCIÓN ÚNICA PARA CAMBIAR EL ESTADO DEL CHECK
    const actualizarEstadoMensaje = (sala, idMensaje, nuevoEstado) => {
        setHistoriales(prev => {
            if (!prev[sala]) return prev;
            return {
                ...prev,
                [sala]: prev[sala].map(msg => {
                    if (msg.id === idMensaje) {
                        // Evita que un mensaje 'leido' regrese a 'recibido' por lag de red
                        if (msg.estado === 'leido') return msg;
                        return { ...msg, estado: nuevoEstado };
                    }
                    return msg;
                })
            };
        });
    };

    const gestionarMensajeEntrante = (emisor, texto, idMensaje, hora) => {
        let sala = emisor;
        let limpio = texto;

        if (texto.startsWith("[GLOBAL]")) {
            sala = "Todos";
            limpio = texto.replace("[GLOBAL]", "");
        } else if (texto.startsWith("[PRIVADO]")) {
            limpio = texto.replace("[PRIVADO]", "");
            
            // NUEVO: AVISAMOS AL INSTANTE QUE EL MENSAJE LLEGÓ AL NAVEGADOR
            send("MENSAJE_RECIBIDO", { idMensaje: idMensaje, autorOriginal: emisor });
        }

        setChatsAbiertos(prev => {
            if (!prev.includes(sala)) return [sala, ...prev];
            return prev;
        });

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

        if (sala !== chatActivoRef.current) {
            setNoLeidos(prev => ({ ...prev, [sala]: (prev[sala] || 0) + 1 }));
        } 
        else if (sala !== "Todos") {
            // Si ya estamos viendo el chat, mandamos confirmación de LECTURA al instante
            send("MENSAJE_LEIDO", { idMensaje: idMensaje, autorOriginal: emisor });
            setHistoriales(prev => ({
                ...prev,
                [sala]: prev[sala].map(m => m.id === idMensaje ? {...m, reportadoComoLeido: true} : m)
            }));
        }
    };

    const handleSendMessage = (texto) => {
        const prefijo = chatActivo === "Todos" ? "[GLOBAL]" : "[PRIVADO]";
        const receptores = chatActivo === "Todos" ? usuarios : [chatActivo];
        
        const idUnico = Date.now().toString() + Math.floor(Math.random() * 1000);
        const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        send("CHAT", { receptor: receptores, mensaje: prefijo + texto, id: idUnico, hora: horaActual });

        setHistoriales(prev => ({
            ...prev,
            [chatActivo]: [...(prev[chatActivo] || []), { 
                id: idUnico, 
                autor: "Tú", 
                texto: texto, 
                tipo: 'me', 
                estado: 'enviado', // Nace con 1 palomita
                hora: horaActual
            }]
        }));
    };

    const cambiarChat = (chat) => {
        setChatActivo(chat);
        setNoLeidos(prev => ({ ...prev, [chat]: 0 }));

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

    const abrirChat = (usuario) => {
        setChatsAbiertos(prev => {
            if (!prev.includes(usuario)) return [usuario, ...prev];
            return prev;
        });
        cambiarChat(usuario); 
        setVistaContactos(false);
        setBusqueda("");
    };

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

    return (
        <div className="app-container">
            <aside className="sidebar">
                {vistaContactos ? (
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

            <main className="chat-window">
                <header className="chat-header">
                    Chat con: <strong>{chatActivo === 'Todos' ? 'Sala General' : chatActivo}</strong>
                </header>
                <MessageWindow messages={historiales[chatActivo] || []} />
                <TextBar onSend={handleSendMessage} />
            </main>
        </div>
    );
}

export default App;