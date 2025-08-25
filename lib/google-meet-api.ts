import { google } from "googleapis";

export interface Meeting {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime?: string;
  size?: number;
  webViewLink?: string;
  meetingCode?: string;
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

export interface TranscriptEntry {
  text: string;
  timestamp?: string;
}

export class GoogleMeetAPI {
  private auth: InstanceType<typeof google.auth.OAuth2>;
  private drive: ReturnType<typeof google.drive>;

  constructor(accessToken: string) {
    this.auth = new google.auth.OAuth2();
    this.auth.setCredentials({ access_token: accessToken });
    this.drive = google.drive({ version: "v3", auth: this.auth });
  }

  async getMeetings(): Promise<Meeting[]> {
    try {
      console.log("Fetching Google Meet files from Google Drive...");

      // Google Drive から Google Meet で生成されたファイルを検索
      const response = await this.drive.files.list({
        q: "mimeType contains 'video' or name contains 'meeting' or name contains 'Meet' or name contains 'transcript'",
        spaces: "drive",
        fields:
          "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
        orderBy: "createdTime desc",
        pageSize: 50,
      });

      const files = response.data.files || [];
      console.log(`Found ${files.length} potential meeting files`);

      // ファイル情報を会議情報に変換
      const meetings: Meeting[] = [];
      const processedMeetings = new Set<string>();

      for (const file of files) {
        // ファイル名から会議コードを抽出（推定）
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

      return meetings;
    } catch (error) {
      console.error("Error fetching Google Drive files:", error);
      throw new Error(
        `Failed to fetch meeting files: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private extractMeetingCode(fileName: string): string | undefined {
    // ファイル名から会議コードのパターンを抽出
    const patterns = [
      /([a-z]{3}-[a-z]{4}-[a-z]{3})/i, // xxx-xxxx-xxx 形式
      /meet\.google\.com\/([a-z\-]+)/i, // URL形式
      /Meeting\s+([A-Z0-9\-]+)/i, // Meeting XXX 形式
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
    // ファイル名から読みやすい会議名を生成
    const cleanName = fileName
      .replace(/\.(mp4|webm|txt|doc|docx)$/i, "")
      .replace(/^(Meeting|Google Meet|Meet)[\s\-_]*/i, "")
      .replace(/[\-_]/g, " ")
      .trim();

    return cleanName || "Google Meet 会議";
  }

  private extractBaseName(fileName: string): string {
    // ファイル名から基本名を抽出（拡張子や余分な文字を除去）
    return fileName
      .replace(/\.(mp4|webm|txt|doc|docx|pdf)$/i, "")
      .replace(/^(Meeting|Google Meet|Meet|Recording)[\s\-_]*/i, "")
      .replace(/[\s\-_]+/g, " ")
      .split(" ")[0] // 最初の単語を取得
      .trim();
  }

  async getTranscript(meetingId: string): Promise<Transcript | null> {
    try {
      console.log(`=== Simplified Transcript Search for: ${meetingId} ===`);

      // 1回のAPI呼び出しで包括的に検索
      const response = await this.drive.files.list({
        q: `(name contains 'transcript' OR name contains '文字起こし' OR name contains 'Transcript' OR name contains 'Meeting') AND (mimeType='text/plain' OR mimeType='application/vnd.google-apps.document' OR mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
        spaces: "drive",
        fields: "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType,parents)",
        orderBy: "createdTime desc",
        pageSize: 50
      });

      const files = response.data.files || [];
      console.log(`Found ${files.length} potential transcript files`);

      if (files.length === 0) {
        console.log("No transcript files found");
        return null;
      }

      // 会議ファイル情報を取得（スコアリング用）
      let meetingFile = null;
      try {
        const meetingResponse = await this.drive.files.get({
          fileId: meetingId,
          fields: "id,name,createdTime,parents,mimeType",
        });
        meetingFile = meetingResponse.data;
        console.log(`Meeting file: ${meetingFile.name}`);
      } catch (error) {
        console.log(`Meeting file not accessible: ${meetingId}`);
      }

      // スコアベースで最適なファイルを選択
      const bestFile = this.selectBestTranscriptFile(files, meetingFile);
      
      if (!bestFile) {
        console.log("No suitable transcript file found");
        return null;
      }

      console.log(`Selected transcript: ${bestFile.name} (score-based)`);

      // コンテンツを取得
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
      throw new Error(
        `Failed to fetch transcript: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private selectBestTranscriptFile(files: any[], meetingFile: any): any | null {
    if (files.length === 0) return null;

    // 各ファイルにスコアを付与
    const scoredFiles = files.map(file => ({
      file,
      score: this.calculateRelevanceScore(file, meetingFile)
    }));

    // スコアの高い順にソート
    scoredFiles.sort((a, b) => b.score - a.score);
    
    // デバッグ: 上位5件のスコアを表示
    console.log("Top transcript candidates:");
    scoredFiles.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.file.name} (score: ${item.score})`);
    });

    return scoredFiles[0].file;
  }

  private calculateRelevanceScore(file: any, meetingFile: any): number {
    let score = 0;
    const fileName = (file.name || '').toLowerCase();
    
    // ファイル名による加点
    if (fileName.includes('transcript')) score += 10;
    if (fileName.includes('文字起こし')) score += 10;
    if (fileName.includes('meeting')) score += 5;
    
    // MIMEタイプによる加点
    if (file.mimeType === 'application/vnd.google-apps.document') score += 3;
    if (file.mimeType === 'text/plain') score += 2;
    
    // 作成日時による加点（新しいほど高得点、10日以内）
    if (file.createdTime) {
      const daysSinceCreation = (Date.now() - new Date(file.createdTime).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - daysSinceCreation);
    }

    // 会議ファイルとの関連性
    if (meetingFile) {
      // 同じフォルダにある場合は大幅加点
      if (file.parents && meetingFile.parents && 
          file.parents.some((p: string) => meetingFile.parents.includes(p))) {
        score += 15;
      }

      // 会議ファイル名との類似性
      if (meetingFile.name) {
        const meetingBaseName = this.extractBaseName(meetingFile.name);
        if (meetingBaseName && fileName.includes(meetingBaseName.toLowerCase())) {
          score += 8;
        }
      }

      // 作成日時の近さ（同日なら加点）
      if (file.createdTime && meetingFile.createdTime) {
        const fileDate = new Date(file.createdTime).toDateString();
        const meetingDate = new Date(meetingFile.createdTime).toDateString();
        if (fileDate === meetingDate) {
          score += 5;
        }
      }
    }
    
    return score;
  }

  private async fetchFileContent(file: any): Promise<string> {
    try {
      console.log(`Fetching content for: ${file.name} (${file.mimeType})`);
      
      let content = "";
      
      if (file.mimeType === "application/vnd.google-apps.document") {
        // Google Docs の場合は export で取得
        const exportResponse = await this.drive.files.export({
          fileId: file.id!,
          mimeType: "text/plain",
        });
        content = exportResponse.data as string;
      } else {
        // テキストファイルの場合は直接取得
        const fileResponse = await this.drive.files.get({
          fileId: file.id!,
          alt: "media",
        });
        content = fileResponse.data as string;
      }
      
      console.log(`Content fetched: ${content.length} characters`);
      if (content && content.length > 0) {
        console.log(`Preview: ${content.substring(0, 100)}...`);
      }
      
      return content;
    } catch (error) {
      console.error(`Failed to fetch content for ${file.name}:`, error);
      return "";
    }
  }

  async getAllTranscripts(meetingId: string): Promise<Transcript[]> {
    try {
      console.log(`=== getAllTranscripts for meeting: ${meetingId} ===`);

      // まず会議ファイルの情報を取得
      let meetingFile = null;
      try {
        const meetingResponse = await this.drive.files.get({
          fileId: meetingId,
          fields: "id,name,createdTime,parents,mimeType",
        });
        meetingFile = meetingResponse.data;
        console.log(`Meeting file found:`, {
          id: meetingFile.id,
          name: meetingFile.name,
          mimeType: meetingFile.mimeType,
          parents: meetingFile.parents,
          createdTime: meetingFile.createdTime,
        });
      } catch (error) {
        console.log(`Meeting file not found: ${meetingId}`, error);
      }

      let allFiles: Array<{
        id?: string | null;
        name?: string | null;
        createdTime?: string | null;
        modifiedTime?: string | null;
        size?: string | null;
        webViewLink?: string | null;
        mimeType?: string | null;
      }> = [];

      // 戦略1: 会議ファイルと同じフォルダ内で文字起こしファイルを検索
      if (
        meetingFile &&
        meetingFile.parents &&
        meetingFile.parents.length > 0
      ) {
        const parentFolder = meetingFile.parents[0];

        const folderResponse = await this.drive.files.list({
          q: `'${parentFolder}' in parents and (name contains 'transcript' or name contains '文字起こし' or name contains 'Transcript' or mimeType='text/plain' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
          spaces: "drive",
          fields:
            "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
          orderBy: "createdTime desc",
          pageSize: 20,
        });

        allFiles = allFiles.concat(folderResponse.data.files || []);
      }

      // 戦略2: 会議ファイル名に基づく類似名検索
      if (meetingFile) {
        const meetingBaseName = this.extractBaseName(meetingFile.name || "");

        const nameResponse = await this.drive.files.list({
          q: `(name contains '${meetingBaseName}' or name contains 'transcript' or name contains '文字起こし') and (mimeType='text/plain' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
          spaces: "drive",
          fields:
            "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
          orderBy: "createdTime desc",
          pageSize: 20,
        });

        allFiles = allFiles.concat(nameResponse.data.files || []);
      }

      // 戦略3: フォールバック - 全体検索
      if (allFiles.length === 0) {
        console.log(
          "No files found in folder/name search, trying global search"
        );
        const globalResponse = await this.drive.files.list({
          q: `(name contains 'transcript' or name contains '文字起こし' or name contains 'Transcript') and (mimeType='text/plain' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
          spaces: "drive",
          fields:
            "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
          orderBy: "createdTime desc",
          pageSize: 20,
        });

        allFiles = globalResponse.data.files || [];
        console.log(`Global search found ${allFiles.length} files`);
      }

      // 戦略4: より広範囲な検索（mimeTypeの制限を緩和）
      if (allFiles.length === 0) {
        console.log("No files found in global search, trying broader search");
        const broadResponse = await this.drive.files.list({
          q: `name contains 'transcript' or name contains '文字起こし' or name contains 'Transcript' or name contains 'Meeting' or name contains 'meet'`,
          spaces: "drive",
          fields:
            "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
          orderBy: "createdTime desc",
          pageSize: 50,
        });

        const broadFiles = broadResponse.data.files || [];
        console.log(`Broad search found ${broadFiles.length} files`);

        // 文字起こしらしいファイルをフィルタリング
        allFiles = broadFiles.filter(
          (file) =>
            file.name &&
            (file.name.toLowerCase().includes("transcript") ||
              file.name.includes("文字起こし") ||
              (file.name.toLowerCase().includes("meeting") &&
                (file.mimeType === "text/plain" ||
                  file.mimeType === "application/vnd.google-apps.document" ||
                  file.mimeType ===
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document")))
        );
        console.log(`Filtered to ${allFiles.length} transcript-like files`);
      }

      // 重複を除去し、会議ファイルの作成日時に近い順にソート
      const uniqueFiles = allFiles.filter(
        (file, index, self) => self.findIndex((f) => f.id === file.id) === index
      );

      if (meetingFile && meetingFile.createdTime) {
        const meetingTime = new Date(meetingFile.createdTime).getTime();
        uniqueFiles.sort((a, b) => {
          const aTime = a.createdTime ? new Date(a.createdTime).getTime() : 0;
          const bTime = b.createdTime ? new Date(b.createdTime).getTime() : 0;
          return Math.abs(aTime - meetingTime) - Math.abs(bTime - meetingTime);
        });
      }

      const results: Transcript[] = [];
      for (const [index, file] of uniqueFiles.slice(0, 10).entries()) {
        // 最大10件に制限
        let content = undefined;

        // 最初のファイルのコンテンツを取得
        if (index === 0 && file.id) {
          try {
            console.log(`Fetching content for first transcript: ${file.name}`);
            if (file.mimeType === "application/vnd.google-apps.document") {
              const exportResponse = await this.drive.files.export({
                fileId: file.id,
                mimeType: "text/plain",
              });
              content = exportResponse.data as string;
            } else {
              const fileResponse = await this.drive.files.get({
                fileId: file.id,
                alt: "media",
              });
              content = fileResponse.data as string;
            }
            console.log(`Content fetched: ${content?.length || 0} characters`);
          } catch (contentError) {
            console.error(
              `Failed to fetch content for ${file.name}:`,
              contentError
            );
          }
        }

        results.push({
          id: file.id || "",
          name: file.name || "",
          createdTime: file.createdTime || "",
          modifiedTime: file.modifiedTime || undefined,
          size: parseInt(file.size || "0"),
          webViewLink: file.webViewLink || undefined,
          downloadLink: `https://drive.google.com/uc?id=${file.id}`,
          content: content,
        });
      }

      console.log(`Found ${results.length} transcript files for meeting:`);
      results.forEach((result, index) => {
        console.log(
          `  ${index + 1}. ${result.name} (${result.id}) - ${
            result.createdTime
          }`
        );
      });

      return results;
    } catch (error) {
      console.error("Error fetching all transcripts:", error);
      throw new Error(
        `Failed to fetch transcripts: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // 文字起こしテキストを解析してエントリに分割
  parseTranscriptContent(content: string): TranscriptEntry[] {
    if (!content) return [];

    const lines = content.split("\n").filter((line) => line.trim());
    const entries: TranscriptEntry[] = [];

    for (const line of lines) {
      // タイムスタンプのパターンを探す
      const timestampMatch = line.match(
        /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.+)$/
      );

      if (timestampMatch) {
        entries.push({
          text: timestampMatch[2].trim(),
          timestamp: timestampMatch[1],
        });
      } else if (line.trim()) {
        entries.push({
          text: line.trim(),
        });
      }
    }

    return entries;
  }
}
