import { NextRequest, NextResponse } from 'next/server';
import { generators } from 'openid-client';
import { getSingpassClient } from '@/lib/singpass-client';
import { singpassConfig } from '@/lib/singpass-config';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export async function GET() {
  try {
    const singpassClient = await getSingpassClient();
    
    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);
    const nonce = crypto.randomUUID();
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store auth parameters in cookies
    const cookieStore = await cookies();
    cookieStore.set('auth_code_verifier', code_verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutes
    });
    cookieStore.set('auth_nonce', nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600
    });
    cookieStore.set('auth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600
    });

    // Generate authorization URL
    const authorizationUrl = singpassClient.authorizationUrl({
      redirect_uri: singpassConfig.REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge,
      nonce,
      state,
      scope: singpassConfig.SCOPES,
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error('Error initiating Singpass login:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Singpass login' },
      { status: 500 }
    );
  }
}

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
      }
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create session cookie
    const cookieStore = await cookies();
    cookieStore.set('user_session', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}