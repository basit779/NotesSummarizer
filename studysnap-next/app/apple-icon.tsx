import { ImageResponse } from 'next/og';
import { StudySnapLogo } from '@/components/brand/StudySnapLogo';

export const runtime = 'edge';
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
          background: '#0a0a0a',
        }}
      >
        <StudySnapLogo size={116} color="#10b981" cutoutColor="#0a0a0a" />
      </div>
    ),
    { ...size },
  );
}
