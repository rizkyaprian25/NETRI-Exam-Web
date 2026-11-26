'use client';

// Root State Machine In-Page NETRI Exam Web
// Mengelola alur Login -> ExamSession -> Result serta memulihkan sesi & Hard Lock jika browser di-refresh (F5)

import { useEffect, useState } from 'react';
import type {
  ActiveExamSession,
  PersistedExamState,
  ViolationLogEntry,
} from '@/contracts/exam';
import { LoginView } from '@/features/auth/LoginView';
import { ExamSessionView } from '@/features/exam-session/ExamSessionView';
import {
  clearPersistedExamState,
  loadPersistedExamStateAsync,
} from '@/features/lockdown/sessionPersistence';
import { ResultView } from '@/features/result/ResultView';

type AppStage =
  | { kind: 'login' }
  | { kind: 'exam'; session: ActiveExamSession; initialPersisted?: PersistedExamState }
  | {
      kind: 'result';
      session: ActiveExamSession;
      strikeCount: number;
      totalAwaySeconds: number;
      violationLogs: ViolationLogEntry[];
      finishedAtIso: string;
    };

export default function HomePage() {
  const [stage, setStage] = useState<AppStage>({ kind: 'login' });

  // Anti-Refresh & Anti-Clear-Storage: pulihkan sesi aktif atau Hard Lock dari localStorage / IndexedDB
  useEffect(() => {
    let cancelled = false;
    void loadPersistedExamStateAsync().then((persisted) => {
      if (!cancelled && persisted) {
        setStage({
          kind: 'exam',
          session: persisted.session,
          initialPersisted: persisted,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (stage.kind === 'exam') {
    return (
      <ExamSessionView
        session={stage.session}
        initialPersisted={stage.initialPersisted}
        onCompleted={({ strikeCount, totalAwaySeconds, violationLogs }) => {
          clearPersistedExamState();
          setStage({
            kind: 'result',
            session: stage.session,
            strikeCount,
            totalAwaySeconds,
            violationLogs,
            finishedAtIso: new Date().toISOString(),
          });
        }}
        onEmergencyExited={() => {
          clearPersistedExamState();
          setStage({ kind: 'login' });
        }}
      />
    );
  }

  if (stage.kind === 'result') {
    return (
      <ResultView
        session={stage.session}
        strikeCount={stage.strikeCount}
        totalAwaySeconds={stage.totalAwaySeconds}
        violationLogs={stage.violationLogs}
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
