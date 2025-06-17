'use client';

import { useRouter } from 'next/navigation';
import { LoginPage } from './components';

export default function LoginPageContainer() {
  const router = useRouter();

  const handleEmailLogin = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        router.push('/dashboard');
      } else {
        const error = await response.json();
        console.error('Login failed:', error);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleSingPassLogin = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <LoginPage 
      onEmailLogin={handleEmailLogin}
      onSingPassLogin={handleSingPassLogin}
    />
  );
}