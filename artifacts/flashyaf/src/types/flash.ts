export type Stage = "STARTED" | "PEAK" | "COOLING_DOWN" | "FLASH_ENDED" | "BACK_TO_NORMAL";

export interface StageEntry {
  stage: Stage;
  timestamp: number;
}

export interface Flash {
  id?: string;
  userId: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  stages: StageEntry[];
  peakRating?: number;
  notes?: string;
  bodyAreas?: string[];
  audioNoteUrl?: string;
}
