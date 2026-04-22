import { WebSocketServer } from 'ws'

class wsServer {
    constructor() {
        this.wss = new WebSocketServer({ port: 8080 })
        console.log("Servidor WebSocket iniciado en ws://localhost:8080")

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

    IDENTIFICACION(ws, data) {
        const nombreLimpio = data.trim();
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

    CHAT(ws, data) {
        if(data) {
            const emisor = ws.data,
            {receptor, mensaje, id, hora} = data

            for (const destinatario of receptor) {
                const socket = this.socketId(destinatario)
                if(socket)
                    this.MSG(socket, "CHAT", {emisor, mensaje, id, hora})
            }
        }
    }

    // NUEVO: El celular destino avisa que YA RECIBIÓ el mensaje en su memoria
    MENSAJE_RECIBIDO(ws, data) {
        const socket = this.socketId(data.autorOriginal);
        if (socket) {
            this.MSG(socket, "CONFIRMACION_RECEPCION", { 
                idMensaje: data.idMensaje, 
                receptor: ws.data 
            });
        }
    }

    // El celular destino avisa que YA LEYÓ el mensaje (abrió el chat)
    MENSAJE_LEIDO(ws, data) {
        const socket = this.socketId(data.autorOriginal);
        if (socket) {
            this.MSG(socket, "CONFIRMACION_LECTURA", { 
                idMensaje: data.idMensaje, 
                lector: ws.data 
            });
        }
    }

    actualizarTodos() {
        for (const cliente of this.wss.clients) {
            if (cliente.readyState === 1 && cliente.data) {
                this.CONECTADOS(cliente)
            }
        }
    }

    socketId(id) {
        for (const cliente of this.wss.clients)
            if(cliente.data == id) return cliente
        return false
    }

    MSG(ws, mensaje, data) {
        const msg = data !== undefined ?
            this.JSAJson({mensaje, data}) : this.JSAJson({mensaje})
        if(msg && ws.readyState === 1) {
            ws.send(msg)
        }
    }

    jsonAJS(json) {
        try { return JSON.parse(json) } catch { return false }
    }

    JSAJson(js) {
        try { return JSON.stringify(js) } catch { return false }
    }
}
new wsServer()