"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    TradingView?: any;
  }
}

interface TradingViewChartProps {
  ticket: string | null;
}

const TradingViewChart = ({ ticket }: TradingViewChartProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null); // Ссылаемся на скрипт

  useEffect(() => {
    if (!containerRef.current || !ticket) return;

    // Если скрипт уже был добавлен, не добавляем его снова
    if (!scriptRef.current) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = () => {
        if (window.TradingView && ticket) {
          new window.TradingView.widget({
            container_id: "tradingview_chart",
            autosize: true,
            symbol: ticket,
            interval: "1D",
            timezone: "Etc/UTC",
            theme: "light",
            style: "1",
            locale: "ru",
            enable_publishing: false,
            hide_top_toolbar: false,
            hide_side_toolbar: false,
            allow_symbol_change: true,
          });
        }
      };

      scriptRef.current = script;
      containerRef.current.appendChild(script);
    }

    return () => {
      // Убедимся, что скрипт существует перед удалением
      if (scriptRef.current && containerRef.current) {
        if (containerRef.current.contains(scriptRef.current)) {
          containerRef.current.removeChild(scriptRef.current);
        }
        scriptRef.current = null; // Очистим ссылку на скрипт
      }
    };
  }, [ticket]); // Зависимость от тикера

  return (
    <div
      id="tradingview_chart"
      ref={containerRef}
      style={{
        width: "100%",
        height: "600px",
        border: "none",
      }}
    />
  );
};

export default TradingViewChart;
