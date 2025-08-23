import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { GoogleMeetAPI } from '@/lib/google-meet-api'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    console.log('=== Transcript API Request ===')
    const session = await getServerSession(authOptions)
    
    if (!session || !session.accessToken) {
      console.log('No session or access token found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { meetingId } = await params
    console.log(`Fetching transcript for meeting ID: ${meetingId}`)
    
    const meetAPI = new GoogleMeetAPI(session.accessToken)
    
    const searchParams = request.nextUrl.searchParams
    const transcriptId = searchParams.get('transcriptId')
    console.log(`Transcript ID parameter: ${transcriptId}`)
    
    let result
    if (transcriptId) {
      console.log('Using specific transcript ID')
      result = await meetAPI.getTranscript(meetingId)
    } else {
      console.log('Getting all transcripts and selecting first one')
      const transcripts = await meetAPI.getAllTranscripts(meetingId)
      console.log(`Found ${transcripts.length} transcripts`)
      result = transcripts.length > 0 ? transcripts[0] : null
    }

    if (!result) {
      console.log('No transcript found, returning 404')
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    console.log(`Returning transcript: ${result.name} (${result.content?.length || 0} characters)`)
    return NextResponse.json({ transcript: result })
  } catch (error) {
    console.error('Error in transcript API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcript' }, 
      { status: 500 }
    )
  }
}