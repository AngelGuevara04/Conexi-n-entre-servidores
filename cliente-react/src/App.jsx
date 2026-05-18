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
    
    const [misGrupos, setMisGrupos] = useState([]); 
    
    const chatActivoRef = useRef(chatActivo);

    useEffect(() => {
        chatActivoRef.current = chatActivo;
    }, [chatActivo]);

    useEffect(() => {
        if (identificado) {
            actualizarListaGrupos();
        }
    }, [identificado, nombre]);

    useEffect(() => {
        const prepararDB = async () => {
            try {
                await db.init();
            } catch (err) {
                console.error("Error al inicializar IndexedDB:", err);
            }
        };
        prepararDB();
    }, []);

    const actualizarListaGrupos = async () => {
        if (!nombre) return;
        try {
            const todosLosGrupos = await db.getAll();
            const gruposPermitidos = todosLosGrupos.filter(grupo => 
                grupo && 
                grupo.miembros && 
                Array.isArray(grupo.miembros) && 
                grupo.miembros.includes(nombre)
            );
            setMisGrupos(gruposPermitidos);
        } catch (error) {
            console.error("Error al leer los grupos de la BD:", error);
        }
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
            
            try {
                // 1. Guardar localmente
                await db.add(idGlobalGrupo, nombreGrupoNuevo, todosLosMiembros);
                
                // 2. Forzar actualización inmediata en la UI del creador
                const nuevoGrupoObj = { id: idGlobalGrupo, nombre: nombreGrupoNuevo, miembros: todosLosMiembros };
                setMisGrupos(prev => [...prev, nuevoGrupoObj]);

                // 3. Crear mensaje automático de Sistema para el creador
                const msgCreador = {
                    id: `SYS_${Date.now()}`,
                    autor: "Sistema",
                    texto: `Has creado el grupo "${nombreGrupoNuevo}"`,
                    tipo: 'me',
                    estado: 'leido',
                    hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                setHistoriales(prev => ({ ...prev, [idGlobalGrupo]: [msgCreador] }));

                // 4. Notificar vía WebSocket a los seleccionados
                const payloadSincronizacion = JSON.stringify({
                    tipo: "NUEVO_GRUPO",
                    idGrupo: idGlobalGrupo,
                    nombre: nombreGrupoNuevo,
                    miembros: todosLosMiembros
                });
                
                // SOLUCIÓN DEFINITIVA: Enviamos el array completo tal y como lo espera tu servidor Node.js
                send("CHAT", { receptor: miembrosSeleccionados, mensaje: payloadSincronizacion });
                
                // Limpiar y abrir el grupo
                setVistaCrearGrupo(false);
                setNombreGrupoNuevo("");
                setMiembrosSeleccionados([]);
                cambiarChat(idGlobalGrupo);
            } catch (err) {
                console.error("Error al crear el grupo:", err);
            }
        }
    };

    const usuariosFiltrados = usuarios.filter(u => 
        u && u.toLowerCase().includes(busqueda.toLowerCase())
    );

    const iniciarConexion = () => {
        if (!nombre.trim()) return alert("Ingresa un nombre");

        connect(
            (incoming) => {
                if (!incoming) return;

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
                            destino: "Todos",
                            id: Date.now().toString(), 
                            hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        };
                    }

                    if (dataOculta.tipo === "NUEVO_GRUPO") {
                        const nuevoGrupoObj = {
                            id: dataOculta.idGrupo,
                            nombre: dataOculta.nombre,
                            miembros: dataOculta.miembros
                        };

                        // 1. Actualizamos la vista de grupos al instante
                        setMisGrupos(prev => {
                            if (prev.find(g => g.id === nuevoGrupoObj.id)) return prev;
                            return [...prev, nuevoGrupoObj];
                        });

                        // 2. Guardamos en IndexedDB en segundo plano
                        db.add(dataOculta.idGrupo, dataOculta.nombre, dataOculta.miembros)
                          .catch(err => console.error("Error BD:", err));

                        // 3. Generamos el mensaje automático
                        const msgBienvenida = {
                            id: `SYS_${Date.now()}`,
                            autor: "Sistema",
                            texto: `Has sido agregado al grupo "${dataOculta.nombre}" por ${emisor}`,
                            tipo: 'other', 
                            hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            reportadoComoLeido: true
                        };

                        // 4. Agregamos el mensaje e incrementamos la notificación visual
                        setHistoriales(prev => ({ 
                            ...prev, 
                            [dataOculta.idGrupo]: [...(prev[dataOculta.idGrupo] || []), msgBienvenida] 
                        }));
                        
                        setNoLeidos(prev => ({ 
                            ...prev, 
                            [dataOculta.idGrupo]: (prev[dataOculta.idGrupo] || 0) + 1 
                        }));
                    }
                    else if (dataOculta.tipo === "NUEVO_MENSAJE") {
                        gestionarMensajeEntrante(emisor, dataOculta.texto, dataOculta.id, dataOculta.hora, dataOculta.destino);
                        
                        const destinoStr = String(dataOculta.destino || '');
                        if (emisor !== "Todos" && !destinoStr.startsWith("GRUPO_") && emisor !== "Sistema") {
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
            () => { 
                alert("Conexión perdida con el servidor."); 
                window.location.reload(); 
            }
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
        let sala = emisor; 
        let limpio = texto || "";
        const destinoStr = String(destino || '');

        if (destinoStr === "Todos") {
            sala = "Todos";
            limpio = limpio.replace("[GLOBAL]", ""); 
        } else if (destinoStr.startsWith("GRUPO_")) {
            sala = destinoStr; 
            limpio = `[${emisor}]: ` + limpio.replace("[GRUPO]", ""); 
        } else {
            limpio = limpio.replace("[PRIVADO]", "");
        }

        if (!sala.startsWith("GRUPO_")) {
            setChatsAbiertos(prev => {
                if (!prev.includes(sala)) return [sala, ...prev];
                return prev;
            });
        }

        const nuevoMensaje = { id: idUnicoSeguro(idMensaje), autor: emisor, texto: limpio, tipo: 'other', hora: hora, reportadoComoLeido: false };
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

    const idUnicoSeguro = (base) => base || (Date.now().toString() + Math.floor(Math.random() * 1000));

    const handleSendMessage = (texto) => {
        if (!chatActivo) return;
        let receptores = [];
        let prefijo = "";
        const chatActivoStr = String(chatActivo);

        if (chatActivoStr === "Todos") {
            prefijo = "[GLOBAL]";
            receptores = usuarios;
        } else if (chatActivoStr.startsWith("GRUPO_")) {
            const grupoActual = misGrupos.find(g => String(g.id) === chatActivoStr);
            if (grupoActual && grupoActual.miembros) {
                prefijo = "[GRUPO]";
                receptores = grupoActual.miembros.filter(m => m !== nombre);
            }
        } else {
            prefijo = "[PRIVADO]";
            receptores = [chatActivoStr];
        }
        
        const idUnico = idUnicoSeguro();
        const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const payloadOculto = JSON.stringify({
            tipo: "NUEVO_MENSAJE",
            texto: prefijo + texto,
            destino: chatActivoStr, 
            id: idUnico,
            hora: horaActual
        });

        // FILTRO Y ENVÍO CORREGIDO PARA TU SERVIDOR NODE
        const receptoresReales = receptores.filter(r => r !== nombre);
        if (receptoresReales.length > 0) {
            send("CHAT", { receptor: receptoresReales, mensaje: payloadOculto });
        }

        const miMensaje = { id: idUnico, autor: "Tú", texto: texto, tipo: 'me', estado: 'enviado', hora: horaActual };
        setHistoriales(prev => ({ ...prev, [chatActivoStr]: [...(prev[chatActivoStr] || []), miMensaje] }));
    };

    const cambiarChat = (chatId) => {
        if (!chatId) return;
        const chatIdStr = String(chatId);
        setChatActivo(chatIdStr);
        setNoLeidos(prev => ({ ...prev, [chatIdStr]: 0 }));

        setHistoriales(prev => {
            const chatHistory = prev[chatIdStr] || [];
            let huboCambios = false;
            
            const updatedHistory = chatHistory.map(msg => {
                if (msg && msg.tipo === 'other' && !msg.reportadoComoLeido && !chatIdStr.startsWith("GRUPO_") && msg.autor !== "Sistema") {
                    const reciboLeido = JSON.stringify({ tipo: "CONFIRMACION_LECTURA", idMensaje: msg.id });
                    send("CHAT", { receptor: [msg.autor], mensaje: reciboLeido });
                    huboCambios = true;
                    return { ...msg, reportadoComoLeido: true };
                }
                return msg;
            });

            if (huboCambios) return { ...prev, [chatIdStr]: updatedHistory };
            return prev;
        });
    };

    const abrirChat = (usuario) => {
        if (usuario !== nombre) {
            setChatsAbiertos(prev => {
                if (!prev.includes(usuario)) return [usuario, ...prev];
                return prev;
            });
            cambiarChat(usuario); 
            setVistaContactos(false);
            setBusqueda("");
        }
    };

    const obtenerNombreChatActivo = () => {
        if (chatActivo === 'Todos') return 'Sala General';
        if (!chatActivo) return '';
        
        const chatActivoStr = String(chatActivo);
        if (chatActivoStr.startsWith("GRUPO_")) {
            const g = misGrupos.find(g => String(g.id) === chatActivoStr);
            return g ? g.nombre : "Grupo";
        }
        return chatActivoStr;
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
                            {usuarios.filter(u => u !== nombre).length === 0 ? (
                                <p className="empty-msg" style={{padding: '0 20px'}}>No hay más usuarios conectados para agregar.</p>
                            ) : (
                                usuarios.filter(u => u !== nombre).map(u => (
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
                                style={{ padding: '8px 15px', backgroundColor: (!nombreGrupoNuevo.trim() || miembrosSeleccionados.length === 0) ? '#cbd5d0' : '#00a884', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                                Crear Grupo
                            </button>
                        </div>
                    </>
                ) : vistaContactos ? (
                    <>
                        <div className="sidebar-header slide-header">
                            <button className="icon-btn" onClick={() => { setVistaContactos(false); setBusqueda(""); }}>←</button>
                            <h3>Contactos Online</h3>
                        </div>
                        <div className="search-container">
                            <input type="text" placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                        </div>
                        <div className="user-list vertical-list">
                            {usuariosFiltrados.filter(u => u !== nombre).length === 0 ? (
                                <p className="empty-msg">No hay nadie más conectado</p>
                            ) : (
                                usuariosFiltrados.filter(u => u !== nombre).map(u => (
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
                        <div className="sidebar-profile">
                            <div className="avatar profile-avatar">👤</div>
                            <div>
                                <span className="profile-name">{nombre}</span>
                                <span className="profile-status">En línea</span>
                            </div>
                        </div>

                        <div className="sidebar-header">
                            <h3>Mensajes</h3>
                            <div>
                                <button className="new-chat-btn" onClick={() => setVistaCrearGrupo(true)} title="Nuevo Grupo" style={{marginRight: '15px'}}>👥</button>
                                <button className="new-chat-btn" onClick={() => setVistaContactos(true)} title="Nuevo Mensaje">➕</button>
                            </div>
                        </div>

                        <div className="user-list">
                            <div className={`tab ${chatActivo === "Todos" ? "active-tab" : ""}`} onClick={() => cambiarChat("Todos")}>
                                <div className="avatar">🌐</div>
                                <div className="tab-info">
                                    <span className="tab-name">Sala General</span>
                                </div>
                                {noLeidos["Todos"] > 0 && <div className="unread-badge">{noLeidos["Todos"]}</div>}
                            </div>

                            {misGrupos.length > 0 && <p style={{padding: '10px 20px 5px', fontSize: '0.75rem', color: '#667781', fontWeight: 'bold'}}>MIS GRUPOS</p>}
                            {misGrupos.map(g => {
                                const idSeguro = g.id || g.nombre;
                                const miembrosSeguros = Array.isArray(g.miembros) ? g.miembros.join(', ') : '';
                                return (
                                    <div key={idSeguro} className={`tab ${String(chatActivo) === String(idSeguro) ? "active-tab" : ""}`} onClick={() => cambiarChat(idSeguro)}>
                                        <div className="avatar">👥</div>
                                        <div className="tab-info">
                                            <span className="tab-name">{g.nombre}</span>
                                            <span className="tab-status" style={{fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                                {miembrosSeguros}
                                            </span>
                                        </div>
                                        {noLeidos[idSeguro] > 0 && <div className="unread-badge">{noLeidos[idSeguro]}</div>}
                                    </div>
                                );
                            })}

                            {chatsAbiertos.filter(c => c !== "Todos").length > 0 && <p style={{padding: '10px 20px 5px', fontSize: '0.75rem', color: '#667781', fontWeight: 'bold'}}>CHATS PRIVADOS</p>}
                            {chatsAbiertos.filter(c => c !== "Todos").map(chat => {
                                const chatStr = String(chat);
                                return (
                                    <div key={chatStr} className={`tab ${chatActivo === chatStr ? "active-tab" : ""}`} onClick={() => cambiarChat(chatStr)}>
                                        <div className="avatar">👤</div>
                                        <div className="tab-info">
                                            <span className="tab-name">{chatStr}</span>
                                        </div>
                                        {noLeidos[chatStr] > 0 && <div className="unread-badge">{noLeidos[chatStr]}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </aside>
            <main className="chat-window">
                <header className="chat-header">
                    <div className="chat-header-info">
                        <strong>{obtenerNombreChatActivo()}</strong>
                    </div>
                </header>
                <MessageWindow messages={historiales[chatActivo] || []} onReply={() => {}} />
                <TextBar onSend={handleSendMessage} />
            </main>
        </div>
    );
}

export default App;