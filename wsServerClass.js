import { WebSocketServer } from 'ws'

/**
 * CLASE wsServer: Controlador principal de la sala de chat.
 * Seguridad reforzada contra inyección de textos largos.
 */
class wsServer {
    constructor() {
        this.wss = new WebSocketServer({ port: 8080 })
        console.log("Servidor WebSocket iniciado en ws://localhost:8080")

        // Memoria centralizada de grupos
        this.grupos = {}; 

        this.wss.on('connection', (ws) => {
            this.MSG(ws, "IDENTIFICATE") 

            ws.on('message', (datos) => {
                datos = this.jsonAJS(datos) 
                if(datos) {
                    const {mensaje, data} = datos
                    if(this[mensaje] && typeof this[mensaje] == "function")
                        this[mensaje](ws, data) 
                }
            })

            ws.on('close', () => {
                if (ws.data) {
                    console.log(`${ws.data} desconectado`)
                }
                this.actualizarTodos()
            })
        })
    }

    /**
     * BLOQUE 1: IDENTIFICACIÓN Y CONEXIÓN
     */
    IDENTIFICACION(ws, data) {
        if (typeof data !== 'string') return;
        const nombreLimpio = data.trim();

        if (nombreLimpio.length > 20) {
            return this.MSG(ws, "ERROR", "Tu nombre es demasiado largo (máximo 20 caracteres).");
        }

        let nombreOcupado = false;
        for (const cliente of this.wss.clients) {
            if (cliente.data && cliente.data.toLowerCase() === nombreLimpio.toLowerCase()) {
                nombreOcupado = true;
                break;
            }
        }

        if (nombreOcupado) {
            this.MSG(ws, "ERROR", "Ese nombre ya está en uso. Por favor, elige otro.");
        } else {
            ws.data = nombreLimpio; 
            console.log(`${ws.data} se ha conectado correctamente.`);
            this.MSG(ws, "IDENTIFICACION_EXITOSA");
            this.actualizarTodos();

            const gruposDelUsuario = [];
            for (const [nombre, info] of Object.entries(this.grupos)) {
                if (info.miembros.includes(nombreLimpio)) {
                    gruposDelUsuario.push({ nombre, creador: info.creador });
                }
            }
            this.MSG(ws, "MIS_GRUPOS", gruposDelUsuario);
        }
    }

    CONECTADOS(ws, data) {
        const lista = []
        for (const cliente of this.wss.clients) {
            if(ws.data != cliente.data && cliente.data) {
                lista.push(cliente.data)
            }
        }
        this.MSG(ws, "CONECTADOS", lista)
    }

    /**
     * BLOQUE 2: GESTIÓN DE GRUPOS
     */
    
    CREAR_GRUPO(ws, data) {
        const nombreGrupo = typeof data === 'string' ? data.trim() : "";
        
        // Evita inyección de nombres gigantes en la RAM del servidor
        if (nombreGrupo.length > 20) {
            return this.MSG(ws, "ERROR", "El nombre del grupo no puede superar los 20 caracteres.");
        }

        if (!nombreGrupo || this.grupos[nombreGrupo] || nombreGrupo === "Todos") {
            return this.MSG(ws, "ERROR", "Nombre de grupo inválido o ya existe.");
        }

        this.grupos[nombreGrupo] = { creador: ws.data, miembros: [ws.data] };
        this.MSG(ws, "GRUPO_CREADO", { nombre: nombreGrupo, creador: ws.data });
        console.log(`Grupo '${nombreGrupo}' creado por ${ws.data}`);
    }

    AGREGAR_A_GRUPO(ws, data) {
        if (!data || typeof data !== 'object') return;
        const { nombreGrupo, nuevoMiembro } = data;
        
        const miembroLimpio = typeof nuevoMiembro === 'string' ? nuevoMiembro.trim() : "";

        // Evita agregar cadenas gigantes como si fueran usuarios
        if (miembroLimpio.length > 20) {
            return this.MSG(ws, "ERROR", "El nombre del usuario no es válido (muy largo).");
        }

        const grupo = this.grupos[nombreGrupo];

        if (!grupo || grupo.creador !== ws.data) return;
        
        if (grupo.miembros.includes(miembroLimpio)) {
            return this.MSG(ws, "ERROR", "El usuario ya está en el grupo");
        }

        grupo.miembros.push(miembroLimpio);
        
        const socket = this.socketId(miembroLimpio);
        if (socket) {
            this.MSG(socket, "AGREGADO_A_GRUPO", { nombre: nombreGrupo, creador: grupo.creador });
        }
    }

    ELIMINAR_GRUPO(ws, data) {
        const nombreGrupo = data;
        const grupo = this.grupos[nombreGrupo];

        if (!grupo || grupo.creador !== ws.data) return;

        for (const miembro of grupo.miembros) {
            const socket = this.socketId(miembro);
            if (socket) this.MSG(socket, "GRUPO_ELIMINADO", nombreGrupo);
        }
        
        delete this.grupos[nombreGrupo];
        console.log(`Grupo '${nombreGrupo}' eliminado.`);
    }

    /**
     * BLOQUE 3: ENRUTAMIENTO DE MENSAJES (TX/RX)
     */
    CHAT(ws, data) {
        if(data) {
            const emisor = ws.data,
            {receptor, mensaje, id, hora, replyTo, isGroup, nombreGrupo} = data

            if (typeof mensaje !== 'string' || mensaje.length > 300) return; 

            if (isGroup && this.grupos[nombreGrupo]) {
                const miembros = this.grupos[nombreGrupo].miembros;
                for (const dest of miembros) {
                    if (dest !== emisor) {
                        const socket = this.socketId(dest);
                        if (socket) {
                            this.MSG(socket, "CHAT", {emisor, mensaje, id, hora, replyTo, nombreGrupo});
                        }
                    }
                }
            } else {
                for (const destinatario of receptor) {
                    const socket = this.socketId(destinatario)
                    if(socket)
                        this.MSG(socket, "CHAT", {emisor, mensaje, id, hora, replyTo})
                }
            }
        }
    }

    MENSAJE_RECIBIDO(ws, data) {
        const socket = this.socketId(data.autorOriginal);
        if (socket) this.MSG(socket, "CONFIRMACION_RECEPCION", { idMensaje: data.idMensaje, receptor: ws.data });
    }

    MENSAJE_LEIDO(ws, data) {
        const socket = this.socketId(data.autorOriginal);
        if (socket) this.MSG(socket, "CONFIRMACION_LECTURA", { idMensaje: data.idMensaje, lector: ws.data });
    }

    /**
     * MÉTODOS DE UTILIDAD
     */
    actualizarTodos() {
        for (const cliente of this.wss.clients) {
            if (cliente.readyState === 1 && cliente.data) this.CONECTADOS(cliente)
        }
    }

    socketId(id) {
        for (const cliente of this.wss.clients)
            if(cliente.data == id) return cliente
        return false
    }

    MSG(ws, mensaje, data) {
        const msg = data !== undefined ? this.JSAJson({mensaje, data}) : this.JSAJson({mensaje})
        if(msg && ws.readyState === 1) ws.send(msg)
    }

    jsonAJS(json) { try { return JSON.parse(json) } catch { return false } }
    JSAJson(js) { try { return JSON.stringify(js) } catch { return false } }
}
new wsServer()