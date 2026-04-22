import { WebSocketServer } from 'ws'

/**
 * CLASE wsServer: Actúa como el controlador principal de la sala de chat.
 * Gestiona las conexiones, el enrutamiento de mensajes y los estados (leído/recibido).
 */
class wsServer {
    constructor() {
        // Instancia el servidor WebSocket en el puerto 8080
        this.wss = new WebSocketServer({ port: 8080 })
        console.log("Servidor WebSocket iniciado en ws://localhost:8080")

        /**
         * GESTIÓN DE EVENTOS PRINCIPALES
         * Se dispara cuando un nuevo cliente establece el handshake TCP/WS.
         */
        this.wss.on('connection', (ws) => {
            // Inmediatamente pedimos al cliente que se identifique
            this.MSG(ws, "IDENTIFICATE") 

            // EVENTO 'message': Escucha los paquetes de datos que envía este cliente
            ws.on('message', (datos) => {
                datos = this.jsonAJS(datos) 
                if(datos) {
                    const {mensaje, data} = datos
                    // Lógica de Enrutamiento Dinámico: Si la clase tiene un método con el nombre 
                    // del "mensaje" (ej. CHAT, IDENTIFICACION), lo ejecuta dinámicamente.
                    if(this[mensaje] && typeof this[mensaje] == "function")
                        this[mensaje](ws, data) 
                }
            })

            // EVENTO 'close': Limpieza cuando el cliente cierra la pestaña o pierde red
            ws.on('close', () => {
                if (ws.data) {
                    console.log(`${ws.data} desconectado`)
                }
                // Avisamos a todos los demás que la lista de usuarios ha cambiado
                this.actualizarTodos()
            })
        })
    }

    /**
     * MÉTODOS DE NEGOCIO (Controladores de Eventos Específicos)
     */

    // Valida y registra el nombre de un nuevo usuario
    IDENTIFICACION(ws, data) {
        const nombreLimpio = data.trim();
        let nombreOcupado = false;
        
        // Verifica que el nombre no exista ya en la memoria del servidor
        for (const cliente of this.wss.clients) {
            if (cliente.data && cliente.data.toLowerCase() === nombreLimpio.toLowerCase()) {
                nombreOcupado = true;
                break;
            }
        }

        if (nombreOcupado) {
            this.MSG(ws, "ERROR", "Ese nombre ya está en uso. Por favor, elige otro.");
        } else {
            ws.data = nombreLimpio; // Guarda el nombre directamente en el objeto del socket
            console.log(`${ws.data} se ha conectado correctamente.`);
            this.MSG(ws, "IDENTIFICACION_EXITOSA");
            this.actualizarTodos();
        }
    }

    // Recopila y envía la lista de usuarios activos a un cliente específico
    CONECTADOS(ws, data) {
        const lista = []
        for (const cliente of this.wss.clients) {
            // Excluimos al propio usuario que lo solicita y sockets sin identificar
            if(ws.data != cliente.data && cliente.data) {
                lista.push(cliente.data)
            }
        }
        this.MSG(ws, "CONECTADOS", lista)
    }

    // Enrutador principal de mensajes de texto
    CHAT(ws, data) {
        if(data) {
            const emisor = ws.data,
            {receptor, mensaje, id, hora} = data

            // Itera sobre el array de receptores y envía el mensaje individualmente
            for (const destinatario of receptor) {
                const socket = this.socketId(destinatario)
                if(socket)
                    this.MSG(socket, "CHAT", {emisor, mensaje, id, hora})
            }
        }
    }

    // NOTIFICACIÓN: El celular destino confirma que el mensaje llegó a su dispositivo
    MENSAJE_RECIBIDO(ws, data) {
        const socket = this.socketId(data.autorOriginal);
        if (socket) {
            this.MSG(socket, "CONFIRMACION_RECEPCION", { 
                idMensaje: data.idMensaje, 
                receptor: ws.data 
            });
        }
    }

    // NOTIFICACIÓN: El usuario destino abrió la conversación
    MENSAJE_LEIDO(ws, data) {
        const socket = this.socketId(data.autorOriginal);
        if (socket) {
            this.MSG(socket, "CONFIRMACION_LECTURA", { 
                idMensaje: data.idMensaje, 
                lector: ws.data 
            });
        }
    }

    /**
     * MÉTODOS DE UTILIDAD
     */

    // Fuerza a todos los clientes a actualizar su lista de contactos
    actualizarTodos() {
        for (const cliente of this.wss.clients) {
            if (cliente.readyState === 1 && cliente.data) {
                this.CONECTADOS(cliente)
            }
        }
    }

    // Busca un socket específico usando el nombre del usuario
    socketId(id) {
        for (const cliente of this.wss.clients)
            if(cliente.data == id) return cliente
        return false
    }

    // Construye y envía un paquete JSON validando que el socket esté abierto
    MSG(ws, mensaje, data) {
        const msg = data !== undefined ?
            this.JSAJson({mensaje, data}) : this.JSAJson({mensaje})
        // readyState === 1 significa que la conexión WS está OPEN
        if(msg && ws.readyState === 1) {
            ws.send(msg)
        }
    }

    // Funciones seguras de parseo para evitar caídas del servidor por formato inválido
    jsonAJS(json) {
        try { return JSON.parse(json) } catch { return false }
    }

    JSAJson(js) {
        try { return JSON.stringify(js) } catch { return false }
    }
}
new wsServer()