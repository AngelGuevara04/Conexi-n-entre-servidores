const DB_NAME = 'Chat'
const STORE_NAME = 'grupos'

export class chatBD {
	constructor() {
		this.db = null
	}      

	async init() {                                                                                                                               
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, 1)

			request.onupgradeneeded = (e) => {
				const db = e.target.result
				// Mantenemos autoIncrement por seguridad, pero pasaremos un ID explícito
				db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
				console.log('Estructura de la base de datos creada')
			}

			request.onsuccess = (e) => {
				this.db = e.target.result
				resolve()
			}

			request.onerror = (e) => {
				reject(`Error crítico: ${e.target.error.message}`)
			}
		})
	}

	/**
	 * CREATE: Guarda un nuevo objeto con un ID explícito para evitar colisiones entre usuarios
	 */
	async add(idUnico, nombreGrupo, miembros) {
		try {
			const tx = this.db.transaction(STORE_NAME, 'readwrite')
			const store = tx.objectStore(STORE_NAME)
			
			return new Promise((resolve, reject) => {
				// Pasamos el idUnico explícitamente
				const request = store.add({ id: idUnico, nombre: nombreGrupo, miembros: miembros })
				
				request.onsuccess = () => resolve(request.result)
				request.onerror = () => reject("No se pudo añadir el grupo")
			})
		} catch (err) {
			console.error("Error en add:", err)
		}
	}

	async getAll() {
		try {
			const tx = this.db.transaction(STORE_NAME, 'readonly')
			const store = tx.objectStore(STORE_NAME)
			
			return new Promise((resolve) => {
				const request = store.getAll()
				request.onsuccess = () => resolve(request.result)
			})
		} catch (err) {
			console.error("Error en getAll:", err)
			return []
		}
	}

	async update(id, nuevoNombre) {
		try {
			const tx = this.db.transaction(STORE_NAME, 'readwrite')
			const store = tx.objectStore(STORE_NAME)
			
			return new Promise((resolve, reject) => {
				const request = store.put({ id, nombre: nuevoNombre })
				request.onsuccess = () => resolve()
				request.onerror = () => reject("Error al actualizar")
			})
		} catch (err) {
			console.error("Error en update:", err)
		}
	}

	async delete(id) {
		try {
			const tx = this.db.transaction(STORE_NAME, 'readwrite')
			const store = tx.objectStore(STORE_NAME)
			
			return new Promise((resolve) => {
				const request = store.delete(id)
				request.onsuccess = () => resolve()
			})
		} catch (err) {
			console.error("Error en delete:", err)
		}
	}

	async clearAll() {
		try {
			const tx = this.db.transaction(STORE_NAME, 'readwrite')
			const store = tx.objectStore(STORE_NAME)
			
			return new Promise((resolve, reject) => {
				const request = store.clear()
				request.onsuccess = () => resolve()
				request.onerror = () => reject("Error al limpiar")
			})
		} catch (err) {
			console.error("Error en clearAll:", err)
		}
	}
}