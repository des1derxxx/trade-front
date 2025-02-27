import { useState, FormEvent } from "react";
import { useRouter } from "next/router";
import {
  TextInput,
  PasswordInput,
  Paper,
  Title,
  Container,
  Button,
  Stack,
  Alert,
  MantineTheme,
  Box,
  Text,
} from "@mantine/core";
import { IconAlertCircle, IconKey, IconUser } from "@tabler/icons-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface FormData {
  username: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  user: {
    username: string;
    demoBalance: number;
    role: string;
  };
}

const LoginPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    username: "",
    password: "",
  });
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      setError("Пожалуйста, заполните все поля");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Неверные учетные данные");
      }

      // Validate response data structure
      if (!data.access_token || !data.user) {
        throw new Error("Некорректный ответ от сервера");
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      router.push("/profile");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Произошла ошибка при входе в систему"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData) => (value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black py-8 relative overflow-hidden">
      {/* Neon gradients */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-cyan-500/10 to-pink-500/10 z-0"></div>

      <Container size={420} className="z-10 relative">
        <Paper
          withBorder
          p={30}
          radius="md"
          style={{
            backgroundColor: "rgba(10, 10, 10, 0.8)",
            backdropFilter: "blur(5px)",
            border: "1px solid rgba(0, 255, 255, 0.3)",
            boxShadow:
              "0 0 20px rgba(0, 255, 255, 0.3), 0 0 40px rgba(255, 0, 255, 0.1)",
            position: "relative",
            overflow: "hidden",
          }}
          className="before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-gradient-to-r before:from-cyan-400 before:to-pink-500"
        >
          <Title
            ta="center"
            className="text-cyan-400 font-extrabold tracking-wider text-3xl mb-8"
            style={{
              textShadow: "0 0 1px #00ffff, 0 0 5px #00ffff",
            }}
          >
            ВХОД В СИСТЕМУ
          </Title>

          <form onSubmit={handleSubmit}>
            <Stack>
              {error && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  color="red"
                  variant="filled"
                  styles={{
                    root: {
                      backgroundColor: "rgba(255, 50, 50, 0.2)",
                      border: "1px solid rgba(255, 50, 50, 0.5)",
                      boxShadow: "0 0 15px rgba(255, 50, 50, 0.3)",
                    },
                  }}
                >
                  {error}
                </Alert>
              )}

              <TextInput
                required
                label="Имя пользователя"
                placeholder="Введите имя пользователя"
                value={formData.username}
                onChange={(event) =>
                  handleInputChange("username")(event.currentTarget.value)
                }
                error={!formData.username && error ? "Обязательное поле" : null}
                icon={<IconUser size={16} color="#00ffff" />}
                styles={{
                  input: {
                    backgroundColor: "rgba(20, 20, 30, 0.6)",
                    borderColor: "rgba(0, 255, 255, 0.3)",
                    color: "#fff",
                    "&:focus": {
                      borderColor: "#00ffff",
                      boxShadow: "0 0 8px rgba(0, 255, 255, 0.5)",
                    },
                    "&::placeholder": {
                      color: "rgba(255, 255, 255, 0.5)",
                    },
                  },
                  label: {
                    color: "#00ffff",
                  },
                }}
              />

              <PasswordInput
                required
                label="Пароль"
                placeholder="Введите пароль"
                value={formData.password}
                onChange={(event) =>
                  handleInputChange("password")(event.currentTarget.value)
                }
                error={!formData.password && error ? "Обязательное поле" : null}
                icon={<IconKey size={16} color="#00ffff" />}
                styles={{
                  input: {
                    backgroundColor: "rgba(20, 20, 30, 0.6)",
                    borderColor: "rgba(0, 255, 255, 0.3)",
                    color: "#fff",
                    "&:focus": {
                      borderColor: "#00ffff",
                      boxShadow: "0 0 8px rgba(0, 255, 255, 0.5)",
                    },
                    "&::placeholder": {
                      color: "rgba(255, 255, 255, 0.5)",
                    },
                  },
                  label: {
                    color: "#00ffff",
                  },
                  innerInput: {
                    color: "#fff",
                  },
                }}
              />

              <Button
                type="submit"
                loading={isLoading}
                fullWidth
                className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-black font-bold tracking-wide flex items-center justify-center transition-all duration-300 shadow-lg shadow-cyan-500/30 hover:shadow-pink-500/30 hover:-translate-y-0.5 text-lg"
              >
                ВОЙТИ
              </Button>
            </Stack>
          </form>
        </Paper>
      </Container>
    </div>
  );
};

export default LoginPage;
