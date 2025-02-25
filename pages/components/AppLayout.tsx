import React, { useEffect, useState, ReactNode } from "react";
import axios from "axios";
import { Modal, Button, Container, Text } from "@mantine/core";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [modalOpened, setModalOpened] = useState(false);

  // Создаем перехватчик для axios
  useEffect(() => {
    // Add response interceptor
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          error.response?.status === 403 &&
          error.response.data?.isDeactivated
        ) {
          setModalOpened(true);
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptor on component unmount
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear(); // Очищаем весь localStorage
    window.location.href = "/login";
  };

  if (modalOpened) {
    return (
      <Container
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <Text size="xl" fw={700} mb={20}>
          Аккаунт деактивирован
        </Text>
        <Text mb={30}>
          Ваш аккаунт деактивирован. Пожалуйста, свяжитесь с администрацией.
        </Text>
        <Button color="red" onClick={handleLogout}>
          Выйти
        </Button>
      </Container>
    );
  }

  return <>{children}</>;
};

export default AppLayout;
