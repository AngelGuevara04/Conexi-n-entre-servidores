import React, { useState, useRef } from 'react';
import './TextBar.css';

const TextBar = ({ onSend }) => {
    
    // BLOQUE 1: ESTADOS Y REFERENCIAS
    // Aquí guardamos los datos temporales del componente
    
    
    // Almacena el texto que el usuario está escribiendo actualmente.
    const [text, setText] = useState("");
    
    // Referencia directa al elemento HTML <textarea> para poder manipular 
    // su altura dinámicamente mediante código (DOM).
    const textareaRef = useRef(null); 
    
    // Constante que define el límite de caracteres permitidos por mensaje.
    const MAX_CHARS = 250;            

    
    // BLOQUE 2: LÓGICA DE VALIDACIÓN Y ENVÍO
    // Controla qué pasa cuando el usuario decide mandar el mensaje
    
    
    const handleSend = () => {
        // Validación 1: El mensaje no debe estar vacío (ni tener solo espacios).
        // Validación 2: El mensaje no debe superar el límite de caracteres.
        if (text.trim() !== "" && text.length <= MAX_CHARS) {
            
            // Ejecuta la función que le pasó el componente padre (App o MessageWindow)
            onSend(text);
            
            // Limpia la caja de texto tras enviar el mensaje
            setText("");
            
            // Resetea la altura física de la caja de texto a su tamaño original (1 fila)
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    // Variable booleana que decide si el botón de enviar debe estar bloqueado (gris)
    // Se bloquea si no hay texto escrito o si se pasaron los 250 caracteres.
    const isButtonDisabled = text.trim() === "" || text.length > MAX_CHARS;


    
    // BLOQUE 3: MANEJO DE INTERFAZ DINÁMICA (AUTO-RESIZE)
    // Hace que la caja crezca hacia arriba según se escribe
    
    
    const handleInput = (e) => {
        // Actualiza el estado con lo que el usuario acaba de teclear
        setText(e.target.value);
        
        // Truco de UI: Primero resetea la altura para calcular el nuevo tamaño,
        // luego ajusta la altura de la caja según el contenido real (scrollHeight).
        e.target.style.height = 'auto'; 
        e.target.style.height = `${e.target.scrollHeight}px`; 
    };

    
    // BLOQUE 4: RENDERIZADO VISUAL (HTML/JSX)
    // Estructura de los elementos en la pantalla
    
    
    return (
        // Contenedor principal: Responsable del fondo general y centrar el contenido
        <div className="text-bar-outer-container">
            
            {/* Contenedor interno: Limita el ancho en monitores grandes */}
            <div className="text-bar-inner-wrapper">
                
                {/* Zona de escritura: Agrupa el textarea y el contador */}
                <div className="input-wrapper">
                    <textarea 
                        ref={textareaRef}
                        value={text} 
                        onChange={handleInput} 
                        
                        // Captura las teclas que presiona el usuario
                        onKeyDown={(e) => {
                            // Si presiona 'Enter' sin 'Shift', se envía el mensaje.
                            // Si presiona 'Shift + Enter', permite salto de línea natural.
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault(); // Evita que se haga un salto de línea extra
                                handleSend();
                            }
                        }}
                        placeholder="Escribe un mensaje..."
                        maxLength={MAX_CHARS} // Evita a nivel HTML que escriba más del límite
                        rows={1}
                    />
                    
                    {/* Contador de caracteres (ej: 14/250) */}
                    {/* Si llega al límite, se añade la clase 'limit-reached' para ponerlo rojo */}
                    <span className={`char-counter ${text.length >= MAX_CHARS ? 'limit-reached' : ''}`}>
                        {text.length}/{MAX_CHARS}
                    </span>
                </div>
                
                {/* Botón de envío */}
                <button 
                    className="send-button"
                    onClick={handleSend} 
                    disabled={isButtonDisabled} // Usa la validación del Bloque 2
                >
                    {/* Icono vectorial (SVG) de avión de papel */}
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default TextBar;