import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_CONFIG = {
  providers: {
    grsai: {
      apiUrl: 'https://grsai.dakka.com.cn',
      apiKey: '',
      modelApiKey: '',
    },
    runninghub: {
      apiUrl: '',
      apiKey: '',
      modelApiKey: '',
    },
    'runninghub-model': {
      apiUrl: '',
      apiKey: '',
      modelApiKey: '',
    },
    ppio: {
      apiUrl: '',
      apiKey: '',
      modelApiKey: '',
    },
    apimart: {
      apiUrl: '',
      apiKey: '',
      modelApiKey: '',
    },
  },
  defaultUrl: 'https://grsai.dakka.com.cn',
  apiUrl: 'https://grsai.dakka.com.cn',
  apiKey: '',
}

function json(data: unknown) {
  return NextResponse.json({
    success: true,
    data,
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET() {
  return json(DEFAULT_CONFIG)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return json({
    ...DEFAULT_CONFIG,
    ...(body && typeof body === 'object' ? body : {}),
  })
}
