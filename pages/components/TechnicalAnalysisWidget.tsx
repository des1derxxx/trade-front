import { useEffect, useRef } from "react";

const TechnicalAnalysisWidget = ({ symbol }: { symbol: string }) => {
  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!widgetRef.current) return; // Проверяем, что элемент существует

    // Удаляем предыдущий виджет перед созданием нового (если меняется символ)
    widgetRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
    script.innerHTML = JSON.stringify({
      interval: "1m",
      width: "100%",
      isTransparent: false,
      height: 450,
      symbol,
      showIntervalTabs: true,
      displayMode: "single",
      locale: "en",
      colorTheme: "dark",
    });

    widgetRef.current.appendChild(script);
  }, [symbol]); // Перезапуск при изменении символа

  return (
    <div className="tradingview-widget-container">
      <div ref={widgetRef} />
    </div>
  );
};

export default TechnicalAnalysisWidget;
