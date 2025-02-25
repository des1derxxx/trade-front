import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Title, Table, Card, Text, Group, Badge, Loader } from '@mantine/core';
import axios from 'axios';

interface User {
  username: string;
  demoBalance: number;
  group: number;
}

interface Trade {
  _id: string;
  symbol: string;
  type: 'buy' | 'sell';
  amount: number;
  lotSize: number;
  entryPrice: number;
  total: number;
  status: 'open' | 'closed';
  profit?: number;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: string;
  exitPrice?: number;
  updatedAt?: string;
}

const TradeHistoryPage = () => {
  const [userData, setUserData] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userTrades, setUserTrades] = useState<Trade[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setToken(storedToken);  

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setUsername(user.username);
    }
  }, []);

  useEffect(() => {
    if (username && token) {
      fetchUserData();
      fetchTradeData();
    }
  }, [username, token]);

  const fetchUserData = async () => {
    try {
      const response = await axios.get<User>(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${username}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserData(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке данных пользователя', error);
    }
  };

  const fetchTradeData = async () => { 
    try {
      const response = await axios.get<Trade[]>(`${process.env.NEXT_PUBLIC_API_URL}/api/trading/trades`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUserTrades(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке истории трейдинга', error);
    }
  };

  return (
    <Container>
      {userData ? (
        <Card shadow="sm" padding="lg" radius="md" withBorder m="lg">
          <Group justify="space-between">
            <Text size="lg" fw={500}>Информация о пользователе</Text>
            <Badge color="blue" size="lg">Группа {userData.group}</Badge>
          </Group>
          <Text size="md" mt="sm"><b>Ник:</b> {userData.username}</Text>
          <Text size="md" mt="sm"><b>Баланс:</b> ${userData.demoBalance.toFixed(2)}</Text>
        </Card>
      ) : (
        <Loader color="blue" size="md" />
      )}

      <Title ta="center" mb="lg">История торгов</Title>

      {userTrades ? (
        <Table striped highlightOnHover>
  <thead>
    <tr>
      <th>Символ</th>
      <th>Тип</th>
      <th>Объем</th>
      <th>Цена входа</th>
      <th>Цена выхода</th>
      <th>Прибыль</th>
      <th>Статус</th>
      <th>Открыто</th>
      <th>Закрыто</th>
    </tr>
  </thead>
  <tbody>
    {userTrades.map((trade) => {
      // Рассчитываем процент прибыли относительно объема сделки
      const profitPercentage = trade.profit
        ? ((trade.profit / (trade.entryPrice * trade.amount)) * 100).toFixed(2)
        : "0.00";

      return (
        <tr key={trade._id}>
          <td>{trade.symbol}</td>
          <td>{trade.type === 'buy' ? 'Покупка' : 'Продажа'}</td>
          <td>{trade.amount}</td>
          <td>${trade.entryPrice.toFixed(7)}</td>
          <td>{trade.exitPrice ? `$${trade.exitPrice.toFixed(7)}` : '-'}</td>
          <td style={{ color: trade.profit && trade.profit >= 0 ? 'green' : 'red' }}>
            {trade.profit ? `$${trade.profit.toFixed(2)} (${profitPercentage}%)` : '-'}
          </td>
          <td>
            <Badge color={trade.status === 'closed' ? 'green' : 'yellow'}>
              {trade.status === 'closed' ? 'Закрыто' : 'Открыто'}
            </Badge>
          </td>
          <td>{new Date(trade.createdAt).toLocaleDateString()}</td>
          <td>{trade.status === 'closed' && trade.updatedAt ? new Date(trade.updatedAt).toLocaleDateString() : '-'}</td>
        </tr>
      );
    })}
  </tbody>
</Table>

      ) : (
        <Loader color="blue" size="md" />
      )}
    </Container>
  );
};

export default TradeHistoryPage;