const url = `ws://${window.location.hostname}:8080`;
let ws;

export const connect = (onMessageReceived, onDisconnect) => {
    ws = new WebSocket(url);

    // 'onmessage': Intercepta la trama entrante, la decodifica de JSON a JS 
    // y la pasa a la capa de interfaz gráfica (React)
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onMessageReceived(data);
        } catch (error) {
            console.error("Error parseando mensaje:", error);
        }
    };

    // EVENTO 'onclose': Se dispara si el servidor se apaga o se pierde el internet
    ws.onclose = () => {
        console.log('Desconectado');
        if (onDisconnect) onDisconnect();
    };
};

export const send = (mensaje, data = {}) => {
    // Seguridad Crítica: Solo emitimos datos si la conexión está completamente abierta (readyState === OPEN)
    // Esto evita errores de "WebSocket is already in CLOSING or CLOSED state"
    if (ws && ws.readyState === WebSocket.OPEN) {
        const msg = Object.keys(data).length > 0 ? { mensaje, data } : { mensaje };
        ws.send(JSON.stringify(msg));
    }
};