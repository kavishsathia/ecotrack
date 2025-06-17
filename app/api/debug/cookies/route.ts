import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getUserSessionData } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    console.log('=== DEBUG COOKIES ENDPOINT ===');
    
    // Get user ID using our auth utility
    const userId = await getAuthenticatedUserId();
    
    // Get full session data
    const sessionData = await getUserSessionData();
    
    return NextResponse.json({
      success: true,
      userId: userId,
      hasUserId: !!userId,
      sessionData: sessionData ? {
        keys: Object.keys(sessionData),
        hasUserId: 'userId' in sessionData,
        userIdValue: sessionData.userId
      } : null,
      rawHeaders: Object.fromEntries(request.headers.entries()),
    });
    
  } catch (error) {
    console.error('Debug cookies error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}