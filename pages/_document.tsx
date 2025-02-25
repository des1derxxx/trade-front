import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body className="antialiased">
        <Main />
        <NextScript />
        <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
      </body>
    </Html>
  );
}
