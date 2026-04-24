import React, { useState, useEffect, useRef } from 'react';
import { connect, send } from './websocket';
import MessageWindow from './MessageWindow';
import TextBar from './TextBar';
import './App.css'; 

function App() {
    /**
     * BLOQUE 1: ESTADO GLOBAL (DOM VIRTUAL)
     */
    const [identificado, setIdentificado] = useState(false); 
    const [nombre, setNombre] = useState("");                
    const [usuarios, setUsuarios] = useState([]);            
    const [chatsAbiertos, setChatsAbiertos] = useState(["Todos"]); 
    const [vistaContactos, setVistaContactos] = useState(false);   
    const [busqueda, setBusqueda] = useState("");            
    const [chatActivo, setChatActivo] = useState("Todos");   
    const [historiales, setHistoriales] = useState({ Todos: [] }); 
    const [noLeidos, setNoLeidos] = useState({});            
    const [replyingTo, setReplyingTo] = useState(null); 
    const [misGrupos, setMisGrupos] = useState([]);

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
        if (!nombre.trim()) return alert("Ingresa un nombre válido");
        if (nombre.trim().length > 20) return alert("Tu nombre no puede superar los 20 caracteres");

        connect(
            (incoming) => {
                if (incoming.mensaje === "IDENTIFICATE") send("IDENTIFICACION", nombre);
                if (incoming.mensaje === "IDENTIFICACION_EXITOSA") {
                    send("CONECTADOS");
                    setIdentificado(true);
                }
                if (incoming.mensaje === "ERROR") alert(incoming.data); 
                if (incoming.mensaje === "CONECTADOS" && incoming.data) setUsuarios(incoming.data);
                
                if (incoming.mensaje === "MIS_GRUPOS") {
                    setMisGrupos(incoming.data);
                    setChatsAbiertos(prev => {
                        const nombresGrupos = incoming.data.map(g => g.nombre);
                        return [...new Set([...prev, ...nombresGrupos])];
                    });
                }
                
                if (incoming.mensaje === "GRUPO_CREADO") {
                    setMisGrupos(p => [...p, incoming.data]);
                    abrirChat(incoming.data.nombre);
                }

                if (incoming.mensaje === "AGREGADO_A_GRUPO") {
                    alert(`¡Te han agregado al grupo: ${incoming.data.nombre}!`);
                    setMisGrupos(p => [...p, incoming.data]);
                    setChatsAbiertos(p => {
                        if (!p.includes(incoming.data.nombre)) return [incoming.data.nombre, ...p];
                        return p;
                    });
                }

                if (incoming.mensaje === "GRUPO_ELIMINADO") {
                    alert(`El grupo '${incoming.data}' fue eliminado por su creador.`);
                    setMisGrupos(p => p.filter(g => g.nombre !== incoming.data));
                    setChatsAbiertos(p => p.filter(c => c !== incoming.data));
                    if (chatActivoRef.current === incoming.data) cambiarChat("Todos");
                }

                if (incoming.mensaje === "CHAT" && incoming.data) {
                    gestionarMensajeEntrante(
                        incoming.data.emisor, 
                        incoming.data.mensaje, 
                        incoming.data.id, 
                        incoming.data.hora,
                        incoming.data.replyTo,
                        incoming.data.nombreGrupo 
                    );
                }

                if (incoming.mensaje === "CONFIRMACION_RECEPCION" && incoming.data) {
                    actualizarEstadoMensaje(incoming.data.receptor, incoming.data.idMensaje, 'recibido');
                }
                if (incoming.mensaje === "CONFIRMACION_LECTURA" && incoming.data) {
                    actualizarEstadoMensaje(incoming.data.lector, incoming.data.idMensaje, 'leido');
                }
            },
            () => { alert("Conexión perdida con el servidor."); window.location.reload(); }
        );

        setInterval(() => send("CONECTADOS"), 3000);
    };

    /**
     * BLOQUE 3: LÓGICA DE GRUPOS SEGUROS
     */
    const crearGrupo = () => {
        const nombreGrupo = window.prompt("Ingresa el nombre del nuevo grupo (Máximo 20 caracteres):");
        if (nombreGrupo) {
            const limpio = nombreGrupo.trim();
            // 🚨 VALIDACIÓN: Impide crear grupos con nombres gigantes
            if (limpio.length > 20) {
                return alert("⚠️ El nombre del grupo no puede tener más de 20 caracteres.");
            }
            if (limpio !== "") send("CREAR_GRUPO", limpio);
        }
    };

    const agregarMiembro = (nombreGrupo) => {
        const nuevoMiembro = window.prompt("Ingresa el nombre EXACTO del usuario a agregar (Máx 20 caracteres):");
        if (nuevoMiembro) {
            const limpio = nuevoMiembro.trim();
            // 🚨 VALIDACIÓN: Impide inyectar textos masivos
            if (limpio.length > 20) {
                return alert("⚠️ El nombre de usuario ingresado es demasiado largo.");
            }
            if (limpio !== "") send("AGREGAR_A_GRUPO", { nombreGrupo, nuevoMiembro: limpio });
        }
    };

    const eliminarGrupo = (nombreGrupo) => {
        if (window.confirm(`¿Estás seguro de eliminar el grupo '${nombreGrupo}'? Todos perderán el acceso.`)) {
            send("ELIMINAR_GRUPO", nombreGrupo);
        }
    };

    /**
     * BLOQUE 4: MUTACIÓN DEL HISTORIAL Y NOTIFICACIONES
     */
    const actualizarEstadoMensaje = (sala, idMensaje, nuevoEstado) => {
        setHistoriales(prev => {
            if (!prev[sala]) return prev;
            return {
                ...prev,
                [sala]: prev[sala].map(msg => {
                    if (msg.id === idMensaje) {
                        if (msg.estado === 'leido') return msg;
                        return { ...msg, estado: nuevoEstado };
                    }
                    return msg;
                })
            };
        });
    };

    const gestionarMensajeEntrante = (emisor, texto, idMensaje, hora, replyTo, nombreGrupo) => {
        let sala = nombreGrupo || emisor; 
        let limpio = texto;

        if (texto.startsWith("[GLOBAL]")) {
            sala = "Todos";
            limpio = texto.replace("[GLOBAL]", "");
        } else if (texto.startsWith("[PRIVADO]")) {
            limpio = texto.replace("[PRIVADO]", "");
            send("MENSAJE_RECIBIDO", { idMensaje: idMensaje, autorOriginal: emisor });
        } else if (texto.startsWith("[GRUPO]")) {
            limpio = texto.replace("[GRUPO]", "");
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
                reportadoComoLeido: false,
                replyTo: replyTo 
            }]
        }));

        if (sala !== chatActivoRef.current) {
            setNoLeidos(prev => ({ ...prev, [sala]: (prev[sala] || 0) + 1 }));
        } 
        else if (sala !== "Todos") {
            send("MENSAJE_LEIDO", { idMensaje: idMensaje, autorOriginal: emisor });
            setHistoriales(prev => ({
                ...prev,
                [sala]: prev[sala].map(m => m.id === idMensaje ? {...m, reportadoComoLeido: true} : m)
            }));
        }
    };

    /**
     * BLOQUE 5: EMISIÓN DE DATOS (TX)
     */
    const handleSendMessage = (texto) => {
        const currentGroup = misGrupos.find(g => g.nombre === chatActivo);
        const isGroup = !!currentGroup;

        const prefijo = chatActivo === "Todos" ? "[GLOBAL]" : (isGroup ? "[GRUPO]" : "[PRIVADO]");
        const receptores = chatActivo === "Todos" ? usuarios : [chatActivo];
        
        const idUnico = Date.now().toString() + Math.floor(Math.random() * 1000);
        const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const payload = { 
            receptor: receptores, 
            mensaje: prefijo + texto, 
            id: idUnico, 
            hora: horaActual,
            isGroup: isGroup, 
            nombreGrupo: isGroup ? chatActivo : null
        };
        if (replyingTo) payload.replyTo = replyingTo;

        send("CHAT", payload);

        setHistoriales(prev => ({
            ...prev,
            [chatActivo]: [...(prev[chatActivo] || []), { 
                id: idUnico, 
                autor: "Tú", 
                texto: texto, 
                tipo: 'me', 
                estado: 'enviado', 
                hora: horaActual,
                replyTo: replyingTo 
            }]
        }));

        setReplyingTo(null); 
    };

    /**
     * BLOQUE 6: CONTROL DE VISTAS (ENRUTAMIENTO)
     */
    const cambiarChat = (chat) => {
        setChatActivo(chat);
        setNoLeidos(prev => ({ ...prev, [chat]: 0 })); 
        setReplyingTo(null); 

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

    /**

     * BLOQUE 7: RENDERIZADO VISUAL (INTERFAZ)

     */
    
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
                        maxLength={20} 
                    />
                    <button onClick={iniciarConexion}>Entrar al Chat</button>
                </div>
            </div>
        );
    }

    const currentGroup = misGrupos.find(g => g.nombre === chatActivo);
    const isCurrentChatGroup = !!currentGroup;
    const isCreatorOfCurrentGroup = currentGroup && currentGroup.creador === nombre;

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-profile">
                    <div className="avatar profile-avatar">👤</div>
                    <div className="profile-info">
                        <span className="profile-name">{nombre}</span>
                        <span className="profile-status">En línea</span>
                    </div>
                </div>

                {vistaContactos ? (
                    <>
                        <div className="sidebar-header slide-header">
                            <button className="icon-btn" onClick={() => { setVistaContactos(false); setBusqueda(""); }}>←</button>
                            <h3>Contactos</h3>
                        </div>
                        <div className="search-container">
                            <input 
                                type="text" 
                                placeholder="Buscar contacto..." 
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                maxLength={50} 
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
                            <div>
                                <button className="new-chat-btn group-btn-add" onClick={crearGrupo} title="Crear Grupo">👥</button>
                                <button className="new-chat-btn" onClick={() => setVistaContactos(true)} title="Nuevo Chat">➕</button>
                            </div>
                        </div>
                        <div className="user-list">
                            {chatsAbiertos.map(chat => {
                                const isG = misGrupos.some(g => g.nombre === chat);
                                return (
                                    <div 
                                        key={chat} 
                                        className={`tab ${chatActivo === chat ? "active-tab" : ""}`}
                                        onClick={() => cambiarChat(chat)}
                                    >
                                        <div className="avatar">
                                            {chat === "Todos" ? "🌐" : (isG ? "👥" : "👤")}
                                        </div>
                                        <div className="tab-info">
                                            <span className="tab-name">
                                                {chat === "Todos" ? "Sala General" : chat}
                                            </span>
                                            {isG && <span className="tab-status">Grupo</span>}
                                        </div>
                                        {noLeidos[chat] > 0 && (
                                            <div className="unread-badge">{noLeidos[chat]}</div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </aside>

            <main className="chat-window">
                <header className="chat-header">
                    <div className="chat-header-info">
                        Chat con: <strong>{chatActivo === 'Todos' ? 'Sala General' : chatActivo}</strong>
                    </div>

                    {isCurrentChatGroup && isCreatorOfCurrentGroup && (
                        <div className="group-admin-actions">
                            <button onClick={() => agregarMiembro(chatActivo)} className="btn-group btn-add">➕ Agregar</button>
                            <button onClick={() => eliminarGrupo(chatActivo)} className="btn-group btn-delete">🗑️ Eliminar</button>
                        </div>
                    )}
                </header>
                
                <MessageWindow 
                    messages={historiales[chatActivo] || []} 
                    onReply={setReplyingTo} 
                />
                
                <TextBar 
                    onSend={handleSendMessage} 
                    replyingTo={replyingTo}
                    onCancelReply={() => setReplyingTo(null)}
                />
            </main>
        </div>
    );
}

export default App;