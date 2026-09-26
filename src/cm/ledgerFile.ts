/**
 * 쓰던 장부 파일 고르기 · 올릴 폼 만들기 — 엑셀(xlsx) · CSV · PDF.
 *
 * 형식 거르기는 **확장자**로 한다. 안드로이드 파일 앱마다 CSV 를 text/plain · octet-stream 으로 알려 주어 MIME 으로 거르면
 * 멀쩡한 파일이 안 보인다. 그래서 고르기는 모두 열어 두고, 고른 뒤 이름을 본다(서버도 확장자 + 파일 머리로 다시 본다).
 *
 * 폼은 `upload.ts` 와 같은 이유로 손으로 싼다 — Expo 57 네이티브 fetch 는 `{uri,name,type}` 을 못 받으니 `expo-file-system` 의
 * `File` 로, 웹은 브라우저가 준 `File` 그대로.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ApiError } from '../api';
import { ledgerExt, type LedgerExt } from './importRows';

export type PickedLedger = { name: string; ext: LedgerExt; size: number | null; form: () => Promise<FormData> };

/** 고르기 — 그만두면 null. 받지 않는 형식은 오류 코드로 던진다(화면이 문구로 바꾼다) */
export async function pickLedgerFile(): Promise<PickedLedger | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const ext = ledgerExt(a.name);
  if (ext === 'xls') throw new ApiError('old_excel', 0);
  if (!ext) throw new ApiError('bad_file', 0);

  return { name: a.name, ext, size: typeof a.size === 'number' ? a.size : null, form: () => formFor(a) };
}

async function formFor(a: DocumentPicker.DocumentPickerAsset): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    if (!a.file) throw new ApiError('file_missing', 0);
    form.append('file', a.file, a.name);

    return form;
  }
  const { File, Paths } = await import('expo-file-system');
  let file = new File(a.uri);
  if (!file.exists || file.size === 0) throw new ApiError('file_missing', 0);
  /*
   | 서버는 올라온 이름의 확장자로 형식을 보고, 그 이름을 화면 제목으로 쓴다 — 캐시 사본 이름이 원래 이름과 다르면
   | 원래 이름으로 한 번 더 옮겨 둔다. 아이폰 캐시 사본은 확장자는 맞고 이름이 UUID 라(「15D30376-….xlsx」, 2026-09-26 앱빌드)
   | 확장자만 보면 UUID 가 그대로 올라갔다.
   */
  if (file.name !== a.name) {
    const named = new File(Paths.cache, a.name);
    if (named.exists) named.delete();
    await file.copy(named);
    file = named;
  }
  form.append('file', file as unknown as Blob);

  return form;
}
