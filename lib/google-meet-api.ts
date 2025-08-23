import { google } from 'googleapis'

export interface Meeting {
  id: string
  name: string
  createdTime: string
  modifiedTime?: string
  size?: number
  webViewLink?: string
  meetingCode?: string
}

export interface Transcript {
  id: string
  name: string
  createdTime: string
  modifiedTime?: string
  size?: number
  webViewLink?: string
  downloadLink?: string
  content?: string
}

export interface TranscriptEntry {
  text: string
  timestamp?: string
}

export class GoogleMeetAPI {
  private auth: InstanceType<typeof google.auth.OAuth2>
  private drive: ReturnType<typeof google.drive>

  constructor(accessToken: string) {
    this.auth = new google.auth.OAuth2()
    this.auth.setCredentials({ access_token: accessToken })
    this.drive = google.drive({ version: 'v3', auth: this.auth })
  }

  async getMeetings(): Promise<Meeting[]> {
    try {
      console.log('Fetching Google Meet files from Google Drive...')
      
      // Google Drive から Google Meet で生成されたファイルを検索
      const response = await this.drive.files.list({
        q: "mimeType contains 'video' or name contains 'meeting' or name contains 'Meet' or name contains 'transcript'",
        spaces: 'drive',
        fields: 'files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)',
        orderBy: 'createdTime desc',
        pageSize: 50
      })

      const files = response.data.files || []
      console.log(`Found ${files.length} potential meeting files`)

      // ファイル情報を会議情報に変換
      const meetings: Meeting[] = []
      const processedMeetings = new Set<string>()

      for (const file of files) {
        // ファイル名から会議コードを抽出（推定）
        const meetingCode = this.extractMeetingCode(file.name || '')
        const meetingKey = meetingCode || file.createdTime || file.id

        // 重複を避ける
        if (meetingKey && !processedMeetings.has(meetingKey)) {
          processedMeetings.add(meetingKey)
          
          meetings.push({
            id: file.id || '',
            name: this.generateMeetingName(file.name || ''),
            createdTime: file.createdTime || '',
            modifiedTime: file.modifiedTime || undefined,
            size: parseInt(file.size || '0'),
            webViewLink: file.webViewLink || undefined,
            meetingCode: meetingCode
          })
        }
      }

      return meetings
      
    } catch (error) {
      console.error('Error fetching Google Drive files:', error)
      throw new Error(`Failed to fetch meeting files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private extractMeetingCode(fileName: string): string | undefined {
    // ファイル名から会議コードのパターンを抽出
    const patterns = [
      /([a-z]{3}-[a-z]{4}-[a-z]{3})/i, // xxx-xxxx-xxx 形式
      /meet\.google\.com\/([a-z\-]+)/i, // URL形式
      /Meeting\s+([A-Z0-9\-]+)/i // Meeting XXX 形式
    ]
    
    for (const pattern of patterns) {
      const match = fileName.match(pattern)
      if (match) {
        return match[1]
      }
    }
    
    return undefined
  }

  private generateMeetingName(fileName: string): string {
    // ファイル名から読みやすい会議名を生成
    const cleanName = fileName
      .replace(/\.(mp4|webm|txt|doc|docx)$/i, '')
      .replace(/^(Meeting|Google Meet|Meet)[\s\-_]*/i, '')
      .replace(/[\-_]/g, ' ')
      .trim()
    
    return cleanName || 'Google Meet 会議'
  }

  async getTranscript(meetingId: string): Promise<Transcript | null> {
    try {
      console.log(`Fetching transcript files for meeting: ${meetingId}`)
      
      // Google Drive で文字起こしファイルを検索
      const response = await this.drive.files.list({
        q: `(name contains 'transcript' or name contains '文字起こし') and (mimeType='text/plain' or mimeType='application/vnd.google-apps.document')`,
        spaces: 'drive',
        fields: 'files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)',
        orderBy: 'createdTime desc',
        pageSize: 20
      })

      const files = response.data.files || []
      console.log(`Found ${files.length} potential transcript files`)

      if (files.length === 0) {
        return null
      }

      // 最初の文字起こしファイルを使用
      const transcriptFile = files[0]
      
      let content = ''
      try {
        // ファイルの内容を取得
        if (transcriptFile.mimeType === 'application/vnd.google-apps.document') {
          // Google Docs の場合は export で取得
          const exportResponse = await this.drive.files.export({
            fileId: transcriptFile.id!,
            mimeType: 'text/plain'
          })
          content = exportResponse.data as string
        } else {
          // テキストファイルの場合は直接取得
          const fileResponse = await this.drive.files.get({
            fileId: transcriptFile.id!,
            alt: 'media'
          })
          content = fileResponse.data as string
        }
      } catch (contentError) {
        console.log('Could not fetch file content:', contentError)
        content = ''
      }

      return {
        id: transcriptFile.id || '',
        name: transcriptFile.name || '',
        createdTime: transcriptFile.createdTime || '',
        modifiedTime: transcriptFile.modifiedTime || undefined,
        size: parseInt(transcriptFile.size || '0'),
        webViewLink: transcriptFile.webViewLink || undefined,
        downloadLink: `https://drive.google.com/uc?id=${transcriptFile.id}`,
        content: content
      }
      
    } catch (error) {
      console.error('Error fetching transcript:', error)
      throw new Error(`Failed to fetch transcript: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getAllTranscripts(meetingId: string): Promise<Transcript[]> {
    try {
      console.log(`Fetching all transcript files for meeting: ${meetingId}`)
      
      // Google Drive で文字起こしファイルを検索
      const response = await this.drive.files.list({
        q: `(name contains 'transcript' or name contains '文字起こし') and (mimeType='text/plain' or mimeType='application/vnd.google-apps.document')`,
        spaces: 'drive',
        fields: 'files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)',
        orderBy: 'createdTime desc',
        pageSize: 10
      })

      const files = response.data.files || []
      const results: Transcript[] = []

      for (const file of files) {
        results.push({
          id: file.id || '',
          name: file.name || '',
          createdTime: file.createdTime || '',
          modifiedTime: file.modifiedTime || undefined,
          size: parseInt(file.size || '0'),
          webViewLink: file.webViewLink || undefined,
          downloadLink: `https://drive.google.com/uc?id=${file.id}`,
          content: undefined // コンテンツは必要時に個別取得
        })
      }

      return results
    } catch (error) {
      console.error('Error fetching all transcripts:', error)
      throw new Error(`Failed to fetch transcripts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // 文字起こしテキストを解析してエントリに分割
  parseTranscriptContent(content: string): TranscriptEntry[] {
    if (!content) return []

    const lines = content.split('\n').filter(line => line.trim())
    const entries: TranscriptEntry[] = []

    for (const line of lines) {
      // タイムスタンプのパターンを探す
      const timestampMatch = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.+)$/)
      
      if (timestampMatch) {
        entries.push({
          text: timestampMatch[2].trim(),
          timestamp: timestampMatch[1]
        })
      } else if (line.trim()) {
        entries.push({
          text: line.trim()
        })
      }
    }

    return entries
  }
}