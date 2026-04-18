import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'StudySnap — AI study packs from any PDF';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#09090b',
          padding: '80px',
          backgroundImage:
            'radial-gradient(circle at 20% 0%, rgba(16, 185, 129, 0.12), transparent 55%), radial-gradient(circle at 100% 100%, rgba(16, 185, 129, 0.08), transparent 50%)',
        }}
      >
        {/* top: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 9999,
              background: '#10b981',
              boxShadow: '0 0 20px 4px rgba(16, 185, 129, 0.6)',
            }}
          />
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.55)',
              fontFamily: 'monospace',
              fontSize: 26,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            StudySnap
          </div>
        </div>

        {/* middle: headline + tagline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              color: 'white',
              fontSize: 110,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: '-0.04em',
            }}
          >
            Study at the
          </div>
          <div
            style={{
              color: 'white',
              fontSize: 110,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: '-0.04em',
              display: 'flex',
            }}
          >
            speed of{' '}
            <span style={{ color: '#10b981', marginLeft: 26 }}>AI.</span>
          </div>
          <div
            style={{
              marginTop: 36,
              color: 'rgba(255, 255, 255, 0.58)',
              fontSize: 30,
              lineHeight: 1.4,
              maxWidth: 960,
            }}
          >
            Upload a PDF, get structured notes, flashcards, quizzes, and a chat tutor.
          </div>
        </div>

        {/* bottom: tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              color: '#10b981',
              fontFamily: 'monospace',
              fontSize: 20,
              letterSpacing: '0.15em',
            }}
          >
            // free for students
          </div>
        </div>
      </div>
    ),
    size,
  );
}
