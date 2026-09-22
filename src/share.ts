/**
 * 밖으로 내보내기 — 엑셀(CSV) · 결산서 PDF · 정산서 글 · 계좌번호 복사.
 *
 * 파일은 기기 캐시에 만들고 공유 창으로 넘긴다(카톡·메일·드라이브 어디든 사람이 고른다).
 * 웹 미리보기는 브라우저 방식으로 — CSV 는 내려받기, PDF 는 인쇄 창, 글은 클립보드.
 */
import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export async function copy(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

export async function shareCsv(fileName: string, csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(csv);
  const Sharing = await import('expo-sharing');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: fileName, UTI: 'public.comma-separated-values-text' });
}

export async function sharePdf(html: string, title: string): Promise<void> {
  const Print = await import('expo-print');
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });

    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const Sharing = await import('expo-sharing');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
}

/** 글 공유 — 카톡 단체방에 붙이기 좋게. 웹은 클립보드로 */
export async function shareText(text: string): Promise<'shared' | 'copied'> {
  if (Platform.OS === 'web') {
    await copy(text);

    return 'copied';
  }
  await Share.share({ message: text });

  return 'shared';
}
