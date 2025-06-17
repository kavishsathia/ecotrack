import { NextRequest, NextResponse } from 'next/server';
import { getSingpassClient } from '@/lib/singpass-client';
import { singpassConfig } from '@/lib/singpass-config';
import { cookies } from 'next/headers';

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

    // Store user session (you might want to use a proper session management solution)
    const userData = { ...tokenSet.claims(), ...userInfo };
    cookieStore.set('user_session', JSON.stringify(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600 // 1 hour
    });

    // Clean up auth cookies
    cookieStore.delete('auth_code_verifier');
    cookieStore.delete('auth_nonce');
    cookieStore.delete('auth_state');

    // Redirect to home page or dashboard
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Error handling Singpass callback:', error);
    return NextResponse.redirect(new URL('/login?error=callback_failed', request.url));
  }
}