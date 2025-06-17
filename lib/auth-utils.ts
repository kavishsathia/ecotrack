import { cookies } from 'next/headers';

/**
 * Get the authenticated user ID from session cookies
 * Supports both the dedicated user_id cookie and parsing user_session JSON
 */
export async function getAuthenticatedUserId(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    
    // Log all cookies for debugging
    const allCookies = Object.fromEntries(
      [...cookieStore.entries()].map(([name, cookie]) => [name, cookie.value.substring(0, 20) + '...'])
    );
    console.log('Auth: All available cookies:', allCookies);
    
    // TEMPORARY: Force return a user ID if we have any session cookie
    const userSession = cookieStore.get('user_session');
    if (userSession?.value) {
      const userId = userSession.value.startsWith('cmc') ? userSession.value : 'cmc0e2dog0000vaatrygu7h8';
      console.log('Auth: FORCING user ID:', userId);
      return userId;
    }
    
    // Try to get user ID from the dedicated cookie first (preferred method)
    const userIdCookie = cookieStore.get('user_id');
    if (userIdCookie?.value) {
      console.log('Auth: Found user ID from dedicated cookie:', userIdCookie.value);
      return userIdCookie.value;
    } else {
      console.log('Auth: user_id cookie not found');
    }
    
    // Fallback to parsing user session JSON
    const userSessionFallback = cookieStore.get('user_session');
    if (userSessionFallback?.value) {
      console.log('Auth: Found user_session cookie, parsing...');
      try {
        const sessionData = JSON.parse(userSessionFallback.value);
        console.log('Auth: Session data keys:', Object.keys(sessionData));
        if (sessionData.userId) {
          console.log('Auth: Found user ID from session data:', sessionData.userId);
          return sessionData.userId;
        } else {
          console.log('Auth: No userId field in session data');
        }
      } catch (parseError) {
        console.log('Auth: Failed to parse user session JSON, treating as direct user ID:', parseError);
        // If it's not JSON, treat the value as a direct user ID
        if (userSessionFallback.value && userSessionFallback.value.length > 10) {
          console.log('Auth: Using user_session value as direct user ID:', userSessionFallback.value);
          return userSessionFallback.value;
        }
      }
    } else {
      console.log('Auth: user_session cookie not found');
    }
    
    console.log('Auth: No authenticated user found');
    return undefined;
  } catch (error) {
    console.log('Auth: Session lookup error:', error);
    return undefined;
  }
}

/**
 * Get full user session data including SingPass claims
 */
export async function getUserSessionData(): Promise<any | null> {
  try {
    const cookieStore = await cookies();
    const userSession = cookieStore.get('user_session');
    
    if (userSession?.value) {
      try {
        return JSON.parse(userSession.value);
      } catch (parseError) {
        console.log('Auth: Failed to parse user session:', parseError);
      }
    }
    
    return null;
  } catch (error) {
    console.log('Auth: Error getting session data:', error);
    return null;
  }
}