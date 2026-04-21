const url = 'ws://localhost:8080';
let ws;

export const connect = (onMessageReceived, onDisconnect) => {
    ws = new WebSocket(url);

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onMessageReceived(data);
        } catch (error) {
            console.error("Error parseando mensaje:", error);
        }
    };

    ws.onclose = () => {
        console.log('Desconectado');
        if (onDisconnect) onDisconnect();
    };
};

export const send = (mensaje, data = {}) => {
    // Seguridad: Solo enviamos si la conexión está completamente abierta
    if (ws && ws.readyState === WebSocket.OPEN) {
        const msg = Object.keys(data).length > 0 ? { mensaje, data } : { mensaje };
        ws.send(JSON.stringify(msg));
    }
};