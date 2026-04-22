import React, { useState, useEffect, useRef } from 'react';
import { connect, send } from './websocket';
import MessageWindow from './MessageWindow';
import TextBar from './TextBar';
import './App.css'; 

function App() {
    /**
     * BLOQUE 1: ESTADO GLOBAL
     */
    const [identificado, setIdentificado] = useState(false); // Bandera de autenticación
    const [nombre, setNombre] = useState("");                // Credencial del usuario
    const [usuarios, setUsuarios] = useState([]);            // Memoria de nodos activos en la red
    const [chatsAbiertos, setChatsAbiertos] = useState(["Todos"]); 
    const [vistaContactos, setVistaContactos] = useState(false);   
    const [busqueda, setBusqueda] = useState("");            
    const [chatActivo, setChatActivo] = useState("Todos");   // Puntero a la sala actual
    
    // Diccionario de historiales: Llave = Nombre del Contacto, Valor = Array de Mensajes
    const [historiales, setHistoriales] = useState({ Todos: [] }); 
    const [noLeidos, setNoLeidos] = useState({});            

    /**
     * MANEJO DE CONTEXTO ASÍNCRONO
     * Como el callback del WebSocket no lee el estado de React en tiempo real,
     * usamos un useRef para mantener un puntero inmutable al chat activo actual.
     */
    const chatActivoRef = useRef(chatActivo);
    useEffect(() => {
        chatActivoRef.current = chatActivo;
    }, [chatActivo]);

    const usuariosFiltrados = usuarios.filter(u => 
        u.toLowerCase().includes(busqueda.toLowerCase())
    );

    /**
     * BLOQUE 2: PROTOCOLO DE CONEXIÓN Y HANDSHAKE
     */
    const iniciarConexion = () => {
        if (!nombre.trim()) return alert("Ingresa un nombre");

        // Inicializa el túnel WS y mapea los comandos recibidos a funciones locales
        connect(
            (incoming) => {
                // Etapa 1: Petición de identidad
                if (incoming.mensaje === "IDENTIFICATE") send("IDENTIFICACION", nombre);
                
                // Etapa 2: Aprobación y solicitud del directorio de usuarios
                if (incoming.mensaje === "IDENTIFICACION_EXITOSA") {
                    send("CONECTADOS");
                    setIdentificado(true);
                }
                
                if (incoming.mensaje === "ERROR") alert(incoming.data); 
                if (incoming.mensaje === "CONECTADOS" && incoming.data) setUsuarios(incoming.data);
                
                // Evento de Comunicación Principal
                if (incoming.mensaje === "CHAT" && incoming.data) {
                    gestionarMensajeEntrante(incoming.data.emisor, incoming.data.mensaje, incoming.data.id, incoming.data.hora);
                }

                // Callbacks de Estado de Mensaje (Checklist)
                if (incoming.mensaje === "CONFIRMACION_RECEPCION" && incoming.data) {
                    actualizarEstadoMensaje(incoming.data.receptor, incoming.data.idMensaje, 'recibido');
                }

                if (incoming.mensaje === "CONFIRMACION_LECTURA" && incoming.data) {
                    actualizarEstadoMensaje(incoming.data.lector, incoming.data.idMensaje, 'leido');
                }
            },
            () => { alert("Conexión perdida con el servidor."); window.location.reload(); }
        );

        // Polling: Solicita la lista de conectados cada 3 segundos (Evita desconexiones por inactividad)
        setInterval(() => send("CONECTADOS"), 3000);
    };

    /**
     * BLOQUE 3: MUTACIÓN DEL HISTORIAL Y NOTIFICACIONES
     */
    
    // Función mutadora pura: Actualiza el estado de un mensaje sin tocar el resto del historial
    const actualizarEstadoMensaje = (sala, idMensaje, nuevoEstado) => {
        setHistoriales(prev => {
            if (!prev[sala]) return prev;
            return {
                ...prev,
                [sala]: prev[sala].map(msg => {
                    if (msg.id === idMensaje) {
                        // Jerarquía de estados: Evitamos regresar a un estado inferior
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

        // Decodificación del protocolo de metadatos ([GLOBAL] o [PRIVADO])
        if (texto.startsWith("[GLOBAL]")) {
            sala = "Todos";
            limpio = texto.replace("[GLOBAL]", "");
        } else if (texto.startsWith("[PRIVADO]")) {
            limpio = texto.replace("[PRIVADO]", "");
            // Trigger automático: Acusamos recibo a nivel red (doble check gris)
            send("MENSAJE_RECIBIDO", { idMensaje: idMensaje, autorOriginal: emisor });
        }

        // Abre la sesión del usuario si no existía en nuestra interfaz
        setChatsAbiertos(prev => {
            if (!prev.includes(sala)) return [sala, ...prev];
            return prev;
        });

        // Inyección del mensaje en el árbol de estado
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

        // Lógica de Presencia: ¿El usuario está viendo la pantalla donde cayó el mensaje?
        if (sala !== chatActivoRef.current) {
            setNoLeidos(prev => ({ ...prev, [sala]: (prev[sala] || 0) + 1 }));
        } 
        else if (sala !== "Todos") {
            // Si el usuario tiene la pestaña abierta, se marca como leído automáticamente
            send("MENSAJE_LEIDO", { idMensaje: idMensaje, autorOriginal: emisor });
            setHistoriales(prev => ({
                ...prev,
                [sala]: prev[sala].map(m => m.id === idMensaje ? {...m, reportadoComoLeido: true} : m)
            }));
        }
    };

    /**
     * BLOQUE 4: EMISIÓN DE DATOS (TX)
     */
    const handleSendMessage = (texto) => {
        const prefijo = chatActivo === "Todos" ? "[GLOBAL]" : "[PRIVADO]";
        const receptores = chatActivo === "Todos" ? usuarios : [chatActivo];
        
        // Generación de identificador único distribuido (UUID casero)
        const idUnico = Date.now().toString() + Math.floor(Math.random() * 1000);
        const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        send("CHAT", { receptor: receptores, mensaje: prefijo + texto, id: idUnico, hora: horaActual });

        // Optimistic UI Update: Agregamos el mensaje a nuestra pantalla antes de que el servidor conteste
        setHistoriales(prev => ({
            ...prev,
            [chatActivo]: [...(prev[chatActivo] || []), { 
                id: idUnico, 
                autor: "Tú", 
                texto: texto, 
                tipo: 'me', 
                estado: 'enviado', // Estado inicial por defecto (1 check)
                hora: horaActual
            }]
        }));
    };

    /**
     * BLOQUE 5: CONTROL DE VISTAS (ENRUTAMIENTO LOCAL)
     */
    const cambiarChat = (chat) => {
        setChatActivo(chat);
        setNoLeidos(prev => ({ ...prev, [chat]: 0 })); 

        // Cuando entras a un chat, escanea mensajes pendientes de notificar lectura
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

    
    // BLOQUE 6: RENDERIZADO VISUAL (INTERFAZ HTML)
    
    
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