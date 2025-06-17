import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Request validation schema for linking Telegram account
const linkTelegramSchema = z.object({
  telegramId: z.string(),
  telegramUsername: z.string().optional(),
  userId: z.string(), // Life app user ID
});

export async function POST(request: NextRequest) {
  try {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    const body = await request.json();
    
    // Validate input
    const validationResult = linkTelegramSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400, headers }
      );
    }

    const { telegramId, telegramUsername, userId } = validationResult.data;

    // Check if the user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers }
      );
    }

    // Check if Telegram ID is already linked to another user
    const existingTelegramLink = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (existingTelegramLink && existingTelegramLink.id !== userId) {
      return NextResponse.json(
        { 
          error: 'Telegram account already linked',
          message: 'This Telegram account is already linked to another Life app account.'
        },
        { status: 400, headers }
      );
    }

    // Check if user already has a different Telegram account linked
    if (existingUser.telegramId && existingUser.telegramId !== telegramId) {
      return NextResponse.json(
        { 
          error: 'Account already has Telegram linked',
          message: 'This Life app account is already linked to a different Telegram account. Please unlink first.'
        },
        { status: 400, headers }
      );
    }

    // Link the accounts
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        telegramId,
        telegramUsername,
        telegramLinkedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        telegramId: true,
        telegramUsername: true,
        telegramLinkedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Telegram account linked successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        telegramId: updatedUser.telegramId,
        telegramUsername: updatedUser.telegramUsername,
        linkedAt: updatedUser.telegramLinkedAt,
      },
    }, { headers });

  } catch (error) {
    console.error('Telegram linking error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    return NextResponse.json(
      { error: 'Failed to link Telegram account. Please try again.' },
      { status: 500, headers }
    );
  }
}

// Unlink Telegram account
export async function DELETE(request: NextRequest) {
  try {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400, headers }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers }
      );
    }

    if (!existingUser.telegramId) {
      return NextResponse.json(
        { error: 'No Telegram account linked' },
        { status: 400, headers }
      );
    }

    // Unlink the account
    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Telegram account unlinked successfully',
    }, { headers });

  } catch (error) {
    console.error('Telegram unlinking error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    return NextResponse.json(
      { error: 'Failed to unlink Telegram account. Please try again.' },
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}