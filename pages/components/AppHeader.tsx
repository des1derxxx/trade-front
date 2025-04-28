import { Menu, Group, Button, Text, Box, Avatar } from "@mantine/core";
import { useRouter } from "next/router";
import { useState } from "react";

type ErrorState = string | null;

const AppHeader = () => {
  const router = useRouter();
  const [error, setError] = useState<ErrorState>(null);

  const handleLogout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.push("/auth/login");
    } catch (err) {
      setError("Ошибка при выходе из системы");
    }
  };

  const navigationItems = [
    { label: "Группа", onClick: () => router.push("/group") },
    { label: "Профиль", onClick: () => router.push("/profile") },
    { label: "Трейдинг", onClick: () => router.push("/trade") },
    { label: "История", onClick: () => router.push("/history") },
  ];

  return (
    <Box
      style={{
        background:
          "linear-gradient(180deg, rgba(18, 18, 18, 0.95) 0%, rgba(18, 18, 18, 0.85) 100%)",
        borderBottom: "1px solid rgba(62, 184, 255, 0.2)",
        padding: "16px 24px",
        backdropFilter: "blur(10px)",
      }}
    >
      <Group justify="space-between" align="center">
        <Text
          size="xl"
          fw={800}
          className="italic"
          style={{
            color: "#3EB8FF",
            letterSpacing: "0.15em",
            textShadow: "0 0 15px rgba(62, 184, 255, 0.6)",
          }}
        >
          PROP TRADING
        </Text>

        <Group gap="xl">
          {navigationItems.map((item, index) => (
            <Button
              key={index}
              variant="subtle"
              styles={{
                root: {
                  color: "#3EB8FF",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textShadow: "0 0 10px rgba(62, 184, 255, 0.5)",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    color: "#EC48FF",
                    textShadow: "0 0 15px rgba(236, 72, 255, 0.6)",
                    transform: "scale(1.05)",
                    backgroundColor: "transparent",
                  },
                },
              }}
              onClick={item.onClick}
            >
              {item.label}
            </Button>
          ))}
        </Group>

        <Group gap="md">
          <Menu
            shadow="lg"
            styles={{
              dropdown: {
                background: "rgba(18, 18, 18, 0.95)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(62, 184, 255, 0.2)",
              },
              item: {
                color: "#3EB8FF",
                transition: "all 0.3s ease",
                "&:hover": {
                  background: "rgba(236, 72, 255, 0.1)",
                  color: "#EC48FF",
                },
              },
            }}
          >
            <Menu.Target>
              <Avatar
                radius="xl"
                size="md"
                styles={{
                  root: {
                    cursor: "pointer",
                    border: "2px solid #3EB8FF",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      border: "2px solid #EC48FF",
                      transform: "scale(1.05)",
                      boxShadow: "0 0 15px rgba(236, 72, 255, 0.3)",
                    },
                  },
                }}
              >
                U
              </Avatar>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => router.push("/group")}>
                Группа
              </Menu.Item>
              <Menu.Item onClick={() => router.push("/profile")}>
                Профиль
              </Menu.Item>
              <Menu.Item onClick={() => router.push("/trade")}>
                Трейдинг
              </Menu.Item>
              <Menu.Item onClick={() => router.push("/history")}>
                История трейдинга
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          {/* <Button
            variant="outline"
            styles={{
              root: {
                background: "transparent",
                border: "2px solid #EC48FF",
                color: "#EC48FF",
                textShadow: "0 0 10px rgba(236, 72, 255, 0.5)",
                boxShadow: "0 0 15px rgba(236, 72, 255, 0.3)",
                transition: "all 0.3s ease",
                fontWeight: 700,
                letterSpacing: "0.1em",
                "&:hover": {
                  background: "rgba(236, 72, 255, 0.1)",
                  transform: "scale(1.05)",
                  boxShadow: "0 0 20px rgba(236, 72, 255, 0.5)",
                },
              },
            }}
            onClick={handleLogout}
          >
            LOGOUT
          </Button> */}
        </Group>
      </Group>

      {error && (
        <Text c="red" ta="center" mt="md">
          {error}
        </Text>
      )}
    </Box>
  );
};

export default AppHeader;
