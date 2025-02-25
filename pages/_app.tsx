import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css"; // Добавьте эту строку
import type { AppProps } from "next/app";
import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications"; // Добавьте эту строку
import Layout from "./components/layout";
import AuthGuard from "./components/AuthGuard"; // Убедись, что путь правильный
import { PriceProvider } from "./components/PriceContext";
import AppLayout from "./components/AppLayout";
import "../styles/globals.css";

const theme = createTheme({
  primaryColor: "blue",
  fontFamily: "Open Sans, sans-serif",
  defaultRadius: "md",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications
        position="top-right"
        zIndex={2077}
        containerWidth={400}
        autoClose={5000}
      />
      <PriceProvider>
        <AppLayout>
          <AuthGuard>
            <Layout>
              <Component {...pageProps} />
            </Layout>
          </AuthGuard>
        </AppLayout>
      </PriceProvider>
    </MantineProvider>
  );
}
