import React, { useState, useEffect, useRef } from 'react';
import { connect, send } from './websocket';
import MessageWindow from './MessageWindow';
import TextBar from './TextBar';
import { chatBD } from './chatDB'; // Importar la clase de la base de datos
import './App.css'; 

// Crear una instancia de la base de datos
const db = new chatBD();

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
    
    // Estado para manejar los grupos de la base de datos
    const [gruposDB, setGruposDB] = useState([]);
    
    const chatActivoRef = useRef(chatActivo);

    useEffect(() => {
        chatActivoRef.current = chatActivo;
    }, [chatActivo]);

    // Inicializar la base de datos al cargar la pagina
    useEffect(() => {
        const prepararDB = async () => {
            await db.init();
            actualizarListaGrupos();
        };
        prepararDB();
    }, []);

    // Consultar grupos de la DB y actualizar el estado
    const actualizarListaGrupos = async () => {
        const grupos = await db.getAll();
        setGruposDB(grupos);
    };

    // Funcion para crear grupo y guardarlo en la DB
    const crearNuevoGrupo = async () => {
        const nombreG = prompt("Nombre del grupo:");
        if (nombreG) {
            await db.add(nombreG);
            actualizarListaGrupos();
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
                            id: Date.now().toString(), 
                            hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        };
                    }

                    if (dataOculta.tipo === "NUEVO_MENSAJE") {
                        gestionarMensajeEntrante(emisor, dataOculta.texto, dataOculta.id, dataOculta.hora);
                        
                        if (emisor !== "Todos") {
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

    const gestionarMensajeEntrante = (emisor, texto, idMensaje, hora) => {
        let sala = emisor;
        let limpio = texto;

        if (texto.startsWith("[GLOBAL]")) {
            sala = "Todos";
            limpio = texto.replace("[GLOBAL]", "");
        } else if (texto.startsWith("[PRIVADO]")) {
            limpio = texto.replace("[PRIVADO]", "");
        }

        setChatsAbiertos(prev => {
            if (!prev.includes(sala)) return [sala, ...prev];
            return prev;
        });

        const nuevoMensaje = { id: idMensaje, autor: emisor, texto: limpio, tipo: 'other', hora: hora, reportadoComoLeido: false };
        setHistoriales(prev => ({ ...prev, [sala]: [...(prev[sala] || []), nuevoMensaje] }));

        if (sala !== chatActivoRef.current) {
            setNoLeidos(prev => ({ ...prev, [sala]: (prev[sala] || 0) + 1 }));
        } 
        else if (sala !== "Todos") {
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
        const prefijo = chatActivo === "Todos" ? "[GLOBAL]" : "[PRIVADO]";
        const receptores = chatActivo === "Todos" ? usuarios : [chatActivo];
        
        const idUnico = Date.now().toString() + Math.floor(Math.random() * 1000);
        const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const payloadOculto = JSON.stringify({
            tipo: "NUEVO_MENSAJE",
            texto: prefijo + texto,
            id: idUnico,
            hora: horaActual
        });

        send("CHAT", { receptor: receptores, mensaje: payloadOculto });

        const miMensaje = { id: idUnico, autor: "Tú", texto: texto, tipo: 'me', estado: 'enviado', hora: horaActual };
        setHistoriales(prev => ({ ...prev, [chatActivo]: [...(prev[chatActivo] || []), miMensaje] }));
    };

    const cambiarChat = (chat) => {
        setChatActivo(chat);
        setNoLeidos(prev => ({ ...prev, [chat]: 0 }));

        setHistoriales(prev => {
            const chatHistory = prev[chat] || [];
            let huboCambios = false;
            
            const updatedHistory = chatHistory.map(msg => {
                if (msg.tipo === 'other' && !msg.reportadoComoLeido) {
                    const reciboLeido = JSON.stringify({ tipo: "CONFIRMACION_LECTURA", idMensaje: msg.id });
                    send("CHAT", { receptor: [msg.autor], mensaje: reciboLeido });
                    
                    huboCambios = true;
                    return { ...msg, reportadoComoLeido: true };
                }
                return msg;
            });

            if (huboCambios) return { ...prev, [chat]: updatedHistory };
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
                {vistaContactos ? (
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
                                <button className="new-chat-btn" onClick={crearNuevoGrupo} style={{marginRight: '5px'}}>📁</button>
                                <button className="new-chat-btn" onClick={() => setVistaContactos(true)}>➕</button>
                            </div>
                        </div>

                        {/* Mostrar grupos guardados en la DB */}
                        <div className="user-list">
                            <p style={{padding: '5px 20px', fontSize: '0.7rem', color: 'gray'}}>GRUPOS EN DB</p>
                            {gruposDB.map(g => (
                                <div key={g.id} className="tab">
                                    <div className="avatar">👥</div>
                                    <div className="tab-info">
                                        <span className="tab-name">{g.nombre}</span>
                                    </div>
                                </div>
                            ))}
                            <hr style={{opacity: 0.1}}/>
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
                <header className="chat-header">Chat con: <strong>{chatActivo === 'Todos' ? 'Sala General' : chatActivo}</strong></header>
                <MessageWindow messages={historiales[chatActivo] || []} />
                <TextBar onSend={handleSendMessage} />
            </main>
        </div>
    );
}

export default App;