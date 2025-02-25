import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Container,
  Text,
  Box,
  Group,
  Card,
  Grid,
  Avatar,
  Button,
  Modal,
} from "@mantine/core";
import axios from "axios";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const REFRESH_INTERVAL = 5000;

interface PriceData {
  "EUR/USD": { price: string };
  "USD/CHF": { price: string };
  "XAU/USD": { price: string };
}

interface TradeStatistics {
  totalTrades: number;
  profitableTrades: number;
  unprofitableTrades: number;
  winRate: number;
  totalProfit: number;
  averageProfit: number;
}

interface OpenTrade {
  id?: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  profit: number;
  amount: number;
  type: string;
}

interface User {
  _id: string;
  username: string;
  demoBalance: number;
  role: string;
  group: number;
  tradeHistory?: TradeStatistics;
  firstBalance: number;
  hasOpenTrades?: OpenTrade[];
}

interface UserCardProps {
  user: User;
  isCurrentUser?: boolean;
}

interface PriceResponse {
  price: number; // или number, если API возвращает числовое значение
}

const UserCard: React.FC<UserCardProps> = ({ user, isCurrentUser = false }) => {
  const [opened, setOpened] = useState<boolean>(false);
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [updatedTrades, setUpdatedTrades] = useState<OpenTrade[]>(
    user.hasOpenTrades || []
  );
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(API_URL);

    // Listen for price updates
    socketRef.current.on("receive_price", (newPrices: PriceData) => {
      setPrices(newPrices);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const fetchLatestTrades = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Отсутствует токен авторизации");

      const response = await axios.get<OpenTrade[]>(
        `${API_URL}/api/trading/trades/open/by-username/${user.username}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setUpdatedTrades(response.data);
    } catch (error) {
      console.error("Ошибка при обновлении сделок:", error);
    }
  }, [user.username]);

  const handleModalOpen = useCallback(() => {
    setOpened(true);
    fetchLatestTrades();
  }, [fetchLatestTrades]);

  // Update trades when prices change
  useEffect(() => {
    if (!opened || !prices) return;

    setUpdatedTrades((prevTrades) =>
      prevTrades.map((trade) => {
        let newPrice = trade.currentPrice;

        // Match the symbol format from the socket data
        if (trade.symbol === "EUR/USD" && prices["EUR/USD"]) {
          newPrice = parseFloat(prices["EUR/USD"].price);
        }
        if (trade.symbol === "USD/CHF" && prices["USD/CHF"]) {
          newPrice = parseFloat(prices["USD/CHF"].price);
        }
        if (trade.symbol === "XAU/USD" && prices["XAU/USD"]) {
          newPrice = parseFloat(prices["XAU/USD"].price);
        }

        return {
          ...trade,
          currentPrice: newPrice,
          profit: parseFloat((newPrice - trade.entryPrice).toFixed(2)),
        };
      })
    );
  }, [opened, prices]);

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={
        isCurrentUser
          ? { backgroundColor: "#e5ffe5", marginBottom: "20px" }
          : {}
      }
    >
      <Group>
        <Avatar radius="xl" size="lg" />
        <Box>
          <Text
            size={isCurrentUser ? "xl" : "lg"}
            fw={isCurrentUser ? 700 : 600}
            style={isCurrentUser ? { color: "#007F00" } : {}}
          >
            {user.username}
          </Text>
          <Text size={isCurrentUser ? "md" : "sm"}>
            Баланс: {user.demoBalance.toFixed(2)}
          </Text>
          {isCurrentUser && (
            <>
              <Text>Группа: {user.group}</Text>
              <Text>
                Текущий профит:{" "}
                {(user.demoBalance - user.firstBalance).toFixed(2)}
              </Text>
            </>
          )}
          {user.tradeHistory ? (
            <>
              <Text size="sm" color="green">
                Успешные сделки: {user.tradeHistory.profitableTrades}
              </Text>
              <Text size="sm" color="red">
                Неудачные сделки: {user.tradeHistory.unprofitableTrades}
              </Text>
              <Text size="sm" color="blue">
                Win Rate: {user.tradeHistory.winRate.toFixed(2)}%
              </Text>
              <Text size="sm" color="teal">
                Средняя прибыль: {user.tradeHistory.averageProfit?.toFixed(2)}
              </Text>
            </>
          ) : (
            <Text size="sm" color="dimmed">
              Нет данных о сделках
            </Text>
          )}
          <Text size="sm" color="purple">
            Открытые сделки: {user.hasOpenTrades?.length ? "Есть" : "Нет"}
          </Text>
          {user.hasOpenTrades?.length ? (
            <Button variant="outline" onClick={handleModalOpen}>
              Посмотреть открытые сделки
            </Button>
          ) : null}
        </Box>
      </Group>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Открытые сделки"
        size="lg"
      >
        <Box>
          {updatedTrades.length > 0 ? (
            updatedTrades.map((trade) => {
              const currentPrice = prices
                ? trade.symbol === "FX:EURUSD"
                  ? parseFloat(prices["EUR/USD"].price)
                  : trade.symbol === "FX:USDCHF"
                  ? parseFloat(prices["USD/CHF"].price)
                  : trade.symbol === "TVC:XAUUSD"
                  ? parseFloat(prices["XAU/USD"].price)
                  : trade.currentPrice
                : trade.currentPrice;

              const priceDifference =
                trade.type === "sell"
                  ? trade.entryPrice - currentPrice
                  : currentPrice - trade.entryPrice;

              const units = trade.amount * 200.0;
              const profit = currentPrice
                ? parseFloat((priceDifference * units).toFixed(2))
                : trade.profit;
              const profitPercentage =
                trade.amount > 0
                  ? parseFloat(((profit / trade.amount) * 100).toFixed(2))
                  : 0;

              return (
                <Box key={trade.id} mb="md">
                  <Text>
                    <strong>Символ:</strong> {trade.symbol}
                  </Text>
                  <Text>
                    <strong>Цена открытия:</strong> {trade.entryPrice}
                  </Text>
                  <Text>
                    <strong>Текущая цена:</strong>{" "}
                    {currentPrice || "Загрузка..."}
                  </Text>
                  <Text>
                    <strong>Amount:</strong> {trade.amount}
                  </Text>
                  <Text>
                    <strong>Прибыль:</strong> {profit} USD
                  </Text>
                  <Text>
                    <strong>Прибыль (%):</strong> {profitPercentage}%
                  </Text>
                </Box>
              );
            })
          ) : (
            <Text>Нет открытых сделок</Text>
          )}
        </Box>
      </Modal>
    </Card>
  );
};

const GroupPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [groupUsers, setGroupUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number>();

  const fetchGroupUsers = useCallback(async () => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) throw new Error("Отсутствует информация о пользователе");

      const userData = JSON.parse(userStr) as { username: string };
      if (!userData.username)
        throw new Error("Не найден username в данных пользователя");

      const token = localStorage.getItem("token");
      if (!token) throw new Error("Отсутствует токен авторизации");

      const response = await axios.get<User[]>(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const currentUserData = response.data.find(
        (user) => user.username === userData.username
      );
      if (!currentUserData)
        throw new Error("Текущий пользователь не найден в группе");

      const groupUsersData = response.data.filter(
        (user) => user.group === currentUserData.group
      );
      const usersWithTrades = await Promise.all(
        groupUsersData.map(async (user) => {
          try {
            const [tradesResponse, openTradesResponse] = await Promise.all([
              axios.get<TradeStatistics>(
                `${API_URL}/api/trading/statistics/${user.username}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              ),
              axios.get<OpenTrade[]>(
                `${API_URL}/api/trading/trades/open/by-username/${user.username}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              ),
            ]);
            return {
              ...user,
              tradeHistory: tradesResponse.data,
              hasOpenTrades: openTradesResponse.data,
            };
          } catch (error) {
            console.error(
              `Ошибка при загрузке сделок пользователя ${user.username}:`,
              error
            );
            return { ...user, tradeHistory: undefined, hasOpenTrades: [] };
          }
        })
      );

      const currentUserWithTrades = usersWithTrades.find(
        (user) => user.username === userData.username
      );
      setCurrentUser(currentUserWithTrades || null);
      setGroupUsers(usersWithTrades);
      setError(null);
    } catch (error) {
      console.error("Ошибка при загрузке пользователей группы:", error);
      setError("Не удалось загрузить пользователей группы.");
      setGroupUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroupUsers();
    const interval = window.setInterval(fetchGroupUsers, REFRESH_INTERVAL);
    intervalRef.current = interval;
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [fetchGroupUsers]);

  if (loading && !groupUsers.length) {
    return (
      <Container>
        <Text>Загрузка...</Text>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Text color="red">{error}</Text>
      </Container>
    );
  }

  return (
    <Container>
      {currentUser && <UserCard user={currentUser} isCurrentUser={true} />}
      <Grid>
        {groupUsers
          .filter((user) => user.username !== currentUser?.username)
          .map((user) => (
            <Grid.Col key={user._id} span={{ base: 12, sm: 6 }}>
              <UserCard user={user} />
            </Grid.Col>
          ))}
      </Grid>
    </Container>
  );
};

export default GroupPage;
