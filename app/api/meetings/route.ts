import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { GoogleMeetAPI } from '@/lib/google-meet-api'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    console.log('Session in meetings API:', session)
    
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const meetAPI = new GoogleMeetAPI(session.accessToken)
    const meetings = await meetAPI.getMeetings()

    return NextResponse.json({ meetings })
  } catch (error) {
    console.error('Error in meetings API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meetings' }, 
      { status: 500 }
    )
  }
}