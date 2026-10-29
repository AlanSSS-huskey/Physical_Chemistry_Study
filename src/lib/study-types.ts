export type StudyLocale = "zh" | "en";
export type StudyTheme = "system" | "light" | "sepia" | "dark";
export type StudyPreferences = {
  fontSize: number;
  lineHeight: number;
  theme: StudyTheme;
  revision: number;
};
export type StudyPosition = {
  anchor: string | null;
  progress: number;
  revision: number;
};
export type StudyNote = { body: string; revision: number };
export const defaultStudyPreferences: StudyPreferences = {
  fontSize: 18,
  lineHeight: 1.8,
  theme: "system",
  revision: 0,
};
