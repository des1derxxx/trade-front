import { useRouter } from 'next/router';
import { ReactNode } from 'react';
import AppHeader from './AppHeader'; // Укажите правильный путь

const Layout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const hideHeaderPaths = ['/auth/login', '/register'];

  const showHeader = !hideHeaderPaths.includes(router.pathname);

  return (
    <div>
      {showHeader && <AppHeader />}
      <main>{children}</main>
    </div>
  );
};

export default Layout;
