import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000'; // URL твоего сервера

export default function ChatApp() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [price, setPrice] = useState(null); // Для хранения текущей цены

  useEffect(() => {
    // Проверка на наличие window для того, чтобы избежать выполнения на сервере
    if (typeof window !== 'undefined') {
      // Получаем токен из localStorage
      const token = localStorage.getItem('token');

      if (token) {
        const socket = io(SOCKET_URL, {
          auth: { token }, // Передаем токен для авторизации
        });

        // Слушаем события от сервера
        socket.on('connect', () => {
          console.log('Connected to WebSocket server');
        });

        socket.on('receive_message', (data) => {
          setMessages((prevMessages) => [
            ...prevMessages,
            { username: data.username, message: data.message },
          ]);
        });

        // Слушаем событие получения цены от сервера
        socket.on('receive_price', (data) => {
          console.log('Price received:', data); // Логируем для проверки
          setPrice(data); // Обновляем состояние с ценой
        });

        setSocket(socket);

        // Отключаем сокет при размонтировании компонента
        return () => {
          socket.disconnect();
        };
      } else {
        console.log('No token found, please log in');
      }
    }
  }, []);

  const handleSendMessage = () => {
    if (socket && message) {
      socket.emit('send_message', message); // Отправка сообщения на сервер
      setMessage(''); // Очистить поле ввода
    }
  };

  return (
    <div>
      <h1>Chat</h1>
      
      {/* Отображение цены */}
      {price && (
        <div>
          <h2>Current Price:</h2>
          <pre>{JSON.stringify(price, null, 2)}</pre>
        </div>
      )}

      <div>
        {messages.map((msg, index) => (
          <div key={index}>
            <strong>{msg.username}: </strong>{msg.message}
          </div>
        ))}
      </div>
      
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message"
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
}
