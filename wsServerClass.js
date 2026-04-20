import { WebSocketServer } from 'ws'

class wsServer {
	constructor() {
		this.wss = new WebSocketServer({ port: 8080 })
		console.log("Servidor WebSocket iniciado en ws://localhost:8080")

		// Un cliente se conecta
		this.wss.on('connection', (ws) => {
			this.MSG(ws, "IDENTIFICATE") // Solicito identificación

			ws.on('message', (datos) => {
				datos = this.jsonAJS(datos) // Conversión segura
				if(datos) {
					const {mensaje, data} = datos

					// Ejecuto dinámicamente al método gestor del mensaje
					if(this[mensaje] && typeof this[mensaje] == "function")
						this[mensaje](ws, data) // Los gestores de mensajes deben llevar la misma firma
				}
			})

			// Un cliente se desconecta
			ws.on('close', () => {
				console.log(`${ws.data} desconectado`)
				// Siempre que se desconecta un cliente, informo a los otros clientes
				this.CONECTADOS(ws)
			})

			// Siempre que se conecte un nuevo cliente, informo a los otros
			this.CONECTADOS(ws)
		})
	}

	//
	// Gestores de mensajes
	// NOTA: Todos los métodos gestores de mensajes llevan la misma firma
	//

	IDENTIFICACION(ws, data) {
		ws.data = data
		console.log(`${ws.data} conectado...`)
	}

	CONECTADOS(ws, data) {
		// Armo el arreglo de clientes para enviar
		data = []
		for (const cliente of this.wss.clients)
			// Enviar el id del propio socket que pregunta es redundante
			if(ws.data != cliente.data)
				data.push(cliente.data)

		// Solo si hay clientes mando el mensaje
		if(data.length)
			this.MSG(ws, "CONECTADOS", data)
	}

	CHAT(ws, data) {
		if(data) {
			const emisor = ws.data,
			{receptor, mensaje} = data

			for (const destinatario of receptor) {
				const socket = this.socketId(destinatario)

				if(socket)
					this.MSG(socket, "CHAT", {emisor, mensaje})
			}
		}
	}

	//
	// Métodos auxiliares
	//

	socketId(id) {
		// Recorro la lista de clientes para localizar al receptor
		for (const cliente of this.wss.clients)
			if(cliente.data == id) return cliente
		return false
	}

	// Envía un mensaje al socket indicado
	MSG(ws, mensaje, data) {
		// Solo voy a enviar data, si hay data
		const msg = data != {} && data != undefined && data != null ?
			this.JSAJson({mensaje, data}) : this.JSAJson({mensaje})
		
		if(msg) {
			ws.send(msg)
			// console.log(`Mensaje enviado: ${msg}`)
		}
	}

	// Conversión a Javascript segura
	jsonAJS(json) {
		try { return JSON.parse(json) }
		catch { return false }
	}

	// Conversión a JSON segura
	JSAJson(js) {
		try { return JSON.stringify(js) }
		catch { return false }
	}
}
new wsServer()