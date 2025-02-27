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
    <div
      className={`rounded-lg border shadow-lg p-6 mb-4 ${
        isCurrentUser
          ? "border-cyan-500 bg-gradient-to-r from-cyan-900/20 to-cyan-900/10 shadow-cyan-500/20"
          : "border-pink-500 bg-gradient-to-r from-purple-900/20 to-purple-900/10 shadow-pink-500/20"
      }`}
    >
      <div className="flex items-start space-x-4">
        <div
          className={`rounded-full w-16 h-16 flex items-center justify-center text-xl ${
            isCurrentUser
              ? "bg-cyan-900/50 text-cyan-400 border border-cyan-500"
              : "bg-pink-900/50 text-pink-400 border border-pink-500"
          }`}
        >
          {user.username.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1">
          <Text
            className={`text-xl font-bold mb-1 ${
              isCurrentUser ? "text-cyan-400" : "text-pink-400"
            }`}
          >
            {user.username}
          </Text>

          <Text className="text-gray-300">
            Баланс:{" "}
            <span className="text-white">${user.demoBalance.toFixed(2)}</span>
          </Text>

          {isCurrentUser && (
            <>
              <div className="grid grid-cols-2 gap-2 my-2">
                <Text className="text-gray-300">
                  Группа: <span className="text-white">{user.group}</span>
                </Text>
                <Text
                  className={`${
                    user.demoBalance - user.firstBalance >= 0
                      ? "text-cyan-400"
                      : "text-pink-500"
                  }`}
                >
                  Текущий профит:{" "}
                  {(user.demoBalance - user.firstBalance).toFixed(2)}
                </Text>
              </div>
            </>
          )}

          {user.tradeHistory ? (
            <div className="grid grid-cols-2 gap-2 my-2">
              <Text className="text-cyan-400 text-sm">
                Успешные сделки: {user.tradeHistory.profitableTrades}
              </Text>
              <Text className="text-pink-500 text-sm">
                Неудачные сделки: {user.tradeHistory.unprofitableTrades}
              </Text>
              <Text className="text-cyan-400 text-sm">
                Win Rate: {user.tradeHistory.winRate.toFixed(2)}%
              </Text>
              <Text className="text-white text-sm">
                Средняя прибыль: {user.tradeHistory.averageProfit?.toFixed(2)}
              </Text>
            </div>
          ) : (
            <Text className="text-gray-500 text-sm my-2">
              Нет данных о сделках
            </Text>
          )}

          <Text
            className={`text-sm my-2 ${
              user.hasOpenTrades?.length ? "text-cyan-400" : "text-gray-500"
            }`}
          >
            Открытые сделки: {user.hasOpenTrades?.length ? "Есть" : "Нет"}
          </Text>

          {user.hasOpenTrades?.length ? (
            <button
              onClick={handleModalOpen}
              className={`mt-2 px-4 py-2 text-sm rounded-full border ${
                isCurrentUser
                  ? "border-cyan-500 text-cyan-400 hover:bg-cyan-900/30"
                  : "border-pink-500 text-pink-400 hover:bg-pink-900/30"
              } transition-colors`}
            >
              Посмотреть открытые сделки
            </button>
          ) : null}
        </div>
      </div>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={
          <Text className="text-xl text-cyan-400 font-bold">
            Открытые сделки
          </Text>
        }
        size="lg"
        overlayProps={{
          opacity: 0.7,
          blur: 8,
        }}
        className="bg-black"
      >
        <Box className="p-4 rounded-lg border border-cyan-500 bg-black shadow-lg shadow-cyan-500/20">
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
                <Box
                  key={trade.id}
                  className="mb-4 p-4 rounded border border-cyan-500/30 bg-cyan-900/10"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Text className="text-gray-300">
                      <span className="text-pink-400 font-bold">Символ:</span>{" "}
                      {trade.symbol}
                    </Text>
                    <Text className="text-gray-300">
                      <span className="text-pink-400 font-bold">
                        Цена открытия:
                      </span>{" "}
                      {trade.entryPrice}
                    </Text>
                    <Text className="text-gray-300">
                      <span className="text-pink-400 font-bold">
                        Текущая цена:
                      </span>{" "}
                      {currentPrice || "Загрузка..."}
                    </Text>
                    <Text className="text-gray-300">
                      <span className="text-pink-400 font-bold">Amount:</span>{" "}
                      {trade.amount}
                    </Text>
                    <Text
                      className={
                        profit >= 0 ? "text-cyan-400" : "text-pink-500"
                      }
                    >
                      <span className="text-pink-400 font-bold">Прибыль:</span>{" "}
                      {profit} USD
                    </Text>
                    <Text
                      className={
                        profitPercentage >= 0
                          ? "text-cyan-400"
                          : "text-pink-500"
                      }
                    >
                      <span className="text-pink-400 font-bold">
                        Прибыль (%):
                      </span>{" "}
                      {profitPercentage}%
                    </Text>
                  </div>
                </Box>
              );
            })
          ) : (
            <Text className="text-gray-400">Нет открытых сделок</Text>
          )}
        </Box>
      </Modal>
    </div>
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
    <div className="bg-black text-white min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          {currentUser && <UserCard user={currentUser} isCurrentUser={true} />}
        </div>

        <Text className="text-3xl font-bold text-white mb-6">TRADERS</Text>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {groupUsers
            .filter((user) => user.username !== currentUser?.username)
            .map((user) => (
              <div key={user._id}>
                <UserCard user={user} />
              </div>
            ))}
        </div>
      </div>

      {/* Feature Icons */}
      <div className="flex justify-center gap-8 my-12">
        {[
          // "ANALYTICS",
          // "HISTORY",
          // "STRATEGY",
          // "PLANNING",
          // "MARKETS",
          // "REPORTS",
          // "OPTIONS",
          // "SETTINGS",
        ].map((item, index) => (
          <div key={index} className="flex flex-col items-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                index % 2 === 0
                  ? "border border-cyan-500 text-cyan-400"
                  : "border border-pink-500 text-pink-500"
              }`}
            >
              <span>{item.charAt(0)}</span>
            </div>
            <Text className="text-xs mt-2 text-gray-400">{item}</Text>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GroupPage;
