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
    const [mensajeAResponder, setMensajeAResponder] = useState(null);
    
    const chatActivoRef = useRef(chatActivo);

    useEffect(() => {
        chatActivoRef.current = chatActivo;
    }, [chatActivo]);

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
            console.error("Error al leer grupos:", error);
        }
    };

    const cargarHistorialesDesdeBD = async () => {
        try {
            const todosLosMensajes = await db.getAllMensajes();
            const nuevoHistoriales = { Todos: [] };
            const salasChatPrivado = [];

            todosLosMensajes.forEach(msg => {
                const sala = msg.sala;
                if (!nuevoHistoriales[sala]) {
                    nuevoHistoriales[sala] = [];
                }
                nuevoHistoriales[sala].push(msg);

                if (!sala.startsWith("GRUPO_") && sala !== "Todos" && !salasChatPrivado.includes(sala)) {
                    salasChatPrivado.push(sala);
                }
            });

            if (salasChatPrivado.length > 0) {
                setChatsAbiertos(prev => {
                    const combinados = [...prev];
                    salasChatPrivado.forEach(s => {
                        if (!combinados.includes(s)) combinados.push(s);
                    });
                    return combinados;
                });
            }

            setHistoriales(nuevoHistoriales);
        } catch (err) {
            console.error("Error al restaurar historial:", err);
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
                await db.add(idGlobalGrupo, nombreGrupoNuevo, todosLosMiembros);
                
                const nuevoGrupoObj = { id: idGlobalGrupo, nombre: nombreGrupoNuevo, miembros: todosLosMiembros };
                setMisGrupos(prev => [...prev, nuevoGrupoObj]);

                const msgCreador = {
                    id: `SYS_${Date.now()}`,
                    autor: "Sistema",
                    texto: `Has creado el grupo "${nombreGrupoNuevo}"`,
                    tipo: 'me',
                    estado: 'leido',
                    hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                
                await db.addMensaje({ ...msgCreador, sala: idGlobalGrupo });
                setHistoriales(prev => ({ ...prev, [idGlobalGrupo]: [msgCreador] }));

                const payloadSincronizacion = JSON.stringify({
                    tipo: "NUEVO_GRUPO",
                    idGrupo: idGlobalGrupo,
                    nombre: nombreGrupoNuevo,
                    miembros: todosLosMiembros
                });
                
                send("CHAT", { receptor: miembrosSeleccionados, mensaje: payloadSincronizacion });
                
                setVistaCrearGrupo(false);
                setNombreGrupoNuevo("");
                setMiembrosSeleccionados([]);
                cambiarChat(idGlobalGrupo);
            } catch (err) {
                console.error("Error al crear el grupo:", err);
            }
        }
    };

    // --- NUEVAS FUNCIONES PARA EDITAR Y ELIMINAR GRUPOS ---

    const renombrarGrupoActivo = async () => {
        const grupo = misGrupos.find(g => g.id === chatActivo);
        if (!grupo) return;

        const nuevoNombre = prompt("Ingresa el nuevo nombre para el grupo:", grupo.nombre);
        if (nuevoNombre && nuevoNombre.trim() !== "" && nuevoNombre !== grupo.nombre) {
            const nombreLimpio = nuevoNombre.trim();
            
            // 1. Actualizamos en BD local
            await db.update(grupo.id, nombreLimpio);
            
            // 2. Actualizamos la Interfaz Gráfica
            setMisGrupos(prev => prev.map(g => g.id === grupo.id ? { ...g, nombre: nombreLimpio } : g));

            // 3. Avisamos a los demás miembros
            const receptores = grupo.miembros.filter(m => m !== nombre);
            if (receptores.length > 0) {
                const payload = JSON.stringify({
                    tipo: "EDITAR_GRUPO",
                    idGrupo: grupo.id,
                    nuevoNombre: nombreLimpio
                });
                send("CHAT", { receptor: receptores, mensaje: payload });
            }
        }
    };

    const eliminarGrupoActivo = async () => {
        const grupo = misGrupos.find(g => g.id === chatActivo);
        if (!grupo) return;

        if (window.confirm(`¿Estás seguro de que deseas eliminar el grupo "${grupo.nombre}" para todos los miembros?`)) {
            // 1. Borramos de la BD local
            await db.delete(grupo.id);
            
            // 2. Actualizamos la interfaz (lo quitamos de la lista y volvemos al chat general)
            setMisGrupos(prev => prev.filter(g => g.id !== grupo.id));
            cambiarChat("Todos");

            // 3. Avisamos a los demás miembros para que se les borre automáticamente
            const receptores = grupo.miembros.filter(m => m !== nombre);
            if (receptores.length > 0) {
                const payload = JSON.stringify({
                    tipo: "ELIMINAR_GRUPO",
                    idGrupo: grupo.id
                });
                send("CHAT", { receptor: receptores, mensaje: payload });
            }
        }
    };

    const usuariosFiltrados = usuarios.filter(u => 
        u && u.toLowerCase().includes(busqueda.toLowerCase())
    );

    const iniciarConexion = async () => {
        if (!nombre.trim()) return alert("Ingresa un nombre");

        try {
            await db.init(nombre); 
            await actualizarListaGrupos();
            await cargarHistorialesDesdeBD();
            setIdentificado(true); 
        } catch (error) {
            console.error(error);
            return alert("Hubo un error cargando tu entorno local.");
        }

        connect(
            (incoming) => {
                if (!incoming) return;

                if (incoming.mensaje === "IDENTIFICATE") {
                    send("IDENTIFICACION", nombre);
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
                        const nuevoGrupoObj = { id: dataOculta.idGrupo, nombre: dataOculta.nombre, miembros: dataOculta.miembros };

                        setMisGrupos(prev => {
                            if (prev.find(g => g.id === nuevoGrupoObj.id)) return prev;
                            return [...prev, nuevoGrupoObj];
                        });

                        db.add(dataOculta.idGrupo, dataOculta.nombre, dataOculta.miembros).catch(err => console.error(err));

                        const msgBienvenida = {
                            id: `SYS_${Date.now()}`, autor: "Sistema", texto: `Has sido agregado al grupo "${dataOculta.nombre}" por ${emisor}`,
                            tipo: 'other', hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), reportadoComoLeido: true
                        };

                        db.addMensaje({ ...msgBienvenida, sala: dataOculta.idGrupo }).catch(err => console.error(err));
                        setHistoriales(prev => ({ ...prev, [dataOculta.idGrupo]: [...(prev[dataOculta.idGrupo] || []), msgBienvenida] }));
                        setNoLeidos(prev => ({ ...prev, [dataOculta.idGrupo]: (prev[dataOculta.idGrupo] || 0) + 1 }));
                    }
                    // --- NUEVOS CONTROLADORES PARA SINCRONIZAR EDICIÓN Y ELIMINACIÓN ---
                    else if (dataOculta.tipo === "EDITAR_GRUPO") {
                        db.update(dataOculta.idGrupo, dataOculta.nuevoNombre).catch(err => console.error(err));
                        setMisGrupos(prev => prev.map(g => g.id === dataOculta.idGrupo ? { ...g, nombre: dataOculta.nuevoNombre } : g));
                    }
                    else if (dataOculta.tipo === "ELIMINAR_GRUPO") {
                        db.delete(dataOculta.idGrupo).catch(err => console.error(err));
                        setMisGrupos(prev => prev.filter(g => g.id !== dataOculta.idGrupo));
                        
                        // Si el usuario tenía abierto justo ese grupo cuando lo borraron, lo sacamos de ahí
                        if (chatActivoRef.current === dataOculta.idGrupo) {
                            cambiarChat("Todos");
                        }
                    }
                    else if (dataOculta.tipo === "NUEVO_MENSAJE") {
                        gestionarMensajeEntrante(emisor, dataOculta.texto, dataOculta.id, dataOculta.hora, dataOculta.destino, dataOculta.replyTo);
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

    const actualizarEstadoMensaje = async (sala, idMensaje, nuevoEstado) => {
        await db.updateEstadoMensaje(idMensaje, nuevoEstado);

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

    const gestionarMensajeEntrante = (emisor, texto, idMensaje, hora, destino, replyTo) => {
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

        let reportadoComoLeido = false;

        if (sala === chatActivoRef.current && sala !== "Todos" && !sala.startsWith("GRUPO_")) {
            reportadoComoLeido = true;
            const reciboLeido = JSON.stringify({ tipo: "CONFIRMACION_LECTURA", idMensaje: idMensaje });
            send("CHAT", { receptor: [emisor], mensaje: reciboLeido });
        } else if (sala !== "Todos" && !sala.startsWith("GRUPO_")) {
            const reciboEntregado = JSON.stringify({ tipo: "CONFIRMACION_RECEPCION", idMensaje: idMensaje });
            send("CHAT", { receptor: [emisor], mensaje: reciboEntregado });
        }

        const nuevoMensaje = { id: idUnicoSeguro(idMensaje), autor: emisor, texto: limpio, tipo: 'other', hora: hora, reportadoComoLeido, replyTo };
        
        db.addMensaje({ ...nuevoMensaje, sala }).catch(err => console.error(err));

        setHistoriales(prev => ({ ...prev, [sala]: [...(prev[sala] || []), nuevoMensaje] }));

        if (sala !== chatActivoRef.current) {
            setNoLeidos(prev => ({ ...prev, [sala]: (prev[sala] || 0) + 1 }));
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
            hora: horaActual,
            replyTo: mensajeAResponder 
        });

        const receptoresReales = receptores.filter(r => r !== nombre);
        if (receptoresReales.length > 0) {
            send("CHAT", { receptor: receptoresReales, mensaje: payloadOculto });
        }

        const miMensaje = { id: idUnico, autor: "Tú", texto: texto, tipo: 'me', estado: 'enviado', hora: horaActual, replyTo: mensajeAResponder };
        
        db.addMensaje({ ...miMensaje, sala: chatActivoStr }).catch(err => console.error(err));
        setHistoriales(prev => ({ ...prev, [chatActivoStr]: [...(prev[chatActivoStr] || []), miMensaje] }));
        
        setMensajeAResponder(null);
    };

    const cambiarChat = (chatId) => {
        if (!chatId) return;
        const chatIdStr = String(chatId);
        setChatActivo(chatIdStr);
        setNoLeidos(prev => ({ ...prev, [chatIdStr]: 0 }));

        const chatHistory = historiales[chatIdStr] || [];
        let huboCambios = false;
        
        const updatedHistory = chatHistory.map(msg => {
            if (msg && msg.tipo === 'other' && !msg.reportadoComoLeido && !chatIdStr.startsWith("GRUPO_") && msg.autor !== "Sistema") {
                const reciboLeido = JSON.stringify({ tipo: "CONFIRMACION_LECTURA", idMensaje: msg.id });
                send("CHAT", { receptor: [msg.autor], mensaje: reciboLeido });
                huboCambios = true;
                
                const msgActualizado = { ...msg, reportadoComoLeido: true };
                db.addMensaje({ ...msgActualizado, sala: chatIdStr }).catch(err => console.error(err));
                return msgActualizado;
            }
            return msg;
        });

        if (huboCambios) {
            setHistoriales(prev => ({ ...prev, [chatIdStr]: updatedHistory }));
        }
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
                    {/* BOTONES DE EDICIÓN Y ELIMINACIÓN DE GRUPO */}
                    {chatActivo.startsWith("GRUPO_") && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                onClick={renombrarGrupoActivo} 
                                title="Renombrar Grupo" 
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>
                                ✏️
                            </button>
                            <button 
                                onClick={eliminarGrupoActivo} 
                                title="Eliminar Grupo" 
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'red' }}>
                                🗑️
                            </button>
                        </div>
                    )}
                </header>
                <MessageWindow 
                    messages={historiales[chatActivo] || []} 
                    onReply={(msg) => setMensajeAResponder(msg)} 
                />
                <TextBar 
                    onSend={handleSendMessage} 
                    replyingTo={mensajeAResponder} 
                    onCancelReply={() => setMensajeAResponder(null)} 
                />
            </main>
        </div>
    );
}

export default App;