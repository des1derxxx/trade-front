import { useEffect, useState } from "react";
import {
  Container,
  Paper,
  Title,
  Select,
  Group,
  NumberInput,
  Button,
  Text,
  Table,
  Badge,
  ActionIcon,
  Stack,
  Grid,
  Card,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import axios from "axios";
import { X } from "lucide-react";
import { io, Socket } from "socket.io-client";
import TradingViewChart from "../components/TradingViewChart";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const FOREX_API_URL = "https://api.twelvedata.com";
const FOREX_KEY = process.env.NEXT_PUBLIC_FINAGE_KEY;

interface PriceData {
  "EUR/USD": { price: string };
  "USD/CHF": { price: string };
  "XAU/USD": { price: string };
}

interface ExchangeRateResponse {
  price: string;
}

interface UserProfileResponse {
  demoBalance: number;
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
}

interface TradeFormData {
  symbol: string;
  type: "buy" | "sell";
  lotSize: number;
  price: number;
  stopLoss: number;
  takeProfit: number;
  amount: number;
}

interface PairPrices {
  "FX:EURUSD": number;
  "FX:USDCHF": number;
  "TVC:GOLD": number;
  [key: string]: number;
}

const ForexTradingPage = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentPair, setCurrentPair] = useState<string | null>("FX:EURUSD");
  //const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [pairPrices, setPairPrices] = useState<PairPrices>({
    "FX:EURUSD": 0,
    "FX:USDCHF": 0,
    "TVC:GOLD": 0,
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [balance, setBalance] = useState<number>(10000);
  const [tradeForm, setTradeForm] = useState<TradeFormData>({
    symbol: "EURUSD",
    type: "buy",
    lotSize: 10,
    price: 0,
    stopLoss: 0,
    takeProfit: 0,
    amount: 0,
  });

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on("receive_price", (prices: PriceData) => {
      const priceMap = {
        "FX:EURUSD": parseFloat(prices["EUR/USD"]?.price || "0"),
        "FX:USDCHF": parseFloat(prices["USD/CHF"]?.price || "0"),
        "TVC:GOLD": parseFloat(prices["XAU/USD"]?.price || "0"),
      };

      setPairPrices(priceMap);

      // Обновляем форму только для текущей выбранной пары
      if (currentPair && priceMap[currentPair]) {
        setTradeForm((prev) => ({ ...prev, price: priceMap[currentPair] }));
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [currentPair]);

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Безопасная функция для форматирования цены
  const formatPrice = (
    price: number | undefined,
    decimals: number = 5
  ): string => {
    if (price === undefined || price === null) return "0.00";
    return price.toFixed(decimals);
  };

  // Helper function to convert lots to units with проверкой
  const lotsToUnits = (lots: number): number => {
    if (!lots) return 0;
    return lots * 200; // 1 lot = $200 (100 lots = $20,000)
  };

  const fetchUserData = async (): Promise<void> => {
    try {
      const token = localStorage.getItem("token");
      const user = localStorage.getItem("user");
      if (!user) {
        throw new Error("User information not found");
      }

      const { username } = JSON.parse(user);
      if (!username) {
        throw new Error("Username not found");
      }

      const response = await axios.get(
        `${API_URL}/api/users/username/${username}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setBalance(response.data.demoBalance);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch user data",
        color: "red",
      });
    }
  };

  const fetchTrades = async (): Promise<void> => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get<Trade[]>(
        `${API_URL}/api/trading/trades`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setTrades(response.data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch trades",
        color: "red",
      });
    }
  };

  const calculatePNL = (trade: Trade): number => {
    if (!trade || !trade.entryPrice || !trade.amount) {
      return 0;
    }

    // Получаем текущую цену для конкретной пары из trade.symbol
    const currentPriceForPair = pairPrices[trade.symbol] || 0;

    if (currentPriceForPair === 0) return 0;

    const priceDifference =
      trade.type === "sell"
        ? trade.entryPrice - currentPriceForPair
        : currentPriceForPair - trade.entryPrice;

    const units = trade.amount * 200.0;
    const pnl = priceDifference * units;

    return parseFloat(pnl.toFixed(2));
  };

  const handleTrade = async (type: "buy" | "sell"): Promise<void> => {
    try {
      const token = localStorage.getItem("token");
      const positionSize = lotsToUnits(tradeForm.lotSize);

      if (positionSize > balance) {
        notifications.show({
          title: "Error",
          message: "Insufficient balance",
          color: "red",
        });
        return;
      }

      const currentPriceForPair = currentPair ? pairPrices[currentPair] : 0;

      const response = await axios.post(
        `${API_URL}/api/trading/trade`,
        {
          ...tradeForm,
          type,
          symbol: currentPair,
          entryPrice: currentPriceForPair,
          price: currentPriceForPair,
          amount: positionSize,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      notifications.show({
        title: "Success",
        message: "Trade opened successfully",
        color: "green",
      });
      fetchUserData();
      fetchTrades();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to create trade",
        color: "red",
      });
    }
  };

  const handleCloseTrade = async (trade: Trade): Promise<void> => {
    try {
      const token = localStorage.getItem("token");

      const fetchTrade = await axios.get(`${API_URL}/api/trading/trades/open`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const selectedTrade = fetchTrade.data.find((t) => t._id === trade);
      if (!selectedTrade) {
        console.error("Trade not found");
        return;
      }

      // Используем цену конкретной пары при закрытии трейда
      const currentPriceForPair = pairPrices[selectedTrade.symbol] || 0;
      const pnl = calculatePNL(selectedTrade);

      await axios.post(
        `${API_URL}/api/trading/trade/${trade}/close`,
        {
          pnl,
          exitPrice: currentPriceForPair,
          lotSize: selectedTrade.lotSize,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      notifications.show({
        title: "Success",
        message: "Trade closed successfully",
        color: "green",
      });

      fetchUserData();
      fetchTrades();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to close trade",
        color: "red",
      });
    }
  };

  useEffect(() => {
    fetchUserData();
    fetchTrades();
  }, []);

  return (
    <Container size="xl" mt="md">
      <Paper shadow="sm" radius="md" p="md">
        <Group justify="space-between" mb="md">
          <Title order={2}>Forex Trading</Title>
          <Text>
            Current Rate: $
            {formatPrice(currentPair ? pairPrices[currentPair] : 0)}
          </Text>
        </Group>
        <Grid>
          <Grid.Col span={4}>
            <Card shadow="sm" radius="md" p="md" mb="md">
              <Title order={4}>Demo Balance - ${balance}</Title>
            </Card>
            <Paper shadow="sm" radius="md" p="md">
              <Stack>
                <NumberInput
                  label="Lot Size"
                  description="1.00 lot = $200 (100.00 = $20,000)"
                  value={tradeForm.lotSize}
                  onChange={(value) =>
                    setTradeForm((prev) => ({
                      ...prev,
                      lotSize: Number(value) || 0,
                    }))
                  }
                  decimalScale={2}
                  min={0.01}
                  max={10000000}
                  step={0.01}
                />

                <div className="space-y-1">
                  <Text size="sm" c="dimmed">
                    Position Size:{" "}
                    {formatNumber(lotsToUnits(tradeForm.lotSize))} USD
                  </Text>
                </div>

                <NumberInput
                  label="Stop Loss"
                  value={tradeForm.stopLoss}
                  onChange={(value) =>
                    setTradeForm((prev) => ({
                      ...prev,
                      stopLoss: Number(value) || 0,
                    }))
                  }
                  min={0}
                  decimalScale={5}
                />

                <NumberInput
                  label="Take Profit"
                  value={tradeForm.takeProfit}
                  onChange={(value) =>
                    setTradeForm((prev) => ({
                      ...prev,
                      takeProfit: Number(value) || 0,
                    }))
                  }
                  min={0}
                  decimalScale={5}
                />

                <Group grow>
                  <Button color="green" onClick={() => handleTrade("buy")}>
                    Buy at $
                    {formatPrice(currentPair ? pairPrices[currentPair] : 0)}
                  </Button>
                  <Button color="red" onClick={() => handleTrade("sell")}>
                    Sell at $
                    {formatPrice(currentPair ? pairPrices[currentPair] : 0)}
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>
          <Grid.Col span={8}>
            <Select
              label="Выбор валютной пары"
              placeholder="Выбор"
              data={["FX:EURUSD", "FX:USDCHF", "TVC:GOLD"]}
              value={currentPair}
              onChange={(value) => value && setCurrentPair(value)}
            />
            <TradingViewChart ticket={currentPair} />
          </Grid.Col>
        </Grid>
      </Paper>

      <Paper shadow="sm" radius="md" p="md" mt="md">
        <Title order={3} mb="md">
          Open Positions
        </Title>
        <Table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Amount</th>
              <th>Entry Price</th>
              <th>PNL</th>
              <th>SL/TP</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {trades
              .filter((trade) => trade?.status === "open")
              .map((trade) => (
                <tr key={trade._id}>
                  <td>
                    <Badge color={trade.type === "buy" ? "green" : "red"}>
                      {trade.type?.toUpperCase()}
                    </Badge>
                  </td>
                  <td>{formatNumber(trade.lotSize)}</td>
                  <td>${formatPrice(trade.entryPrice)}</td>
                  <td>
                    <Text c={calculatePNL(trade) >= 0 ? "green" : "red"}>
                      ${formatNumber(Math.abs(calculatePNL(trade)))}
                    </Text>
                  </td>
                  <td>
                    SL: ${formatPrice(trade.stopLoss)} / TP: $
                    {formatPrice(trade.takeProfit)}
                  </td>
                  <td>
                    <ActionIcon
                      color="red"
                      onClick={() => trade._id && handleCloseTrade(trade._id)}
                      disabled={!trade._id}
                    >
                      <X size={16} />
                    </ActionIcon>
                  </td>
                </tr>
              ))}
          </tbody>
        </Table>
      </Paper>
    </Container>
  );
};

export default ForexTradingPage;
