'use client';

// Root State Machine In-Page NETRI Exam Web
// Mengelola alur Login -> ExamSession -> Result tanpa reload dokumen agar Fullscreen Lock tetap terjaga

import { useState } from 'react';
import type { ActiveExamSession } from '@/contracts/exam';
import { LoginView } from '@/features/auth/LoginView';
import { ExamSessionView } from '@/features/exam-session/ExamSessionView';
import { ResultView } from '@/features/result/ResultView';

type AppStage =
  | { kind: 'login' }
  | { kind: 'exam'; session: ActiveExamSession }
  | { kind: 'result'; session: ActiveExamSession; strikeCount: number; finishedAtIso: string };

export default function HomePage() {
  const [stage, setStage] = useState<AppStage>({ kind: 'login' });

  if (stage.kind === 'exam') {
    return (
      <ExamSessionView
        session={stage.session}
        onCompleted={(strikeCount) =>
          setStage({
            kind: 'result',
            session: stage.session,
            strikeCount,
            finishedAtIso: new Date().toISOString(),
          })
        }
        onEmergencyExited={() => setStage({ kind: 'login' })}
      />
    );
  }

  if (stage.kind === 'result') {
    return (
      <ResultView
        session={stage.session}
        strikeCount={stage.strikeCount}
        finishedAtIso={stage.finishedAtIso}
        onReturnHome={() => setStage({ kind: 'login' })}
      />
    );
  }

  return (
    <LoginView
      onStartExam={(session) => setStage({ kind: 'exam', session })}
    />
  );
}
