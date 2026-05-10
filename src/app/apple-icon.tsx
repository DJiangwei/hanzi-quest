import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#2a9a93',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <svg
        width="120"
        height="120"
        viewBox="-90 -90 180 180"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 -74 L18 -18 L74 0 L18 18 L0 74 L-18 18 L-74 0 L-18 -18 Z"
          fill="#f5c537"
        />
        <circle r="8" fill="#fdf8ec" />
      </svg>
    </div>,
    { ...size },
  );
}
