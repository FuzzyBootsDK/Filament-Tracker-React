import { createContext, useContext, useEffect, useRef, useState } from 'react';

const PrinterContext = createContext(null);

const MQTT_LOG_MAX = 200;

export function PrinterProvider({ children }) {
  const [printerStatus, setPrinterStatus] = useState({});
  const [mqttLog, setMqttLog] = useState([]);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

  function connect() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      clearTimeout(reconnectRef.current);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'printer_status') {
          setPrinterStatus(prev => ({ ...prev, [msg.serial]: msg }));
        } else if (msg.type === 'mqtt_debug') {
          setMqttLog(prev => {
            const next = [...prev, msg];
            return next.length > MQTT_LOG_MAX ? next.slice(next.length - MQTT_LOG_MAX) : next;
          });
        }
      } catch {}
    };

    ws.onclose = () => {
      reconnectRef.current = setTimeout(connect, 5000);
    };
  }

  const getBestPrinter = () => {
    const statuses = Object.values(printerStatus);
    // Prefer a printing printer, fallback to first connected
    return statuses.find(s => s.gcode_state === 'RUNNING') || statuses.find(s => s.connected) || null;
  };

  return (
    <PrinterContext.Provider value={{
      printerStatus, getBestPrinter,
      mqttLog, clearMqttLog: () => setMqttLog([]),
    }}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  return useContext(PrinterContext);
}
