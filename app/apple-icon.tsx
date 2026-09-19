import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#040D12',
        }}
      >
        <svg width="130" height="130" viewBox="0 0 64 64">
          <circle cx="32" cy="28" r="15" fill="none" stroke="#2FD3E1" strokeWidth="4" />
          <circle cx="26" cy="23" r="2.6" fill="#2FD3E1" />
          <circle cx="38" cy="23" r="2.6" fill="#2FD3E1" />
          <circle cx="32" cy="30" r="2.6" fill="#2FD3E1" />
          <rect x="29.5" y="42" width="5" height="14" rx="2.5" fill="#2FD3E1" />
        </svg>
      </div>
    ),
    size,
  );
}
