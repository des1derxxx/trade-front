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
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !ticket) return;

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
            theme: "dark",
            style: "1",
            locale: "ru",
            enable_publishing: false,
            hide_top_toolbar: false,
            hide_side_toolbar: false,
            allow_symbol_change: false, // Отключаем возможность менять символ
            studies: ["STD;BBP", "STD;RSI"],
          });
        }
      };

      scriptRef.current = script;
      containerRef.current.appendChild(script);
    }

    return () => {
      if (scriptRef.current && containerRef.current) {
        if (containerRef.current.contains(scriptRef.current)) {
          containerRef.current.removeChild(scriptRef.current);
        }
        scriptRef.current = null;
      }
    };
  }, [ticket]);

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
