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
      console.log(`Fetching transcript files for meeting: ${meetingId}`);

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

      // 複数の戦略で文字起こしファイルを検索
      let transcriptFile = null;

      // 戦略1: 会議ファイルと同じフォルダ内で文字起こしファイルを検索
      if (
        meetingFile &&
        meetingFile.parents &&
        meetingFile.parents.length > 0
      ) {
        const parentFolder = meetingFile.parents[0];
        console.log(`Searching in parent folder: ${parentFolder}`);

        const folderResponse = await this.drive.files.list({
          q: `'${parentFolder}' in parents and (name contains 'transcript' or name contains '文字起こし' or name contains 'Transcript' or mimeType='text/plain' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
          spaces: "drive",
          fields:
            "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
          orderBy: "createdTime desc",
          pageSize: 10,
        });

        const folderFiles = folderResponse.data.files || [];
        console.log(`Found ${folderFiles.length} files in parent folder`);

        if (folderFiles.length > 0) {
          transcriptFile = folderFiles[0];
        }
      }

      // 戦略2: 会議ファイル名に基づく類似名検索
      if (!transcriptFile && meetingFile) {
        const meetingBaseName = this.extractBaseName(meetingFile.name || "");
        console.log(`Searching by meeting base name: ${meetingBaseName}`);

        const nameResponse = await this.drive.files.list({
          q: `(name contains '${meetingBaseName}' or name contains 'transcript' or name contains '文字起こし') and (mimeType='text/plain' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
          spaces: "drive",
          fields:
            "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
          orderBy: "createdTime desc",
          pageSize: 10,
        });

        const nameFiles = nameResponse.data.files || [];
        console.log(`Found ${nameFiles.length} files by name search`);

        // 会議ファイルの作成日時に近いファイルを優先
        if (nameFiles.length > 0 && meetingFile.createdTime) {
          const meetingTime = new Date(meetingFile.createdTime).getTime();
          nameFiles.sort((a, b) => {
            const aTime = a.createdTime ? new Date(a.createdTime).getTime() : 0;
            const bTime = b.createdTime ? new Date(b.createdTime).getTime() : 0;
            return (
              Math.abs(aTime - meetingTime) - Math.abs(bTime - meetingTime)
            );
          });
          transcriptFile = nameFiles[0];
        }
      }

      // 戦略3: フォールバック - 全体検索（従来の方法）
      if (!transcriptFile) {
        console.log("Falling back to global search");
        const globalResponse = await this.drive.files.list({
          q: `(name contains 'transcript' or name contains '文字起こし' or name contains 'Transcript') and (mimeType='text/plain' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
          spaces: "drive",
          fields:
            "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
          orderBy: "createdTime desc",
          pageSize: 20,
        });

        const globalFiles = globalResponse.data.files || [];
        console.log(`Found ${globalFiles.length} transcript files globally:`);
        globalFiles.forEach((file, index) => {
          console.log(
            `  ${index + 1}. ${file.name} (${file.mimeType}) - ${
              file.createdTime
            }`
          );
        });

        if (globalFiles.length > 0) {
          transcriptFile = globalFiles[0];
        }
      }

      // 戦略4: より広範囲な検索（mimeTypeの制限を緩和）
      if (!transcriptFile) {
        console.log("Trying broader search without mimeType restrictions");
        const broadResponse = await this.drive.files.list({
          q: `name contains 'transcript' or name contains '文字起こし' or name contains 'Transcript' or name contains 'Meeting' or name contains 'meet'`,
          spaces: "drive",
          fields:
            "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
          orderBy: "createdTime desc",
          pageSize: 50,
        });

        const broadFiles = broadResponse.data.files || [];
        console.log(`Found ${broadFiles.length} files in broad search:`);
        broadFiles.forEach((file, index) => {
          console.log(
            `  ${index + 1}. ${file.name} (${file.mimeType}) - ${
              file.createdTime
            }`
          );
        });

        // 文字起こしらしいファイルを優先的に選択
        const transcriptLikeFiles = broadFiles.filter(
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

        if (transcriptLikeFiles.length > 0) {
          transcriptFile = transcriptLikeFiles[0];
          console.log(`Selected transcript-like file: ${transcriptFile.name}`);
        }
      }

      if (!transcriptFile) {
        console.log("No transcript file found after all search strategies");
        return null;
      }

      console.log(`Selected transcript file:`, {
        id: transcriptFile.id,
        name: transcriptFile.name,
        mimeType: transcriptFile.mimeType,
        size: transcriptFile.size,
        createdTime: transcriptFile.createdTime,
      });

      let content = "";
      try {
        // ファイルの内容を取得
        console.log(
          `Attempting to fetch content for file type: ${transcriptFile.mimeType}`
        );

        if (
          transcriptFile.mimeType === "application/vnd.google-apps.document"
        ) {
          // Google Docs の場合は export で取得
          console.log("Exporting Google Docs as plain text");
          const exportResponse = await this.drive.files.export({
            fileId: transcriptFile.id!,
            mimeType: "text/plain",
          });
          content = exportResponse.data as string;
          console.log(`Exported content length: ${content.length} characters`);
        } else {
          // テキストファイルの場合は直接取得
          console.log("Fetching file content directly");
          const fileResponse = await this.drive.files.get({
            fileId: transcriptFile.id!,
            alt: "media",
          });
          content = fileResponse.data as string;
          console.log(`Fetched content length: ${content.length} characters`);
        }

        // コンテンツの最初の100文字をログに出力（デバッグ用）
        if (content) {
          console.log(`Content preview: ${content.substring(0, 100)}...`);
        }
      } catch (contentError) {
        console.error("Could not fetch file content:", contentError);
        content = "";
      }

      return {
        id: transcriptFile.id || "",
        name: transcriptFile.name || "",
        createdTime: transcriptFile.createdTime || "",
        modifiedTime: transcriptFile.modifiedTime || undefined,
        size: parseInt(transcriptFile.size || "0"),
        webViewLink: transcriptFile.webViewLink || undefined,
        downloadLink: `https://drive.google.com/uc?id=${transcriptFile.id}`,
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
