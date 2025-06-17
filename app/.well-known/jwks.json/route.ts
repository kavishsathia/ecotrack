import { NextResponse } from 'next/server';
import { singpassConfig } from '@/lib/singpass-config';

export async function GET() {
  return NextResponse.json({
    keys: [
      singpassConfig.KEYS.PUBLIC_SIG_KEY,
      singpassConfig.KEYS.PUBLIC_ENC_KEY
    ]
  });
}