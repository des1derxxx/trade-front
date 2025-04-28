import { useEffect, useState, useRef } from "react";
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
  Modal,
} from "@mantine/core";
import { X, Pencil } from "lucide-react";
import { notifications } from "@mantine/notifications";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import TradingViewChart from "../components/TradingViewChart";
import TechnicalAnalysisWidget from "../components/TechnicalAnalysisWidget";

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
  liquidationPrice: number;
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
  const [pairPrices, setPairPrices] = useState<PairPrices>({
    "FX:EURUSD": 0,
    "FX:USDCHF": 0,
    "TVC:GOLD": 0,
  });
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // Состояние открытия/закрытия
  const [trades, setTrades] = useState<Trade[]>([]);
  const [balance, setBalance] = useState<number>(10000);
  const [editingSLTP, setEditingSLTP] = useState(false);
  const [currentTradeId, setCurrentTradeId] = useState(null);
  const [slTPForm, setSLTPForm] = useState({
    stopLoss: 0,
    takeProfit: 0,
    symbol: "",
    type: "buy",
  });
  const [tradeForm, setTradeForm] = useState<TradeFormData>({
    symbol: "EURUSD",
    type: "buy",
    lotSize: 10,
    price: 0,
    stopLoss: 0,
    takeProfit: 0,
    amount: 0,
  });
  const [currentTradeType, setCurrentTradeType] = useState<"buy" | "sell">(
    "buy"
  );

  // Reference to store the interval ID for position updates
  const positionUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

      // If any price is valid, mark prices as loaded
      if (Object.values(priceMap).some((price) => price > 0)) {
        setPricesLoaded(true);
      }

      // Обновляем форму только для текущей выбранной пары
      if (currentPair && priceMap[currentPair]) {
        setTradeForm((prev) => ({
          ...prev,
          price: priceMap[currentPair],
        }));
      }
    });

    const timeoutId = setTimeout(() => {
      if (!pricesLoaded) {
        notifications.show({
          title: "Warning",
          message:
            "Prices taking longer than expected to load. Please check your connection.",
          color: "yellow",
        });
      }
    }, 10000); // 10 seconds timeout

    return () => {
      clearTimeout(timeoutId);
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
  const lotsToUnits = (lots: number, symbol: string = "FX:EURUSD"): number => {
    if (!lots) return 0;

    // Базовое значение для стандартных пар
    let lotFactor = 200.0;

    // Специфические настройки для разных инструментов
    if (symbol === "TVC:GOLD") {
      lotFactor = 200.0; // Для золота можно установить другой коэффициент
    }

    return lots * lotFactor;
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

  const handleEditSLTP = (trade) => {
    setCurrentTradeId(trade);
    const selectedTrade = trades.find((t) => t._id === trade);

    if (selectedTrade) {
      setSLTPForm({
        stopLoss: selectedTrade.stopLoss || 0,
        takeProfit: selectedTrade.takeProfit || 0,
        symbol: selectedTrade.symbol,
        type: selectedTrade.type,
      });
      setEditingSLTP(true);
    }
  };

  const validateSLTPEdits = () => {
    const selectedTrade = trades.find((t) => t._id === currentTradeId);
    if (!selectedTrade) return false;

    const currentPriceForPair = pairPrices[selectedTrade.symbol] || 0;

    // Validate Stop Loss if set
    if (slTPForm.stopLoss !== 0) {
      if (
        selectedTrade.type === "buy" &&
        slTPForm.stopLoss >= currentPriceForPair
      ) {
        notifications.show({
          title: "Error",
          message:
            "Stop Loss for LONG positions must be set below the current price",
          color: "red",
        });
        return false;
      }
      if (
        selectedTrade.type === "sell" &&
        slTPForm.stopLoss <= currentPriceForPair
      ) {
        notifications.show({
          title: "Error",
          message:
            "Stop Loss for SHORT positions must be set above the current price",
          color: "red",
        });
        return false;
      }
    }

    // Validate Take Profit if set
    if (slTPForm.takeProfit !== 0) {
      if (
        selectedTrade.type === "buy" &&
        slTPForm.takeProfit <= currentPriceForPair
      ) {
        notifications.show({
          title: "Error",
          message:
            "Take Profit for LONG positions must be set above the current price",
          color: "red",
        });
        return false;
      }
      if (
        selectedTrade.type === "sell" &&
        slTPForm.takeProfit >= currentPriceForPair
      ) {
        notifications.show({
          title: "Error",
          message:
            "Take Profit for SHORT positions must be set below the current price",
          color: "red",
        });
        return false;
      }
    }

    return true;
  };

  const saveSLTPChanges = async () => {
    try {
      if (!validateSLTPEdits()) return;

      const token = localStorage.getItem("token");
      await axios.put(
        `${API_URL}/api/trading/trades/${currentTradeId}/sl-tp`,
        {
          stopLoss: slTPForm.stopLoss,
          takeProfit: slTPForm.takeProfit,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      notifications.show({
        title: "Success",
        message: "Stop Loss and Take Profit updated successfully",
        color: "green",
        autoClose: 3000,
      });

      setEditingSLTP(false);
      fetchTrades();
    } catch (error) {
      console.error("Error updating SL/TP:", error);
      notifications.show({
        title: "Error",
        message: "Failed to update Stop Loss and Take Profit",
        color: "red",
        autoClose: 3000,
      });
    }
  };

  // Add these helper functions to improve UX
  const getMarketPrice = (symbol) => {
    return pairPrices[symbol] || 0;
  };

  const getStopLossLabel = (type) => {
    return type === "buy"
      ? "Stop Loss (set below current price)"
      : "Stop Loss (set above current price)";
  };

  const getTakeProfitLabel = (type) => {
    return type === "buy"
      ? "Take Profit (set above current price)"
      : "Take Profit (set below current price)";
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
    if (!trade || !trade.entryPrice || !trade.lotSize) {
      return 0;
    }

    // Get current price for the specific trading pair
    const currentPriceForPair = pairPrices[trade.symbol] || 0;
    if (currentPriceForPair === 0) return 0;

    // Define pip values and multipliers based on instrument type
    const pipSettings = {
      "FX:EURUSD": { pipDecimalPlace: 4, pipValue: 10, lotSize: 200 },
      "FX:USDCHF": { pipDecimalPlace: 4, pipValue: 10, lotSize: 200 },
      "TVC:GOLD": { pipDecimalPlace: 2, pipValue: 0.1, lotSize: 100 },
    };

    // Get settings for current instrument or use default forex settings
    const settings = pipSettings[trade.symbol] || {
      pipDecimalPlace: 4,
      pipValue: 10,
      lotSize: 200,
    };

    // Calculate pip size (e.g., 0.0001 for 4 decimal place currencies)
    const pipSize = Math.pow(10, -settings.pipDecimalPlace);

    // Calculate price difference in terms of pips
    const priceDifference =
      trade.type === "buy"
        ? currentPriceForPair - trade.entryPrice
        : trade.entryPrice - currentPriceForPair;

    const pipsCount = priceDifference / pipSize;

    // Calculate standard lot value (1.0 lot = 100,000 units for most forex pairs)
    const standardLotValue = settings.lotSize * trade.lotSize;

    // Calculate pip value in account currency
    // For pairs where USD is the quote currency (like EUR/USD), pip value is fixed
    // For other pairs, we'd need to adjust based on the current exchange rate to USD
    let pipValueInUSD = settings.pipValue * trade.lotSize;

    // Calculate final PNL
    const pnl = pipsCount * pipValueInUSD;

    // Account for leverage if applicable
    // const leverageMultiplier = trade.leverage || 1;
    // const pnlWithLeverage = pnl * leverageMultiplier;

    // Round to 2 decimal places for display
    return parseFloat(pnl.toFixed(2));
  };
  // Validation for stop loss and take profit based on trade type
  const validateStopLoss = (value: number, type: "buy" | "sell"): boolean => {
    // Return true if stop loss is disabled
    if (value === 0) return true;

    const currentPriceForPair = currentPair ? pairPrices[currentPair] : 0;

    if (type === "buy") {
      // For buy/long positions, stop loss should be below entry price
      return value < currentPriceForPair;
    } else {
      // For sell/short positions, stop loss should be above entry price
      return value > currentPriceForPair;
    }
  };

  const validateTakeProfit = (value: number, type: "buy" | "sell"): boolean => {
    // Return true if take profit is disabled
    if (value === 0) return true;

    const currentPriceForPair = currentPair ? pairPrices[currentPair] : 0;

    if (type === "buy") {
      // For buy/long positions, take profit should be above entry price
      return value > currentPriceForPair;
    } else {
      // For sell/short positions, take profit should be below entry price
      return value < currentPriceForPair;
    }
  };

  const handleStopLossChange = (value: number): void => {
    // Always update the value first to enable user input
    setTradeForm((prev) => ({ ...prev, stopLoss: value }));

    // Skip validation if value is 0 (disabled)
    if (value === 0) return;

    // Only show warning notification if needed, but don't block input
    const currentPriceForPair = currentPair ? pairPrices[currentPair] : 0;

    if (currentTradeType === "buy" && value >= currentPriceForPair) {
      notifications.show({
        title: "Warning - Stop Loss",
        message:
          "For LONG positions, stop loss is typically set below the entry price",
        color: "yellow",
      });
    } else if (currentTradeType === "sell" && value <= currentPriceForPair) {
      notifications.show({
        title: "Warning - Stop Loss",
        message:
          "For SHORT positions, stop loss is typically set above the entry price",
        color: "yellow",
      });
    }
  };

  const handleTakeProfitChange = (value: number): void => {
    // Always update the value first to enable user input
    setTradeForm((prev) => ({ ...prev, takeProfit: value }));

    // Skip validation if value is 0 (disabled)
    if (value === 0) return;

    // Only show warning notification if needed, but don't block input
    const currentPriceForPair = currentPair ? pairPrices[currentPair] : 0;

    if (currentTradeType === "buy" && value <= currentPriceForPair) {
      notifications.show({
        title: "Warning - Take Profit",
        message:
          "For LONG positions, take profit is typically set above the entry price",
        color: "yellow",
      });
    } else if (currentTradeType === "sell" && value >= currentPriceForPair) {
      notifications.show({
        title: "Warning - Take Profit",
        message:
          "For SHORT positions, take profit is typically set below the entry price",
        color: "yellow",
      });
    }
  };

  const handleTrade = async (type: "buy" | "sell"): Promise<void> => {
    try {
      const token = localStorage.getItem("token");
      const positionSize = lotsToUnits(tradeForm.lotSize);
      const currentPriceForPair = currentPair ? pairPrices[currentPair] : 0;

      // Strict validation for stop loss and take profit
      // If SL is set, it must be valid
      if (
        tradeForm.stopLoss !== 0 &&
        !validateStopLoss(tradeForm.stopLoss, type)
      ) {
        notifications.show({
          title: "Error",
          message:
            type === "buy"
              ? "Stop Loss for LONG positions must be set below the entry price"
              : "Stop Loss for SHORT positions must be set above the entry price",
          color: "red",
        });
        return; // Prevent trade execution
      }

      // If TP is set, it must be valid
      if (
        tradeForm.takeProfit !== 0 &&
        !validateTakeProfit(tradeForm.takeProfit, type)
      ) {
        notifications.show({
          title: "Error",
          message:
            type === "buy"
              ? "Take Profit for LONG positions must be set above the entry price"
              : "Take Profit for SHORT positions must be set below the entry price",
          color: "red",
        });
        return; // Prevent trade execution
      }

      if (positionSize > balance) {
        notifications.show({
          title: "Error",
          message: "Insufficient balance",
          color: "red",
        });
        return;
      }

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

      // Используем обновленный расчет PNL
      const pnl = calculatePNL(selectedTrade);

      // Получаем текущую цену для пары
      const currentPriceForPair = pairPrices[selectedTrade.symbol] || 0;

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
  // Function to check for SL/TP hits and update positions
  const checkPositionsForSLTP = async () => {
    try {
      // Only process if we have open trades
      if (trades.filter((trade) => trade.status === "open").length === 0)
        return;

      const token = localStorage.getItem("token");
      const openTrades = await axios.get(`${API_URL}/api/trading/trades/open`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // For each open trade, check if SL or TP has been hit
      for (const trade of openTrades.data) {
        if (trade.status !== "open") continue;

        const currentPriceForPair = pairPrices[trade.symbol] || 0;
        if (currentPriceForPair === 0) continue;

        // Check for stop loss hit
        if (
          trade.stopLoss &&
          ((trade.type === "buy" && currentPriceForPair <= trade.stopLoss) ||
            (trade.type === "sell" && currentPriceForPair >= trade.stopLoss))
        ) {
          await handleCloseTrade(trade._id);
          notifications.show({
            title: "Stop Loss Hit",
            message: `Position ${
              trade.symbol
            } closed at stop loss price of ${formatPrice(trade.stopLoss)}`,
            color: "red",
            autoClose: 5000,
          });
          continue; // Skip to next trade
        }

        // Check for take profit hit
        if (
          trade.takeProfit &&
          ((trade.type === "buy" && currentPriceForPair >= trade.takeProfit) ||
            (trade.type === "sell" && currentPriceForPair <= trade.takeProfit))
        ) {
          await handleCloseTrade(trade._id);
          notifications.show({
            title: "Take Profit Hit",
            message: `Position ${
              trade.symbol
            } closed at take profit price of ${formatPrice(trade.takeProfit)}`,
            color: "green",
            autoClose: 5000,
          });
        }
      }

      // Refresh trades list after checking
      fetchTrades();
    } catch (error) {
      console.error("Error checking positions:", error);
    }
  };

  // Set up initial data fetching and position checking interval
  useEffect(() => {
    fetchUserData();
    fetchTrades();

    // Set up interval to refresh open positions and check for SL/TP hits
    if (positionUpdateIntervalRef.current === null) {
      positionUpdateIntervalRef.current = setInterval(() => {
        fetchTrades();
        checkPositionsForSLTP();
      }, 10000); // Check every 10 seconds
    }

    // Clean up interval on component unmount
    return () => {
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
        positionUpdateIntervalRef.current = null;
      }
    };
  }, []);

  // Update positions check when prices change
  useEffect(() => {
    // Only run check if we have prices and trades
    if (
      Object.values(pairPrices).some((price) => price > 0) &&
      trades.filter((trade) => trade.status === "open").length > 0
    ) {
      checkPositionsForSLTP();
    }
  }, [pairPrices]);

  if (!pricesLoaded) {
    return (
      <div className="bg-black text-white min-h-screen flex flex-col justify-between">
        <div className="mx-8 pt-6">
          <div className="rounded-lg border border-cyan-500 bg-gradient-to-r from-purple-900/20 to-cyan-900/20 p-6 shadow-lg shadow-cyan-500/20">
            <div className="flex justify-between mb-8">
              <Text className="text-3xl font-bold text-white">
                FOREX TRADING
              </Text>
              <Badge className="bg-gradient-to-r from-pink-600 to-cyan-600 text-white px-3 py-1 rounded">
                DEMO
              </Badge>
            </div>

            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-4">
                <div className="w-16 h-16 border-4 border-t-cyan-500 border-r-transparent border-b-purple-500 border-l-transparent rounded-full animate-spin"></div>
              </div>
              <Text className="text-xl font-medium text-cyan-400 mb-2">
                Loading Trading Platform
              </Text>
              <Text className="text-gray-400">
                Connecting to market data...
              </Text>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-between">
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
              <div className="rounded-lg border border-green-500 bg-gradient-to-r from-green-500/20 to-cyan-500/20 p-4 mb-6 shadow-lg shadow-green-500/20">
                <Text className="text-xl text-green-400">
                  <span className="text-green-500 font-bold">BALANCE: </span> $
                  {balance}
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
                      <span className="text-cyan-500 font-bold">
                        POSITION SIZE:
                      </span>{" "}
                      {formatNumber(lotsToUnits(tradeForm.lotSize))} USD
                    </Text>
                  </div>
                  <div>
                    <Text className="text-pink-500 font-bold mb-1">
                      STOP LOSS{" "}
                      {currentTradeType === "buy"
                        ? "(LOWER PRICE)"
                        : "(HIGHER PRICE)"}
                    </Text>
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full bg-black border border-cyan-500 rounded px-3 py-2 text-cyan-400"
                        value={tradeForm.stopLoss}
                        onChange={(e) =>
                          handleStopLossChange(Number(e.target.value) || 0)
                        }
                        min={0}
                        step={0.00001}
                      />
                      <div className="absolute right-8 top-2">
                        <span className="text-xs text-gray-400">
                          {currentPair
                            ? formatPrice(pairPrices[currentPair])
                            : "0.00"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <Text className="text-xs text-gray-400">
                        Set to 0 to disable
                      </Text>
                      <div className="flex gap-2">
                        <button
                          className="text-xs bg-green-900/30 text-green-400 border border-green-500 px-2 py-1 rounded"
                          onClick={() => {
                            const currentPriceForPair = currentPair
                              ? pairPrices[currentPair]
                              : 0;
                            const offset = currentPriceForPair * 0.001; // 1% offset
                            const newValue = currentPriceForPair - offset;
                            handleStopLossChange(
                              parseFloat(newValue.toFixed(5))
                            );
                          }}
                        >
                          Auto Set Long
                        </button>
                        <button
                          className="text-xs bg-pink-900/30 text-pink-400 border border-pink-500 px-2 py-1 rounded"
                          onClick={() => {
                            const currentPriceForPair = currentPair
                              ? pairPrices[currentPair]
                              : 0;
                            const offset = currentPriceForPair * 0.001; // 1% offset
                            const newValue = currentPriceForPair + offset;
                            handleStopLossChange(
                              parseFloat(newValue.toFixed(5))
                            );
                          }}
                        >
                          Auto Set Short
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Text className="text-cyan-400 font-bold mb-1">
                      TAKE PROFIT{" "}
                      {currentTradeType === "buy"
                        ? "(HIGHER PRICE)"
                        : "(LOWER PRICE)"}
                    </Text>
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full bg-black border border-cyan-500 rounded px-3 py-2 text-cyan-400"
                        value={tradeForm.takeProfit}
                        onChange={(e) =>
                          handleTakeProfitChange(Number(e.target.value) || 0)
                        }
                        min={0}
                        step={0.00001}
                      />
                      <div className="absolute right-8 top-2">
                        <span className="text-xs text-gray-400">
                          {currentPair
                            ? formatPrice(pairPrices[currentPair])
                            : "0.00"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <Text className="text-xs text-gray-400">
                        Set to 0 to disable
                      </Text>
                      <div className="flex gap-2">
                        <button
                          className="text-xs bg-green-900/30 text-green-400 border border-green-500 px-2 py-1 rounded"
                          onClick={() => {
                            const currentPriceForPair = currentPair
                              ? pairPrices[currentPair]
                              : 0;
                            const offset = currentPriceForPair * 0.002; // 2% offset
                            const newValue = currentPriceForPair + offset;
                            handleTakeProfitChange(
                              parseFloat(newValue.toFixed(5))
                            );
                          }}
                        >
                          Auto Set Long
                        </button>
                        <button
                          className="text-xs bg-pink-900/30 text-pink-400 border border-pink-500 px-2 py-1 rounded"
                          onClick={() => {
                            const currentPriceForPair = currentPair
                              ? pairPrices[currentPair]
                              : 0;
                            const offset = currentPriceForPair * 0.002; // 2% offset
                            const newValue = currentPriceForPair - offset;
                            handleTakeProfitChange(
                              parseFloat(newValue.toFixed(5))
                            );
                          }}
                        >
                          Auto Set Short
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <button
                      className="bg-gradient-to-r from-cyan-900 to-cyan-600 text-white py-2 px-4 rounded border border-cyan-500 shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/40"
                      onClick={() => {
                        setCurrentTradeType("buy");
                        handleTrade("buy");
                      }}
                    >
                      LONG @ $
                      {formatPrice(currentPair ? pairPrices[currentPair] : 0)}
                    </button>
                    <button
                      className="bg-gradient-to-r from-pink-900 to-pink-600 text-white py-2 px-4 rounded border border-pink-500 shadow-md shadow-pink-500/20 hover:shadow-lg hover:shadow-pink-500/40"
                      onClick={() => {
                        setCurrentTradeType("sell");
                        handleTrade("sell");
                      }}
                    >
                      SHORT @ $
                      {formatPrice(currentPair ? pairPrices[currentPair] : 0)}
                    </button>
                  </div>
                </div>
                <div className="pt-10">
                  <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="px-4 py-2 bg-blue-500 text-white rounded"
                  >
                    {isOpen ? "Закрыть виджет" : "Открыть виджет"}
                  </button>

                  {isOpen && (
                    <div className="mt-4">
                      <TechnicalAnalysisWidget symbol={currentPair} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Chart */}
            <div className="lg:col-span-8">
              <div className="rounded-lg border border-cyan-500 bg-gradient-to-r from-purple-900/20 to-cyan-900/20 p-4 mb-6 shadow-lg shadow-cyan-500/20">
                <select
                  className="w-full bg-black border border-pink-500 rounded px-3 py-2 text-cyan-400 mb-4"
                  value={currentPair}
                  onChange={(e) => {
                    if (e.target.value) {
                      setCurrentPair(e.target.value);
                      // Reset stop loss and take profit when changing pairs
                      setTradeForm((prev) => ({
                        ...prev,
                        stopLoss: 0,
                        takeProfit: 0,
                      }));
                    }
                  }}
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
        <div className="mt-8 mb-5">
          <div className="flex justify-between items-center mb-6">
            <Text className="text-3xl font-bold text-white">
              OPEN POSITIONS
            </Text>
            <button
              className="bg-gradient-to-r from-cyan-900 to-cyan-600 text-white py-1 px-3 rounded border border-cyan-500 shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/40"
              onClick={() => {
                fetchTrades();
                checkPositionsForSLTP();
                notifications.show({
                  title: "Refreshed",
                  message: "Positions updated",
                  color: "blue",
                  autoClose: 2000,
                });
              }}
            >
              Refresh Positions
            </button>
          </div>
          <div className="rounded-lg border border-cyan-500 bg-gradient-to-r from-purple-900/20 to-cyan-900/20 p-2 shadow-lg shadow-cyan-500/20 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-cyan-500/30">
                  <th className="px-4 py-3 text-left text-cyan-400">TYPE</th>
                  <th className="px-4 py-3 text-left text-cyan-400">PAIR</th>
                  <th className="px-4 py-3 text-left text-cyan-400">SIZE</th>
                  <th className="px-4 py-3 text-left text-cyan-400">ENTRY</th>
                  <th className="px-4 py-3 text-left text-cyan-400">CURRENT</th>
                  <th className="px-4 py-3 text-left text-cyan-400">PNL</th>
                  <th className="px-4 py-3 text-left text-cyan-400">SL/TP</th>
                  <th className="px-4 py-3 text-left text-cyan-400">
                    Liqudation
                  </th>
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
                      <td className="px-4 py-3">{trade.symbol}</td>
                      <td className="px-4 py-3 text-white">
                        {formatNumber(trade.lotSize)}
                      </td>
                      <td className="px-4 py-3 text-white">
                        ${formatPrice(trade.entryPrice)}
                      </td>
                      <td className="px-4 py-3 text-white">
                        $
                        {formatPrice(
                          trade.symbol ? pairPrices[trade.symbol] : 0
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          calculatePNL(trade) >= 0
                            ? "text-cyan-400"
                            : "text-pink-500"
                        }`}
                      >
                        $
                        {calculatePNL(trade) >= 0
                          ? formatNumber(Math.abs(calculatePNL(trade)))
                          : `-${formatNumber(Math.abs(calculatePNL(trade)))}`}
                      </td>
                      <td className="px-4 py-3 text-white flex items-center space-x-2">
                        <div>
                          <span className="text-pink-500 font-bold">SL:</span> $
                          {formatPrice(trade.stopLoss)} /
                          <span className="text-cyan-400 font-bold"> TP:</span>{" "}
                          ${formatPrice(trade.takeProfit)}
                        </div>
                        <button
                          className="bg-yellow-900/50 text-yellow-400 border border-yellow-500 p-1 rounded hover:bg-yellow-800/50"
                          onClick={() => handleEditSLTP(trade._id)}
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                      <td className="px-4 py-3">${trade.liquidationPrice}</td>
                      <td className="px-4 py-3">
                        <button
                          className="bg-pink-900/50 text-pink-400 border border-pink-500 p-1 rounded hover:bg-pink-800/50"
                          onClick={() => handleCloseTrade(trade._id)}
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
        </div>{" "}
        <Modal
          opened={editingSLTP}
          onClose={() => setEditingSLTP(false)}
          title={
            <Text className="text-cyan-400 font-bold">
              Edit Stop Loss and Take Profit
            </Text>
          }
          classNames={{
            content: "bg-gray-900 border border-cyan-500",
            title: "text-cyan-400 font-bold",
          }}
        >
          <div className="space-y-4">
            {/* Display current market price */}
            {currentTradeId && (
              <div className="flex justify-between mb-4">
                <Text className="text-white">Current Market Price:</Text>
                <Text className="text-white font-bold">
                  ${formatPrice(getMarketPrice(slTPForm.symbol))}
                </Text>
              </div>
            )}

            <NumberInput
              label={
                <span className="text-pink-500 font-bold">
                  {getStopLossLabel(slTPForm.type)}
                </span>
              }
              value={slTPForm.stopLoss}
              onChange={(value) =>
                setSLTPForm((prev) => ({
                  ...prev,
                  stopLoss: parseFloat(value),
                }))
              }
              precision={5}
              step={0.00001}
              className="mb-3"
            />

            <NumberInput
              label={
                <span className="text-cyan-400 font-bold">
                  {getTakeProfitLabel(slTPForm.type)}
                </span>
              }
              value={slTPForm.takeProfit}
              onChange={(value) =>
                setSLTPForm((prev) => ({
                  ...prev,
                  takeProfit: parseFloat(value),
                }))
              }
              precision={5}
              step={0.00001}
            />

            <Group position="right" className="mt-6">
              <Button
                className="bg-pink-900 text-pink-400 border border-pink-500 hover:bg-pink-800"
                onClick={() => setEditingSLTP(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-cyan-900 text-cyan-400 border border-cyan-500 hover:bg-cyan-800"
                onClick={saveSLTPChanges}
              >
                Save Changes
              </Button>
            </Group>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ForexTradingPage;
