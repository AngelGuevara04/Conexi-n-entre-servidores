import React from 'react';
import './MessageWindow.css';

const MessageWindow = ({ messages }) => {
    return (
        <div className="message-window">
            {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.tipo}`}>
                    <span className="author">{msg.autor}:</span>
                    <p>{msg.texto}</p>
                </div>
            ))}
        </div>
    );
};

export default MessageWindow;