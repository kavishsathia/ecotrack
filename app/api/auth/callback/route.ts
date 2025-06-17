import { NextRequest, NextResponse } from 'next/server';
import { getSingpassClient } from '@/lib/singpass-client';
import { singpassConfig } from '@/lib/singpass-config';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle errors from Singpass
    if (error) {
      console.error('Singpass authentication error:', error);
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }

    // Get stored auth parameters from cookies
    const cookieStore = await cookies();
    const code_verifier = cookieStore.get('auth_code_verifier')?.value;
    const nonce = cookieStore.get('auth_nonce')?.value;
    const stored_state = cookieStore.get('auth_state')?.value;

    if (!code_verifier || !nonce || !stored_state) {
      console.error('Missing auth parameters from cookies');
      return NextResponse.redirect(new URL('/login?error=session_expired', request.url));
    }

    // Verify state parameter
    if (state !== stored_state) {
      console.error('State parameter mismatch');
      return NextResponse.redirect(new URL('/login?error=invalid_state', request.url));
    }

    const singpassClient = await getSingpassClient();

    // Exchange authorization code for tokens
    const params = Object.fromEntries(searchParams.entries());
    const tokenSet = await singpassClient.callback(
      singpassConfig.REDIRECT_URI,
      params,
      {
        code_verifier,
        nonce,
        state: stored_state,
      }
    );

    console.log('ID Token claims:', tokenSet.claims());

    // Get user info if available
    let userInfo = {};
    try {
      userInfo = await singpassClient.userinfo(tokenSet);
      console.log('User info:', userInfo);
    } catch (userInfoError) {
      console.log('Could not fetch user info (might not have additional scopes):', userInfoError);
    }

    // Extract user data from SingPass
    const claims = tokenSet.claims();
    const singpassId = claims.sub; // SingPass unique identifier
    const name = claims.name || userInfo.name || 'SingPass User';
    const email = claims.email || userInfo.email;

    console.log('Creating/updating user with SingPass ID:', singpassId);

    // Create or update user in database
    const user = await prisma.user.upsert({
      where: {
        singpassId: singpassId,
      },
      update: {
        name: name,
        email: email,
        updatedAt: new Date(),
      },
      create: {
        singpassId: singpassId,
        name: name,
        email: email,
      },
    });

    console.log('User created/updated:', user.id);

    // Store user session data
    const userData = { ...claims, ...userInfo, userId: user.id };
    
    const cookieStore = await cookies();
    
    // Set comprehensive session cookie
    cookieStore.set('user_session', JSON.stringify(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600 // 1 hour
    });

    // Set simple user ID cookie for Chrome extension
    cookieStore.set('user_id', user.id, {
      httpOnly: false, // Allow JavaScript access for Chrome extension
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600, // 1 hour
      domain: process.env.NODE_ENV === 'production' ? '.your-domain.com' : 'localhost'
    });

    // Clean up auth cookies
    cookieStore.delete('auth_code_verifier');
    cookieStore.delete('auth_nonce');
    cookieStore.delete('auth_state');

    console.log('Authentication successful, redirecting to dashboard');

    // Redirect to dashboard after successful authentication
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error handling Singpass callback:', error);
    return NextResponse.redirect(new URL('/login?error=callback_failed', request.url));
  }
}