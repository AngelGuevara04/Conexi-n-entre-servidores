const STORE_NAME = 'grupos'
const MSG_STORE_NAME = 'mensajes'

export class chatBD {
    constructor() {
        this.db = null
    }      

    /**
     * Inicializa de forma dinámica la base de datos exclusiva para el usuario conectado.
     * Si entra "Carlos", crea o abre "Chat_Carlos". Si entra "Elena", abre "Chat_Elena".
     */
    async init(nombreUsuario) {                                                                                                                                                                                   
        return new Promise((resolve, reject) => {
            const dbName = `Chat_${nombreUsuario}`
            // Versión 2 para asegurar la creación de ambos almacenes
            const request = indexedDB.open(dbName, 2)

            request.onupgradeneeded = (e) => {
                const db = e.target.result
                
                // Almacén para Grupos (Mantiene autoIncrement por tu compatibilidad previa)
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
                    console.log(`Estructura de grupos creada para el usuario: ${nombreUsuario}`)
                }

                // Almacén para Mensajes
                if (!db.objectStoreNames.contains(MSG_STORE_NAME)) {
                    const msgStore = db.createObjectStore(MSG_STORE_NAME, { keyPath: 'id' })
                    // Creamos un índice sobre la propiedad "sala" para búsquedas eficientes
                    msgStore.createIndex("sala", "sala", { unique: false })
                    console.log(`Estructura de mensajes creada para el usuario: ${nombreUsuario}`)
                }
            }

            request.onsuccess = (e) => {
                this.db = e.target.result
                resolve()
            }

            request.onerror = (e) => {
                reject(`Error crítico en IndexedDB: ${e.target.error.message}`)
            }
        })
    }

    // ==========================================
    // MÉTODOS PARA GRUPOS
    // ==========================================

    async add(idUnico, nombreGrupo, miembros) {
        try {
            const tx = this.db.transaction(STORE_NAME, 'readwrite')
            const store = tx.objectStore(STORE_NAME)
            
            return new Promise((resolve, reject) => {
                const request = store.add({ id: idUnico, nombre: nombreGrupo, miembros: miembros })
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject("No se pudo añadir el grupo")
            })
        } catch (err) {
            console.error("Error en add grupo:", err)
        }
    }

    async getAll() {
        try {
            const tx = this.db.transaction(STORE_NAME, 'readonly')
            const store = tx.objectStore(STORE_NAME)
            
            return new Promise((resolve) => {
                const request = store.getAll()
                request.onsuccess = () => resolve(request.result || [])
            })
        } catch (err) {
            console.error("Error en getAll grupos:", err)
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
                request.onerror = () => reject("Error al actualizar grupo")
            })
        } catch (err) {
            console.error("Error en update grupo:", err)
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
            console.error("Error en delete grupo:", err)
        }
    }

    async clearAll() {
        try {
            const tx = this.db.transaction(STORE_NAME, 'readwrite')
            const store = tx.objectStore(STORE_NAME)
            
            return new Promise((resolve, reject) => {
                const request = store.clear()
                request.onsuccess = () => resolve()
                request.onerror = () => reject("Error al limpiar almacén de grupos")
            })
        } catch (err) {
            console.error("Error en clearAll grupos:", err)
        }
    }

    // ==========================================
    // MÉTODOS PARA MENSAJES
    // ==========================================

    async addMensaje(mensaje) {
        try {
            const tx = this.db.transaction(MSG_STORE_NAME, 'readwrite')
            const store = tx.objectStore(MSG_STORE_NAME)
            
            return new Promise((resolve, reject) => {
                // 'put' guarda el mensaje nuevo o actualiza su estado (enviado/recibido/leído)
                const request = store.put(mensaje)
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject("No se pudo guardar o actualizar el mensaje")
            })
        } catch (err) {
            console.error("Error en addMensaje:", err)
        }
    }

    async getAllMensajes() {
        try {
            const tx = this.db.transaction(MSG_STORE_NAME, 'readonly')
            const store = tx.objectStore(MSG_STORE_NAME)
            
            return new Promise((resolve) => {
                const request = store.getAll()
                request.onsuccess = () => resolve(request.result || [])
            })
        } catch (err) {
            console.error("Error en getAllMensajes:", err)
            return []
        }
    }

	// NUEVO MÉTODO: Actualiza el estado (enviado -> recibido -> leido) directamente en la BD
    async updateEstadoMensaje(idMensaje, nuevoEstado) {
        try {
            const tx = this.db.transaction(MSG_STORE_NAME, 'readwrite')
            const store = tx.objectStore(MSG_STORE_NAME)
            
            return new Promise((resolve) => {
                const request = store.get(idMensaje)
                request.onsuccess = () => {
                    if (request.result) {
                        let msg = request.result
                        // Evita que un estado "leído" retroceda por accidente a "recibido"
                        if (msg.estado === 'leido') return resolve(msg)
                        
                        msg.estado = nuevoEstado
                        store.put(msg)
                        resolve(msg)
                    } else {
                        resolve(null)
                    }
                }
            })
        } catch (err) {
            console.error("Error al actualizar estado en BD:", err)
        }
    }
}