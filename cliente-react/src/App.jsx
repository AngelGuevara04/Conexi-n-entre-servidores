import React, { useState, useEffect, useRef } from 'react';
import { connect, send } from './websocket';
import MessageWindow from './MessageWindow';
import TextBar from './TextBar';
import { chatBD } from './chatDB';
import './App.css'; 

const db = new chatBD();

function App() {
    const [identificado, setIdentificado] = useState(false);
    const [nombre, setNombre] = useState("");
    const [usuarios, setUsuarios] = useState([]);
    const [chatsAbiertos, setChatsAbiertos] = useState(["Todos"]);
    const [vistaContactos, setVistaContactos] = useState(false);
    
    const [vistaCrearGrupo, setVistaCrearGrupo] = useState(false);
    const [nombreGrupoNuevo, setNombreGrupoNuevo] = useState("");
    const [miembrosSeleccionados, setMiembrosSeleccionados] = useState([]);

    const [busqueda, setBusqueda] = useState("");
    const [chatActivo, setChatActivo] = useState("Todos");
    const [historiales, setHistoriales] = useState({ Todos: [] });
    const [noLeidos, setNoLeidos] = useState({});
    const [gruposDB, setGruposDB] = useState([]);
    
    const chatActivoRef = useRef(chatActivo);

    useEffect(() => {
        chatActivoRef.current = chatActivo;
    }, [chatActivo]);

    useEffect(() => {
        const prepararDB = async () => {
            await db.init();
            actualizarListaGrupos();
        };
        prepararDB();
    }, []);

    const actualizarListaGrupos = async () => {
        const grupos = await db.getAll();
        setGruposDB(grupos);
    };

    const toggleMiembro = (usuarioSel) => {
        setMiembrosSeleccionados(prev => 
            prev.includes(usuarioSel) 
                ? prev.filter(m => m !== usuarioSel) 
                : [...prev, usuarioSel]
        );
    };

    const guardarNuevoGrupo = async () => {
        if (nombreGrupoNuevo.trim() && miembrosSeleccionados.length > 0) {
            const idGlobalGrupo = `GRUPO_${Date.now()}`;
            const todosLosMiembros = [nombre, ...miembrosSeleccionados];
            
            // 1. Guardar en tu base de datos local
            await db.add(idGlobalGrupo, nombreGrupoNuevo, todosLosMiembros);
            
            // 2. Sincronizar: Enviar invitación silenciosa a los integrantes seleccionados
            const payloadSincronizacion = JSON.stringify({
                tipo: "NUEVO_GRUPO",
                idGrupo: idGlobalGrupo,
                nombre: nombreGrupoNuevo,
                miembros: todosLosMiembros
            });
            send("CHAT", { receptor: miembrosSeleccionados, mensaje: payloadSincronizacion });
            
            actualizarListaGrupos();
            setVistaCrearGrupo(false);
            setNombreGrupoNuevo("");
            setMiembrosSeleccionados([]);
            
            // 3. Abrir el grupo recién creado
            abrirGrupo({ id: idGlobalGrupo });
        }
    };

    const usuariosFiltrados = usuarios.filter(u => 
        u.toLowerCase().includes(busqueda.toLowerCase())
    );

    const iniciarConexion = () => {
        if (!nombre.trim()) return alert("Ingresa un nombre");

        connect(
            (incoming) => {
                if (incoming.mensaje === "IDENTIFICATE") {
                    send("IDENTIFICACION", nombre);
                    setIdentificado(true); 
                    setTimeout(() => send("CONECTADOS"), 500); 
                }
                
                if (incoming.mensaje === "ERROR") alert(incoming.data); 
                if (incoming.mensaje === "CONECTADOS" && incoming.data) setUsuarios(incoming.data);
                
                if (incoming.mensaje === "CHAT" && incoming.data) {
                    const emisor = incoming.data.emisor;
                    const textoCrudo = incoming.data.mensaje;
                    let dataOculta;

                    try {
                        dataOculta = JSON.parse(textoCrudo);
                    } catch (e) {
                        dataOculta = { 
                            tipo: "NUEVO_MENSAJE", 
                            texto: textoCrudo, 
                            destino: "Todos", // Fallback
                            id: Date.now().toString(), 
                            hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        };
                    }

                    // --- NUEVA LÓGICA DE SINCRONIZACIÓN DE GRUPOS ---
                    if (dataOculta.tipo === "NUEVO_GRUPO") {
                        // Alguien nos agregó a un grupo. Lo guardamos localmente.
                        db.add(dataOculta.idGrupo, dataOculta.nombre, dataOculta.miembros).then(() => {
                            actualizarListaGrupos();
                        });
                    }
                    else if (dataOculta.tipo === "NUEVO_MENSAJE") {
                        gestionarMensajeEntrante(emisor, dataOculta.texto, dataOculta.id, dataOculta.hora, dataOculta.destino);
                        
                        // Confirmación de recepción básica (solo para privados, evitar tormenta en grupos)
                        if (emisor !== "Todos" && (!dataOculta.destino || !dataOculta.destino.startsWith("GRUPO_"))) {
                            const reciboEntregado = JSON.stringify({ tipo: "CONFIRMACION_RECEPCION", idMensaje: dataOculta.id });
                            send("CHAT", { receptor: [emisor], mensaje: reciboEntregado });
                        }
                    } 
                    else if (dataOculta.tipo === "CONFIRMACION_RECEPCION") {
                        actualizarEstadoMensaje(emisor, dataOculta.idMensaje, 'recibido');
                    } 
                    else if (dataOculta.tipo === "CONFIRMACION_LECTURA") {
                        actualizarEstadoMensaje(emisor, dataOculta.idMensaje, 'leido');
                    }
                }
            },
            () => { alert("Conexión perdida con el servidor."); window.location.reload(); }
        );

        setInterval(() => send("CONECTADOS"), 3000);
    };

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

    const gestionarMensajeEntrante = (emisor, texto, idMensaje, hora, destino) => {
        let sala = emisor; // Por defecto asumimos chat privado
        let limpio = texto;

        // Determinar a qué ventana pertenece el mensaje
        if (destino === "Todos") {
            sala = "Todos";
            limpio = texto.replace("[GLOBAL]", ""); 
        } else if (destino && destino.startsWith("GRUPO_")) {
            sala = destino; 
            // En grupos mostramos quién lo envió dentro del texto
            limpio = `[${emisor}]: ` + texto; 
        } else {
            limpio = texto.replace("[PRIVADO]", "");
        }

        // Si es un chat privado o grupo y no está abierto, lo añadimos a chats abiertos (si no es grupo ya mostrado)
        if (!sala.startsWith("GRUPO_")) {
            setChatsAbiertos(prev => {
                if (!prev.includes(sala)) return [sala, ...prev];
                return prev;
            });
        }

        const nuevoMensaje = { id: idMensaje, autor: emisor, texto: limpio, tipo: 'other', hora: hora, reportadoComoLeido: false };
        setHistoriales(prev => ({ ...prev, [sala]: [...(prev[sala] || []), nuevoMensaje] }));

        if (sala !== chatActivoRef.current) {
            setNoLeidos(prev => ({ ...prev, [sala]: (prev[sala] || 0) + 1 }));
        } 
        else if (sala !== "Todos" && !sala.startsWith("GRUPO_")) {
            const reciboLeido = JSON.stringify({ tipo: "CONFIRMACION_LECTURA", idMensaje: idMensaje });
            send("CHAT", { receptor: [emisor], mensaje: reciboLeido });

            setHistoriales(prev => ({
                ...prev,
                [sala]: prev[sala].map(m => {
                    if(m.id === idMensaje) return {...m, reportadoComoLeido: true};
                    return m;
                })
            }));
        }
    };

    const handleSendMessage = (texto) => {
        let receptores = [];
        let prefijo = "";

        // Enrutar el mensaje dependiendo del chat activo
        if (chatActivo === "Todos") {
            prefijo = "[GLOBAL]";
            receptores = usuarios;
        } else if (chatActivo.startsWith("GRUPO_")) {
            // Buscamos el grupo y obtenemos todos los miembros menos a nosotros mismos
            const grupoActual = gruposDB.find(g => g.id === chatActivo);
            if (grupoActual) {
                receptores = grupoActual.miembros.filter(m => m !== nombre);
            }
        } else {
            prefijo = "[PRIVADO]";
            receptores = [chatActivo];
        }
        
        const idUnico = Date.now().toString() + Math.floor(Math.random() * 1000);
        const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const payloadOculto = JSON.stringify({
            tipo: "NUEVO_MENSAJE",
            texto: prefijo + texto,
            destino: chatActivo, // Clave para que el receptor sepa en qué pestaña mostrarlo
            id: idUnico,
            hora: horaActual
        });

        // Enviar solo si hay receptores
        if (receptores.length > 0) {
            send("CHAT", { receptor: receptores, mensaje: payloadOculto });
        }

        const miMensaje = { id: idUnico, autor: "Tú", texto: texto, tipo: 'me', estado: 'enviado', hora: horaActual };
        setHistoriales(prev => ({ ...prev, [chatActivo]: [...(prev[chatActivo] || []), miMensaje] }));
    };

    const cambiarChat = (chatId) => {
        setChatActivo(chatId);
        setNoLeidos(prev => ({ ...prev, [chatId]: 0 }));

        setHistoriales(prev => {
            const chatHistory = prev[chatId] || [];
            let huboCambios = false;
            
            const updatedHistory = chatHistory.map(msg => {
                // No enviamos recibos de lectura masivos en grupos aún para simplificar
                if (msg.tipo === 'other' && !msg.reportadoComoLeido && !chatId.startsWith("GRUPO_")) {
                    const reciboLeido = JSON.stringify({ tipo: "CONFIRMACION_LECTURA", idMensaje: msg.id });
                    send("CHAT", { receptor: [msg.autor], mensaje: reciboLeido });
                    
                    huboCambios = true;
                    return { ...msg, reportadoComoLeido: true };
                }
                return msg;
            });

            if (huboCambios) return { ...prev, [chatId]: updatedHistory };
            return prev;
        });
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

    const abrirGrupo = (grupo) => {
        cambiarChat(grupo.id);
    };

    // Helper para mostrar el nombre correcto en la cabecera
    const obtenerNombreChatActivo = () => {
        if (chatActivo === 'Todos') return 'Sala General';
        if (chatActivo.startsWith("GRUPO_")) {
            const g = gruposDB.find(g => g.id === chatActivo);
            return g ? g.nombre : "Grupo";
        }
        return chatActivo;
    };

    if (!identificado) {
        return (
            <div className="login-container">
                <div className="card">
                    <h2>Chat Hub</h2>
                    <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} onKeyPress={e => e.key === 'Enter' && iniciarConexion()} placeholder="Ingresa tu usuario" />
                    <button onClick={iniciarConexion}>Chatear</button>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <aside className="sidebar">
                {vistaCrearGrupo ? (
                    <>
                        <div className="sidebar-header slide-header">
                            <button className="icon-btn" onClick={() => { setVistaCrearGrupo(false); setNombreGrupoNuevo(""); setMiembrosSeleccionados([]); }}>←</button>
                            <h3>Crear Grupo</h3>
                        </div>
                        <div className="search-container">
                            <input type="text" placeholder="Nombre del grupo..." value={nombreGrupoNuevo} onChange={(e) => setNombreGrupoNuevo(e.target.value)} />
                        </div>
                        <div className="user-list vertical-list">
                            <p style={{padding: '5px 20px', fontSize: '0.8rem', color: 'gray'}}>Selecciona integrantes:</p>
                            {usuarios.length === 0 ? (
                                <p className="empty-msg" style={{padding: '0 20px'}}>No hay usuarios disponibles para agregar.</p>
                            ) : (
                                usuarios.map(u => (
                                    <div key={u} className="tab" onClick={() => toggleMiembro(u)} style={{ cursor: 'pointer' }}>
                                        <input type="checkbox" checked={miembrosSeleccionados.includes(u)} readOnly style={{ pointerEvents: 'none' }}/>
                                        <div className="tab-info" style={{marginLeft: '10px'}}>
                                            <span className="tab-name">{u}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div style={{padding: '15px', textAlign: 'center'}}>
                            <button 
                                onClick={guardarNuevoGrupo} 
                                disabled={!nombreGrupoNuevo.trim() || miembrosSeleccionados.length === 0}
                                style={{ padding: '8px 15px', backgroundColor: (!nombreGrupoNuevo.trim() || miembrosSeleccionados.length === 0) ? '#555' : '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                                Guardar Grupo
                            </button>
                        </div>
                    </>
                ) : vistaContactos ? (
                    <>
                        <div className="sidebar-header slide-header">
                            <button className="icon-btn" onClick={() => { setVistaContactos(false); setBusqueda(""); }}>←</button>
                            <h3>Contactos</h3>
                        </div>
                        <div className="search-container">
                            <input type="text" placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                        </div>
                        <div className="user-list vertical-list">
                            {usuariosFiltrados.length === 0 ? (
                                <p className="empty-msg">No hay nadie más conectado</p>
                            ) : (
                                usuariosFiltrados.map(u => (
                                    <div key={u} className="tab" onClick={() => abrirChat(u)}>
                                        <div className="avatar">👤</div>
                                        <div className="tab-info">
                                            <span className="tab-name">{u}</span><span className="tab-status">Disponible</span>
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
                                <button className="new-chat-btn" onClick={() => setVistaCrearGrupo(true)} style={{marginRight: '5px'}}>📁</button>
                                <button className="new-chat-btn" onClick={() => setVistaContactos(true)}>➕</button>
                            </div>
                        </div>

                        <div className="user-list">
                            <p style={{padding: '5px 20px', fontSize: '0.7rem', color: 'gray'}}>GRUPOS PRIVADOS</p>
                            {gruposDB.map(g => (
                                // Ahora al tocar un grupo, usamos su ID único para cambiar el chat activo
                                <div key={g.id} className={`tab ${chatActivo === g.id ? "active-tab" : ""}`} onClick={() => abrirGrupo(g)}>
                                    <div className="avatar">👥</div>
                                    <div className="tab-info">
                                        <span className="tab-name">{g.nombre}</span>
                                        <span className="tab-status" style={{fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                            {g.miembros?.join(', ')}
                                        </span>
                                    </div>
                                    {noLeidos[g.id] > 0 && <div className="unread-badge">{noLeidos[g.id]}</div>}
                                </div>
                            ))}
                            <hr style={{opacity: 0.1, margin: '10px 0'}}/>
                            {chatsAbiertos.map(chat => (
                                <div key={chat} className={`tab ${chatActivo === chat ? "active-tab" : ""}`} onClick={() => cambiarChat(chat)}>
                                    <div className="avatar">{chat === "Todos" ? "🌐" : "👤"}</div>
                                    <div className="tab-info">
                                        <span className="tab-name">{chat === "Todos" ? "Sala General" : chat}</span>
                                    </div>
                                    {noLeidos[chat] > 0 && <div className="unread-badge">{noLeidos[chat]}</div>}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </aside>
            <main className="chat-window">
                <header className="chat-header">Chat con: <strong>{obtenerNombreChatActivo()}</strong></header>
                <MessageWindow messages={historiales[chatActivo] || []} />
                <TextBar onSend={handleSendMessage} />
            </main>
        </div>
    );
}

export default App;