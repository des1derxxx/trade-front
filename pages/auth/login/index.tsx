import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
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
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

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
    username: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Неверные учетные данные');
      }

      // Validate response data structure
      if (!data.access_token || !data.user) {
        throw new Error('Некорректный ответ от сервера');
      }

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      router.push('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка при входе в систему');
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
    <Container size={420} my={40}>
      <Title
        ta="center"
        style={(theme: MantineTheme) => ({
          fontFamily: `Greycliff CF, ${theme.fontFamily}`,
          fontWeight: 900,
        })}
      >
        Вход в систему
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <Stack>
            {error && (
              <Alert 
                icon={<IconAlertCircle size={16} />} 
                color="red" 
                variant="filled"
              >
                {error}
              </Alert>
            )}
            
            <TextInput
              required
              label="Имя пользователя"
              placeholder="Введите имя пользователя"
              value={formData.username}
              onChange={(event) => handleInputChange('username')(event.currentTarget.value)}
              error={!formData.username && error ? 'Обязательное поле' : null}
            />

            <PasswordInput
              required
              label="Пароль"
              placeholder="Введите пароль"
              value={formData.password}
              onChange={(event) => handleInputChange('password')(event.currentTarget.value)}
              error={!formData.password && error ? 'Обязательное поле' : null}
            />

            <Button 
              type="submit" 
              loading={isLoading}
              fullWidth
            >
              Войти
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
};

export default LoginPage;