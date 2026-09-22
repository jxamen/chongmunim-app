/**
 * 사진 올리기 — `@jcurve/ocr` 가 만든 폼을 **Expo 57 에서 실제로 나가는 모양**으로 다시 싼다.
 *
 * 패키지(1.0.0)는 RN 방식 `{ uri, name, type }` 을 폼에 넣는다. SDK 57 의 전역 fetch(expo/fetch)는 그 모양을
 * 받지 못하고 **요청을 보내기도 전에** `Unsupported FormDataPart implementation` 으로 던진다 — 화면에는 「network」로만
 * 보인다(영테크 `docs/RECEIPT_UPLOAD_DIAGNOSIS.md`, 같은 수정: 영테크 `src/receipt/client.ts`).
 * 그래서 네이티브는 `expo-file-system` 의 `File`(바이트를 읽는 방법을 가진 파일)로 바꿔 넣는다.
 *
 * 웹 미리보기의 폼은 브라우저 것이라 `{uri…}` 가 글자로 뭉개진다 — 사진을 고른 쪽이 남겨 둔 파일(`holdWebFile`)로 바꾼다.
 */
import { Platform } from 'react-native';
import { ApiError } from './api';

type Part = { fieldName: string; string?: string; uri?: string; name?: string; type?: string };

let webFile: Blob | null = null;
/** 웹 미리보기 — 고른 파일을 잠깐 들고 있다가 다음 올리기에 쓴다 */
export const holdWebFile = (f: Blob | null): void => { webFile = f; };

export async function toSendable(form: FormData): Promise<FormData> {
  if (Platform.OS === 'web') {
    if (!webFile) throw new ApiError('receipt_file_missing', 0);
    const out = new FormData();
    out.append('image', webFile, 'receipt.jpg');
    out.append('kind', 'receipt');
    webFile = null;

    return out;
  }

  const parts: Part[] = typeof (form as unknown as { getParts?: () => Part[] }).getParts === 'function'
    ? (form as unknown as { getParts: () => Part[] }).getParts()
    : [];
  const out = new FormData();
  for (const p of parts) {
    if (p.uri) {
      const { File } = await import('expo-file-system');
      const file = new File(p.uri);
      if (!file.exists || file.size === 0) throw new ApiError('receipt_file_missing', 0);
      out.append(p.fieldName, file as unknown as Blob);
    } else {
      out.append(p.fieldName, String(p.string ?? ''));
    }
  }

  return out;
}
