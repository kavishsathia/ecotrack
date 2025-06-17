'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SignUpPage } from './components';

export default function SignUpPageContainer() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      if (response.ok) {
        // Registration successful, redirect to login
        router.push('/?success=Account created successfully. Please sign in.');
      } else {
        const error = await response.json();
        console.error('Registration failed:', error);
        // You might want to show an error message to the user here
      }
    } catch (error) {
      console.error('Registration error:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SignUpPage 
      onSignUp={handleSignUp}
      isLoading={isLoading}
    />
  );
}