/**
 * 영수증 읽기 — `@jcurve/ocr` 에 앱의 HTTP 만 끼워 넣는다(패키지 README §3 그대로).
 *
 * 사진 준비(`preparePhoto` — 긴 변 1600, 방향을 픽셀에 굽기) · 맡기기 · 묻기 · 판정 문구는 패키지 것이다.
 * 앱이 하는 일은 둘뿐이다: 인증 헤더가 붙은 호출을 넘기고, 올리는 폼을 Expo 57 모양으로 다시 싸기(`upload.ts`).
 *
 * 읽은 결과는 **총무님 전용 표로 옮긴다**(`POST cm/g/{gid}/receipts {ocrJobId}`) — 공용 작업표의 사진은 임시다.
 */
import { createOcr } from '@jcurve/ocr';
import { api } from './api';
import { toSendable } from './upload';

export const ocr = createOcr({
  post: async (path, form) => api.upload(path, await toSendable(form)),
  get: (path) => api.get(path),
});

export { ocrMessage, preparePhoto, verdictMessage, type OcrResult } from '@jcurve/ocr';
