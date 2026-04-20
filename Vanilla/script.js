let ws;
let miNombre = "";
let usuariosConectados = [];

// Diccionario para guardar los mensajes de cada sala/usuario
// Inicia siempre con la sala "Todos" vacía
let historiales = { "Todos": [] }; 
let chatActivo = "Todos"; // El panel que el usuario está viendo actualmente

function conectarAlServidor() {
    miNombre = document.getElementById("username").value.trim();
    if (!miNombre) return alert("Por favor ingresa un nombre");

    document.getElementById("login-modal").style.display = "none";
    document.getElementById("app").style.display = "flex";

    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        console.log("Conexión establecida.");
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) enviarMSG("CONECTADOS");
        }, 3000);
    };

    ws.onmessage = (event) => {
        const datos = jsonAJS(event.data);
        if(datos) {
            const {mensaje, data} = datos;
            if(mensaje === "IDENTIFICATE") IDENTIFICATE();
            if(mensaje === "CONECTADOS") CONECTADOS(data);
            if(mensaje === "CHAT") CHAT(data);
        }
    };

    ws.onclose = () => {
        alert("Servidor desconectado");
        window.location.reload();
    };
}

// --- GESTORES DE MENSAJE ---

function IDENTIFICATE() {
    enviarMSG("IDENTIFICACION", miNombre);
    enviarMSG("CONECTADOS");
}

function CONECTADOS(data) {
    if(data) {
        if (JSON.stringify(usuariosConectados) === JSON.stringify(data)) return;
        usuariosConectados = data;

        const lista = document.getElementById("user-list");
        // Reiniciamos la lista manteniendo siempre la Sala General
        lista.innerHTML = `<li id="tab-Todos" class="${chatActivo === 'Todos' ? 'active-tab' : ''}" onclick="cambiarChat('Todos')">🌐 Sala General</li>`;

        usuariosConectados.forEach(cliente => {
            // Creamos un historial vacío si es un usuario nuevo
            if (!historiales[cliente]) historiales[cliente] = [];
            
            const li = document.createElement("li");
            li.id = `tab-${cliente}`;
            li.className = chatActivo === cliente ? 'active-tab' : '';
            li.innerText = `👤 ${cliente}`;
            li.onclick = () => cambiarChat(cliente);
            lista.appendChild(li);
        });
    }
}

function CHAT(data) {
    if(data) {
        const {emisor, mensaje} = data;
        let textoFinal = mensaje;
        let salaDestino = emisor; // Asumimos que es privado por defecto

        // Detectamos nuestra etiqueta oculta y la removemos
        if (mensaje.startsWith("[GLOBAL]")) {
            textoFinal = mensaje.replace("[GLOBAL]", "");
            salaDestino = "Todos";
        } else if (mensaje.startsWith("[PRIVADO]")) {
            textoFinal = mensaje.replace("[PRIVADO]", "");
        }

        // Aseguramos que la sala exista en memoria
        if (!historiales[salaDestino]) historiales[salaDestino] = [];
        
        // Guardamos el mensaje en el historial correspondiente
        historiales[salaDestino].push({ autor: emisor, texto: textoFinal, tipo: 'other' });

        // Si estamos viendo exactamente ese panel, lo dibujamos en pantalla
        if (chatActivo === salaDestino) {
            dibujarMensaje(emisor, textoFinal, 'other');
        }
    }
}

// --- LÓGICA DE INTERFAZ MULTI-PANEL ---

function cambiarChat(nuevoDestino) {
    chatActivo = nuevoDestino;

    // Actualizar estilos en la barra lateral
    document.querySelectorAll('#user-list li').forEach(li => li.classList.remove('active-tab'));
    document.getElementById(`tab-${chatActivo}`).classList.add('active-tab');

    // Actualizar el encabezado
    document.getElementById("chat-header").innerHTML = `Conversando en: <strong>${chatActivo === 'Todos' ? 'Sala General' : chatActivo}</strong>`;

    // Limpiar el área de chat
    const historyContainer = document.getElementById("chat-history");
    historyContainer.innerHTML = "";

    // Volcar todos los mensajes guardados en el historial de ese panel
    if (historiales[chatActivo]) {
        historiales[chatActivo].forEach(msg => {
            dibujarMensaje(msg.autor, msg.texto, msg.tipo);
        });
    }
}

function enviarMensaje() {
    const inputElement = document.getElementById("mensaje");
    const mensajeTexto = inputElement.value.trim();

    if(!mensajeTexto) return;

    // Preparamos los datos según si es general o privado
    const receptor = chatActivo === "Todos" ? usuariosConectados : [chatActivo];
    const prefijoMeta = chatActivo === "Todos" ? "[GLOBAL]" : "[PRIVADO]";

    // Enviamos el mensaje con la etiqueta invisible al servidor
    enviarMSG("CHAT", {receptor, mensaje: prefijoMeta + mensajeTexto});

    // Lo guardamos en nuestro propio panel localmente
    if (!historiales[chatActivo]) historiales[chatActivo] = [];
    historiales[chatActivo].push({ autor: "Tú", texto: mensajeTexto, tipo: 'me' });
    dibujarMensaje("Tú", mensajeTexto, 'me');
    
    inputElement.value = "";
}

// --- MÉTODOS AUXILIARES ---

function enviarMSG(mensaje, data = {}) {
    const msg = (Object.keys(data).length !== 0 && data !== undefined && data !== null) ?
        JSON.stringify({mensaje, data}) : JSON.stringify({mensaje});

    if(msg && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
    }
}

function jsonAJS(json) { try { return JSON.parse(json); } catch { return false; } }

function dibujarMensaje(autor, texto, tipo) {
    const div = document.createElement("div");
    div.className = `message msg-${tipo}`;
    div.innerHTML = `<div class="msg-author">${autor}</div><div>${texto}</div>`;
    
    const history = document.getElementById("chat-history");
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
}