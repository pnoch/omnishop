import { Platform } from "react-native";
// Classic FS API moved to /legacy in expo-file-system 19; the root-level
// functions are deprecated stubs that throw at runtime.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { MAX_BACKUP_BYTES } from "./backup";

function backupFileName(): string {
  return `omnishop-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export async function exportBackupFile(json: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = backupFileName();
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return true;
    }
    const uri = `${FileSystem.cacheDirectory}${backupFileName()}`;
    await FileSystem.writeAsStringAsync(uri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      dialogTitle: "Export Backup",
    });
    return true;
  } catch {
    return false;
  }
}

export async function pickBackupFile(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return await new Promise<string | null>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          if (file.size > MAX_BACKUP_BYTES) return resolve(null);
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === "string" ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsText(file);
        };
        input.oncancel = () => resolve(null);
        input.click();
      });
    }
    // Some Android providers report backups as octet-stream/text — accept broadly.
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/plain", "application/octet-stream"],
    });
    if (result.canceled || result.assets.length === 0) return null;
    const asset = result.assets[0];
    if (typeof asset.size === "number" && asset.size > MAX_BACKUP_BYTES) {
      return null;
    }
    return await FileSystem.readAsStringAsync(asset.uri);
  } catch {
    return null;
  }
}
