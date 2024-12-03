import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import styles from './WebSocketClient.module.css';
import useWASD from "use-wasd";
import appCfg from '../app-cfg.ts';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface Message {
    text: string;
    timestamp: Date;
}

enum DataKind {
    ToFData,
    EnvironmentData
};

const WebSocketClient: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState<string>('');
    const [temperatureHistory, setTemperatureHistory] = useState<number[]>([]);
    const [humidityHistory, setHumidityHistory] = useState<number[]>([]);
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    const canvasRef = useRef(null);
    const wsRef = useRef<WebSocket | null>(null);

    const width_ToF = 8;
    const height_ToF = 8;


    const options = useMemo(
        () => ({
            allowed: ["w", "a", "s", "d"],
        }),
        []
    );
    const { w, a, s, d } = useWASD(options);

    useEffect(() => {
        const setupWebSocket = () => {
            const webSocketType = appCfg.isSecure ? 'wss' : 'ws';
            wsRef.current = new WebSocket(`${webSocketType}://${appCfg.apiUrl}`);
            wsRef.current.binaryType = 'arraybuffer';

            if ("onopen" in wsRef.current) {
                wsRef.current.onopen = () => {
                    appendMessage('Connected to server.');
                    appendMessage('Starting to send steer data.');
                };
            }

            if ("onmessage" in wsRef.current) {
                wsRef.current.onmessage = (event: MessageEvent) => {
                    if (event.data instanceof ArrayBuffer) {
                        const dataView = new DataView(event.data);

                        const dataKind: DataKind = dataView.getUint8(0);
                        switch (dataKind) {
                            case DataKind.ToFData:
                                const tofBuffer = event.data.slice(1, dataView.byteLength);
                                const distanceData = new Int16Array(tofBuffer);
                                drawCameraFeed(distanceData);
                                console.log(distanceData.length);
                                appendMessage(`ToF: ${distanceData.toString()}\n`);
                                break;

                            case DataKind.EnvironmentData:
                                const temperature = dataView.getFloat32(1, true);
                                const humidity = dataView.getUint16(5, true);

                                setTemperatureHistory(prev => {
                                    const updated = [...prev, temperature];
                                    if (updated.length > 100) updated.shift();
                                    return updated;
                                });
                                setHumidityHistory(prev => {
                                    const updated = [...prev, humidity];
                                    if (updated.length > 100) updated.shift();
                                    return updated;
                                });

                                appendMessage(`Temperature: ${temperature.toString()}, Humidity: ${humidity.toString()}\n`);
                                break;

                            default:
                                appendMessage("none");
                        }
                    }
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
            const currentState = [a, d, w, s];

            const steeringStates = new Uint8Array(currentState.map(state => state ? 1 : 0));
            if ("send" in wsRef.current) {
                wsRef.current.send(steeringStates);
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

    const chartData = (data: number[], label: string, color: string) => ({
        labels: data.map((_, index) => index),
        datasets: [
            {
                label,
                data,
                borderColor: color,
                backgroundColor: `${color}33`,
                fill: true,
            },
        ],
    });

    const drawCameraFeed = (data: Int16Array): void => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
        if (!ctx) return;

        const cellWidth = canvas.width / width_ToF;
        const cellHeight = canvas.height / height_ToF;

        const minDist = Math.min(...data);
        const maxDist = Math.max(...data);

        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const value = data[y * WIDTH + x];
                const normalizedValue = (value - minDist) / (maxDist - minDist);

                const r = Math.floor(normalizedValue * 255);
                const b = Math.floor((1 - normalizedValue) * 255);

                ctx.fillStyle = `rgb(${r}, 0, ${b})`;
                ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
            }
        }
    };

    return (
        <div className={styles.container}>

            <div className={styles.messageViewContainer}>


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

            <div className={styles.chartsContainer}>
                <div className={styles.chart}>
                    <Line data={chartData(temperatureHistory, 'Temperature', 'rgba(255, 99, 132)')}/>
                </div>
                <div className={styles.chart}>
                    <Line data={chartData(humidityHistory, 'Humidity', 'rgba(54, 162, 235)')}/>
                </div>
            </div>

            <div>

            </div>

            <div className={styles.cameraView}>

                <canvas
                    ref={canvasRef}
                    width={480}
                    height={480}
                    className="border border-gray-300 rounded"
                />
            </div>
        </div>
    );
};

export default WebSocketClient;
