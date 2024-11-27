import React, { useEffect, useRef, useState, useMemo } from 'react';
import styles from './WebSocketClient.module.css';
import useWASD from "use-wasd";

interface Message {
    text: string;
    timestamp: Date;
}

const WebSocketClient: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState<string>('');
    const wsRef = useRef<WebSocket | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    const options = useMemo(
        () => ({
            allowed: ["w", "a", "s", "d"],
        }),
        []
    );
    const { w, a, s, d } = useWASD(options);

    useEffect(() => {
        const setupWebSocket = () => {
            wsRef.current = new WebSocket('ws://localhost:3000');

            if ("onopen" in wsRef.current) {
                wsRef.current.onopen = () => {
                    appendMessage('Connected to server.');
                    appendMessage('Starting to send steer data.');
                };
            }

            if ("onmessage" in wsRef.current) {
                wsRef.current.onmessage = (event: MessageEvent) => {
                    const distanceData = new Int16Array(event.data); // assuming that only distance data is send
                    appendMessage(`Received: ${distanceData}`);
                };
            }

            if ("onclose" in wsRef.current) {
                wsRef.current.onclose = () => {
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = undefined;
                    }
                    appendMessage('Connection closed.');
                };
            }
        };

        setupWebSocket();

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = undefined;
            }
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, []); // Only run on component mount

    useEffect(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const currentState = [w, a, s, d];
            const dataString = currentState.map(b => b ? '1' : '0').join(',');
            if ("send" in wsRef.current) {
                wsRef.current.send(dataString);
            }
        }
    }, [w, a, s, d]);

    useEffect(() => {
        if (messagesContainerRef.current) {
            if ("scrollTop" in messagesContainerRef.current) {
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
        }
    }, [messages]);

    const appendMessage = (text: string) => {
        setMessages(prev => [...prev, {
            text,
            timestamp: new Date()
        }]);
    };

    const handleSend = () => {
        if (inputMessage.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
            if ("send" in wsRef.current) {
                wsRef.current.send(inputMessage);
            }
            appendMessage(`Sent: ${inputMessage}`);
            setInputMessage('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <div className={styles.container}>
            <h1>WebSocket Client</h1>
            <div
                ref={messagesContainerRef}
                className={styles.messagesContainer}
            >
                {messages.map((message, index) => (
                    <div key={index} className={styles.message}>
                        <span>{message.timestamp.toLocaleTimeString()}: </span>
                        {message.text}
                    </div>
                ))}
            </div>
            <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                className={styles.messageInput}
                placeholder="Type your message..."
            />
            <button
                onClick={handleSend}
                className={styles.sendButton}
            >
                Send
            </button>
            <code>{JSON.stringify({w, a, s, d})}</code>
        </div>
    );
};

export default WebSocketClient;