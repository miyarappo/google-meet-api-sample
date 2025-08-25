import { google } from "googleapis";

export interface Meeting {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime?: string;
  size?: number;
  webViewLink?: string;
  meetingCode?: string;
  // カレンダー情報
  calendarEvent?: {
    eventId: string;
    calendarId: string;
    summary?: string;
    startTime?: string;
    endTime?: string;
    organizer?: {
      email: string;
      displayName?: string;
    };
  };
}

export interface Transcript {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime?: string;
  size?: number;
  webViewLink?: string;
  downloadLink?: string;
  content?: string;
}



export class GoogleMeetAPI {
  private auth: InstanceType<typeof google.auth.OAuth2>;
  private drive: ReturnType<typeof google.drive>;
  private calendar: ReturnType<typeof google.calendar>;

  constructor(accessToken: string) {
    this.auth = new google.auth.OAuth2();
    this.auth.setCredentials({ access_token: accessToken });
    this.drive = google.drive({ version: "v3", auth: this.auth });
    this.calendar = google.calendar({ version: "v3", auth: this.auth });
  }

  async getMeetings(): Promise<Meeting[]> {
    try {
      // Google Drive から Google Meet で生成されたファイルを検索
      const response = await this.drive.files.list({
        q: "mimeType contains 'video' or name contains 'meeting' or name contains 'Meet' or name contains 'transcript'",
        spaces: "drive",
        fields: "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
        orderBy: "createdTime desc",
        pageSize: 50,
      });

      const files = response.data.files || [];
      const meetings: Meeting[] = [];
      const processedMeetings = new Set<string>();

      for (const file of files) {
        const meetingCode = this.extractMeetingCode(file.name || "");
        const meetingKey = meetingCode || file.createdTime || file.id;

        // 重複を避ける
        if (meetingKey && !processedMeetings.has(meetingKey)) {
          processedMeetings.add(meetingKey);
          meetings.push({
            id: file.id || "",
            name: this.generateMeetingName(file.name || ""),
            createdTime: file.createdTime || "",
            modifiedTime: file.modifiedTime || undefined,
            size: parseInt(file.size || "0"),
            webViewLink: file.webViewLink || undefined,
            meetingCode: meetingCode,
          });
        }
      }

      // カレンダーイベントとの紐付け
      return await this.enrichMeetingsWithCalendarData(meetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      throw new Error(
        `Failed to fetch meetings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private async enrichMeetingsWithCalendarData(
    meetings: Meeting[]
  ): Promise<Meeting[]> {
    try {
      // 過去30日間のカレンダーイベントを取得
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 30);

      const calendarResponse = await this.calendar.events.list({
        calendarId: "primary",
        timeMin: timeMin.toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = calendarResponse.data.items || [];
      const meetEvents = events.filter((event) => this.hasGoogleMeetLink(event));

      // 各会議にカレンダー情報を紐付け
      return meetings.map((meeting) => {
        const matchingEvent = this.findMatchingCalendarEvent(meeting, meetEvents);
        
        if (matchingEvent) {
          return {
            ...meeting,
            calendarEvent: {
              eventId: matchingEvent.id || "",
              calendarId: "primary",
              summary: matchingEvent.summary || "",
              startTime: matchingEvent.start?.dateTime || matchingEvent.start?.date || "",
              endTime: matchingEvent.end?.dateTime || matchingEvent.end?.date || "",
              organizer: matchingEvent.organizer ? {
                email: matchingEvent.organizer.email || "",
                displayName: matchingEvent.organizer.displayName,
              } : undefined,
            },
          };
        }
        
        return meeting;
      });
    } catch (error) {
      console.error("Error enriching calendar data:", error);
      return meetings; // カレンダー連携失敗時も会議一覧は返す
    }
  }

  private findMatchingCalendarEvent(meeting: Meeting, events: any[]): any | null {
    const meetingTime = new Date(meeting.createdTime);
    const cleanMeetingName = this.extractMeetingBaseName(meeting.name);

    for (const event of events) {
      // 1. 会議コードでマッチング
      if (meeting.meetingCode && this.extractMeetLinkFromEvent(event)?.includes(meeting.meetingCode)) {
        return event;
      }

      // 2. 時間の近さ + 名前の類似性でマッチング
      if (event.start?.dateTime && event.summary) {
        const eventTime = new Date(event.start.dateTime);
        const hoursDiff = Math.abs(eventTime.getTime() - meetingTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff <= 6) {
          const eventName = event.summary.toLowerCase();
          const meetingNameLower = cleanMeetingName.toLowerCase();
          
          // 部分一致または共通単語があれば採用
          if (eventName.includes(meetingNameLower) || 
              meetingNameLower.includes(eventName) ||
              this.hasCommonWords(meetingNameLower, eventName)) {
            return event;
          }
        }
      }
    }

    return null;
  }

  private extractMeetingBaseName(fileName: string): string {
    return fileName
      .replace(/\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}\s+JST/g, "")
      .replace(/～(Chat|Recording|Gemini によるメモ).*$/g, "")
      .replace(/\s+のコピー.*$/g, "")
      .replace(/\.(pdf|docx?|txt)$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private hasCommonWords(str1: string, str2: string): boolean {
    const words1 = str1.split(/[\s\/\-_]+/).filter(word => word.length > 2);
    const words2 = str2.split(/[\s\/\-_]+/).filter(word => word.length > 2);
    return words1.some(word1 => words2.some(word2 => 
      word1.includes(word2) || word2.includes(word1)
    ));
  }

  private extractMeetLinkFromEvent(event: any): string | undefined {
    if (event.conferenceData?.entryPoints) {
      const meetEntry = event.conferenceData.entryPoints.find(
        (entry: any) => entry.entryPointType === "video" && entry.uri?.includes("meet.google.com")
      );
      return meetEntry?.uri;
    }
    
    if (event.description) {
      const meetLinkMatch = event.description.match(/https:\/\/meet\.google\.com\/[a-z\-]+/);
      return meetLinkMatch?.[0];
    }
    
    return undefined;
  }

  private hasGoogleMeetLink(event: any): boolean {
    return !!(
      event.conferenceData?.entryPoints?.some((entry: any) => 
        entry.entryPointType === "video" && entry.uri?.includes("meet.google.com")
      ) || (event.description && event.description.includes("meet.google.com"))
    );
  }

  private extractMeetingCode(fileName: string): string | undefined {
    const patterns = [
      /([a-z]{3}-[a-z]{4}-[a-z]{3})/i, // xxx-xxxx-xxx 形式
      /meet\.google\.com\/([a-z\-]+)/i, // URL形式
    ];
    
    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return undefined;
  }

  private generateMeetingName(fileName: string): string {
    const cleanName = fileName
      .replace(/\.(mp4|webm|txt|doc|docx)$/i, "")
      .replace(/^(Meeting|Google Meet|Meet)[\s\-_]*/i, "")
      .replace(/[\-_]/g, " ")
      .trim();

    return cleanName || "Google Meet 会議";
  }

  async getTranscript(_meetingId: string): Promise<Transcript | null> {
    try {
      const response = await this.drive.files.list({
        q: `(name contains 'transcript' OR name contains '文字起こし') AND (mimeType='text/plain' OR mimeType='application/vnd.google-apps.document')`,
        spaces: "drive",
        fields: "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
        orderBy: "createdTime desc",
        pageSize: 20,
      });

      const files = response.data.files || [];
      if (files.length === 0) return null;

      const bestFile = files[0]; // 最新のファイルを使用
      const content = await this.fetchFileContent(bestFile);

      return {
        id: bestFile.id || "",
        name: bestFile.name || "",
        createdTime: bestFile.createdTime || "",
        modifiedTime: bestFile.modifiedTime || undefined,
        size: parseInt(bestFile.size || "0"),
        webViewLink: bestFile.webViewLink || undefined,
        downloadLink: `https://drive.google.com/uc?id=${bestFile.id}`,
        content: content,
      };
    } catch (error) {
      console.error("Error fetching transcript:", error);
      return null;
    }
  }



    private async fetchFileContent(file: any): Promise<string> {
    try {
      if (file.mimeType === "application/vnd.google-apps.document") {
        const exportResponse = await this.drive.files.export({
          fileId: file.id!,
          mimeType: "text/plain",
        });
        return exportResponse.data as string;
      } else {
        const fileResponse = await this.drive.files.get({
          fileId: file.id!,
          alt: "media",
        });
        return fileResponse.data as string;
      }
    } catch (error) {
      console.error(`Failed to fetch content:`, error);
      return "";
    }
  }
}
