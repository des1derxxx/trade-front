import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "@mantine/core";
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
      console.error("Error loading user data", error);
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
      console.error("Error loading trade history", error);
    }
  };

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-700 py-6 px-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-light tracking-widest">TRADE HISTORY</h1>
          {userData && (
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-xs text-gray-400">ACCOUNT</div>
                <div className="font-mono">{userData.username}</div>
              </div>
              <div className="h-8 w-px bg-gray-700"></div>
              <div className="text-right">
                <div className="text-xs text-gray-400">BALANCE</div>
                <div className="font-mono">
                  ${userData.demoBalance.toFixed(2)}
                </div>
              </div>
              <div className="h-8 w-px bg-gray-700"></div>
              <div className="text-right">
                <div className="text-xs text-gray-400">GROUP</div>
                <div className="font-mono">{userData.group}</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="px-8 py-6">
        {userTrades ? (
          <div className="overflow-hidden rounded-lg border border-gray-700">
            <div className="grid grid-cols-9 bg-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
              <div className="p-3">SYMBOL</div>
              <div className="p-3">TYPE</div>
              <div className="p-3">AMOUNT</div>
              <div className="p-3">ENTRY</div>
              <div className="p-3">EXIT</div>
              <div className="p-3">PROFIT</div>
              <div className="p-3">STATUS</div>
              <div className="p-3">OPENED</div>
              <div className="p-3">CLOSED</div>
            </div>

            <div className="divide-y divide-gray-800">
              {userTrades.map((trade) => {
                const profitPercentage = trade.profit
                  ? (trade.profit / (trade.entryPrice * trade.amount)) * 100
                  : 0;

                return (
                  <div
                    key={trade._id}
                    className="grid grid-cols-9 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="p-3 font-mono text-blue-400">
                      {trade.symbol}
                    </div>
                    <div className="p-3">
                      {trade.type === "buy" ? (
                        <span className="text-green-400">LONG</span>
                      ) : (
                        <span className="text-red-400">SHORT</span>
                      )}
                    </div>
                    <div className="p-3 font-mono">{trade.amount}</div>
                    <div className="p-3 font-mono">
                      ${trade.entryPrice.toFixed(5)}
                    </div>
                    <div className="p-3 font-mono">
                      {trade.exitPrice ? `$${trade.exitPrice.toFixed(5)}` : "-"}
                    </div>
                    <div
                      className={`p-3 font-mono ${
                        trade.profit && trade.profit >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {trade.profit
                        ? `$${trade.profit.toFixed(
                            2
                          )} (${profitPercentage.toFixed(2)}%)`
                        : "-"}
                    </div>
                    <div className="p-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          trade.status === "closed"
                            ? "bg-green-900/20 text-green-400"
                            : "bg-blue-900/20 text-blue-400"
                        }`}
                      >
                        {trade.status === "closed" ? "CLOSED" : "ACTIVE"}
                      </span>
                    </div>
                    <div className="p-3 font-mono text-sm text-gray-400">
                      {new Date(trade.createdAt).toLocaleDateString()}
                    </div>
                    <div className="p-3 font-mono text-sm text-gray-400">
                      {trade.status === "closed" && trade.updatedAt
                        ? new Date(trade.updatedAt).toLocaleDateString()
                        : "-"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center h-64">
            <Loader className="text-blue-400" size="lg" />
          </div>
        )}
      </main>

      {/* Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 py-2 px-8 text-xs text-gray-400 flex justify-between">
        <div>
          SYSTEM STATUS: <span className="text-green-400">OPERATIONAL</span>
        </div>
        <div>LAST UPDATE: {new Date().toLocaleTimeString()}</div>
        <div>VERSION: 2.0.1</div>
      </footer>
    </div>
  );
};

export default TradeHistoryPage;
