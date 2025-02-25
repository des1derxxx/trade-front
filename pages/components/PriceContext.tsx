// contexts/PriceContext.tsx

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";

// Типы для цены
interface Price {
  symbol: string;
  value: string;
}

interface PriceContextType {
  price: Price | null;
  socket: Socket | null;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL;

// Создаем контекст с типом
const PriceContext = createContext<PriceContextType | undefined>(undefined);

// Хук для использования контекста
export function usePrice() {
  const context = useContext(PriceContext);
  if (!context) {
    throw new Error("usePrice must be used within a PriceProvider");
  }
  return context;
}

interface PriceProviderProps {
  children: ReactNode; // Типизируем children
}

export function PriceProvider({ children }: PriceProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [price, setPrice] = useState<Price | null>(null);

  useEffect(() => {
    // Получаем токен из localStorage
    const token = localStorage.getItem("token");

    if (token) {
      const socketInstance = io(SOCKET_URL, {
        auth: { token }, // Передаем токен для авторизации
      });

      // Подключаемся к серверу
      socketInstance.on("connect", () => {
        console.log("Connected to WebSocket server");
      });

      // Слушаем события получения цены от сервера
      socketInstance.on("receive_price", (data: Price) => {
        console.log("Price received:", data); // Логируем для проверки
        setPrice(data); // Обновляем цену
      });

      setSocket(socketInstance);

      // Очищаем сокет при размонтировании компонента
      return () => {
        socketInstance.disconnect();
      };
    } else {
      console.log("No token found, please log in");
    }
  }, []);

  // Возвращаем провайдер контекста с ценой и функциями для взаимодействия с сокетом
  return (
    <PriceContext.Provider value={{ price, socket }}>
      {children}
    </PriceContext.Provider>
  );
}
