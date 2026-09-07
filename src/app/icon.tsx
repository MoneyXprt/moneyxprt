import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

/** Temporary MoneyXprt app icon until the final brand mark is ready. */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: '#0d1f15',
        color: '#d4a843',
        display: 'flex',
        fontFamily: 'Arial',
        fontSize: 42,
        fontWeight: 700,
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      M
    </div>,
    size,
  );
}
