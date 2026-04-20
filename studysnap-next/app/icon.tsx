import { ImageResponse } from 'next/og';
import { StudySnapLogo } from '@/components/brand/StudySnapLogo';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
        <StudySnapLogo size={24} color="#10b981" cutoutColor="#0a0a0a" />
      </div>
    ),
    { ...size },
  );
}
