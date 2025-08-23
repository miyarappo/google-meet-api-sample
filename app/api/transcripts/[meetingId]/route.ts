import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { GoogleMeetAPI } from '@/lib/google-meet-api'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { meetingId } = await params
    const meetAPI = new GoogleMeetAPI(session.accessToken)
    
    const searchParams = request.nextUrl.searchParams
    const transcriptId = searchParams.get('transcriptId')
    
    let result
    if (transcriptId) {
      result = await meetAPI.getTranscript(meetingId)
    } else {
      const transcripts = await meetAPI.getAllTranscripts(meetingId)
      result = transcripts.length > 0 ? transcripts[0] : null
    }

    if (!result) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    return NextResponse.json({ transcript: result })
  } catch (error) {
    console.error('Error in transcript API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcript' }, 
      { status: 500 }
    )
  }
}