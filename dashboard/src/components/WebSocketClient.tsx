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

enum DataKind {
    ToFData,
    EnvironmentData
};

const WebSocketClient: React.FC = () => {
    const [temperatureHistory, setTemperatureHistory] = useState<number[]>([]);
    const [humidityHistory, setHumidityHistory] = useState<number[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // ToF configuration data
    const width_ToF = 8;
    const height_ToF = 8;
    const minDist = 20; // 20mm
    const maxDist = 3000; // 3m

    // Char configuration
    const maxEntriesInChart = 50;

    const controlKeys = ["w", "a", "s", "d"];

    const options = useMemo(
        () => ({
            allowed: controlKeys,
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
                    console.log("Connected to server")
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
                                break;

                            case DataKind.EnvironmentData:
                                const temperature = dataView.getFloat32(1, true);
                                const humidity = dataView.getUint16(5, true);

                                setTemperatureHistory(prev => {
                                    const updated = [...prev, temperature];
                                    if (updated.length > maxEntriesInChart) updated.shift();
                                    return updated;
                                });
                                setHumidityHistory(prev => {
                                    const updated = [...prev, humidity];
                                    if (updated.length > maxEntriesInChart) updated.shift();
                                    return updated;
                                });
                                break;

                            default:
                                console.log("DataKind not found");
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
                    console.log('Connection closed.');
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

        for (let y = 0; y < height_ToF; y++) {
            for (let x = 0; x < width_ToF; x++) {
                const value = data[x * width_ToF + y]; // read the data vertically
                const normalizedValue = (value - minDist) / (maxDist - minDist);

                const r = Math.floor((1 - normalizedValue) * 255);
                const b = Math.floor(normalizedValue * 255);

                ctx.fillStyle = `rgb(${r}, 0, ${b})`;
                ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
            }
        }
    };

    return (

        <div className={styles.container}>
            <h1 className={styles.header}>ESP-32 Robot Controller</h1>

            <div className={styles.contentContainer}>
                <div className={styles.chartsContainer}>
                    <div className={styles.chart}>
                        <Line data={chartData(temperatureHistory, 'Temperature', 'rgba(255, 99, 132)')}/>
                    </div>

                </div>
                <div className={styles.cameraView}>
                    <canvas
                        ref={canvasRef}
                        width={480}
                        height={480}
                        className="border border-gray-300 rounded"
                    />
                    <div className={styles.controlKeys}>
                        {
                            [w, a, s, d].map((isKeyPressed, index) => { return <p key={index} style={{ color: `rgba(255, 100, 100, ${isKeyPressed ? 1.0 : 0.3})` }}>{controlKeys[index]}</p> })
                        }
                    </div>
                </div>
                <div className={styles.chartsContainer}>
                    <div className={styles.chart}>
                        <Line data={chartData(humidityHistory, 'Humidity', 'rgba(54, 162, 235)')} />
                    </div>
                </div>
            </div>
        </div>

    );
};

export default WebSocketClient;
