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
    <div className="bg-black text-white min-h-screen">
      <div className="mx-8 pt-6">
        <div className="rounded-lg border border-cyan-500 bg-gradient-to-r from-purple-900/20 to-cyan-900/20 p-6 shadow-lg shadow-cyan-500/20">
          <div className="flex justify-between">
            <Text className="text-3xl font-bold text-white">FOREX TRADING</Text>
            <Badge className="bg-gradient-to-r from-pink-600 to-cyan-600 text-white px-3 py-1 rounded">
              RATE: ${formatPrice(currentPair ? pairPrices[currentPair] : 0)}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            {/* Left Column - Trading Controls */}
            <div className="lg:col-span-4">
              <div className="rounded-lg border border-pink-500 bg-gradient-to-r from-purple-900/20 to-cyan-900/20 p-4 mb-6 shadow-lg shadow-pink-500/20">
                <Text className="text-xl text-cyan-400">
                  <span className="text-pink-500 font-bold">DEMO BALANCE:</span>{" "}
                  ${balance}
                </Text>
              </div>

              <div className="rounded-lg border border-cyan-500 bg-gradient-to-r from-purple-900/20 to-cyan-900/20 p-4 shadow-lg shadow-cyan-500/20">
                <div className="space-y-4">
                  <div>
                    <Text className="text-pink-500 font-bold mb-1">
                      LOT SIZE
                    </Text>
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full bg-black border border-cyan-500 rounded px-3 py-2 text-cyan-400"
                        value={tradeForm.lotSize}
                        onChange={(e) =>
                          setTradeForm((prev) => ({
                            ...prev,
                            lotSize: Number(e.target.value) || 0,
                          }))
                        }
                        min={0.01}
                        max={10000000}
                        step={0.01}
                      />
                    </div>
                    <Text className="text-xs mt-1 text-gray-400">
                      1.00 lot = $200 (100.00 = $20,000)
                    </Text>
                  </div>

                  <div className="space-y-1">
                    <Text className="text-cyan-400">
                      <span className="text-pink-500 font-bold">
                        POSITION SIZE:
                      </span>{" "}
                      {formatNumber(lotsToUnits(tradeForm.lotSize))} USD
                    </Text>
                  </div>

                  <div>
                    <Text className="text-pink-500 font-bold mb-1">
                      STOP LOSS
                    </Text>
                    <input
                      type="number"
                      className="w-full bg-black border border-cyan-500 rounded px-3 py-2 text-cyan-400"
                      value={tradeForm.stopLoss}
                      onChange={(e) =>
                        setTradeForm((prev) => ({
                          ...prev,
                          stopLoss: Number(e.target.value) || 0,
                        }))
                      }
                      min={0}
                      step={0.00001}
                    />
                  </div>

                  <div>
                    <Text className="text-pink-500 font-bold mb-1">
                      TAKE PROFIT
                    </Text>
                    <input
                      type="number"
                      className="w-full bg-black border border-cyan-500 rounded px-3 py-2 text-cyan-400"
                      value={tradeForm.takeProfit}
                      onChange={(e) =>
                        setTradeForm((prev) => ({
                          ...prev,
                          takeProfit: Number(e.target.value) || 0,
                        }))
                      }
                      min={0}
                      step={0.00001}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <button
                      className="bg-gradient-to-r from-cyan-900 to-cyan-600 text-white py-2 px-4 rounded border border-cyan-500 shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/40"
                      onClick={() => handleTrade("buy")}
                    >
                      LONG @ $
                      {formatPrice(currentPair ? pairPrices[currentPair] : 0)}
                    </button>
                    <button
                      className="bg-gradient-to-r from-pink-900 to-pink-600 text-white py-2 px-4 rounded border border-pink-500 shadow-md shadow-pink-500/20 hover:shadow-lg hover:shadow-pink-500/40"
                      onClick={() => handleTrade("sell")}
                    >
                      SHORT @ $
                      {formatPrice(currentPair ? pairPrices[currentPair] : 0)}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Chart */}
            <div className="lg:col-span-8">
              <div className="rounded-lg border border-cyan-500 bg-gradient-to-r from-purple-900/20 to-cyan-900/20 p-4 mb-6 shadow-lg shadow-cyan-500/20">
                <select
                  className="w-full bg-black border border-pink-500 rounded px-3 py-2 text-cyan-400 mb-4"
                  value={currentPair}
                  onChange={(e) =>
                    e.target.value && setCurrentPair(e.target.value)
                  }
                >
                  <option value="">SELECT PAIR</option>
                  <option value="FX:EURUSD">FX:EURUSD</option>
                  <option value="FX:USDCHF">FX:USDCHF</option>
                  <option value="TVC:GOLD">TVC:GOLD</option>
                </select>
                <div className="border border-cyan-500 rounded">
                  <TradingViewChart ticket={currentPair} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Open Positions Table */}
        <div className="mt-8 mb-8">
          <Text className="text-3xl font-bold text-white mb-6">
            OPEN POSITIONS
          </Text>
          <div className="rounded-lg border border-cyan-500 bg-gradient-to-r from-purple-900/20 to-cyan-900/20 p-2 shadow-lg shadow-cyan-500/20 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-cyan-500/30">
                  <th className="px-4 py-3 text-left text-cyan-400">TYPE</th>
                  <th className="px-4 py-3 text-left text-cyan-400">SIZE</th>
                  <th className="px-4 py-3 text-left text-cyan-400">ENTRY</th>
                  <th className="px-4 py-3 text-left text-cyan-400">PNL</th>
                  <th className="px-4 py-3 text-left text-cyan-400">SL/TP</th>
                  <th className="px-4 py-3 text-left text-cyan-400">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {trades
                  .filter((trade) => trade?.status === "open")
                  .map((trade) => (
                    <tr
                      key={trade._id}
                      className="border-b border-cyan-500/10 hover:bg-cyan-900/20"
                    >
                      <td className="px-4 py-3">
                        {trade.type === "buy" ? (
                          <Badge className="bg-cyan-900/50 text-cyan-400 border border-cyan-500 px-2 py-1 rounded">
                            LONG
                          </Badge>
                        ) : (
                          <Badge className="bg-pink-900/50 text-pink-400 border border-pink-500 px-2 py-1 rounded">
                            SHORT
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {formatNumber(trade.lotSize)}
                      </td>
                      <td className="px-4 py-3 text-white">
                        ${formatPrice(trade.entryPrice)}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          calculatePNL(trade) >= 0
                            ? "text-cyan-400"
                            : "text-pink-500"
                        }`}
                      >
                        ${formatNumber(Math.abs(calculatePNL(trade)))}
                      </td>
                      <td className="px-4 py-3 text-white">
                        <span className="text-pink-500 font-bold">SL:</span> $
                        {formatPrice(trade.stopLoss)} /
                        <span className="text-cyan-400 font-bold"> TP:</span> $
                        {formatPrice(trade.takeProfit)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="bg-pink-900/50 text-pink-400 border border-pink-500 p-1 rounded hover:bg-pink-800/50"
                          onClick={() =>
                            trade._id && handleCloseTrade(trade._id)
                          }
                          disabled={!trade._id}
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForexTradingPage;
