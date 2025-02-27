import { useState, useEffect } from "react";

import { useRouter } from "next/router";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  Modal,
  TextInput,
  PasswordInput,
  Select,
  NumberInput,
  Avatar,
  Grid,
  Card,
  Switch,
  Loader,
  Alert,
  Table,
  ScrollArea,
  Badge,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconLogout,
  IconUserPlus,
  IconUsers,
  IconSearch,
  IconEye,
} from "@tabler/icons-react";
import { User } from "lucide-react";
import axios from "axios";
import { io } from "socket.io-client";

interface PriceData {
  "EUR/USD"?: { price: string };
  "USD/CHF"?: { price: string };
  "XAU/USD"?: { price: string };
}

interface UserData {
  _id?: string;
  username: string;
  demoBalance: number;
  firstBalance: number;
  role: string;
  isActive: boolean;
  group: number;
  password?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface Trade {
  _id: string;
  symbol: string;
  type: "buy" | "sell";
  amount: number;
  lotSize: number;
  entryPrice: number;
  total: number;
  status: "open" | "closed";
  profit?: number;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: string;
  exitPrice?: number;
  updatedAt?: string;
}

interface TradeStatistics {
  totalTrades: number;
  profitableTrades: number;
  unprofitableTrades: number;
  winRate: number;
  totalProfit: number;
  averageProfit: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const ProfilePage = () => {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [accounts, setAccounts] = useState<UserData[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<UserData | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [groups, setGroups] = useState<number[] | null>(null);
  const [users, setUsers] = useState<{ username: string; group: number }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [viewSelectedAccount, setViewSelectedAccount] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false); // новое состояние
  const [selectedUserTrades, setSelectedUserTrades] = useState<Trade[] | null>(
    null
  );
  const [tradeStats, setTradeStats] = useState<TradeStatistics | null>(null);
  const [userPercent, setUserPercent] = useState<number | null>(null);
  const [userProfitPercentages, setUserProfitPercentages] = useState<{
    [key: string]: number;
  }>({});
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const [socket, setSocket] = useState(null);
  const [livePrices, setLivePrices] = useState({});
  const [trades, setTrades] = useState<Trade[]>([]);
  const [newUserData, setNewUserData] = useState<UserData>({
    username: "",
    password: "",
    role: "user",
    demoBalance: 10000,
    isActive: true,
    group: 0,
  });

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on("receive_price", (prices: PriceData) => {
      const priceMap = {
        "FX:EURUSD": prices["EUR/USD"]?.price,
        "FX:USDCHF": prices["USD/CHF"]?.price,
        "TVC:GOLD": prices["XAU/USD"]?.price,
      };
      setLivePrices(priceMap);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const calculatePNL = (trade: Trade): { pnl: number; percentage: number } => {
    if (trade.status === "closed") {
      return {
        pnl: trade.profit || 0,
        percentage:
          ((trade.profit || 0) / (trade.entryPrice * trade.amount)) * 100,
      };
    }

    const currentPrice = livePrices[trade.symbol];
    if (!currentPrice || !trade.entryPrice || !trade.amount) {
      return { pnl: 0, percentage: 0 };
    }

    const price = parseFloat(currentPrice);
    const priceDifference =
      trade.type === "sell"
        ? trade.entryPrice - price
        : price - trade.entryPrice;

    const units = trade.amount * 200.0;
    const pnl = priceDifference * units;
    const percentage = (pnl / (trade.entryPrice * trade.amount)) * 100;

    return {
      pnl: parseFloat(pnl.toFixed(2)),
      percentage: parseFloat(percentage.toFixed(2)),
    };
  };

  const getCurrentPrice = (trade: Trade): string => {
    if (trade.status === "closed") {
      return trade.exitPrice ? `$${trade.exitPrice.toFixed(7)}` : "-";
    }

    const price = livePrices[trade.symbol];
    return price ? `$${parseFloat(price).toFixed(7)}` : "Загрузка...";
  };

  const fetchUsersProfitPercentages = async (usernames: string[]) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Отсутствует токен авторизации");

      // Create an array of promises for each username
      const promises = usernames.map((username) =>
        axios.get(`${API_URL}/api/trading/getUserCalculatedStats/${username}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );

      // Wait for all requests to complete
      const responses = await Promise.all(promises);

      // Create a mapping of username to profit percentage
      const percentages = responses.reduce((acc, response, index) => {
        acc[usernames[index]] = response.data.profitPercent;
        return acc;
      }, {} as { [key: string]: number });

      setUserProfitPercentages(percentages);
    } catch (error) {
      console.error(
        "Ошибка при получении данных о прибыли пользователей:",
        error
      );
      setError("Не удалось загрузить данные о прибыли пользователей");
    }
  };

  useEffect(() => {
    if (selectedGroup !== null) {
      const usersInGroup = getUsersByGroup(selectedGroup);
      const usernames = usersInGroup.map((user) => user.username);
      fetchUsersProfitPercentages(usernames);
    }
  }, [selectedGroup]);

  // Helper function to safely parse JSON responses
  const parseJsonResponse = async (response: Response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON response:", text);
      throw new Error("Некорректный ответ от сервера");
    }
  };

  // Helper function to handle API requests
  const apiRequest = async <T,>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Отсутствует токен авторизации");
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await parseJsonResponse(response);
        throw new Error(errorData.message || "Ошибка сервера");
      }

      const data = await parseJsonResponse(response);
      return data;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "Отсутствует токен авторизации"
      ) {
        //router.push("/auth/login");
      }
      throw err;
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (userData?.role === "admin") {
      fetchAccounts();
    }
  }, [userData]);

  const loadUserData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Отсутствует токен авторизации");
      }

      const user = localStorage.getItem("user");
      if (!user) {
        throw new Error("Отсутствует информация о пользователе");
      }

      const { username } = JSON.parse(user); // Парсим объект и достаем username
      if (!username) {
        throw new Error("Не найден username в данных пользователя");
      }

      const response = await axios.get(
        `http://localhost:3000/api/users/username/${username}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.data || !response.data.username) {
        throw new Error("Некорректные данные пользователя");
      }

      setUserData(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ошибка загрузки данных пользователя"
      );
      //router.push("/auth/login");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await apiRequest<UserData[]>(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAccounts(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ошибка при загрузке списка аккаунтов"
      );
    }
  };

  const fetchGroupAndAccount = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const usersData = response.data;
      console.log(response.data);
      setUsers(usersData);

      // Получаем уникальные группы
      const uniqueGroups = [...new Set(usersData.map((user) => user.group))];
      setGroups(uniqueGroups);
    } catch (error) {
      console.error(error);
    }
  };

  // Фильтр пользователей по группе
  const getUsersByGroup = (group: number) => {
    return users.filter((user) => user.group === group);
  };

  const calculatePercentage = (firstBalance: number, demoBalance: number) => {
    if (firstBalance === 0) return 0; // Чтобы избежать деления на 0
    return ((demoBalance - firstBalance) / firstBalance) * 100;
  };

  const fetchUserTrades = async (username: string) => {
    setIsLoadingTrades(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get<Trade[]>(
        `${API_URL}/api/trading/trades/${username}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSelectedUserTrades(response.data);
    } catch (error) {
      console.error("Ошибка при загрузке истории трейдинга", error);
      setError("Не удалось загрузить историю торгов");
    } finally {
      setIsLoadingTrades(false);
    }
  };

  const fetchUserTradesAndStats = async (username: string) => {
    setIsLoadingTrades(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch trades - add .data to get the actual response data
      const tradesResponse = await axios.get<Trade[]>(
        `${API_URL}/api/trading/trades/open/by-username/${username}`,
        { headers }
      );

      // Fetch statistics
      const statsResponse = await axios.get<TradeStatistics>(
        `${API_URL}/api/trading/statistics/${username}`,
        { headers }
      );

      // Access the data property of the axios response
      setSelectedUserTrades(tradesResponse.data);
      setTradeStats(statsResponse.data);

      // Add some logging to debug
      console.log("Trades data:", tradesResponse.data);
      console.log("Stats data:", statsResponse.data);
    } catch (error) {
      console.error("Ошибка при загрузке данных трейдинга", error);
      setError("Не удалось загрузить данные торгов");
    } finally {
      setIsLoadingTrades(false);
    }
  };

  useEffect(() => {
    fetchUserTradesAndStats("admin");
  }, []);

  useEffect(() => {
    const fetchUserPercent = async () => {
      try {
        const token = localStorage.getItem("token");
        const user = localStorage.getItem("user");
        if (!user) throw new Error("Отсутствует информация о пользователе");

        const { username } = JSON.parse(user);
        if (!username)
          throw new Error("Не найден username в данных пользователя");

        const response = await axios.get(
          `${API_URL}/api/trading/getUserCalculatedStats/${username}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        console.log(response.data);
        setUserPercent(response.data.profitPercent); // Предположим, что процент приходит в поле `percentage`
      } catch (error) {
        console.error("Ошибка при получении данных:", error);
      }
    };

    fetchUserPercent();
  }, []);

  const handleOpenAccountModal = async (username: string) => {
    const account = accounts.find((acc) => acc.username === username);
    if (account) {
      setSelectedAccount(account);
      setIsAccountModalOpen(true);
      try {
        // Fetch all trades (both open and closed) for the specific user
        const token = localStorage.getItem("token");
        const tradesResponse = await axios.get<Trade[]>(
          `${API_URL}/api/trading/trades/by-username/${username}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTrades(tradesResponse.data);

        // Fetch statistics for the specific user
        const statsResponse = await axios.get<TradeStatistics>(
          `${API_URL}/api/trading/statistics/${username}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTradeStats(statsResponse.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setError("Failed to load user trading data");
      }
    }
  };
  useEffect(() => {
    if (isTrackingModalOpen) {
      fetchGroupAndAccount();
    }
  }, [isTrackingModalOpen]);

  useEffect(() => {
    if (isManageModalOpen) {
      fetchAccounts();
    }
  }, [isManageModalOpen]);

  const handleCreateUser = async () => {
    if (!newUserData.username || !newUserData.password) {
      setError("Заполните обязательные поля");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`${API_URL}/auth/register`, {
        method: "POST",
        body: JSON.stringify(newUserData),
      });

      await fetchAccounts();
      setIsCreateModalOpen(false);
      setNewUserData({
        username: "",
        password: "",
        role: "user",
        demoBalance: 10000,
        isActive: true,
        group: 0,
      });
      setError("success:Пользователь успешно создан");
      console.log("Перед отправкой:", newUserData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка при создании пользователя"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedAccount?._id) return;

    setIsSubmitting(true);
    try {
      await apiRequest(`${API_URL}/api/users/${selectedAccount._id}`, {
        method: "PUT",
        body: JSON.stringify(selectedAccount),
      });

      await fetchAccounts();
      setIsEditModalOpen(false);
      setError("success:Аккаунт успешно обновлен");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка при обновлении аккаунта"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // const handleLogout = () => {
  //   try {
  //     localStorage.removeItem('token');
  //     localStorage.removeItem('user');
  //     router.push('/auth/login');
  //   } catch (err) {
  //     setError('Ошибка при выходе из системы');
  //   }
  // };

  const filteredAccounts = accounts.filter((account) =>
    account.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <Container size={420} my={40}>
        <Group justify="center">
          <Loader />
        </Group>
      </Container>
    );
  }

  if (!userData) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Container size="lg" className="py-8">
        {error && (
          <div
            className={`mb-6 rounded-lg p-4 ${
              error.startsWith("success:")
                ? "bg-emerald-900/30 border-emerald-400/30"
                : "bg-red-900/30 border-red-400/30"
            } border backdrop-blur-sm`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <IconAlertCircle
                  size={20}
                  className={
                    error.startsWith("success:")
                      ? "text-emerald-400"
                      : "text-red-400"
                  }
                />
                <Text className="ml-2">{error.replace("success:", "")}</Text>
              </div>
              <button
                onClick={() => setError("")}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <Grid>
          <Grid.Col span={{ base: 12, md: userData.role === "admin" ? 6 : 12 }}>
            <div className="rounded-xl bg-gray-800/30 border border-cyan-400/30 p-8 backdrop-blur-sm shadow-lg shadow-cyan-500/20 bg-gradient-to-r from-purple-700/20 to-cyan-900/20">
              <Stack align="center" className="mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-pink-500 flex items-center justify-center text-2xl font-bold">
                  {userData.username.charAt(0).toUpperCase()}
                </div>
                <Text className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                  {userData.username}
                </Text>
              </Stack>

              <Stack className="space-y-4">
                <div>
                  <Text className="text-sm text-cyan-400">Роль</Text>
                  <Text className="text-lg">{userData.role}</Text>
                </div>
                <div>
                  <Text className="text-sm text-cyan-400 mb-1">
                    Изначальный баланс
                  </Text>
                  <Text className="text-lg font-bold">
                    {userData.firstBalance.toLocaleString()} ${" "}
                  </Text>
                </div>
                <div>
                  <Text className="text-sm text-cyan-400">Демо баланс</Text>
                  <Text className="text-lg font-bold">
                    {userData.demoBalance.toLocaleString()} ${" "}
                    {userPercent !== null
                      ? ` (${userPercent.toFixed(2)}%)`
                      : " (загрузка...)"}
                  </Text>
                </div>
                <div>
                  <Text className="text-sm text-cyan-400">Группа</Text>
                  <Text className="text-lg">{userData.group}</Text>
                </div>
              </Stack>
            </div>
          </Grid.Col>

          {userData.role === "admin" && (
            <Grid.Col span={{ base: 12, md: 6 }}>
              <div className="rounded-xl bg-gray-800/30 border border-cyan-400/30 p-8 backdrop-blur-sm shadow-lg shadow-cyan-500/20 bg-gradient-to-r from-purple-700/20 to-cyan-900/20">
                <Text className="text-xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                  Панель администратора
                </Text>
                <Stack className="space-y-4">
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white font-semibold flex items-center justify-center space-x-2 transition-all duration-300 shadow-lg shadow-cyan-500/30 hover:shadow-pink-500/30"
                  >
                    <IconUserPlus size={16} />
                    <span>Создать аккаунт</span>
                  </button>
                  <button
                    onClick={() => setIsManageModalOpen(true)}
                    className="w-full py-2 px-4 rounded-lg border border-cyan-400/50 hover:border-pink-400/50 text-cyan-400 hover:text-pink-400 flex items-center justify-center space-x-2 transition-all duration-300"
                  >
                    <IconUsers size={16} />
                    <span>Управление аккаунтами</span>
                  </button>
                  <button
                    onClick={() => setIsTrackingModalOpen(true)}
                    className="w-full py-2 px-4 rounded-lg border border-cyan-400/50 hover:border-pink-400/50 text-cyan-400 hover:text-pink-400 flex items-center justify-center space-x-2 transition-all duration-300"
                  >
                    <IconEye size={16} />
                    <span>Отслеживание пользователей</span>
                  </button>
                </Stack>
              </div>
            </Grid.Col>
          )}
        </Grid>

        <Modal
          opened={isTrackingModalOpen}
          onClose={() => setIsTrackingModalOpen(false)}
          size="xl"
          classNames={{
            modal: "bg-gray-900/95 backdrop-blur-sm z-50 ",
            overlay: "backdrop-blur-sm",
          }}
          title={
            <Text className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
              Отслеживание пользователей
            </Text>
          }
        >
          <Stack className="space-y-4 ">
            {groups && groups.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 bg-whtie-900">
                {groups.map((group) => (
                  <button
                    key={group}
                    onClick={() => setSelectedGroup(group)}
                    className={`p-3 rounded-lg border transition-all duration-300 ${
                      selectedGroup === group
                        ? "bg-gradient-to-r from-cyan-500 to-pink-500 border-transparent text-white"
                        : "border-cyan-400/30 text-cyan-400 hover:border-pink-400/30 hover:text-pink-400"
                    }`}
                  >
                    Группа {group}
                  </button>
                ))}
              </div>
            ) : (
              <Text className="text-gray-400">Нет доступных групп</Text>
            )}

            {selectedGroup !== null && (
              <div className="mt-6 space-y-4">
                <Text className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                  Пользователи группы {selectedGroup}:
                </Text>
                {getUsersByGroup(selectedGroup).length > 0 ? (
                  <div className="space-y-3">
                    {getUsersByGroup(selectedGroup).map((user) => {
                      // Get the profit percentage from the state instead of calculating it
                      const profitPercent =
                        userProfitPercentages[user.username] || 0;

                      return (
                        <div
                          key={user.username}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 border border-cyan-400/30"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-cyan-400">👤</span>
                            <Text>{user.username}</Text>
                            <Text
                              className={
                                profitPercent >= 0
                                  ? "text-emerald-400"
                                  : "text-red-400"
                              }
                            >
                              {profitPercent >= 0
                                ? `+${profitPercent.toFixed(2)}%`
                                : `${profitPercent.toFixed(2)}%`}
                            </Text>
                          </div>
                          <button
                            onClick={() =>
                              handleOpenAccountModal(user.username)
                            }
                            className="px-4 py-2 rounded-lg border border-cyan-400/30 text-cyan-400 hover:text-pink-400 hover:border-pink-400/30 transition-all duration-300"
                          >
                            Посмотреть аккаунт
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Text className="text-gray-400">
                    Нет пользователей в этой группе
                  </Text>
                )}
              </div>
            )}
          </Stack>
        </Modal>
        <Modal
          opened={isAccountModalOpen}
          onClose={() => {
            setIsAccountModalOpen(false);
            setSelectedUserTrades(null);
            setTradeStats(null);
          }}
          size="xl"
          classNames={{
            modal: "bg-gray-900/95 backdrop-blur-sm z-50", // Стили для самого модального окна
            overlay: "backdrop-blur-sm", // Стили для затемнённого фона
          }}
          title={
            <Text className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
              Информация об аккаунте
            </Text>
          }
        >
          <Stack className="space-y-6">
            <div className="rounded-lg bg-black border border-cyan-400/30 p-6">
              <Text className="text-lg font-bold mb-4 bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                Информация о пользователе
              </Text>
              <div className="space-y-3">
                <div>
                  <Text className="text-sm text-cyan-400">Ник</Text>
                  <Text>{selectedAccount?.username}</Text>
                </div>
                <div>
                  <Text className="text-sm text-cyan-400">Баланс</Text>
                  <Text>${selectedAccount?.demoBalance.toFixed(2)}</Text>
                </div>
                <div>
                  <Text className="text-sm text-cyan-400">Группа</Text>
                  <Text>{selectedAccount?.group}</Text>
                </div>
              </div>
            </div>

            {tradeStats && (
              <div className="rounded-lg bg-black border border-cyan-400/30 p-6">
                <Text className="text-lg font-bold mb-4 bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                  Статистика торговли
                </Text>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Text className="text-sm text-cyan-400">Всего сделок</Text>
                    <Text className="text-lg font-bold">
                      {tradeStats.totalTrades}
                    </Text>
                  </div>
                  <div>
                    <Text className="text-sm text-cyan-400">Прибыльные</Text>
                    <Text className="text-lg font-bold text-emerald-400">
                      {tradeStats.profitableTrades}
                    </Text>
                  </div>
                  <div>
                    <Text className="text-sm text-cyan-400">Убыточные</Text>
                    <Text className="text-lg font-bold text-red-400">
                      {tradeStats.unprofitableTrades}
                    </Text>
                  </div>
                  <div>
                    <Text className="text-sm text-cyan-400">Винрейт</Text>
                    <Text className="text-lg font-bold">
                      {tradeStats.winRate.toFixed(2)}%
                    </Text>
                  </div>
                  <div>
                    <Text className="text-sm text-cyan-400">Общая прибыль</Text>
                    <Text
                      className={`text-lg font-bold ${
                        tradeStats.totalProfit >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      ${tradeStats.totalProfit.toFixed(2)}
                    </Text>
                  </div>
                  <div>
                    <Text className="text-sm text-cyan-400">
                      Средняя прибыль
                    </Text>
                    <Text
                      className={`text-lg font-bold ${
                        tradeStats.averageProfit >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      ${tradeStats.averageProfit.toFixed(2)}
                    </Text>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-black border border-cyan-400/30 p-6">
              <Text className="text-lg font-bold mb-4 bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                История торгов
              </Text>
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <Loader color="cyan" />
                </div>
              ) : trades.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-cyan-400/30">
                        <th className="p-3 text-left text-cyan-400">Символ</th>
                        <th className="p-3 text-left text-cyan-400">Тип</th>
                        <th className="p-3 text-left text-cyan-400">Объем</th>
                        <th className="p-3 text-left text-cyan-400">
                          Цена входа
                        </th>
                        <th className="p-3 text-left text-cyan-400">
                          Текущая цена/Цена выхода
                        </th>
                        <th className="p-3 text-left text-cyan-400">
                          Прибыль/Убыток
                        </th>
                        <th className="p-3 text-left text-cyan-400">Статус</th>
                        <th className="p-3 text-left text-cyan-400">Открыто</th>
                        <th className="p-3 text-left text-cyan-400">Закрыто</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((trade) => {
                        const { pnl, percentage } = calculatePNL(trade);
                        const isOpen = trade.status === "open";
                        return (
                          <tr
                            key={trade._id}
                            className="border-b border-cyan-400/10 hover:bg-gray-800/50"
                          >
                            <td className="p-3">{trade.symbol}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-1 rounded-full text-sm ${
                                  trade.type === "buy"
                                    ? "bg-emerald-900/30 text-emerald-400"
                                    : "bg-red-900/30 text-red-400"
                                }`}
                              >
                                {trade.type === "buy" ? "Покупка" : "Продажа"}
                              </span>
                            </td>
                            <td className="p-3">{trade.amount}</td>
                            <td className="p-3">
                              ${trade.entryPrice.toFixed(7)}
                            </td>
                            <td className="p-3">{getCurrentPrice(trade)}</td>
                            <td
                              className={`p-3 font-bold ${
                                pnl >= 0 ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              ${pnl.toFixed(2)} ({percentage.toFixed(2)}%)
                              {isOpen && (
                                <Text className="text-xs text-gray-400 mt-1">
                                  (Текущий P&L)
                                </Text>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-1 rounded-full text-sm ${
                                  isOpen
                                    ? "bg-yellow-900/30 text-yellow-400"
                                    : "bg-emerald-900/30 text-emerald-400"
                                }`}
                              >
                                {isOpen ? "1" : "0"}
                              </span>
                            </td>
                            <td className="p-3">
                              {new Date(trade.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                              {!isOpen && trade.closedAt
                                ? new Date(trade.closedAt).toLocaleDateString()
                                : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Text className="text-gray-400 text-center py-4">
                  Нет доступных данных о торгах
                </Text>
              )}
            </div>
          </Stack>
        </Modal>

        <Modal
          opened={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          classNames={{
            modal: "bg-gray-900/95 backdrop-blur-sm z-50", // Стили для самого модального окна
            overlay: "backdrop-blur-sm", // Стили для затемнённого фона
          }}
          title={
            <Text className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
              Создание нового аккаунта
            </Text>
          }
        >
          <Stack className="space-y-4">
            <div>
              <Text className="text-sm text-cyan-400 mb-1">
                Имя пользователя
              </Text>
              <input
                type="text"
                className="w-full bg-gray-800/30 border border-cyan-400/30 rounded-lg p-2 text-white focus:border-pink-400/30 focus:outline-none"
                placeholder="Введите имя пользователя"
                value={newUserData.username}
                onChange={(e) =>
                  setNewUserData({ ...newUserData, username: e.target.value })
                }
              />
            </div>
            <div>
              <Text className="text-sm text-cyan-400 mb-1">Пароль</Text>
              <input
                type="password"
                className="w-full bg-gray-800/30 border border-cyan-400/30 rounded-lg p-2 text-white focus:border-pink-400/30 focus:outline-none"
                placeholder="Введите пароль"
                value={newUserData.password}
                onChange={(e) =>
                  setNewUserData({ ...newUserData, password: e.target.value })
                }
              />
            </div>
            <div>
              <Text className="text-sm text-cyan-400 mb-1">Роль</Text>
              <select
                className="w-full bg-gray-800/30 border border-cyan-400/30 rounded-lg p-2 text-white focus:border-pink-400/30 focus:outline-none"
                value={newUserData.role}
                onChange={(e) =>
                  setNewUserData({ ...newUserData, role: e.target.value })
                }
              >
                <option value="user">Пользователь</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
            <div>
              <Text className="text-sm text-cyan-400 mb-1">Демо баланс</Text>
              <input
                type="number"
                className="w-full bg-gray-800/30 border border-cyan-400/30 rounded-lg p-2 text-white focus:border-pink-400/30 focus:outline-none"
                placeholder="Введите начальный баланс"
                value={newUserData.demoBalance}
                onChange={(e) =>
                  setNewUserData({
                    ...newUserData,
                    demoBalance: Number(e.target.value),
                  })
                }
                min="0"
              />
            </div>
            <div>
              <Text className="text-sm text-cyan-400 mb-1">Группа</Text>
              <input
                type="number"
                className="w-full bg-gray-800/30 border border-cyan-400/30 rounded-lg p-2 text-white focus:border-pink-400/30 focus:outline-none"
                placeholder="Введите номер группы"
                value={newUserData.group}
                onChange={(e) =>
                  setNewUserData({
                    ...newUserData,
                    group: Number(e.target.value),
                  })
                }
                min="0"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={newUserData.isActive}
                onChange={(e) =>
                  setNewUserData({ ...newUserData, isActive: e.target.checked })
                }
                className="w-4 h-4 rounded border-cyan-400/30 bg-gray-800/30"
              />
              <label htmlFor="isActive" className="text-cyan-400">
                Активный аккаунт
              </label>
            </div>
            <button
              onClick={handleCreateUser}
              disabled={isSubmitting}
              className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white font-semibold transition-all duration-300 shadow-lg shadow-cyan-500/30 hover:shadow-pink-500/30 disabled:opacity-50"
            >
              {isSubmitting ? "Создание..." : "Создать аккаунт"}
            </button>
          </Stack>
        </Modal>

        <Modal
          opened={isManageModalOpen}
          onClose={() => setIsManageModalOpen(false)}
          size="xl"
          classNames={{
            modal: "bg-gray-900/95 backdrop-blur-sm z-50", // Стили для самого модального окна
            overlay: "backdrop-blur-sm", // Стили для затемнённого фона
          }}
          title={
            <Text className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
              Управление аккаунтами
            </Text>
          }
        >
          <Stack className="space-y-4">
            <div className="relative">
              <IconSearch
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Поиск аккаунтов..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800/30 border border-cyan-400/30 rounded-lg text-white focus:border-pink-400/30 focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cyan-400/30">
                    <th className="p-3 text-left text-cyan-400">
                      Пользователь
                    </th>
                    <th className="p-3 text-left text-cyan-400">Роль</th>
                    <th className="p-3 text-left text-cyan-400">Баланс</th>
                    <th className="p-3 text-left text-cyan-400">Группа</th>
                    <th className="p-3 text-left text-cyan-400">Статус</th>
                    <th className="p-3 text-left text-cyan-400">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => (
                    <tr
                      key={account._id}
                      className="border-b border-cyan-400/10 hover:bg-gray-800/50"
                    >
                      <td className="p-3 text-black">{account.username}</td>
                      <td className="p-3 text-black">{account.role}</td>
                      <td className="p-3 text-black">
                        {account.demoBalance.toLocaleString()} $
                      </td>
                      <td className="p-3 text-black">{account.group}</td>
                      <td className="p-3 text-black">
                        <span
                          className={`px-2 py-1 rounded-full text-sm ${
                            account.isActive
                              ? "bg-emerald-900/30 text-emerald-400"
                              : "bg-red-900/30 text-red-400"
                          }`}
                        >
                          {account.isActive ? "Активный" : "Неактивный"}
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => {
                            setSelectedAccount(account);
                            setIsEditModalOpen(true);
                          }}
                          className="px-4 py-2 rounded-lg border border-cyan-400/30 text-cyan-400 hover:text-pink-400 hover:border-pink-400/30 transition-all duration-300"
                        >
                          Редактировать
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Stack>
        </Modal>

        <Modal
          opened={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          classNames={{
            modal: "bg-gray-900/95 backdrop-blur-sm z-50", // Стили для самого модального окна
            overlay: "backdrop-blur-sm", // Стили для затемнённого фона
          }}
          title={
            <Text className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
              Редактирование аккаунта
            </Text>
          }
        >
          {selectedAccount && (
            <Stack className="space-y-4">
              <div>
                <Text className="text-sm text-cyan-400 mb-1">
                  Имя пользователя
                </Text>
                <input
                  type="text"
                  className="w-full bg-gray-800/30 border border-cyan-400/30 rounded-lg p-2 text-white focus:border-pink-400/30 focus:outline-none"
                  value={selectedAccount.username}
                  onChange={(e) =>
                    setSelectedAccount({
                      ...selectedAccount,
                      username: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Text className="text-sm text-cyan-400 mb-1">Новый пароль</Text>
                <input
                  type="password"
                  className="w-full bg-gray-800/30 border border-cyan-400/30 rounded-lg p-2 text-white focus:border-pink-400/30 focus:outline-none"
                  value={selectedAccount.password || ""}
                  onChange={(e) =>
                    setSelectedAccount({
                      ...selectedAccount,
                      password: e.target.value,
                    })
                  }
                  placeholder="Оставьте пустым, чтобы не менять"
                />
              </div>
              <div>
                <Text className="text-sm text-cyan-400 mb-1">Роль</Text>
                <select
                  className="w-full bg-gray-800/30 border border-cyan-400/30 rounded-lg p-2 text-white focus:border-pink-400/30 focus:outline-none"
                  value={selectedAccount.role}
                  onChange={(e) =>
                    setSelectedAccount({
                      ...selectedAccount,
                      role: e.target.value,
                    })
                  }
                >
                  <option value="user">Пользователь</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              <div>
                <Text className="text-sm text-cyan-400 mb-1">Демо баланс</Text>
                <input
                  type="number"
                  className="w-full bg-gray-800/30 border border-cyan-400/30 rounded-lg p-2 text-white focus:border-pink-400/30 focus:outline-none"
                  value={selectedAccount.demoBalance}
                  onChange={(e) =>
                    setSelectedAccount({
                      ...selectedAccount,
                      demoBalance: Number(e.target.value),
                    })
                  }
                  min="0"
                />
              </div>
              <div>
                <Text className="text-sm text-cyan-400 mb-1">Группа</Text>
                <input
                  type="number"
                  className="w-full bg-gray-800/30 border border-cyan-400/30 rounded-lg p-2 text-white focus:border-pink-400/30 focus:outline-none"
                  value={selectedAccount.group}
                  onChange={(e) =>
                    setSelectedAccount({
                      ...selectedAccount,
                      group: Number(e.target.value),
                    })
                  }
                  min="0"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActiveEdit"
                  checked={selectedAccount.isActive}
                  onChange={(e) =>
                    setSelectedAccount({
                      ...selectedAccount,
                      isActive: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-cyan-400/30 bg-gray-800/30"
                />
                <label htmlFor="isActiveEdit" className="text-cyan-400">
                  Активный аккаунт
                </label>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-cyan-400/30 text-cyan-400 hover:text-pink-400 hover:border-pink-400/30 transition-all duration-300"
                >
                  Отмена
                </button>
                <button
                  onClick={handleUpdateAccount}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white font-semibold transition-all duration-300 shadow-lg shadow-cyan-500/30 hover:shadow-pink-500/30 disabled:opacity-50"
                >
                  {isSubmitting ? "Сохранение..." : "Сохранить изменения"}
                </button>
              </div>
            </Stack>
          )}
        </Modal>
      </Container>
    </div>
  );
};

export default ProfilePage;
