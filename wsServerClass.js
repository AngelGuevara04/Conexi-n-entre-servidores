import { WebSocketServer } from 'ws'

class wsServer {
	constructor() {
		this.wss = new WebSocketServer({ port: 8080 })
		console.log("Servidor WebSocket iniciado en ws://localhost:8080")

		// NUEVO: Memoria temporal para guardar mensajes de usuarios desconectados
		this.mensajesPendientes = {}

		// Un cliente se conecta
		this.wss.on('connection', (ws) => {
			this.MSG(ws, "IDENTIFICATE") // Solicito identificación

			ws.on('message', (datos) => {
				datos = this.jsonAJS(datos) // Conversión segura
				if(datos) {
					const {mensaje, data} = datos

					// Ejecuto dinámicamente al método gestor del mensaje
					if(this[mensaje] && typeof this[mensaje] == "function")
						this[mensaje](ws, data) 
				}
			})

			// Un cliente se desconecta
			ws.on('close', () => {
				console.log(`${ws.data} desconectado`)
				this.CONECTADOS(ws)
			})

			this.CONECTADOS(ws)
		})
	}

	//
	// Gestores de mensajes
	//

	IDENTIFICACION(ws, data) {
		ws.data = data
		console.log(`${ws.data} conectado...`)

		// NUEVO: Cuando el usuario se identifica, revisamos si tiene mensajes en espera
		if (this.mensajesPendientes[data] && this.mensajesPendientes[data].length > 0) {
			console.log(`Entregando ${this.mensajesPendientes[data].length} mensajes pendientes a ${data}...`)
			
			// Le enviamos cada mensaje guardado
			for (const msgGuardado of this.mensajesPendientes[data]) {
				this.MSG(ws, "CHAT", msgGuardado)
			}
			
			// Una vez entregados, vaciamos su bandeja para no repetirlos
			delete this.mensajesPendientes[data]
		}
	}

	CONECTADOS(ws, data) {
		data = []
		for (const cliente of this.wss.clients)
			// Nos aseguramos de no enviar sockets sin nombre aún
			if(ws.data != cliente.data && cliente.data)
				data.push(cliente.data)

		if(data.length)
			this.MSG(ws, "CONECTADOS", data)
	}

	CHAT(ws, data) {
		if(data) {
			const emisor = ws.data,
			{receptor, mensaje} = data

			for (const destinatario of receptor) {
				const socket = this.socketId(destinatario)

				if(socket) {
					// Si está conectado, se lo mando en tiempo real
					this.MSG(socket, "CHAT", {emisor, mensaje})
				} else {
					// NUEVO: Si está desconectado, lo guardo en su cola de pendientes
					if (!this.mensajesPendientes[destinatario]) {
						this.mensajesPendientes[destinatario] = []
					}
					this.mensajesPendientes[destinatario].push({ emisor, mensaje })
					console.log(`Mensaje encolado para ${destinatario} (está offline)`)
				}
			}
		}
	}

	//
	// Métodos auxiliares
	//

	socketId(id) {
		for (const cliente of this.wss.clients)
			if(cliente.data == id) return cliente
		return false
	}

	MSG(ws, mensaje, data) {
		const msg = data != {} && data != undefined && data != null ?
			this.JSAJson({mensaje, data}) : this.JSAJson({mensaje})
		
		if(msg) {
			ws.send(msg)
		}
	}

	jsonAJS(json) {
		try { return JSON.parse(json) }
		catch { return false }
	}

	JSAJson(js) {
		try { return JSON.stringify(js) }
		catch { return false }
	}
}

new wsServer()