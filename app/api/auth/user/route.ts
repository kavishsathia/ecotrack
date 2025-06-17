import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userSession = cookieStore.get('user_session');
    
    if (!userSession) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // The session value is the user ID
    const userId = userSession.value;
    
    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        singpassId: true,
        createdAt: true,
      }
    });
    
    if (!user) {
      // Invalid session - clear it
      cookieStore.delete('user_session');
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}