import { google } from 'googleapis'

export interface Meeting {
  name: string
  conferenceRecordId: string
  startTime: string
  endTime?: string
  space?: {
    name: string
    meetingCode?: string
    meetingUri?: string
  }
}

export interface Transcript {
  name: string
  startTime: string
  endTime: string
  state: string
  docsDestination?: {
    document: string
    exportUri?: string
  }
  entries?: TranscriptEntry[]
}

export interface TranscriptEntry {
  name: string
  participant: {
    signedinUser?: {
      user: string
      displayName: string
    }
    anonymousUser?: {
      displayName: string
    }
    phoneUser?: {
      displayName: string
    }
  }
  words: TranscriptWord[]
  startTime: string
  endTime: string
  languageCode: string
}

export interface TranscriptWord {
  word: string
  startTime: string
  endTime: string
}

export class GoogleMeetAPI {
  private auth: InstanceType<typeof google.auth.OAuth2>
  private meet: ReturnType<typeof google.meet>

  constructor(accessToken: string) {
    this.auth = new google.auth.OAuth2()
    this.auth.setCredentials({ access_token: accessToken })
    this.meet = google.meet({ version: 'v2', auth: this.auth })
  }

  async getMeetings(): Promise<Meeting[]> {
    try {
      console.log('Fetching conference records from Google Meet API...')
      
      // 実際のGoogle Meet API v2を使用してconferenceRecordsを取得
      const response = await this.meet.conferenceRecords.list({
        pageSize: 50,
        // filter: 'space.meeting_code:*' // 必要に応じてフィルタを追加
      })

      const conferences = response.data.conferenceRecords || []
      console.log(`Found ${conferences.length} conference records`)

      return conferences.map((record) => ({
        name: record.name || '',
        conferenceRecordId: record.name?.split('/')[1] || '',
        startTime: record.startTime || '',
        endTime: record.endTime || undefined,
        space: record.space ? {
          name: ((record.space as unknown) as Record<string, unknown>).name as string || '',
          meetingCode: ((record.space as unknown) as Record<string, unknown>).meetingCode as string | undefined,
          meetingUri: ((record.space as unknown) as Record<string, unknown>).meetingUri as string | undefined
        } : undefined
      }))
      
    } catch (error) {
      console.error('Error fetching conference records:', error)
      throw new Error(`Failed to fetch conference records: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getTranscript(conferenceRecordId: string, transcriptId?: string): Promise<Transcript | null> {
    try {
      console.log(`Fetching transcripts for conference record: ${conferenceRecordId}`)
      
      // 指定されたconferenceRecordのtranscriptsを取得
      const transcriptsResponse = await this.meet.conferenceRecords.transcripts.list({
        parent: `conferenceRecords/${conferenceRecordId}`
      })

      const transcripts = transcriptsResponse.data.transcripts || []
      console.log(`Found ${transcripts.length} transcripts`)

      if (transcripts.length === 0) {
        return null
      }

      // 指定されたtranscriptId、または最初のtranscriptを使用
      let selectedTranscript
      if (transcriptId) {
        selectedTranscript = transcripts.find((t) => 
          t.name?.includes(transcriptId))
      }
      if (!selectedTranscript) {
        selectedTranscript = transcripts[0]
      }

      if (!selectedTranscript) {
        return null
      }

      console.log(`Selected transcript: ${selectedTranscript.name}`)

      // transcript entriesを取得
      const entriesResponse = await this.meet.conferenceRecords.transcripts.entries.list({
        parent: selectedTranscript.name!,
        pageSize: 100
      })

      const entries = entriesResponse.data.transcriptEntries || []
      console.log(`Found ${entries.length} transcript entries`)

      return {
        name: selectedTranscript.name || '',
        startTime: selectedTranscript.startTime || '',
        endTime: selectedTranscript.endTime || '',
        state: selectedTranscript.state || '',
        docsDestination: selectedTranscript.docsDestination ? {
          document: selectedTranscript.docsDestination.document || '',
          exportUri: selectedTranscript.docsDestination.exportUri || undefined
        } : undefined,
        entries: entries.map((entry) => ({
          name: entry.name || '',
          participant: entry.participant || {},
          words: [], // Google Meet API の実際のスキーマでは words は別のリクエストで取得
          startTime: entry.startTime || '',
          endTime: entry.endTime || '',
          languageCode: entry.languageCode || 'ja'
        }))
      }
      
    } catch (error) {
      console.error('Error fetching transcript:', error)
      throw new Error(`Failed to fetch transcript: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getAllTranscripts(conferenceRecordId: string): Promise<Transcript[]> {
    try {
      console.log(`Fetching all transcripts for conference record: ${conferenceRecordId}`)
      
      const transcriptsResponse = await this.meet.conferenceRecords.transcripts.list({
        parent: `conferenceRecords/${conferenceRecordId}`
      })

      const transcripts = transcriptsResponse.data.transcripts || []
      const results: Transcript[] = []

      for (const transcript of transcripts) {
        const transcriptName = transcript.name
        if (transcriptName) {
          const fullTranscript = await this.getTranscript(conferenceRecordId, 
            transcriptName.split('/')[3]) // Extract transcript ID from name
          if (fullTranscript) {
            results.push(fullTranscript)
          }
        }
      }

      return results
    } catch (error) {
      console.error('Error fetching all transcripts:', error)
      throw new Error(`Failed to fetch transcripts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}