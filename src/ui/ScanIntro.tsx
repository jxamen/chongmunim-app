/**
 * 안드로이드 첫 스캔 안내 — 영테크 `ReceiptScannerIntro` 와 같은 글과 그림(2026-09-22 태훈님 「영테크처럼 안내」).
 *
 * 안드로이드 스캐너는 구글 ML Kit 이라 **처음 한 번 Google Play 서비스가 모듈을 받는다** — 낯선 다운로드 화면이 뜨면
 * 앱이 이상한 걸 받는 줄 알고 닫아 버린다. 모듈은 기기에 받으니 이 안내도 기기마다 한 번(`cm.scanIntro`).
 * 영테크와 달리 「알겠어요」를 누르면 바로 스캐너를 연다(한 번 더 누르게 하지 않는다).
 */
import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Btn, Text, Txt } from './kit';
import { Mascot } from './Mascot';
import { F, R, useT } from './theme';

export function ScanIntro({ open, onContinue, onClose }: { open: boolean; onContinue: () => void; onClose: () => void }) {
  const T = useT();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 40, 380);
  const imageWidth = cardWidth - 58;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.dim}>
        <View style={[st.card, { width: cardWidth, backgroundColor: T.white }]} accessibilityViewIsModal>
          <ScrollView bounces={false} contentContainerStyle={{ padding: 20, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Mascot mood="receipt" size={72} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontSize: 20, lineHeight: 27, fontWeight: '800', color: T.ink }}>{'처음 한 번,\n준비가 필요해요!'}</Text>
                <Txt size="tiny" tone="sub">영수증을 잘 읽기 위한 준비예요</Txt>
              </View>
            </View>
            <Txt size="small">이 화면이 나와도 놀라지 마세요.</Txt>
            <View style={[st.example, { borderColor: T.line }]}>
              <Image source={require('../../assets/scanner-guide.png')} style={{ width: imageWidth, height: imageWidth / 3 }} resizeMode="contain"
                accessibilityLabel="화면 예시: Google Play 서비스에 업데이트 다운로드 중" />
              <Txt size="tiny" tone="sub" style={{ textAlign: 'center' }}>다운로드 화면 예시</Txt>
            </View>
            <View style={{ backgroundColor: T.tint, padding: 12, borderRadius: 12, gap: 6 }}>
              <Text style={{ fontSize: F.body, fontWeight: '700', color: T.deep }}>Google 공식 스캔 기능이에요</Text>
              <Txt size="small">영수증 테두리 인식과 보정에 필요한 다운로드예요. 안심하고 잠시 기다려 주세요.</Txt>
            </View>
            <Txt size="tiny" tone="sub">인터넷 연결이 필요해요. 준비 시간은 통신 환경에 따라 달라질 수 있어요.</Txt>
            <Btn label="알겠어요 · 영수증 올리기" onPress={onContinue} />
            <Pressable accessibilityRole="button" onPress={onClose} style={{ alignItems: 'center', paddingVertical: 5 }}>
              <Txt size="small" tone="sub">나중에</Txt>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(10,18,15,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { maxHeight: '90%', borderRadius: 24, overflow: 'hidden' },
  example: { borderWidth: 1, borderRadius: R.card - 4, overflow: 'hidden', padding: 8, gap: 2, alignItems: 'center' },
});
