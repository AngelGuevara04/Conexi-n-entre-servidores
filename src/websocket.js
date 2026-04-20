// Basado en la lógica modular del repositorio subido
const url = 'ws://localhost:8080';
let ws;

export const connect = (onMessageReceived) => {
    ws = new WebSocket(url);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onMessageReceived(data);
    };

    ws.onclose = () => {
        console.log('Desconectado');
    };
};

export const send = (mensaje, data) => {
    // Ajustado a tu firma de servidor: {mensaje, data}
    ws.send(JSON.stringify({ mensaje, data }));
};