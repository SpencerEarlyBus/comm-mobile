import * as FileSystem from 'expo-file-system';

export async function readAsBase64(uri: string) {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}