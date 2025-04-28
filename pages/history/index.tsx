import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Container,
  Title,
  Table,
  Card,
  Text,
  Group,
  Badge,
  Loader,
} from "@mantine/core";
import axios from "axios";

interface User {
  username: string;
  demoBalance: number;
  group: number;
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

const TradeHistoryPage = () => {
  const [userData, setUserData] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userTrades, setUserTrades] = useState<Trade[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedToken =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    setToken(storedToken);

    const storedUser = localStorage.getItem("user");
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
      const response = await axios.get<User>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/${username}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setUserData(response.data);
    } catch (error) {
      console.error("Ошибка при загрузке данных пользователя", error);
    }
  };

  const fetchTradeData = async () => {
    try {
      const response = await axios.get<Trade[]>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/trading/trades`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setUserTrades(response.data);
    } catch (error) {
      console.error("Ошибка при загрузке истории трейдинга", error);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-between">
      {/* User Info Card */}
      {userData ? (
        <div className="mx-8 mt-8 rounded-lg border border-cyan-500 bg-gradient-to-r from-purple-900/20 to-cyan-900/20 p-6 shadow-lg shadow-cyan-500/20">
          <Group className="flex justify-between">
            <Text className="text-xl text-white font-bold"></Text>
            <Badge className="bg-gradient-to-r from-pink-600 to-cyan-600 text-white px-3 py-1 rounded">
              GROUP {userData.group}
            </Badge>
          </Group>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Text className="text-cyan-400">
              <span className="text-pink-500 font-bold">USER:</span>{" "}
              {userData.username}
            </Text>
            <Text className="text-cyan-400">
              <span className="text-pink-500 font-bold">BALANCE:</span> $
              {userData.demoBalance.toFixed(2)}
            </Text>
          </div>
          <div className="mt-6"></div>
        </div>
      ) : (
        <Loader className="text-cyan-500 mx-auto mt-8" size="lg" />
      )}

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
                  ? "border border-cyan-500 text-cyan-500"
                  : "border border-pink-500 text-pink-500"
              }`}
            >
              <span>{item.charAt(0)}</span>
            </div>
            <Text className="text-xs mt-2 text-gray-400">{item}</Text>
          </div>
        ))}
      </div>

      {/* PROJECTS Section */}
      <div className="flex justify-between mx-8 mb-6">
        <Text className="text-3xl font-bold text-white">TRADES</Text>
      </div>

      {/* Trade History Table */}
      {userTrades ? (
        <div className="mx-8 overflow-x-auto rounded-lg border border-cyan-500 bg-gradient-to-r from-purple-900/20 to-cyan-900/20 p-2 shadow-lg shadow-cyan-500/20">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-cyan-500/30">
                <th className="px-4 py-3 text-left text-cyan-400">SYMBOL</th>
                <th className="px-4 py-3 text-left text-cyan-400">TYPE</th>
                <th className="px-4 py-3 text-left text-cyan-400">AMOUNT</th>
                <th className="px-4 py-3 text-left text-cyan-400">ENTRY</th>
                <th className="px-4 py-3 text-left text-cyan-400">EXIT</th>
                <th className="px-4 py-3 text-left text-cyan-400">PROFIT</th>
                <th className="px-4 py-3 text-left text-cyan-400">STATUS</th>
                <th className="px-4 py-3 text-left text-cyan-400">OPENED</th>
                <th className="px-4 py-3 text-left text-cyan-400">CLOSED</th>
              </tr>
            </thead>
            <tbody>
              {userTrades.map((trade) => {
                const profitPercentage = trade.profit
                  ? (
                      (trade.profit / (trade.entryPrice * trade.amount)) *
                      100
                    ).toFixed(2)
                  : "0.00";

                return (
                  <tr
                    key={trade._id}
                    className="border-b border-cyan-500/10 hover:bg-cyan-900/20"
                  >
                    <td className="px-4 py-3 text-pink-400 font-bold">
                      {trade.symbol}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {trade.type === "buy" ? (
                        <span className="text-cyan-400">LONG</span>
                      ) : (
                        <span className="text-pink-500">SHORT</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white">{trade.amount}</td>
                    <td className="px-4 py-3 text-white">
                      ${trade.entryPrice.toFixed(5)}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {trade.exitPrice ? `$${trade.exitPrice.toFixed(5)}` : "-"}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        trade.profit && trade.profit >= 0
                          ? "text-cyan-400"
                          : "text-pink-500"
                      }`}
                    >
                      {trade.profit
                        ? `$${trade.profit.toFixed(2)} (${profitPercentage}%)`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`px-2 py-1 rounded ${
                          trade.status === "closed"
                            ? "bg-cyan-900/50 text-cyan-400 border border-cyan-500"
                            : "bg-pink-900/50 text-pink-400 border border-pink-500"
                        }`}
                      >
                        {trade.status === "closed" ? "CLOSED" : "ACTIVE"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(trade.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {trade.status === "closed" && trade.updatedAt
                        ? new Date(trade.updatedAt).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Loader className="text-cyan-500 mx-auto mt-8" size="lg" />
      )}
    </div>
  );
};

export default TradeHistoryPage;
