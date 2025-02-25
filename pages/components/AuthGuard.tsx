import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notifications } from "@mantine/notifications";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [checkInterval, setCheckInterval] = useState(60000); // Начинаем с 1 минуты

  const checkToken = () => {
    const token = localStorage.getItem("token");

    if (!token) {
      notifications.show({
        title: "Сессия истекла",
        message: "Войдите снова",
        color: "red",
      });
      router.push("/auth/login");
      return;
    }

    try {
      const decodedToken = JSON.parse(atob(token.split(".")[1])); 
      const currentTime = Date.now() / 1000; 
      const timeLeft = decodedToken.exp - currentTime;

      if (timeLeft <= 0) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        notifications.show({
          title: "Сессия истекла",
          message: "Войдите снова",
          color: "red",
        });

        router.push("/auth/login");
      } else if (timeLeft <= 300) {
        // Если осталось меньше 5 минут, проверяем каждые 15 секунд
        setCheckInterval(15000);
      }
    } catch (error) {
      console.error("Ошибка проверки токена", error);
      localStorage.removeItem("token");
      localStorage.removeItem("user")
      router.push("/auth/login");
    }
  };

  useEffect(() => {
    checkToken(); // Проверяем сразу при загрузке   
    const interval = setInterval(checkToken, checkInterval);
    return () => clearInterval(interval);
  }, [checkInterval]); // Обновляем интервал динамически

  return <>{children}</>;
};

export default AuthGuard;
