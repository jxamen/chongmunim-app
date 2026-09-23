/**
 * 영수증 올리기 — **「영수증 분석」 입구 하나로**(`POST receipts`, 2026-09-24 대표님 「모든 영수증은 입구를 1개로 통일」).
 * 전에는 공용 판독(`@jcurve/ocr` 의 `ocr/jobs`)에 올렸다. 판정(흐림 · 이미 올린 사진)은 입구가 하고, 받아들인 장은 서버가
 * 읽은 뒤 장부 영수증으로 옮긴다(`cm/g/{gid}/receipts/jobs` 에 `receiptId` 로 맡김, `receiptQueue.ts`).
 *
 * 사진은 긴 변 1600 으로 줄이고 방향을 픽셀에 굽는다(`@jcurve/ocr` 의 `preparePhoto` — 사진 준비만 빌려 쓴다).
 * 폼은 **Expo 57 에서 실제로 나가는 모양**으로 싼다 — RN 식 `{ uri, name, type }` 은 SDK 57 전역 fetch 가 보내기도 전에
 * `Unsupported FormDataPart implementation` 으로 던진다(영테크 `src/receipt/client.ts` 와 같은 수정). 네이티브는
 * `expo-file-system` 의 `File`, 웹 미리보기는 고른 쪽이 남겨 둔 파일(`holdWebFile`).
 */
import { Platform } from 'react-native';
import { preparePhoto } from '@jcurve/ocr';
import { api, ApiError } from './api';
import { parseSubmitted, type Submitted } from './cm/receiptEntry';

let webFile: Blob | null = null;
/** 웹 미리보기 — 고른 파일을 잠깐 들고 있다가 다음 올리기에 쓴다 */
export const holdWebFile = (f: Blob | null): void => { webFile = f; };

/** 한 장 올린다 — `rejected`(품질 반려)도 정상 응답이다. 오류는 `ApiError`(코드 · 본문) */
export async function submitReceipt(uri: string, idempotencyKey: string): Promise<Submitted> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    if (!webFile) throw new ApiError('receipt_file_missing', 0);
    form.append('image', webFile, 'receipt.jpg');
    webFile = null;
  } else {
    const photo = await preparePhoto({ uri });
    const { File } = await import('expo-file-system');
    const file = new File(photo.uri);
    if (!file.exists || file.size === 0) throw new ApiError('receipt_file_missing', 0);
    form.append('image', file as unknown as Blob);
  }
  form.append('idempotencyKey', idempotencyKey);
  const got = parseSubmitted(await api.upload<unknown>('receipts', form));
  if (!got) throw new ApiError('bad_response', 0);

  return got;
}
