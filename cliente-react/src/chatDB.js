const DB_NAME = 'Chat'
const STORE_NAME = 'grupos'

export class chatBD {
	constructor() {
		// Guardaremos la conexión aquí para usarla en todos los métodos
		this.db = null
	}

	/**
	 * INIT: Configura y abre la conexión.
	 * Es fundamental porque IndexedDB es una base de datos asíncrona.
	 */
	async init() {
		return new Promise((resolve, reject) => {
			// Abrimos la DB. El '1' es la versión inicial.
			const request = indexedDB.open(DB_NAME, 1)

			// Este evento ocurre SOLO la primera vez o cuando subes la versión.
			// Es el lugar para definir la estructura de las tablas.
			request.onupgradeneeded = (e) => {
				const db = e.target.result
				// Creamos el almacén (ObjectStore). 
				// keyPath 'id' es la llave primaria y autoIncrement genera números solos (1, 2, 3...).
				db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
				console.log('Estructura de la base de datos creada')
			}

			// Si la conexión es exitosa, guardamos el objeto de la DB.
			request.onsuccess = (e) => {
				this.db = e.target.result
				resolve()
			}

			// Atrapa errores (ej. si el usuario bloquea el almacenamiento local).
			request.onerror = (e) => {
				reject(`Error crítico: ${e.target.error.message}`)
			}
		})
	}

	/**
	 * CREATE: Guarda un nuevo objeto.
	 */
	async add(nombreGrupo) {
		try {
			// Creamos una transacción de 'readwrite' (lectura y escritura).
			const tx = this.db.transaction(STORE_NAME, 'readwrite')
			const store = tx.objectStore(STORE_NAME)
			
			return new Promise((resolve, reject) => {
				// .add() inserta el objeto. El ID se genera automáticamente.
				const request = store.add({ nombre: nombreGrupo })
				
				request.onsuccess = () => resolve(request.result) // Retorna el nuevo ID.
				request.onerror = () => reject("No se pudo añadir el grupo")
			})
		} catch (err) {
			console.error("Error en add:", err)
		}
	}

	/**
	 * READ: Trae todos los datos del almacén.
	 */
	async getAll() {
		try {
			// Usamos 'readonly' porque solo vamos a consultar datos.
			const tx = this.db.transaction(STORE_NAME, 'readonly')
			const store = tx.objectStore(STORE_NAME)
			
			return new Promise((resolve) => {
				const request = store.getAll()
				// request.result será un array con todos los objetos encontrados.
				request.onsuccess = () => resolve(request.result)
			})
		} catch (err) {
			console.error("Error en getAll:", err)
			return []
		}
	}

	/**
	 * UPDATE: Modifica un registro existente.
	 */
	async update(id, nuevoNombre) {
		try {
			const tx = this.db.transaction(STORE_NAME, 'readwrite')
			const store = tx.objectStore(STORE_NAME)
			
			return new Promise((resolve, reject) => {
				// .put() busca el ID. Si existe lo actualiza, si no, lo crea.
				const request = store.put({ id, nombre: nuevoNombre })
				request.onsuccess = () => resolve()
				request.onerror = () => reject("Error al actualizar")
			})
		} catch (err) {
			console.error("Error en update:", err)
		}
	}

	/**
	 * DELETE: Elimina por clave primaria.
	 */
	async delete(id) {
		try {
			const tx = this.db.transaction(STORE_NAME, 'readwrite')
			const store = tx.objectStore(STORE_NAME)
			
			return new Promise((resolve) => {
				// Borramos el objeto que coincida con el ID numérico.
				const request = store.delete(id)
				request.onsuccess = () => resolve()
			})
		} catch (err) {
			console.error("Error en delete:", err)
		}
	}

	/**
	 * CLEAR: Vacía todo el contenido sin borrar la base de datos.
	 */
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